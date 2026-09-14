import { supabase, escapeHtml, toast } from './app.js';

const params = new URLSearchParams(location.search);
const classId = params.get('class');
const enrollmentId = params.get('student');

const grade = score => score >= 70 ? 'A' : score >= 60 ? 'B' : score >= 50 ? 'C' : score >= 45 ? 'D' : score >= 40 ? 'E' : 'F';
const initials = (a,b) => `${(a||'')[0]||''}${(b||'')[0]||''}`.toUpperCase();
const esc = escapeHtml;

async function currentTerm(){
  const {data,error}=await supabase.from('terms').select('id,name,session_id,academic_sessions(name)').eq('is_current',true).maybeSingle();
  if(error) throw error; return data;
}

export async function renderResultsPage(){
  const shell=document.querySelector('#app-shell');
  shell.dataset.content=`<div class="result-page"><div class="result-hero"><div><span class="hero-kicker">ACADEMIC RESULTS</span><h1>Results by Class</h1><p>Select a class to view every student in that class, then open an individual student's result.</p></div></div><div class="result-toolbar"><button class="btn secondary" id="refresh-results">↻ Refresh</button></div><div id="class-results-grid" class="result-class-grid"><div class="result-loading"><span class="spinner"></span><b>Loading classes…</b><small>Preparing result records</small></div></div></div>`;
  await loadClasses();
  document.querySelector('#refresh-results')?.addEventListener('click',loadClasses);
}

async function loadClasses(){
  const box=document.querySelector('#class-results-grid'); if(!box)return;
  box.innerHTML=Array.from({length:3},()=>'<div class="result-skeleton"></div>').join('');
  try{
    const {data:classes,error}=await supabase.from('classes').select('id,name,level,description').order('name'); if(error)throw error;
    const {data:enrollments,error:ee}=await supabase.from('enrollments').select('id,class_id,student_id,status,students(first_name,middle_name,last_name,student_id)').eq('status','ACTIVE'); if(ee)throw ee;
    const {data:results,error:re}=await supabase.from('results').select('enrollment_id,id').limit(1000); if(re)throw re;
    const counts={}; (enrollments||[]).forEach(x=>{counts[x.class_id]=(counts[x.class_id]||0)+1});
    const resultCounts={}; (results||[]).forEach(x=>{resultCounts[x.enrollment_id]=(resultCounts[x.enrollment_id]||0)+1});
    box.innerHTML=(classes||[]).map((c,i)=>`<article class="result-class-card" style="--delay:${i*70}ms"><div class="result-class-icon">${esc(initials(c.name,c.level))}</div><div class="result-class-body"><span class="result-level">${esc(c.level||'Class')}</span><h2>${esc(c.name)}</h2><p>${esc(c.description||'View students and academic results for this class.')}</p><div class="result-mini-stats"><span><b>${counts[c.id]||0}</b> Students</span><span><b>${(enrollments||[]).filter(x=>x.class_id===c.id&&resultCounts[x.id]).length}</b> With results</span></div></div><div class="result-card-footer"><a class="btn" href="result-pages.html?class=${encodeURIComponent(c.id)}">View Class Results →</a></div></article>`).join('')||'<div class="result-empty"><h3>No classes found</h3><p>Create a class first before viewing student results.</p></div>';
  }catch(e){console.error(e);box.innerHTML='<div class="result-empty"><h3>Results could not be loaded</h3><p>Please refresh and try again.</p><button class="btn" id="retry-results">Retry</button></div>';document.querySelector('#retry-results')?.addEventListener('click',loadClasses);toast('Results could not be loaded.','error')}
}

export async function renderClassResults(){
  const shell=document.querySelector('#app-shell');
  shell.dataset.content=`<div class="result-page"><div class="result-hero"><div><span class="hero-kicker">CLASS RESULTS</span><h1 id="class-title">Loading class…</h1><p>All active students in this class are listed below.</p></div><a class="btn hero-add" href="results.html">← Back to Classes</a></div><div class="result-toolbar"><div id="class-summary" class="result-summary">Loading students…</div><button class="btn secondary" id="refresh-class">↻ Refresh</button></div><div id="student-result-list" class="student-result-list"><div class="result-loading"><span class="spinner"></span><b>Loading students…</b><small>Preparing the class result list</small></div></div></div>`;
  await loadClassStudents(); document.querySelector('#refresh-class')?.addEventListener('click',loadClassStudents);
}

async function loadClassStudents(){
  const box=document.querySelector('#student-result-list'); if(!box||!classId)return;
  box.innerHTML='<div class="result-loading"><span class="spinner"></span><b>Loading students…</b><small>Please wait</small></div>';
  try{
    const {data:c,error:ce}=await supabase.from('classes').select('id,name,level').eq('id',classId).maybeSingle(); if(ce)throw ce; if(!c)throw new Error('Class not found');
    document.querySelector('#class-title').textContent=c.name; 
    const {data:enrollments,error:e}=await supabase.from('enrollments').select('id,student_id,status,students(first_name,middle_name,last_name,student_id,photo_url)').eq('class_id',classId).eq('status','ACTIVE').order('created_at'); if(e)throw e;
    const ids=(enrollments||[]).map(x=>x.id); let results=[];
    if(ids.length){const r=await supabase.from('results').select('enrollment_id,term_id,subject_id,ca_score,exam_score,total,grade,status').in('enrollment_id',ids); if(r.error)throw r.error; results=r.data||[]}
    const resultBy={}; results.forEach(r=>{resultBy[r.enrollment_id]=(resultBy[r.enrollment_id]||0)+1});
    document.querySelector('#class-summary').textContent=`${enrollments?.length||0} student${(enrollments?.length||0)===1?'':'s'} · ${Object.keys(resultBy).length} with result records`;
    box.innerHTML=(enrollments||[]).map((x,i)=>{const s=x.students||{};return `<article class="student-result-row" style="--delay:${i*45}ms"><div class="student-result-avatar">${esc(initials(s.first_name,s.last_name))}</div><div class="student-result-info"><h3>${esc(`${s.first_name||''} ${s.middle_name||''} ${s.last_name||''}`.replace(/\s+/g,' ').trim()||'Unnamed student')}</h3><span>${esc(s.student_id||'No student ID')} · ${resultBy[x.id]||0} subject result${(resultBy[x.id]||0)===1?'':'s'}</span></div><a class="btn" href="student-result.html?student=${encodeURIComponent(x.id)}&class=${encodeURIComponent(classId)}">View Result →</a></article>`}).join('')||'<div class="result-empty"><h3>No active students</h3><p>This class has no active student enrolments yet.</p></div>';
  }catch(e){console.error(e);box.innerHTML='<div class="result-empty"><h3>Students could not be loaded</h3><p>Please refresh and try again.</p><button class="btn" id="retry-class">Retry</button></div>';document.querySelector('#retry-class')?.addEventListener('click',loadClassStudents);toast('Class students could not be loaded.','error')}
}

export async function renderStudentResult(){
  const shell=document.querySelector('#app-shell');
  shell.dataset.content=`<div class="result-page"><div class="result-hero"><div><span class="hero-kicker">STUDENT RESULT</span><h1 id="student-name">Loading result…</h1><p id="student-meta">Preparing academic record</p></div><a class="btn hero-add" href="result-pages.html?class=${encodeURIComponent(classId||'')}">← Back to Students</a></div><div id="student-result-content"><div class="result-loading"><span class="spinner"></span><b>Loading student result…</b><small>Preparing subjects and scores</small></div></div></div>`;
  try{
    const {data:e,error:ee}=await supabase.from('enrollments').select('id,class_id,students(first_name,middle_name,last_name,student_id,exam_number),classes(name,level)').eq('id',enrollmentId).maybeSingle(); if(ee)throw ee;if(!e)throw new Error('Student record not found');
    const r=await supabase.from('results').select('id,ca_score,exam_score,total,grade,grade_point,teacher_remark,principal_remark,position,status,subject_id,term_id,subjects(name,code),terms(name,academic_sessions(name))').eq('enrollment_id',enrollmentId).order('created_at'); if(r.error)throw r.error;
    const s=e.students||{}; const name=`${s.first_name||''} ${s.middle_name||''} ${s.last_name||''}`.replace(/\s+/g,' ').trim(); document.querySelector('#student-name').textContent=name||'Student Result';document.querySelector('#student-meta').textContent=`${s.student_id||'No ID'} · ${e.classes?.name||'Class'} · ${e.classes?.level||''}`;
    const rows=r.data||[]; const total=rows.reduce((a,x)=>a+Number(x.total||0),0); const avg=rows.length?Math.round(total/rows.length):0;
    document.querySelector('#student-result-content').innerHTML=`<div class="result-stat-grid"><div><b>${rows.length}</b><span>Subjects</span></div><div><b>${total}</b><span>Total Score</span></div><div><b>${avg}</b><span>Average</span></div><div><b>${rows.filter(x=>x.grade==='A').length}</b><span>A Grades</span></div></div><section class="panel result-table-panel"><div class="panel-head"><div><h2>Academic Result</h2><p>${esc(rows[0]?.terms?.academic_sessions?.name||'Current academic session')} · ${esc(rows[0]?.terms?.name||'All terms')}</p></div><button class="btn secondary" onclick="window.print()">Print Result</button></div><div class="table-wrap"><table><thead><tr><th>Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Point</th><th>Remark</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${esc(x.subjects?.name||'Subject')}</b><small>${esc(x.subjects?.code||'')}</small></td><td>${x.ca_score??0}</td><td>${x.exam_score??0}</td><td><b>${x.total??0}</b></td><td><span class="grade-badge grade-${esc(x.grade||grade(Number(x.total||0)))}">${esc(x.grade||grade(Number(x.total||0)))}</span></td><td>${x.grade_point??'—'}</td><td>${esc(x.teacher_remark||'—')}</td></tr>`).join('')||'<tr><td colspan="7" class="empty-cell">No result records have been entered for this student.</td></tr>'}</tbody></table></div></section>`;
  }catch(e){console.error(e);document.querySelector('#student-result-content').innerHTML='<div class="result-empty"><h3>Student result could not be loaded</h3><p>Please refresh and try again.</p><button class="btn" onclick="location.reload()">Retry</button></div>';toast('Student result could not be loaded.','error')}
}
