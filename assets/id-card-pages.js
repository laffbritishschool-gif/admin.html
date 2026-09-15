import { supabase, escapeHtml, toast, pageLoading } from './app.js';

const LOGO_URL = 'https://i.ibb.co/whtP8S5v/image.png';

function fullName(s){ return [s.first_name,s.middle_name,s.last_name].filter(Boolean).join(' '); }
function initials(s){ return [s.first_name,s.last_name].filter(Boolean).map(x=>x[0]).join('').toUpperCase() || 'ST'; }
function cardNumber(){ const d=new Date(); return `LBS-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.random().toString(36).slice(2,8).toUpperCase()}`; }
async function photoUrl(path){
  if(!path)return '';
  if(/^https?:\/\//i.test(path))return path;
  const {data}=await supabase.storage.from('student-passports').createSignedUrl(path,3600);
  return data?.signedUrl||'';
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

  host.innerHTML=`
    <div class="module-hero">
      <div><div class="section-kicker">STUDENT IDENTITY</div><h2>Student ID Cards</h2><p>Manage every student ID card and generate missing cards instantly.</p></div>
      <div class="hero-actions"><button class="btn secondary" id="refresh-cards">↻ Refresh</button></div>
    </div>
    <div class="metric-grid id-card-metrics" id="id-card-metrics"></div>
    <div class="panel">
      <div class="toolbar">
        <input id="card-search" class="search" placeholder="Search student name, ID or exam number…">
        <select id="card-filter"><option value="ALL">All Students</option><option value="MISSING">Card Not Found</option><option value="ISSUED">Card Issued</option></select>
      </div>
      <div id="id-card-list" class="id-card-student-grid"><div class="inline-loading">Loading students…</div></div>
    </div>`;

  let students=[];
  let cards=[];

  const draw=()=>{
    const search=(document.querySelector('#card-search')?.value||'').trim().toLowerCase();
    const filter=document.querySelector('#card-filter')?.value||'ALL';
    const issued=students.filter(s=>!!cardFor(cards,s.id)).length;
    const filtered=students.filter(s=>{
      const c=cardFor(cards,s.id);
      const text=[fullName(s),s.student_id,s.exam_number].filter(Boolean).join(' ').toLowerCase();
      return (!search||text.includes(search)) && (filter==='ALL'||(filter==='MISSING'?!c:!!c));
    });

    document.querySelector('#id-card-metrics').innerHTML=`
      <div class="metric-card"><small>Total Students</small><strong>${students.length}</strong><span>All student records</span></div>
      <div class="metric-card"><small>Cards Issued</small><strong>${issued}</strong><span>Existing student cards</span></div>
      <div class="metric-card"><small>Cards Missing</small><strong>${Math.max(0,students.length-issued)}</strong><span>Ready for generation</span></div>`;

    document.querySelector('#id-card-list').innerHTML=filtered.length ? filtered.map(s=>{
      const c=cardFor(cards,s.id);
      return `<article class="id-student-card">
        <div class="id-student-main"><div class="id-student-avatar">${escapeHtml(initials(s))}</div><div><h3>${escapeHtml(fullName(s))}</h3><p>${escapeHtml(s.student_id||'No Student ID')}${s.exam_number?` • ${escapeHtml(s.exam_number)}`:''}</p></div></div>
        <div class="id-student-status">${c?`<span class="badge status-active">CARD ISSUED</span><small>${escapeHtml(c.card_number||'Issued')}</small>`:`<span class="badge status-inactive">CARD NOT FOUND</span><small>Ready for generation</small>`}</div>
        <div class="id-student-actions"><button class="btn btn-sm secondary view-id" data-student="${s.id}">View</button>${c?'':`<button class="btn btn-sm generate-id" data-student="${s.id}">Generate ID Card</button>`}</div>
      </article>`;
    }).join('') : `<div class="empty-state"><h3>No students found</h3><p>Try another search or filter.</p></div>`;

    host.querySelectorAll('.view-id').forEach(b=>b.onclick=()=>location.href=`id-card-details.html?student=${encodeURIComponent(b.dataset.student)}`);
    host.querySelectorAll('.generate-id').forEach(b=>b.onclick=()=>generate(b.dataset.student));
  };

  async function load(){
    pageLoading(true);
    try{
      // Load students independently so the page never becomes blank because an old card record has an issue.
      students=await getStudents();
      draw();
      try{ cards=await getCards(); }
      catch(cardError){ console.error('ID card records could not be loaded',cardError); cards=[]; toast('Student list loaded. Existing card records could not be read.','error'); }
      draw();
    }catch(e){
      console.error('ID cards load failed',e);
      toast(e.message||'Could not load students.','error');
      document.querySelector('#id-card-list').innerHTML=`<div class="empty-state"><h3>Could not load students</h3><p>${escapeHtml(e.message||'Please refresh and try again.')}</p></div>`;
    }finally{ pageLoading(false); }
  }

  async function generate(studentId){
    pageLoading(true);
    try{
      const {data:existing,error:checkError}=await supabase.from('id_cards').select('id').eq('student_id',studentId).limit(1);
      if(checkError)throw checkError;
      if(existing?.length){ location.href=`id-card-details.html?student=${encodeURIComponent(studentId)}`; return; }
      const expires=new Date(); expires.setFullYear(expires.getFullYear()+1);
      const {data:userData}=await supabase.auth.getUser();
      const {error}=await supabase.from('id_cards').insert({student_id:studentId,card_number:cardNumber(),expires_at:expires.toISOString(),is_active:true,created_by:userData?.user?.id||null});
      if(error)throw error;
      toast('Student ID card generated successfully.','success');
      location.href=`id-card-details.html?student=${encodeURIComponent(studentId)}`;
    }catch(e){ console.error(e); toast(e.message||'Could not generate ID card.','error'); }
    finally{ pageLoading(false); }
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
  host.innerHTML='<div class="panel inline-loading">Loading student ID card…</div>';
  pageLoading(true);
  try{
    const [{data:student,error:se},{data:cards,error:ce}]=await Promise.all([
      supabase.from('students').select('*').eq('id',studentId).maybeSingle(),
      supabase.from('id_cards').select('*').eq('student_id',studentId).order('issued_at',{ascending:false})
    ]);
    if(se)throw se;
    if(ce)throw ce;
    if(!student)throw new Error('Student record not found.');

    let card=cards?.[0];
    if(!card){
      const expires=new Date(); expires.setFullYear(expires.getFullYear()+1);
      const {data:userData}=await supabase.auth.getUser();
      const {data:newCard,error}=await supabase.from('id_cards').insert({student_id:student.id,card_number:cardNumber(),expires_at:expires.toISOString(),is_active:true,created_by:userData?.user?.id||null}).select('*').single();
      if(error)throw error;
      card=newCard;
      toast('ID card was generated automatically for this student.','success');
    }

    const photo=await photoUrl(student.photo_url);
    const name=fullName(student);
    const expiry=card.expires_at?new Date(card.expires_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
    host.innerHTML=`
      <div class="module-hero no-print"><div><div class="section-kicker">ID CARD PREVIEW</div><h2>${escapeHtml(name)}</h2><p>${escapeHtml(student.student_id||'Student')} • ${escapeHtml(card.card_number||'')}</p></div><div class="hero-actions"><a class="btn secondary" href="id-cards.html">← Back</a><button class="btn" id="print-card">Print ID Card</button></div></div>
      <div class="id-preview-wrap"><div class="school-id-card" id="printable-id-card"><div class="school-id-top"><img src="${LOGO_URL}" alt="Laff British Montessori School"><div><strong>LAFF BRITISH</strong><span>MONTESSORI SCHOOL</span><small>STUDENT IDENTITY CARD</small></div></div><div class="school-id-body"><div class="school-id-photo">${photo?`<img src="${escapeHtml(photo)}" alt="Student passport">`:`<span>${escapeHtml(initials(student))}</span>`}</div><div class="school-id-info"><h1>${escapeHtml(name)}</h1><p><b>Student ID:</b> ${escapeHtml(student.student_id||'—')}</p><p><b>Exam No:</b> ${escapeHtml(student.exam_number||'—')}</p><p><b>Class:</b> Student Record</p><p><b>Gender:</b> ${escapeHtml(student.gender||'—')}</p><p><b>Valid Until:</b> ${escapeHtml(expiry)}</p></div></div><div class="school-id-bottom"><span>${escapeHtml(card.card_number||'')}</span><span>LAFF BRITISH MONTESSORI SCHOOL</span></div></div></div>
      <div class="panel no-print id-card-record"><div><small>Card Number</small><strong>${escapeHtml(card.card_number||'—')}</strong></div><div><small>Status</small><span class="badge ${card.is_active===false?'status-inactive':'status-active'}">${card.is_active===false?'INACTIVE':'ACTIVE'}</span></div><div><small>Expires</small><strong>${escapeHtml(expiry)}</strong></div></div>
      <div class="panel no-print"><div class="section-kicker">STUDENT DETAILS</div><div class="detail-grid"><div><small>Full Name</small><strong>${escapeHtml(name)}</strong></div><div><small>Phone</small><strong>${escapeHtml(student.phone||'—')}</strong></div><div><small>Guardian</small><strong>${escapeHtml(student.guardian_name||'—')}</strong></div><div><small>Status</small><strong>${escapeHtml(student.status||'—')}</strong></div></div></div>`;
    document.querySelector('#print-card').onclick=()=>window.print();
  }catch(e){
    console.error(e);
    host.innerHTML=`<div class="panel empty-state"><h3>Could not load ID card</h3><p>${escapeHtml(e.message||'Please try again.')}</p><a class="btn" href="id-cards.html">Back to ID Cards</a></div>`;
  }finally{ pageLoading(false); }
}
