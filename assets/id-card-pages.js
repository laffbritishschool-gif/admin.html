import { supabase, escapeHtml, toast, pageLoading } from './app.js';

const LOGO_URL = 'https://i.ibb.co/whtP8S5v/image.png';

function fullName(s){ return [s.first_name,s.middle_name,s.last_name].filter(Boolean).join(' '); }
function initials(s){ return [s.first_name,s.last_name].filter(Boolean).map(x=>x[0]).join('').toUpperCase() || 'ST'; }
function cardNumber(){ const d=new Date(); return `LBS-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.random().toString(36).slice(2,8).toUpperCase()}`; }
async function photoUrl(path){
  if(!path)return '';
  const value=String(path).trim();
  if(!value)return '';
  if(/^https?:\/\//i.test(value))return value;
  const clean=value.replace(/^\/+/, '').replace(/^student-passports\//i, '');
  const candidates=[clean];
  if(clean.startsWith('passports/'))candidates.push(clean.replace(/^passports\//i,''));
  if(clean.startsWith('students/'))candidates.push(clean.replace(/^students\//i,''));
  for(const candidate of candidates){
    try{
      const {data,error}=await supabase.storage.from('student-passports').createSignedUrl(candidate,3600);
      if(!error&&data?.signedUrl)return data.signedUrl;
    }catch(e){ console.warn('Passport URL could not be resolved',candidate,e); }
  }
  return '';
}

async function attachPhotoUrls(students){
  return Promise.all((students||[]).map(async s=>({...s,_photo_url:await photoUrl(s.photo_url)})));
}

async function getStudents(){
  const {data,error}=await supabase.from('students')
    .select('id,student_id,exam_number,first_name,middle_name,last_name,gender,date_of_birth,photo_url,phone,guardian_name,status')
    .order('first_name',{ascending:true});
  if(error)throw error;
  return data||[];
}

async function getCards(){
  const {data,error}=await supabase.from('id_cards')
    .select('id,student_id,card_number,expires_at,is_active,issued_at')
    .order('issued_at',{ascending:false});
  if(error)throw error;
  return data||[];
}

function cardFor(cards,id){
  return cards.find(c=>c.student_id===id&&c.is_active!==false)||cards.find(c=>c.student_id===id);
}

export async function renderIdCardsPage(){
  const host=document.querySelector('#module-content');
  if(!host)return;
  host.innerHTML=`<div class="id-page id-redesign"><section class="id-hero-redesign"><div class="id-hero-orb id-hero-orb-a"></div><div class="id-hero-orb id-hero-orb-b"></div><div class="id-hero-copy"><span class="id-hero-kicker">STUDENT SERVICES • IDENTITY MANAGEMENT</span><h1>Student ID Cards</h1><p>Create, review and manage official student identity cards from one central workspace.</p><div class="id-hero-labels"><span>STUDENT RECORDS</span><span>PASSPORT PHOTOS</span><span>PRINT READY</span></div></div><div class="id-hero-visual"><div class="hero-id-mini"><div class="hero-id-mini-top"><span>LBS</span><small>IDENTITY CARD</small></div><div class="hero-id-mini-body"><div class="hero-photo-placeholder">ID</div><div><i></i><i></i><i></i></div></div><div class="hero-id-mini-footer"></div></div></div><div class="hero-actions id-hero-actions"><button class="btn hero-btn-secondary" id="refresh-cards">↻ Refresh</button></div></section><section class="id-summary-section"><div class="id-summary-heading"><div><span class="section-kicker">CARD OVERVIEW</span><h2>Student ID Card Records</h2><p>Track which students already have cards and which ones still need to be generated.</p></div></div><div class="metric-grid id-card-metrics" id="id-card-metrics"></div></section><section class="id-directory panel"><div class="id-directory-head"><div><span class="section-kicker">STUDENT DIRECTORY</span><h2>Find a student</h2><p>Search by student name, student ID or examination number.</p></div></div><div class="id-toolbar-redesign"><div class="id-search-wrap"><span>⌕</span><input id="card-search" class="id-search-redesign" placeholder="Search student name, ID or exam number…"></div><select id="card-filter" class="id-filter-redesign" aria-label="Filter ID card records"><option value="ALL">All Students</option><option value="MISSING">Card Not Found</option><option value="ISSUED">Card Issued</option></select></div><div id="id-card-list" class="id-card-student-grid"><div class="inline-loading">Loading students…</div></div></section></div>`;
  let students=[];
  let cards=[];
  const draw=()=>{
    const search=(document.querySelector('#card-search')?.value||'').trim().toLowerCase();
    const filter=document.querySelector('#card-filter')?.value||'ALL';
    const issued=students.filter(s=>!!cardFor(cards,s.id)).length;
    const missing=Math.max(0,students.length-issued);
    const filtered=students.filter(s=>{const card=cardFor(cards,s.id);const text=[fullName(s),s.student_id,s.exam_number].filter(Boolean).join(' ').toLowerCase();return(!search||text.includes(search))&&(filter==='ALL'||(filter==='MISSING'?!card:!!card));});
    document.querySelector('#id-card-metrics').innerHTML=`<div class="metric-card id-overview-card overview-blue"><div class="overview-icon">ST</div><small>Total Students</small><strong>${students.length}</strong><span>Student records</span></div><div class="metric-card id-overview-card overview-gold"><div class="overview-icon">ID</div><small>Cards Issued</small><strong>${issued}</strong><span>Active records found</span></div><div class="metric-card id-overview-card overview-alert"><div class="overview-icon">!</div><small>Cards Missing</small><strong>${missing}</strong><span>Awaiting generation</span></div>`;
    document.querySelector('#id-card-list').innerHTML=filtered.length?filtered.map((s,i)=>{const card=cardFor(cards,s.id);return `<article class="id-student-card id-card-modern" style="--i:${i}"><div class="id-student-main"><div class="id-student-avatar">${s._photo_url?`<img src="${escapeHtml(s._photo_url)}" alt="${escapeHtml(fullName(s))} passport" loading="lazy" referrerpolicy="no-referrer">`:escapeHtml(initials(s))}</div><div class="id-student-copy"><span class="student-label">STUDENT</span><h3>${escapeHtml(fullName(s))}</h3><p><b>ID:</b> ${escapeHtml(s.student_id||'Not assigned')}${s.exam_number?` <span>•</span> <b>Exam:</b> ${escapeHtml(s.exam_number)}`:''}</p></div></div><div class="id-student-status">${card?`<span class="badge status-active">CARD ISSUED</span><small>${escapeHtml(card.card_number||'Card record available')}</small>`:`<span class="badge status-inactive">CARD NOT FOUND</span><small>Generate an official card</small>`}</div><div class="id-student-actions"><button class="btn btn-sm secondary view-id" data-student="${s.id}">View Card</button>${card?'':`<button class="btn btn-sm generate-id" data-student="${s.id}">Generate ID Card</button>`}</div></article>`}).join(''):`<div class="empty-state id-empty-modern"><div class="empty-art">ID</div><h3>No matching students</h3><p>Try another name, student ID or card-status filter.</p></div>`;
    host.querySelectorAll('.view-id').forEach(b=>b.onclick=()=>location.href=`id-card-details.html?student=${encodeURIComponent(b.dataset.student)}`);
    host.querySelectorAll('.generate-id').forEach(b=>b.onclick=()=>generate(b.dataset.student));
  };
  async function load(){
    pageLoading(true);
    try{students=await getStudents();students=await attachPhotoUrls(students);draw();try{cards=await getCards();}catch(cardError){console.error('ID card records could not be loaded',cardError);cards=[];toast('Student list loaded. Existing card records could not be read.','error');}draw();}
    catch(e){console.error('ID cards load failed',e);toast(e.message||'Could not load students.','error');document.querySelector('#id-card-list').innerHTML=`<div class="empty-state"><h3>Could not load students</h3><p>${escapeHtml(e.message||'Please refresh and try again.')}</p></div>`;}
    finally{pageLoading(false)}
  }
  async function generate(studentId){
    pageLoading(true);
    try{const {data:existing,error:checkError}=await supabase.from('id_cards').select('id').eq('student_id',studentId).limit(1);if(checkError)throw checkError;if(existing?.length){location.href=`id-card-details.html?student=${encodeURIComponent(studentId)}`;return;}const expires=new Date();expires.setFullYear(expires.getFullYear()+1);const {data:userData}=await supabase.auth.getUser();const {error}=await supabase.from('id_cards').insert({student_id:studentId,card_number:cardNumber(),expires_at:expires.toISOString(),is_active:true,created_by:userData?.user?.id||null});if(error)throw error;toast('Student ID card generated successfully.','success');location.href=`id-card-details.html?student=${encodeURIComponent(studentId)}`;}catch(e){console.error(e);toast(e.message||'Could not generate ID card.','error');}finally{pageLoading(false)}
  }
  document.querySelector('#refresh-cards').onclick=load;
  document.querySelector('#card-search').oninput=draw;
  document.querySelector('#card-filter').onchange=draw;
  await load();
}

export async function renderIdCardDetailsPage(){
  const host=document.querySelector('#module-content');
  const studentId=new URLSearchParams(location.search).get('student');
  if(!host)return;
  if(!studentId){host.innerHTML='<div class="panel empty-state"><h3>Student not selected</h3><a class="btn" href="id-cards.html">Back to ID Cards</a></div>';return;}
  host.innerHTML='<div class="panel inline-loading">Preparing front and back ID cards…</div>';
  pageLoading(true);
  try{
    const [{data:student,error:se},{data:cards,error:ce},{data:settings,error:sge}]=await Promise.all([
      supabase.from('students').select('*').eq('id',studentId).maybeSingle(),
      supabase.from('id_cards').select('*').eq('student_id',studentId).order('issued_at',{ascending:false}),
      supabase.from('school_settings').select('school_name,motto,logo_url,address,phone,email,website,primary_color,secondary_color').limit(1).maybeSingle()
    ]);
    if(se)throw se;if(ce)throw ce;
    if(!student)throw new Error('Student record not found.');
    let card=cards?.[0];
    if(!card){const expires=new Date();expires.setFullYear(expires.getFullYear()+1);const {data:userData}=await supabase.auth.getUser();const {data:newCard,error}=await supabase.from('id_cards').insert({student_id:student.id,card_number:cardNumber(),expires_at:expires.toISOString(),is_active:true,created_by:userData?.user?.id||null}).select('*').single();if(error)throw error;card=newCard;toast('ID card generated automatically for this student.','success');}
    const photo=await photoUrl(student.photo_url);
    const name=fullName(student);
    const schoolName=settings?.school_name||'Laff British Montessori School';
    const motto=settings?.motto||'Excellence in Education';
    const primary=settings?.primary_color||'#123d8f';
    const secondary=settings?.secondary_color||'#f4c400';
    const expiry=card.expires_at?new Date(card.expires_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
    const issued=card.issued_at?new Date(card.issued_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
    host.innerHTML=`<section class="id-details-page">
      <div class="id-print-header no-print"><div><a href="id-cards.html">← Back to ID Cards</a><span class="section-kicker">PRINT-READY ID CARD</span><h1>${escapeHtml(name)}</h1><p>Front and back student identity card • Issued ${escapeHtml(issued)}</p></div><div class="id-print-actions"><button class="btn secondary" id="print-both">Print Front & Back</button><button class="btn" id="print-front">Print Front</button><button class="btn secondary" id="delete-card">Delete Card</button></div></div>
      <div class="id-print-note no-print"><strong>Print setup:</strong><span>Use portrait/landscape settings that preserve scale. The front and back are separated below with matching dimensions for two-sided printing.</span></div>
      <div class="id-card-sheet-grid">
        <article class="print-card-shell print-front-card"><div class="print-card-label no-print">FRONT • STUDENT IDENTITY</div><div class="pro-id-card front-card" style="--card-primary:${escapeHtml(primary)};--card-secondary:${escapeHtml(secondary)}">
          <div class="pro-card-top"><div class="pro-brand"><img src="${escapeHtml(settings?.logo_url||LOGO_URL)}" alt="${escapeHtml(schoolName)}"><div><strong>${escapeHtml(schoolName)}</strong><span>${escapeHtml(motto)}</span></div></div><span class="pro-card-type">STUDENT ID</span></div>
          <div class="pro-card-body"><div class="pro-passport">${photo?`<img src="${escapeHtml(photo)}" alt="${escapeHtml(name)} passport">`:`<span>${escapeHtml(initials(student))}</span>`}</div><div class="pro-identity"><span class="pro-label">FULL NAME</span><h2>${escapeHtml(name)}</h2><div class="pro-data-grid"><div><span>STUDENT ID</span><strong>${escapeHtml(student.student_id||'—')}</strong></div><div><span>EXAM NUMBER</span><strong>${escapeHtml(student.exam_number||'—')}</strong></div><div><span>GENDER</span><strong>${escapeHtml(student.gender||'—')}</strong></div><div><span>DATE OF BIRTH</span><strong>${student.date_of_birth?escapeHtml(new Date(student.date_of_birth).toLocaleDateString('en-GB')):'—'}</strong></div></div></div></div>
          <div class="pro-card-bottom"><span>VALID UNTIL ${escapeHtml(expiry)}</span><strong>${escapeHtml(card.card_number||'')}</strong></div>
        </div></article>
        <article class="print-card-shell print-back-card"><div class="print-card-label no-print">BACK • SCHOOL / EMERGENCY INFORMATION</div><div class="pro-id-card back-card" style="--card-primary:${escapeHtml(primary)};--card-secondary:${escapeHtml(secondary)}">
          <div class="pro-back-pattern"></div><div class="pro-back-head"><div><span class="pro-card-type">STUDENT ID</span><h2>${escapeHtml(schoolName)}</h2><p>${escapeHtml(motto)}</p></div><div class="qr-placeholder">${escapeHtml((card.card_number||student.student_id||'ID').slice(-6))}</div></div>
          <div class="pro-back-content"><div class="back-info-block"><span>IN CASE OF EMERGENCY</span><strong>${escapeHtml(student.guardian_name||'Parent / Guardian')}</strong><p>${escapeHtml(student.guardian_phone||'Guardian contact not provided')}</p></div><div class="back-info-block"><span>SCHOOL CONTACT</span><p>${escapeHtml(settings?.address||'School address not provided')}</p><p>${escapeHtml(settings?.phone||'')}${settings?.email?` • ${escapeHtml(settings.email)}`:''}</p>${settings?.website?`<p>${escapeHtml(settings.website)}</p>`:''}</div></div>
          <div class="pro-back-rule"></div><div class="pro-back-footer"><span>Issued: ${escapeHtml(issued)}</span><strong>Property of ${escapeHtml(schoolName)}</strong><span>Return if found</span></div>
        </div></article>
      </div>
      <div class="id-record-summary no-print"><div><span>CARD NUMBER</span><strong>${escapeHtml(card.card_number||'—')}</strong></div><div><span>STATUS</span><b class="badge ${card.is_active===false?'status-inactive':'status-active'}">${card.is_active===false?'INACTIVE':'ACTIVE'}</b></div><div><span>ISSUED</span><strong>${escapeHtml(issued)}</strong></div><div><span>EXPIRES</span><strong>${escapeHtml(expiry)}</strong></div></div>
      <section class="id-student-record no-print"><div class="section-kicker">STUDENT RECORD</div><div class="student-record-grid"><div><span>Full Name</span><strong>${escapeHtml(name)}</strong></div><div><span>Student ID</span><strong>${escapeHtml(student.student_id||'—')}</strong></div><div><span>Guardian</span><strong>${escapeHtml(student.guardian_name||'—')}</strong></div><div><span>Guardian Phone</span><strong>${escapeHtml(student.guardian_phone||'—')}</strong></div></div></section>
    </section>`;
    document.querySelector('#print-both').onclick=()=>window.print();
    document.querySelector('#print-front').onclick=()=>{document.body.classList.add('print-front-only');window.print();setTimeout(()=>document.body.classList.remove('print-front-only'),700)};
    document.querySelector('#delete-card').onclick=async()=>{if(!confirm(`Delete the ID card for ${name}? This will remove the card record.`))return;const button=document.querySelector('#delete-card');button.disabled=true;pageLoading(true);try{const {error}=await supabase.from('id_cards').delete().eq('id',card.id);if(error)throw error;toast('Student ID card deleted successfully.','success');setTimeout(()=>location.href='id-cards.html',450);}catch(e){console.error(e);toast(e.message||'Could not delete ID card.','error');button.disabled=false;}finally{pageLoading(false)}};
  }catch(e){console.error(e);host.innerHTML=`<div class="panel empty-state"><h3>Could not load ID card</h3><p>${escapeHtml(e.message||'Please try again.')}</p><a class="btn" href="id-cards.html">Back to ID Cards</a></div>`;}
  finally{pageLoading(false)}
}
