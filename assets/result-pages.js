import { supabase, escapeHtml, toast } from './app.js';

const params = new URLSearchParams(location.search);
const classId = params.get('class');
const enrollmentId = params.get('student');
const esc = escapeHtml;
const grade = score => score >= 70 ? 'A' : score >= 60 ? 'B' : score >= 50 ? 'C' : score >= 45 ? 'D' : score >= 40 ? 'E' : 'F';
const initials = (a,b) => `${(a||'')[0]||''}${(b||'')[0]||''}`.toUpperCase();
const published = rows => rows.length > 0 && rows.every(r => String(r.status||'').toUpperCase() === 'PUBLISHED');
const badge = ok => `<span class="result-publish-badge ${ok?'is-published':'is-unpublished'}"><span class="status-dot"></span>${ok?'Published':'Not Published'}</span>`;

function renderContent(html){const shell=document.querySelector('#app-shell');if(shell)shell.dataset.content=html;const content=document.querySelector('.page-content');if(content)content.innerHTML=html;}

export async function renderResultsPage(){
  renderContent(`<div class="result-page results-overview-page">
    <section class="result-hero results-overview-hero"><div><span class="hero-kicker">ACADEMIC RESULTS</span><h1>Results Center</h1><p>Manage class results, monitor publication status and open individual student records from one place.</p><div class="result-hero-actions"><a class="btn hero-add" href="subjects.html">View Subjects</a><button class="btn secondary results-hero-refresh" id="refresh-results-top" type="button">Refresh Results</button></div></div><div class="result-hero-summary"><div><strong id="result-total-classes">0</strong><span>Classes</span></div><div><strong id="result-total-students">0</strong><span>Active students</span></div></div></section>
    <section class="result-stat-grid result-overview-stats">
      <div><div class="result-overview-stat-icon">▤</div><div><span>Classes</span><b id="result-stat-classes">0</b><small>Classes with active enrolments</small></div></div>
      <div><div class="result-overview-stat-icon">◉</div><div><span>Students</span><b id="result-stat-students">0</b><small>Students currently enrolled</small></div></div>
      <div><div class="result-overview-stat-icon">✓</div><div><span>Published</span><b id="result-stat-published">0</b><small>Students with published results</small></div></div>
      <div><div class="result-overview-stat-icon">◷</div><div><span>Pending</span><b id="result-stat-pending">0</b><small>Students still awaiting publication</small></div></div>
    </section>
    <section class="panel results-command">
      <div class="results-command-head"><div><span class="section-kicker">RESULTS DIRECTORY</span><h2>Choose a class</h2><p>Open a class to review students and publish their results.</p></div><button class="btn secondary" id="refresh-results" type="button">↻ Refresh</button></div>
      <div class="results-command-fields"><label class="results-search"><span>⌕</span><input id="results-class-search" type="search" placeholder="Search class name or level…"><button id="results-search-clear" type="button" aria-label="Clear search">×</button></label></div>
      <div class="results-command-foot"><span id="results-directory-note">Loading classes…</span><span id="results-directory-count">0 classes</span></div>
    </section>
    <section id="class-results-grid" class="result-class-grid"><div class="result-loading"><span class="spinner"></span><b>Loading classes…</b><small>Preparing result records</small></div></section>
  </div>`);
  await loadClasses();
  document.querySelector('#refresh-results')?.addEventListener('click',loadClasses);
  document.querySelector('#refresh-results-top')?.addEventListener('click',loadClasses);
  document.querySelector('#results-class-search')?.addEventListener('input',()=>drawResultClasses(window.__resultClasses||[],window.__resultEnrollments||[],window.__resultByClass||{}));
  document.querySelector('#results-search-clear')?.addEventListener('click',()=>{const x=document.querySelector('#results-class-search');if(x){x.value='';x.focus();drawResultClasses(window.__resultClasses||[],window.__resultEnrollments||[],window.__resultByClass||{})}});
}

function drawResultClasses(classes,enrollments,by){
 const box=document.querySelector('#class-results-grid');if(!box)return;
 const q=(document.querySelector('#results-class-search')?.value||'').trim().toLowerCase();
 const filtered=(classes||[]).filter(c=>!q||[c.name,c.level,c.description].filter(Boolean).join(' ').toLowerCase().includes(q));
 const totalStudents=(enrollments||[]).length;
 const publishedStudents=(enrollments||[]).filter(e=>published(by[e.id]||[])).length;
 const stats={classes:(classes||[]).filter(c=>(by[c.id]||[]).length).length,students:totalStudents,published:publishedStudents,pending:Math.max(0,totalStudents-publishedStudents)};
 document.querySelector('#result-total-classes')&&(document.querySelector('#result-total-classes').textContent=(classes||[]).length);
 document.querySelector('#result-total-students')&&(document.querySelector('#result-total-students').textContent=totalStudents);
 document.querySelector('#result-stat-classes')&&(document.querySelector('#result-stat-classes').textContent=stats.classes);
 document.querySelector('#result-stat-students')&&(document.querySelector('#result-stat-students').textContent=stats.students);
 document.querySelector('#result-stat-published')&&(document.querySelector('#result-stat-published').textContent=stats.published);
 document.querySelector('#result-stat-pending')&&(document.querySelector('#result-stat-pending').textContent=stats.pending);
 document.querySelector('#results-directory-note')&&(document.querySelector('#results-directory-note').textContent=filtered.length===classes.length?(classes||[]).length+' class'+((classes||[]).length===1?'':'es')+' available':'Showing '+filtered.length+' of '+classes.length+' classes');
 document.querySelector('#results-directory-count')&&(document.querySelector('#results-directory-count').textContent=filtered.length+' class'+(filtered.length===1?'':'es'));
 if(!filtered.length){box.innerHTML='<section class="panel result-empty"><div class="result-empty-icon">⌕</div><h3>No classes found</h3><p>Try another class name or level.</p></section>';return}
 box.innerHTML=filtered.map((c,i)=>{const students=by[c.id]||[];const pubCount=students.filter(e=>published(by[e.id]||[])).length;const resultCount=students.reduce((n,e)=>n+(by[e.id]||[]).length,0);return `<article class="result-class-card" style="--delay:${Math.min(i,12)*45}ms"><div class="result-class-icon">${esc(initials(c.name,c.level))}</div><div class="result-class-body"><div class="result-class-topline"><span class="result-level">${esc(c.level||'Class')}</span><span class="result-class-status">${pubCount===students.length&&students.length?'Ready to publish':'In progress'}</span></div><h2>${esc(c.name)}</h2><p>${esc(c.description||'Review students, enter results and manage publication for this class.')}</p><div class="result-mini-stats"><span><b>${students.length}</b><small>Active students</small></span><span><b>${resultCount}</b><small>Score entries</small></span><span><b>${pubCount}</b><small>Published</small></span></div></div><div class="result-card-footer"><a class="btn" href="result-pages.html?class=${encodeURIComponent(c.id)}">Open Class Results <span>→</span></a></div></article>`}).join('');
}
async function loadClasses(){
 const box=document.querySelector('#class-results-grid');if(!box)return;box.innerHTML=Array.from({length:6},()=>'<div class="result-skeleton"></div>').join('');
 try{
  const {data:classes,error}=await supabase.from('classes').select('id,name,level,description').order('name');if(error)throw error;
  const {data:enrollments,error:ee}=await supabase.from('enrollments').select('id,class_id,status').eq('status','ACTIVE');if(ee)throw ee;
  const ids=(enrollments||[]).map(x=>x.id);let results=[];if(ids.length){const r=await supabase.from('results').select('enrollment_id,status').in('enrollment_id',ids);if(r.error)throw r.error;results=r.data||[];}
  const by={};(enrollments||[]).forEach(e=>(by[e.class_id]??=[]).push(e));const rb={};results.forEach(r=>(rb[r.enrollment_id]??=[]).push(r));
  window.__resultClasses=classes||[];window.__resultEnrollments=enrollments||[];window.__resultByClass=by;window.__resultRows=rb;
  drawResultClasses(classes||[],enrollments||[],by);
 }catch(e){console.error(e);box.innerHTML='<section class="panel result-empty"><h3>Results could not be loaded</h3><p>Please refresh and try again.</p><button class="btn" id="retry-results">Retry</button></section>';document.querySelector('#retry-results')?.addEventListener('click',loadClasses);toast('Results could not be loaded.','error');}
}

export async function renderClassResults(){
 renderContent(`<div class="result-page class-results-page">
  <section class="result-hero"><div><span class="hero-kicker">CLASS RESULTS</span><h1 id="class-title">Loading class…</h1><p>Review student score records and control publication for this class.</p></div><a class="btn hero-add" href="results.html">← Results Center</a></section>
  <section class="panel class-results-command">
    <div class="class-results-command-head"><div><span class="section-kicker">PUBLICATION CONTROL</span><h2>Class result management</h2><p>Filter the class, publish individual results or publish the class at once.</p></div><button class="btn secondary" id="refresh-class" type="button">↻ Refresh</button></div>
    <div class="class-results-tools"><div class="result-filter-wrap"><label for="publication-filter">Show</label><select id="publication-filter"><option value="all">All Students</option><option value="published">Published</option><option value="unpublished">Not Published</option></select></div><div class="result-bulk-actions"><button class="btn publish-btn" id="publish-all">✓ Publish All</button><button class="btn secondary unpublish-btn" id="unpublish-all">↶ Unpublish All</button></div></div>
    <div class="class-results-command-foot"><span id="class-summary" class="result-summary">Loading students…</span><span>Publication is controlled by the principal.</span></div>
  </section>
  <div id="student-result-list" class="student-result-list"><div class="result-loading"><span class="spinner"></span><b>Loading students…</b><small>Preparing the class result list</small></div></div>
</div>`);
 await loadClassStudents();document.querySelector('#refresh-class')?.addEventListener('click',loadClassStudents);document.querySelector('#publication-filter')?.addEventListener('change',loadClassStudents);document.querySelector('#publish-all')?.addEventListener('click',()=>bulkPublish(true));document.querySelector('#unpublish-all')?.addEventListener('click',()=>bulkPublish(false));
}

async function getClassData(){
 const {data:c,error:ce}=await supabase.from('classes').select('id,name,level').eq('id',classId).maybeSingle();if(ce)throw ce;if(!c)throw new Error('Class not found');
 const {data:enrollments,error:e}=await supabase.from('enrollments').select('id,student_id,status,students(first_name,middle_name,last_name,student_id,photo_url)').eq('class_id',classId).eq('status','ACTIVE').order('created_at');if(e)throw e;
 const ids=(enrollments||[]).map(x=>x.id);let results=[];if(ids.length){const r=await supabase.from('results').select('id,enrollment_id,term_id,subject_id,ca_score,exam_score,total,grade,status').in('enrollment_id',ids);if(r.error)throw r.error;results=r.data||[];}return {c,enrollments:enrollments||[],results};
}

async function loadClassStudents(){
 const box=document.querySelector('#student-result-list');if(!box||!classId)return;box.innerHTML='<div class="result-loading"><span class="spinner"></span><b>Loading students…</b><small>Please wait</small></div>';
 try{
  const {c,enrollments,results}=await getClassData();document.querySelector('#class-title').textContent=c.name;const by={};results.forEach(r=>(by[r.enrollment_id]??=[]).push(r));const filter=document.querySelector('#publication-filter')?.value||'all';const filtered=enrollments.filter(x=>filter==='all'||(filter==='published'?published(by[x.id]||[]):!published(by[x.id]||[])));const pubCount=enrollments.filter(x=>published(by[x.id]||[])).length;document.querySelector('#class-summary').textContent=`${enrollments.length} student${enrollments.length===1?'':'s'} · ${pubCount} published · ${enrollments.length-pubCount} not published`;
  box.innerHTML=filtered.map((x,i)=>{const s=x.students||{};const rows=by[x.id]||[];const pub=published(rows);return `<article class="student-result-row" style="--delay:${i*45}ms"><div class="student-result-main"><div class="student-result-avatar">${esc(initials(s.first_name,s.last_name))}</div><div class="student-result-info"><div class="student-result-heading"><h3>${esc(`${s.first_name||''} ${s.middle_name||''} ${s.last_name||''}`.replace(/\s+/g,' ').trim()||'Unnamed student')}</h3>${badge(pub)}</div><span>${esc(s.student_id||'No student ID')} · ${rows.length} subject result${rows.length===1?'':'s'}</span></div></div><div class="student-result-actions"><button class="btn ${pub?'secondary unpublish-btn':'publish-btn'} student-publish" data-enrollment="${x.id}" data-published="${pub}">${pub?'↶ Unpublish':'✓ Publish'}</button><button class="btn secondary result-image-btn" data-enrollment="${x.id}">▣ Result Image</button><a class="btn" href="student-result.html?student=${encodeURIComponent(x.id)}&class=${encodeURIComponent(classId)}">View Result →</a></div></article>`}).join('')||'<div class="result-empty"><h3>No students match this filter</h3><p>Try another publication filter.</p></div>';
  box.querySelectorAll('.student-publish').forEach(b=>b.addEventListener('click',()=>publishStudent(b.dataset.enrollment,b.dataset.published!=='true')));box.querySelectorAll('.result-image-btn').forEach(b=>b.addEventListener('click',()=>createResultImage(b.dataset.enrollment)));
 }catch(e){console.error(e);box.innerHTML='<div class="result-empty"><h3>Students could not be loaded</h3><p>Please refresh and try again.</p><button class="btn" id="retry-class">Retry</button></div>';document.querySelector('#retry-class')?.addEventListener('click',loadClassStudents);toast('Class students could not be loaded.','error');}
}

async function publishStudent(id,publish){try{const {error}=await supabase.from('results').update(publish?{status:'PUBLISHED',published_at:new Date().toISOString()}:{status:'DRAFT',published_at:null}).eq('enrollment_id',id);if(error)throw error;toast(publish?'Student result published successfully.':'Student result unpublished.');await loadClassStudents();}catch(e){console.error(e);toast('Could not update publication status.','error');}}

async function bulkPublish(publish){const button=document.querySelector(publish?'#publish-all':'#unpublish-all');if(!button)return;if(!confirm(`Are you sure you want to ${publish?'publish':'unpublish'} all results for this class?`))return;try{button.disabled=true;button.innerHTML='<span class="spinner spinner-sm"></span> Please wait…';const {enrollments}=await getClassData();const ids=enrollments.map(x=>x.id);if(!ids.length){toast('There are no active students in this class.','error');return;}const {error}=await supabase.from('results').update(publish?{status:'PUBLISHED',published_at:new Date().toISOString()}:{status:'DRAFT',published_at:null}).in('enrollment_id',ids);if(error)throw error;toast(publish?'All class results have been published.':'All class results have been unpublished.');await loadClassStudents();}catch(e){console.error(e);toast('Could not update all class results.','error');}finally{button.disabled=false;button.textContent=publish?'✓ Publish All Results':'↶ Unpublish All';}}

async function loadHtml2Canvas(){if(window.html2canvas)return window.html2canvas;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});return window.html2canvas;}

async function createResultImage(id){
 try{
  const {data:e,error:ee}=await supabase.from('enrollments').select('id,class_id,students(first_name,middle_name,last_name,student_id,exam_number,date_of_birth,gender,guardian_name,guardian_phone),classes(name,level)').eq('id',id).maybeSingle();if(ee)throw ee;if(!e)throw new Error('Student not found');const {data:school,error:se}=await supabase.from('school_settings').select('school_name,motto,logo_url,address,phone,email,website').limit(1).maybeSingle();if(se)throw se;const {data:rows,error:re}=await supabase.from('results').select('ca_score,exam_score,total,grade,grade_point,teacher_remark,principal_remark,position,subjects(name,code),terms(name,academic_sessions(name))').eq('enrollment_id',id).order('created_at');if(re)throw re;
  const s=e.students||{},sc=school||{},name=`${s.first_name||''} ${s.middle_name||''} ${s.last_name||''}`.replace(/\s+/g,' ').trim();const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;z-index:-1';host.innerHTML=`<div id="result-image-card" style="width:900px;background:#fff;color:#12213a;padding:42px;font-family:Arial,sans-serif;box-sizing:border-box;border:10px solid #f2c94c"><div style="text-align:center;border-bottom:3px solid #1558a6;padding-bottom:22px"><img src="${esc(sc.logo_url||'https://i.ibb.co/whtP8S5v/image.png')}" crossorigin="anonymous" style="width:90px;height:90px;object-fit:contain;border-radius:50%"><h1 style="margin:12px 0 4px;color:#1558a6;font-size:30px">${esc(sc.school_name||'Laff British Montessori School')}</h1><div style="font-size:15px;font-weight:700">${esc(sc.motto||'')}</div><div style="font-size:12px;margin-top:8px">${esc(sc.address||'')} · ${esc(sc.phone||'')} · ${esc(sc.email||'')}</div></div><div style="display:flex;gap:22px;margin:25px 0;padding:18px;background:#f6f9fd;border-radius:14px"><div style="flex:1"><h2 style="margin:0 0 10px">${esc(name)}</h2><div>Student ID: <b>${esc(s.student_id||'—')}</b></div><div>Exam Number: <b>${esc(s.exam_number||'—')}</b></div><div>Class: <b>${esc(e.classes?.name||'—')}</b></div><div>Level: <b>${esc(e.classes?.level||'—')}</b></div></div><div style="flex:1"><div>Date of Birth: <b>${esc(s.date_of_birth||'—')}</b></div><div>Gender: <b>${esc(s.gender||'—')}</b></div><div>Guardian: <b>${esc(s.guardian_name||'—')}</b></div><div>Guardian Phone: <b>${esc(s.guardian_phone||'—')}</b></div><div style="margin-top:8px">Publication: <b style="color:#16834b">PUBLISHED</b></div></div></div><h2 style="color:#1558a6">Academic Result</h2><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#1558a6;color:#fff"><th style="padding:10px;text-align:left">Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Point</th><th>Remark</th></tr></thead><tbody>${(rows||[]).map(r=>`<tr><td style="padding:9px;border-bottom:1px solid #ddd"><b>${esc(r.subjects?.name||'Subject')}</b><br><small>${esc(r.subjects?.code||'')}</small></td><td style="text-align:center;border-bottom:1px solid #ddd">${r.ca_score??0}</td><td style="text-align:center;border-bottom:1px solid #ddd">${r.exam_score??0}</td><td style="text-align:center;border-bottom:1px solid #ddd"><b>${r.total??0}</b></td><td style="text-align:center;border-bottom:1px solid #ddd"><b>${esc(r.grade||grade(Number(r.total||0)))}</b></td><td style="text-align:center;border-bottom:1px solid #ddd">${r.grade_point??'—'}</td><td style="border-bottom:1px solid #ddd">${esc(r.teacher_remark||'—')}</td></tr>`).join('')||'<tr><td colspan="7" style="padding:18px;text-align:center">No result records entered.</td></tr>'}</tbody></table><div style="margin-top:22px;font-size:12px;line-height:1.6"><b>Principal Remark:</b> ${esc(rows?.[0]?.principal_remark||'—')}<br><b>School Website:</b> ${esc(sc.website||'')}</div><div style="margin-top:28px;text-align:center;font-size:11px;color:#65748b">Official student result · ${esc(sc.school_name||'Laff British Montessori School')}</div></div>`;document.body.appendChild(host);const canvas=await (await loadHtml2Canvas())(host.querySelector('#result-image-card'),{scale:2,useCORS:true,backgroundColor:'#fff'});const link=document.createElement('a');link.download=`${s.student_id||'student'}-result.png`;link.href=canvas.toDataURL('image/png');link.click();host.remove();toast('Result image created successfully.');
 }catch(e){console.error(e);toast('Could not create the result image.','error');}
}

async function invokeProgressionFunction(name, body){
  const response=await supabase.functions.invoke(name,{body});
  if(!response.error) return response.data;
  let message=response.error.message||'The request could not be completed.';
  try{
    const ctx=response.error.context;
    if(ctx&&typeof ctx.text==='function'){const raw=await ctx.text();if(raw){try{const parsed=JSON.parse(raw);message=parsed.error||parsed.message||message;}catch{message=raw;}}}
  }catch{}
  throw new Error(message);
}
async function openPromotionModal(enrollmentId, currentClassName, studentName, average){
 const [classesRes, sessionsRes, enrollmentRes] = await Promise.all([
  supabase.from('classes').select('id,name,level').order('name'),
  supabase.from('academic_sessions').select('id,name,starts_on,ends_on').order('starts_on',{ascending:false,nullsLast:true}).order('name',{ascending:false}),
  supabase.from('enrollments').select('session_id,classes(name)').eq('id',enrollmentId).maybeSingle()
 ]);
 if(classesRes.error) throw classesRes.error;
 if(sessionsRes.error) throw sessionsRes.error;
 if(enrollmentRes.error) throw enrollmentRes.error;
 const classes=classesRes.data||[];
 const sessions=sessionsRes.data||[];
 const currentSessionId=enrollmentRes.data?.session_id||'';
 const currentSessionName=enrollmentRes.data?.classes?.name||'';
 const otherSessions=sessions.filter(s=>s.id!==currentSessionId);
 const card=document.createElement('div');
 card.className='promotion-modal';
 card.setAttribute('role','dialog');
 card.setAttribute('aria-modal','true');
 card.innerHTML=`<div class="promotion-card">
  <div class="promotion-head"><div><span class="hero-kicker" style="color:#8a6900">STUDENT PROMOTION</span><h2>Promote ${esc(studentName||'Student')}</h2><p>Move this student from the current result class into the selected class for another academic session.</p></div><button type="button" class="promotion-close" aria-label="Close">×</button></div>
  <div class="promotion-summary"><div><small>Current Class</small><b>${esc(currentClassName||'—')}</b></div><div><small>Result Average</small><b>${Number(average||0)}%</b></div><div><small>Current Session</small><b>${esc(currentSessionName||'Current session')}</b></div></div>
  <div class="promotion-form">
   <label>Destination Class<select id="promotionTargetClass"><option value="">Select class…</option>${classes.map(x=>`<option value="${x.id}">${esc(x.name)}${x.level?' — '+esc(x.level):''}</option>`).join('')}</select></label>
   <label>Destination Academic Session<select id="promotionTargetSession"><option value="">Select academic session…</option>${otherSessions.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
   ${otherSessions.length?'':'<div class="promotion-empty"><b>No other academic session is available.</b><br>Create the next academic session first, then return here to promote the student.</div>'}
   <div class="promotion-help"><b>What happens:</b> the current enrollment is marked <b>PROMOTED</b> and a new <b>ACTIVE</b> enrollment is created in the destination class and session. Existing results remain attached to the original enrollment.</div>
   <div id="promotionMessage"></div>
   <div class="promotion-actions"><button type="button" class="btn secondary promotion-cancel">Cancel</button><button type="button" class="btn publish-btn" id="confirmPromotion" ${otherSessions.length?'':'disabled'}>Promote Student</button></div>
  </div>
 </div>`;
 document.body.appendChild(card);
 const close=()=>card.remove();
 card.querySelector('.promotion-close').onclick=close;
 card.querySelector('.promotion-cancel').onclick=close;
 card.addEventListener('click',e=>{if(e.target===card)close()});
 const confirm=card.querySelector('#confirmPromotion');
 confirm?.addEventListener('click',async()=>{
  const targetClass=card.querySelector('#promotionTargetClass')?.value;
  const targetSession=card.querySelector('#promotionTargetSession')?.value;
  const message=card.querySelector('#promotionMessage');
  if(!targetClass||!targetSession){message.innerHTML='<div class="promotion-empty">Select both a destination class and academic session.</div>';return}
  if(!confirm('Confirm promotion of this student to the selected class and academic session?'))return;
  try{
   confirm.disabled=true;confirm.textContent='Promoting…';
   const data=await invokeProgressionFunction('admin-promote-student',{enrollment_id:enrollmentId,target_class_id:targetClass,target_session_id:targetSession});
   if(error){
    let detail='Promotion request failed.';
    try{const raw=await error.context?.json?.();if(raw?.error)detail=raw.error}catch{}
    throw new Error(detail);
   }
   if(!data?.ok)throw new Error(data?.error||'Promotion failed.');
   message.innerHTML=`<div class="promotion-success">${esc(data.message||'Student promoted successfully.')}</div>`;
   toast(data.message||'Student promoted successfully.');
   setTimeout(close,900);
  }catch(e){
   console.error('Student promotion failed:',e);
   message.innerHTML=`<div class="promotion-empty">${esc(e.message||'Could not complete the promotion.')}</div>`;
   confirm.disabled=false;confirm.textContent='Promote Student';
  }
 });
}
 
async function openRepeatModal(enrollmentId, currentClassName, studentName, average){
 const [sessionsRes, enrollmentRes] = await Promise.all([
  supabase.from('academic_sessions').select('id,name,starts_on,ends_on').order('starts_on',{ascending:false,nullsLast:true}).order('name',{ascending:false}),
  supabase.from('enrollments').select('session_id').eq('id',enrollmentId).maybeSingle()
 ]);
 if(sessionsRes.error) throw sessionsRes.error;
 if(enrollmentRes.error) throw enrollmentRes.error;
 const currentSessionId=enrollmentRes.data?.session_id||'';
 const sessions=(sessionsRes.data||[]).filter(s=>s.id!==currentSessionId);
 const card=document.createElement('div');
 card.className='promotion-modal';
 card.setAttribute('role','dialog');
 card.setAttribute('aria-modal','true');
 card.innerHTML=`<div class="promotion-card">
  <div class="promotion-head"><div><span class="hero-kicker" style="color:#8a6900">REPEAT STUDENT</span><h2>Repeat ${esc(studentName||'Student')}</h2><p>This keeps the student in the same class for the selected academic session.</p></div><button type="button" class="promotion-close" aria-label="Close">×</button></div>
  <div class="promotion-summary"><div><small>Current Class</small><b>${esc(currentClassName||'—')}</b></div><div><small>Result Average</small><b>${Number(average||0)}%</b></div><div><small>Action</small><b>Repeat Same Class</b></div></div>
  <div class="promotion-form">
   <label>Repeat in Academic Session<select id="repeatTargetSession"><option value="">Select academic session…</option>${sessions.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
   ${sessions.length?'':'<div class="promotion-empty"><b>No other academic session is available.</b><br>Create the next academic session first, then return here to repeat the student.</div>'}
   <div class="promotion-help"><b>What happens:</b> the current enrollment is marked <b>REPEATED</b> and a new <b>ACTIVE</b> enrollment is created for the <b>same class</b> in the selected session. Existing results remain attached to the original enrollment.</div>
   <div id="repeatMessage"></div>
   <div class="promotion-actions"><button type="button" class="btn secondary promotion-cancel">Cancel</button><button type="button" class="btn publish-btn" id="confirmRepeat" ${sessions.length?'':'disabled'}>Repeat Student</button></div>
  </div>
 </div>`;
 document.body.appendChild(card);
 const close=()=>card.remove();
 card.querySelector('.promotion-close').onclick=close;
 card.querySelector('.promotion-cancel').onclick=close;
 card.addEventListener('click',e=>{if(e.target===card)close()});
 const confirm=card.querySelector('#confirmRepeat');
 confirm?.addEventListener('click',async()=>{
  const targetSession=card.querySelector('#repeatTargetSession')?.value;
  const message=card.querySelector('#repeatMessage');
  if(!targetSession){message.innerHTML='<div class="promotion-empty">Select the academic session for the repeat.</div>';return}
  if(!confirm('Confirm that this student should repeat the same class in the selected academic session?'))return;
  try{
   confirm.disabled=true;confirm.textContent='Repeating…';
   const data=await invokeProgressionFunction('admin-repeat-student',{enrollment_id:enrollmentId,target_session_id:targetSession});
   if(error){
    let detail='Repeat request failed.';
    try{const raw=await error.context?.json?.();if(raw?.error)detail=raw.error}catch{}
    throw new Error(detail);
   }
   if(!data?.ok)throw new Error(data?.error||'Repeat action failed.');
   message.innerHTML=`<div class="promotion-success">${esc(data.message||'Student repeat completed successfully.')}</div>`;
   toast(data.message||'Student repeat completed successfully.');
   setTimeout(close,900);
  }catch(e){
   console.error('Student repeat failed:',e);
   message.innerHTML=`<div class="promotion-empty">${esc(e.message||'Could not complete the repeat action.')}</div>`;
   confirm.disabled=false;confirm.textContent='Repeat Student';
  }
 });
}
 
export async function renderStudentResult(){
 renderContent(`<div class="result-page student-result-page"><div class="result-hero student-result-hero"><div><span class="hero-kicker">STUDENT RESULT</span><h1 id="student-name">Loading result…</h1><p id="student-meta">Preparing academic record</p></div><a class="btn hero-add" href="result-pages.html?class=${encodeURIComponent(classId||'')}">← Back to Students</a></div><div id="student-result-content"><div class="result-loading"><span class="spinner"></span><b>Loading student result…</b><small>Preparing subjects and scores</small></div></div></div>`);
 try{
  const {data:e,error:ee}=await supabase.from('enrollments').select('id,class_id,session_id,status,students(first_name,middle_name,last_name,student_id,exam_number),classes(name,level),academic_sessions(name)').eq('id',enrollmentId).maybeSingle();
  if(ee)throw ee;if(!e)throw new Error('Student enrollment not found');
  const r=await supabase.from('results').select('id,ca_score,exam_score,total,grade,grade_point,teacher_remark,principal_remark,position,status,subject_id,term_id,subjects(name,code),terms(name,academic_sessions(name))').eq('enrollment_id',enrollmentId).order('created_at');
  if(r.error)throw r.error;
  const rows=r.data||[],s=e.students||{},name=`${s.first_name||''} ${s.middle_name||''} ${s.last_name||''}`.replace(/\s+/g,' ').trim(),total=rows.reduce((a,x)=>a+Number(x.total||0),0),avg=rows.length?Math.round(total/rows.length):0,pub=published(rows);
  document.querySelector('#student-name').textContent=name||'Student Result';
  document.querySelector('#student-meta').textContent=`${s.student_id||'No ID'} · ${e.classes?.name||'Class'} · ${e.academic_sessions?.name||'Academic session'}`;
  document.querySelector('#student-result-content').innerHTML=`<div class="student-result-detail-actions">
    <div class="result-publication-status ${pub?'published':'unpublished'}"><span class="status-dot"></span><strong>${pub?'PUBLISHED':'NOT PUBLISHED'}</strong><small>${pub?'This result is available to the student.':'This result is still awaiting publication.'}</small></div>
    <button class="btn ${pub?'secondary unpublish-btn':'publish-btn'}" id="student-publish">${pub?'↶ Unpublish Result':'✓ Publish Result'}</button>
    <div class="student-progress-actions"><span class="action-label">ACADEMIC PROGRESSION</span><div class="progress-action-group"><button class="btn publish-btn" id="student-promote">⇧ Promote Student</button><button class="btn secondary" id="student-repeat">↻ Keep in Same Class</button></div><small>Promote to the next class when successful. Keep the same class for the next session when repeating.</small></div>
    <button class="btn secondary" id="student-image">▣ Result Image</button><button class="btn secondary" onclick="window.print()">Print Result</button>
  </div>
  <div class="result-progression-card"><div><span class="hero-kicker">CURRENT ENROLLMENT</span><h3>${esc(e.classes?.name||'Class')}</h3><p>${esc(e.academic_sessions?.name||'Academic session')} · Student status: <b>${esc(e.status||'ACTIVE')}</b></p></div><div class="progression-rule"><span class="progress-dot active"></span><span></span><span class="progress-dot"></span><span></span><span class="progress-dot"></span></div><div class="progression-caption"><span>Current Class</span><span>Next Session</span><span>Next Class</span></div></div>
  <div class="result-stat-grid"><div><b>${rows.length}</b><span>Subjects</span></div><div><b>${total}</b><span>Total Score</span></div><div><b>${avg}</b><span>Average</span></div><div><b>${rows.filter(x=>String(x.grade||grade(Number(x.total||0)))==='A').length}</b><span>A Grades</span></div></div>
  <section class="panel result-table-panel"><div class="panel-head"><div><h2>Academic Result</h2><p>${esc(rows[0]?.terms?.academic_sessions?.name||e.academic_sessions?.name||'Academic session')} · ${esc(rows[0]?.terms?.name||'All terms')}</p></div></div><div class="table-wrap"><table><thead><tr><th>Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Point</th><th>Remark</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${esc(x.subjects?.name||'Subject')}</b><small>${esc(x.subjects?.code||'')}</small></td><td>${x.ca_score??0}</td><td>${x.exam_score??0}</td><td><b>${x.total??0}</b></td><td><span class="grade-badge grade-${esc(x.grade||grade(Number(x.total||0)))}">${esc(x.grade||grade(Number(x.total||0)))}</span></td><td>${x.grade_point??'—'}</td><td>${esc(x.teacher_remark||'—')}</td></tr>`).join('')||'<tr><td colspan="7" class="empty-cell">No result records have been entered for this student.</td></tr>'}</tbody></table></div></section>`;
  document.querySelector('#student-publish')?.addEventListener('click',async()=>{await publishStudent(enrollmentId,!pub);await renderStudentResult();});
  document.querySelector('#student-promote')?.addEventListener('click',async()=>{try{await openPromotionModal(enrollmentId,e.classes?.name||'Class',name,avg);await renderStudentResult();}catch(err){console.error(err);toast(err.message||'Could not open promotion.','error');}});
  document.querySelector('#student-repeat')?.addEventListener('click',async()=>{try{await openRepeatModal(enrollmentId,e.classes?.name||'Class',name,avg);await renderStudentResult();}catch(err){console.error(err);toast(err.message||'Could not open repeat action.','error');}});
  document.querySelector('#student-image')?.addEventListener('click',()=>createResultImage(enrollmentId));
 }catch(e){console.error(e);document.querySelector('#student-result-content').innerHTML='<div class="result-empty"><h3>Student result could not be loaded</h3><p>Please refresh and try again.</p><button class="btn" onclick="location.reload()">Retry</button></div>';toast('Student result could not be loaded.','error');}
}
