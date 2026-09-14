import { supabase, escapeHtml, toast, setLoading } from './app.js';

const esc = escapeHtml;
const DAYS = ['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function initials(name='Class'){ return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'CL'; }

async function classRows(){
  const { data, error } = await supabase.from('classes').select('id,name,level,description,created_at').order('name');
  if(error) throw error;
  const rows = data || [];
  if(!rows.length) return [];
  const ids = rows.map(x=>x.id);
  const [{data:enrollments,error:e1},{data:assignments,error:e2}] = await Promise.all([
    supabase.from('enrollments').select('class_id,status').in('class_id',ids),
    supabase.from('class_subjects').select('class_id,subject_id,teacher_id,subjects(name,code),teachers(full_name)').in('class_id',ids)
  ]);
  if(e1) throw e1; if(e2) throw e2;
  return rows.map(row=>{
    const es=(enrollments||[]).filter(x=>x.class_id===row.id && x.status==='ACTIVE');
    const as=(assignments||[]).filter(x=>x.class_id===row.id);
    return {...row,studentCount:es.length,subjectCount:new Set(as.map(x=>x.subject_id)).size,teacherCount:new Set(as.map(x=>x.teacher_id).filter(Boolean)).size,assignments:as};
  });
}

export async function renderClassesPage(){
  const root=document.querySelector('.page-content');
  root.innerHTML=`
    <section class="class-page">
      <div class="class-hero">
        <div><span class="eyebrow">ACADEMIC MANAGEMENT</span><h1>Classes</h1><p>Organise your school classes, students, subjects and teaching assignments from one place.</p></div>
        <a class="btn btn-primary" href="register-class.html">+ Register New Class</a>
      </div>
      <div class="class-metrics" id="class-metrics"><div class="metric-skeleton"></div><div class="metric-skeleton"></div><div class="metric-skeleton"></div><div class="metric-skeleton"></div></div>
      <div class="class-toolbar"><div class="class-search"><span>⌕</span><input id="class-search" placeholder="Search class name or level…"></div><button class="btn btn-ghost" id="class-refresh">↻ Refresh</button></div>
      <div id="class-list" class="class-grid"><div class="loading-inline">Loading classes…</div></div>
    </section>`;

  const list=document.querySelector('#class-list');
  const search=document.querySelector('#class-search');
  async function refresh(){
    list.innerHTML='<div class="loading-inline">Loading classes…</div>';
    try{
      const rows=await classRows();
      const q=search.value.trim().toLowerCase();
      const filtered=rows.filter(r=>!q || `${r.name} ${r.level||''}`.toLowerCase().includes(q));
      const totals={classes:rows.length,students:rows.reduce((a,r)=>a+r.studentCount,0),subjects:rows.reduce((a,r)=>a+r.subjectCount,0),teachers:new Set(rows.flatMap(r=>r.assignments.map(x=>x.teacher_id).filter(Boolean))).size};
      document.querySelector('#class-metrics').innerHTML=`<div class="class-metric"><span>Classes</span><strong>${totals.classes}</strong><small>Academic groups</small></div><div class="class-metric"><span>Active Students</span><strong>${totals.students}</strong><small>Current enrolments</small></div><div class="class-metric"><span>Subjects</span><strong>${totals.subjects}</strong><small>Assigned across classes</small></div><div class="class-metric"><span>Teachers</span><strong>${totals.teachers}</strong><small>Currently assigned</small></div>`;
      if(!filtered.length){ list.innerHTML='<div class="class-empty"><div class="empty-icon">⌂</div><h3>No classes found</h3><p>Register a new class or change your search.</p><a class="btn btn-primary" href="register-class.html">Register New Class</a></div>'; return; }
      list.innerHTML=filtered.map((r,i)=>`<article class="class-card" style="--delay:${i*70}ms"><div class="class-card-top"><div class="class-avatar">${esc(initials(r.name))}</div><span class="class-level">${esc(r.level||'Class')}</span></div><div class="class-card-body"><h2>${esc(r.name)}</h2><p>${esc(r.description||'No class description added yet.')}</p><div class="class-counts"><div><strong>${r.studentCount}</strong><span>Students</span></div><div><strong>${r.subjectCount}</strong><span>Subjects</span></div><div><strong>${r.teacherCount}</strong><span>Teachers</span></div></div></div><div class="class-card-footer"><span>${r.studentCount ? 'Active class' : 'No active students'}</span><a class="btn btn-sm btn-ghost" href="class-details.html?id=${encodeURIComponent(r.id)}">View Class</a></div></article>`).join('');
    }catch(e){ console.error(e); list.innerHTML='<div class="class-empty"><h3>Unable to load classes</h3><p>Please refresh and try again.</p></div>'; toast('Could not load classes.','error'); }
  }
  search.addEventListener('input',refresh); document.querySelector('#class-refresh').addEventListener('click',refresh); await refresh();
}

async function loadClass(id){
  const [{data:row,error:e1},{data:students,error:e2},{data:assignments,error:e3},{data:timetable,error:e4}]=await Promise.all([
    supabase.from('classes').select('id,name,level,description,created_at').eq('id',id).maybeSingle(),
    supabase.from('enrollments').select('id,status,students(student_id,first_name,middle_name,last_name,photo_url)').eq('class_id',id).order('created_at',{ascending:false}),
    supabase.from('class_subjects').select('id,subject_id,teacher_id,subjects(name,code),teachers(full_name,staff_id)').eq('class_id',id),
    supabase.from('timetables').select('id,day_of_week,start_time,end_time,room,subjects(name),teachers(full_name)').eq('class_id',id).order('day_of_week').order('start_time')
  ]);
  if(e1) throw e1;if(e2)throw e2;if(e3)throw e3;if(e4)throw e4;
  if(!row) throw new Error('Class not found');
  return {row,students:students||[],assignments:assignments||[],timetable:timetable||[]};
}

export async function renderClassDetails(){
  const root=document.querySelector('.page-content'); const id=new URLSearchParams(location.search).get('id');
  root.innerHTML='<div class="loading-inline">Loading class details…</div>'; if(!id){root.innerHTML='<div class="class-empty"><h3>Class not found</h3><a class="btn btn-primary" href="classes.html">Back to Classes</a></div>';return;}
  try{
    const {row,students,assignments,timetable}=await loadClass(id); const active=students.filter(x=>x.status==='ACTIVE');
    root.innerHTML=`<section class="class-detail-page"><div class="detail-back"><a href="classes.html">← Back to Classes</a><a class="btn btn-primary" href="register-class.html?id=${encodeURIComponent(id)}">Edit Class</a></div><div class="class-detail-hero"><div class="class-avatar large">${esc(initials(row.name))}</div><div><span class="eyebrow">CLASS PROFILE</span><h1>${esc(row.name)}</h1><p>${esc(row.level||'Academic class')}</p><small>${esc(row.description||'No description added.')}</small></div></div><div class="detail-metrics"><div><strong>${active.length}</strong><span>Active Students</span></div><div><strong>${new Set(assignments.map(x=>x.subject_id)).size}</strong><span>Subjects</span></div><div><strong>${new Set(assignments.map(x=>x.teacher_id).filter(Boolean)).size}</strong><span>Teachers</span></div><div><strong>${timetable.length}</strong><span>Timetable Entries</span></div></div><div class="detail-columns"><div class="panel"><div class="panel-head"><div><h2>Students</h2><p>Students currently assigned to this class.</p></div></div>${active.length?`<div class="student-mini-list">${active.map(s=>`<div class="student-mini"><div class="mini-avatar">${esc(initials(`${s.students?.first_name||''} ${s.students?.last_name||''}`))}</div><div><strong>${esc(`${s.students?.first_name||''} ${s.students?.middle_name||''} ${s.students?.last_name||''}`.replace(/\s+/g,' ').trim())}</strong><span>${esc(s.students?.student_id||'No student ID')}</span></div></div>`).join('')}</div>`:'<div class="empty">No active students in this class.</div>'}</div><div class="panel"><div class="panel-head"><div><h2>Subjects & Teachers</h2><p>Teaching assignments for this class.</p></div></div>${assignments.length?`<div class="assignment-list">${assignments.map(a=>`<div class="assignment-row"><div><strong>${esc(a.subjects?.name||'Subject')}</strong><span>${esc(a.subjects?.code||'')}</span></div><div>${esc(a.teachers?.full_name||'Unassigned')}<small>${esc(a.teachers?.staff_id||'')}</small></div></div>`).join('')}</div>`:'<div class="empty">No subject assignments yet.</div>'}</div></div><div class="panel"><div class="panel-head"><div><h2>Class Timetable</h2><p>Weekly schedule entries for this class.</p></div></div>${timetable.length?`<div class="table-wrap"><table><thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th></tr></thead><tbody>${timetable.map(t=>`<tr><td>${DAYS[t.day_of_week]||'—'}</td><td>${esc(String(t.start_time||'').slice(0,5))} – ${esc(String(t.end_time||'').slice(0,5))}</td><td>${esc(t.subjects?.name||'—')}</td><td>${esc(t.teachers?.full_name||'—')}</td><td>${esc(t.room||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No timetable entries for this class.</div>'}</div></section>`;
  }catch(e){console.error(e);root.innerHTML=`<div class="class-empty"><h3>Could not load this class</h3><p>${esc(e.message||'Please try again.')}</p><a class="btn btn-primary" href="classes.html">Back to Classes</a></div>`;}
}

async function options(){
  const [{data:subjects,error:e1},{data:teachers,error:e2}]=await Promise.all([supabase.from('subjects').select('id,name,code').eq('is_active',true).order('name'),supabase.from('teachers').select('id,full_name,staff_id').eq('is_active',true).order('full_name')]);
  if(e1)throw e1;if(e2)throw e2;return {subjects:subjects||[],teachers:teachers||[]};
}

export async function renderRegisterClass(){
  const root=document.querySelector('.page-content'); const id=new URLSearchParams(location.search).get('id'); let existing=null;
  root.innerHTML='<div class="loading-inline">Preparing class form…</div>';
  try{if(id){const {data,error}=await supabase.from('classes').select('*').eq('id',id).maybeSingle();if(error)throw error;existing=data;} const {subjects,teachers}=await options(); let assignments=[];
    if(id){const {data,error}=await supabase.from('class_subjects').select('subject_id,teacher_id').eq('class_id',id);if(error)throw error;assignments=data||[];}
    root.innerHTML=`<section class="register-class-page"><div class="detail-back"><a href="classes.html">← Back to Classes</a></div><div class="register-head"><div><span class="eyebrow">ACADEMIC SETUP</span><h1>${existing?'Edit Class':'Register New Class'}</h1><p>${existing?'Update the class information and teaching assignments.':'Create a class and assign its subjects and teachers.'}</p></div></div><form id="class-form" class="register-class-layout"><div class="panel"><h2>Class information</h2><div class="form-grid"><label>Class Name *<input name="name" required value="${esc(existing?.name||'')}" placeholder="e.g. Primary 5"></label><label>Level<input name="level" value="${esc(existing?.level||'')}" placeholder="e.g. Primary"></label><label class="full-field">Description<textarea name="description" placeholder="Short description about this class">${esc(existing?.description||'')}</textarea></label></div></div><div class="panel"><div class="panel-head"><div><h2>Subjects & teachers</h2><p>Add the subjects taught in this class and the responsible teacher.</p></div><button type="button" class="btn btn-ghost" id="add-assignment">+ Add Assignment</button></div><div id="assignments" class="assignment-editor"></div><div class="form-actions"><button type="submit" class="btn btn-primary">${existing?'Save Changes':'Create Class'}</button><a class="btn btn-ghost" href="classes.html">Cancel</a></div></div></form></section>`;
    const box=document.querySelector('#assignments');
    function addAssignment(a={}){const el=document.createElement('div');el.className='assignment-editor-row';el.innerHTML=`<select class="assignment-subject" required><option value="">Select subject…</option>${subjects.map(s=>`<option value="${s.id}" ${a.subject_id===s.id?'selected':''}>${esc(s.name)}${s.code?` — ${esc(s.code)}`:''}</option>`).join('')}</select><select class="assignment-teacher"><option value="">Unassigned teacher</option>${teachers.map(t=>`<option value="${t.id}" ${a.teacher_id===t.id?'selected':''}>${esc(t.full_name)}${t.staff_id?` — ${esc(t.staff_id)}`:''}</option>`).join('')}</select><button type="button" class="btn btn-sm btn-danger remove-assignment">Remove</button>`;el.querySelector('.remove-assignment').onclick=()=>el.remove();box.appendChild(el);}
    (assignments.length?assignments:[{}]).forEach(addAssignment); document.querySelector('#add-assignment').onclick=()=>addAssignment();
    document.querySelector('#class-form').onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('button[type=submit]');setLoading(btn,true,'Saving…');try{const fd=new FormData(e.target);const payload={name:fd.get('name'),level:fd.get('level')||null,description:fd.get('description')||null};let classId=id;if(id){const {error}=await supabase.from('classes').update(payload).eq('id',id);if(error)throw error;}else{const {data,error}=await supabase.from('classes').insert(payload).select('id').single();if(error)throw error;classId=data.id;}const pairs=[...box.querySelectorAll('.assignment-editor-row')].map(r=>({class_id:classId,subject_id:r.querySelector('.assignment-subject').value,teacher_id:r.querySelector('.assignment-teacher').value||null})).filter(x=>x.subject_id);const {error:de}=await supabase.from('class_subjects').delete().eq('class_id',classId);if(de)throw de;if(pairs.length){const {error:ie}=await supabase.from('class_subjects').insert(pairs);if(ie)throw ie;}toast(existing?'Class updated successfully.':'Class registered successfully.');location.href=`class-details.html?id=${encodeURIComponent(classId)}`;}catch(err){console.error(err);toast(err.message||'Could not save class.','error');}finally{setLoading(btn,false);}};
  }catch(e){console.error(e);root.innerHTML=`<div class="class-empty"><h3>Unable to open class form</h3><p>${esc(e.message||'Please try again.')}</p><a class="btn btn-primary" href="classes.html">Back to Classes</a></div>`;}
}
