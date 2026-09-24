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
        <a class="btn btn-primary" href="new-class.html">+ Register New Class</a>
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
      if(!filtered.length){ list.innerHTML='<div class="class-empty"><div class="empty-icon">⌂</div><h3>No classes found</h3><p>Register a new class or change your search.</p><a class="btn btn-primary" href="new-class.html">Register New Class</a></div>'; return; }
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
  const root=document.querySelector('.page-content');
  const id=new URLSearchParams(location.search).get('id');
  root.innerHTML='<div class="loading-inline">Loading class profile…</div>';
  if(!id){root.innerHTML='<div class="class-empty"><h3>Class not found</h3><p>No class identifier was provided.</p><a class="btn btn-primary" href="classes.html">Back to Classes</a></div>';return;}
  try{
    const {row,students,assignments,timetable}=await loadClass(id);
    const active=students.filter(x=>x.status==='ACTIVE');
    const subjectCount=new Set(assignments.map(x=>x.subject_id)).size;
    const teacherCount=new Set(assignments.map(x=>x.teacher_id).filter(Boolean)).size;
    root.innerHTML=`<section class="class-profile-page">
      <div class="profile-topbar"><a class="profile-back" href="classes.html">← Classes</a><div class="profile-actions"><a class="btn btn-ghost" href="classes.html">Close</a><a class="btn btn-primary" href="new-class.html?id=${encodeURIComponent(id)}">Edit Class</a></div></div>
      <div class="profile-hero">
        <div class="profile-hero-pattern"></div>
        <div class="profile-avatar">${esc(initials(row.name))}</div>
        <div class="profile-title">
          <span class="profile-kicker">CLASS PROFILE</span>
          <h1>${esc(row.name)}</h1>
          <div class="profile-subline"><span>${esc(row.level||'Academic Class')}</span><i>•</i><span>${active.length} active students</span></div>
          <p>${esc(row.description||'No description has been added to this class yet.')}</p>
        </div>
        <div class="profile-hero-stat"><strong>${active.length}</strong><span>Students</span></div>
      </div>
      <div class="profile-stat-grid">
        <div class="profile-stat-card reveal"><span>Students</span><strong>${active.length}</strong><small>Active enrolments</small></div>
        <div class="profile-stat-card reveal"><span>Subjects</span><strong>${subjectCount}</strong><small>Assigned to class</small></div>
        <div class="profile-stat-card reveal"><span>Teachers</span><strong>${teacherCount}</strong><small>Teaching assignments</small></div>
        <div class="profile-stat-card reveal"><span>Timetable</span><strong>${timetable.length}</strong><small>Weekly entries</small></div>
      </div>
      <div class="profile-content-grid">
        <div class="profile-column">
          <section class="profile-panel reveal"><div class="profile-panel-head"><div><span class="panel-kicker">CLASS MEMBERS</span><h2>Students</h2><p>Active students assigned to this class.</p></div><span class="panel-count">${active.length}</span></div>${active.length?`<div class="student-profile-list">${active.map((s,i)=>`<div class="student-profile-row" style="--i:${i}"><div class="student-profile-avatar">${esc(initials(`${s.students?.first_name||''} ${s.students?.last_name||''}`))}</div><div class="student-profile-main"><strong>${esc(`${s.students?.first_name||''} ${s.students?.middle_name||''} ${s.students?.last_name||''}`.replace(/\s+/g,' ').trim()||'Student')}</strong><span>${esc(s.students?.student_id||'No student ID')}</span></div><span class="status-dot">ACTIVE</span></div>`).join('')}</div>`:'<div class="empty-profile">No active students are assigned to this class.</div>'}</section>
          <section class="profile-panel reveal"><div class="profile-panel-head"><div><span class="panel-kicker">TEACHING PLAN</span><h2>Subjects & Teachers</h2><p>Subjects and teaching responsibilities.</p></div><span class="panel-count">${assignments.length}</span></div>${assignments.length?`<div class="assignment-profile-list">${assignments.map((a,i)=>`<div class="assignment-profile-row" style="--i:${i}"><div class="assignment-subject-mark">${esc((a.subjects?.code||a.subjects?.name||'SUB').slice(0,3).toUpperCase())}</div><div class="assignment-subject-main"><strong>${esc(a.subjects?.name||'Subject')}</strong><span>${esc(a.subjects?.code||'No code')}</span></div><div class="assignment-teacher-main"><strong>${esc(a.teachers?.full_name||'Unassigned')}</strong><span>${esc(a.teachers?.staff_id||'Teacher not assigned')}</span></div></div>`).join('')}</div>`:'<div class="empty-profile">No subjects have been assigned yet.</div>'}</section>
        </div>
        <div class="profile-column">
          <section class="profile-panel reveal"><div class="profile-panel-head"><div><span class="panel-kicker">WEEKLY ROUTINE</span><h2>Class Timetable</h2><p>Your current timetable entries for this class.</p></div><span class="panel-count">${timetable.length}</span></div>${timetable.length?`<div class="timetable-profile-list">${timetable.map((t,i)=>`<div class="timetable-profile-row" style="--i:${i}"><div class="time-chip"><strong>${esc(String(t.start_time||'').slice(0,5))}</strong><span>${esc(String(t.end_time||'').slice(0,5))}</span></div><div class="timetable-main"><strong>${esc(t.subjects?.name||'Untitled subject')}</strong><span>${esc(t.teachers?.full_name||'No teacher')} ${t.room?`• ${esc(t.room)}`:''}</span></div><div class="day-chip">${esc(DAYS[t.day_of_week]||'—')}</div></div>`).join('')}</div>`:'<div class="empty-profile">No timetable entries have been added for this class.</div>'}</section>
          <section class="profile-panel profile-note-panel reveal"><div class="profile-note-icon">i</div><div><span class="panel-kicker">CLASS INFORMATION</span><h2>About this class</h2><p>${esc(row.description||'This class is ready for students, subjects, teachers and timetable information.')}</p><a class="text-link" href="new-class.html?id=${encodeURIComponent(id)}">Update class information →</a></div></section>
        </div>
      </div>
    </section>`;
  }catch(e){console.error(e);root.innerHTML=`<div class="class-empty"><h3>Could not load this class</h3><p>${esc(e.message||'Please try again.')}</p><a class="btn btn-primary" href="classes.html">Back to Classes</a></div>`;}
}

async function options(){
  const [{data:subjects,error:e1},{data:teachers,error:e2}]=await Promise.all([
    supabase.from('subjects').select('id,name,code,is_active,subject_kind,parent_subject_id,display_order').order('display_order',{ascending:true}).order('name',{ascending:true}),
    supabase.from('teachers').select('id,full_name,staff_id').eq('is_active',true).order('full_name')
  ]);
  if(e1)throw e1;if(e2)throw e2;
  return {subjects:subjects||[],teachers:teachers||[]};
}

export async function renderRegisterClass(){
  const root=document.querySelector('.page-content');
  const id=new URLSearchParams(location.search).get('id');
  let existing=null;

  root.innerHTML='<div class="loading-inline">Preparing class editor…</div>';

  try{
    if(id){
      const {data,error}=await supabase.from('classes').select('*').eq('id',id).maybeSingle();
      if(error)throw error;
      existing=data;
      if(!existing)throw new Error('Class not found');
    }

    const {subjects,teachers}=await options();
    let assignments=[];
    if(id){
      const {data,error}=await supabase.from('class_subjects').select('subject_id,teacher_id').eq('class_id',id);
      if(error)throw error;
      assignments=data||[];
    }

    const groups=subjects.filter(s=>s.subject_kind==='GROUP' && (s.is_active || assignments.some(a=>a.subject_id===s.id)));
    const leaves=subjects.filter(s=>s.subject_kind!=='GROUP');

    root.innerHTML=`<section class="edit-class-page">
      <div class="edit-class-header">
        <div class="edit-breadcrumb"><a href="classes.html">Classes</a><span>/</span><strong>${existing?'Edit Class':'Register Class'}</strong></div>
        <div class="edit-header-main">
          <div class="edit-class-badge">${existing?'EDIT':'NEW'}</div>
          <div><span class="eyebrow">ACADEMIC MANAGEMENT</span><h1>${existing?'Edit Class':'Register New Class'}</h1><p>${existing?'Update the class details and manage its subjects and teachers.':'Create the class, then assign the subjects and teachers that belong to it.'}</p></div>
        </div>
        <div class="edit-header-actions"><a class="btn btn-ghost" href="classes.html">Cancel</a><button form="class-form" class="btn btn-primary" type="submit">${existing?'Save Changes':'Create Class'}</button></div>
      </div>

      <form id="class-form" class="edit-class-layout">
        <div class="edit-main-column">
          <section class="edit-card edit-reveal">
            <div class="edit-card-heading"><div class="edit-step">01</div><div><h2>Class Information</h2><p>Give the class a clear name and academic level.</p></div></div>
            <div class="form-grid">
              <label>Class Name <span>*</span><input name="name" required maxlength="120" value="${esc(existing?.name||'')}" placeholder="e.g. Primary 1"></label>
              <label>Level / Stage<input name="level" list="class-level-options" value="${esc(existing?.level||'')}" placeholder="e.g. Primary 1"><datalist id="class-level-options"><option value="Nursery 1"><option value="Nursery 2"><option value="Nursery 3"><option value="Primary 1"><option value="Primary 2"><option value="Primary 3"><option value="Primary 4"><option value="Primary 5"><option value="Primary 6"><option value="JSS 1"><option value="JSS 2"><option value="JSS 3"></datalist></label>
              <label class="full-field">Class Description<textarea name="description" rows="6" maxlength="500" placeholder="Add a short description, class notes or any useful information.">${esc(existing?.description||'')}</textarea><small class="field-counter"><span id="description-count">${String(existing?.description||'').length}</span>/500</small></label>
            </div>
          </section>

          <section class="edit-card edit-reveal">
            <div class="edit-card-heading"><div class="edit-step">02</div><div><h2>Subjects & Teachers</h2><p>Assign the actual scorable subjects. Combined headings such as BST, RNV and PVS are shown as group labels.</p></div></div>

            <div class="assignment-info-bar">
              <div class="assignment-info-icon">✓</div>
              <div><strong>Subject structure</strong><span>Components remain individual subjects for teaching and result entry, while their combined group is kept for the report structure.</span></div>
            </div>

            <div id="assignments" class="edit-assignment-list"></div>
            <button type="button" class="btn btn-add-assignment edit-add" id="add-assignment">+ Add Subject & Teacher</button>
          </section>
        </div>

        <aside class="edit-side-column">
          <div class="edit-summary-card edit-reveal">
            <span class="panel-kicker">LIVE SUMMARY</span>
            <div class="summary-avatar" id="summary-avatar">${esc(initials(existing?.name||'Class'))}</div>
            <h3 id="summary-name">${esc(existing?.name||'New Class')}</h3>
            <span class="summary-level" id="summary-level">${esc(existing?.level||'Academic Class')}</span>
            <div class="summary-stats-row">
              <div><strong id="summary-count">${assignments.length}</strong><span>Assignments</span></div>
              <div><strong id="summary-unique">0</strong><span>Subjects</span></div>
            </div>
            <p>Everything is saved to the school's academic database when you submit.</p>
          </div>

          <div class="edit-help-card edit-reveal">
            <div class="help-icon">i</div>
            <div><strong>Good to know</strong><p>You can add or remove assignments before saving. The same subject should only appear once in this class.</p></div>
          </div>
        </aside>
      </form>
    </section>`;

    const box=document.querySelector('#assignments');
    const count=document.querySelector('#summary-count');
    const unique=document.querySelector('#summary-unique');
    const desc=document.querySelector('textarea[name=description]');
    const descCount=document.querySelector('#description-count');

    function subjectOptions(selected){
      const standalone=leaves.filter(s=>!s.parent_subject_id);
      const grouped=new Map(groups.map(g=>[g.id,[]]));
      leaves.filter(s=>s.parent_subject_id && grouped.has(s.parent_subject_id)).forEach(s=>grouped.get(s.parent_subject_id).push(s));

      let html='<option value="">Select subject…</option>';
      if(standalone.length){
        html+='<optgroup label="Standalone Subjects">';
        html+=standalone.map(s=>`<option value="${s.id}" ${selected===s.id?'selected':''} ${!s.is_active&&selected!==s.id?'disabled':''}>${esc(s.name)}${s.code?` — ${esc(s.code)}`:''}${!s.is_active?' (Inactive)':''}</option>`).join('');
        html+='</optgroup>';
      }
      groups.forEach(g=>{
        const kids=grouped.get(g.id)||[];
        if(!kids.length)return;
        html+=`<optgroup label="${esc(g.code||g.name)} — ${esc(g.name.replace(/^[^–-]+[–-]\s*/,'')||g.name)}">`;
        html+=kids.sort((a,b)=>Number(a.display_order||0)-Number(b.display_order||0)||a.name.localeCompare(b.name)).map(s=>`<option value="${s.id}" ${selected===s.id?'selected':''} ${!s.is_active&&selected!==s.id?'disabled':''}>${esc(s.name)}${s.code?` — ${esc(s.code)}`:''}${!s.is_active?' (Inactive)':''}</option>`).join('');
        html+='</optgroup>';
      });
      return html;
    }

    function addAssignment(a={}){
      const el=document.createElement('div');
      el.className='edit-assignment-row';
      el.innerHTML=`<div class="edit-field"><label>Subject</label><select class="assignment-subject" required>${subjectOptions(a.subject_id)}</select></div><div class="edit-field"><label>Teacher</label><select class="assignment-teacher"><option value="">Unassigned teacher</option>${teachers.map(t=>`<option value="${t.id}" ${a.teacher_id===t.id?'selected':''}>${esc(t.full_name)}${t.staff_id?` — ${esc(t.staff_id)}`:''}</option>`).join('')}</select></div><button type="button" class="btn btn-remove-assignment" title="Remove assignment">×</button>`;
      el.querySelector('.btn-remove-assignment').onclick=()=>{el.remove();syncSummary();};
      box.appendChild(el);
    }

    function syncSummary(){
      const name=document.querySelector('input[name=name]').value.trim()||'New Class';
      const level=document.querySelector('input[name=level]').value.trim()||'Academic Class';
      const rows=[...box.querySelectorAll('.edit-assignment-row')];
      const subjectIds=rows.map(r=>r.querySelector('.assignment-subject').value).filter(Boolean);
      document.querySelector('#summary-name').textContent=name;
      document.querySelector('#summary-level').textContent=level;
      document.querySelector('#summary-avatar').textContent=initials(name);
      count.textContent=rows.length;
      unique.textContent=new Set(subjectIds).size;
    }

    function validateAssignments(){
      const ids=[...box.querySelectorAll('.assignment-subject')].map(x=>x.value).filter(Boolean);
      const duplicate=ids.find((x,i)=>ids.indexOf(x)!==i);
      if(duplicate)throw new Error('The same subject has been added more than once. Remove the duplicate before saving.');
      return [...box.querySelectorAll('.edit-assignment-row')].map(r=>({
        subject_id:r.querySelector('.assignment-subject').value,
        teacher_id:r.querySelector('.assignment-teacher').value||null
      })).filter(x=>x.subject_id);
    }

    (assignments.length?assignments:[]).forEach(addAssignment);
    document.querySelector('#add-assignment').onclick=()=>{addAssignment();syncSummary();};
    document.querySelectorAll('input[name=name],input[name=level]').forEach(x=>x.addEventListener('input',syncSummary));
    desc?.addEventListener('input',()=>{descCount.textContent=desc.value.length;});
    syncSummary();

    document.querySelector('#class-form').onsubmit=async e=>{
      e.preventDefault();
      const btn=document.querySelector('.edit-header-actions button[type=submit]');
      setLoading(btn,true,'Saving…');
      try{
        const fd=new FormData(e.target);
        const name=String(fd.get('name')||'').trim();
        const level=String(fd.get('level')||'').trim()||null;
        const description=String(fd.get('description')||'').trim()||null;
        if(!name)throw new Error('Class name is required.');

        const duplicateQuery=supabase.from('classes').select('id,name,level').ilike('name',name);
        const {data:duplicates,error:dupError}=await duplicateQuery;
        if(dupError)throw dupError;
        const conflicting=(duplicates||[]).find(x=>x.id!==id && String(x.name).trim().toLowerCase()===name.toLowerCase());
        if(conflicting)throw new Error('A class with this name already exists. Please use a different class name.');

        const classPayload={name,level,description};
        let classId=id;
        if(id){
          const {error}=await supabase.from('classes').update(classPayload).eq('id',id);
          if(error)throw error;
        }else{
          const {data,error}=await supabase.from('classes').insert(classPayload).select('id').single();
          if(error)throw error;
          classId=data.id;
        }

        const pairs=validateAssignments().map(x=>({...x,class_id:classId}));
        const {error:de}=await supabase.from('class_subjects').delete().eq('class_id',classId);
        if(de)throw de;
        if(pairs.length){
          const {error:ie}=await supabase.from('class_subjects').insert(pairs);
          if(ie)throw ie;
        }

        toast(existing?'Class updated successfully.':'Class registered successfully.');
        location.href=`class-details.html?id=${encodeURIComponent(classId)}`;
      }catch(err){
        console.error(err);
        toast(err.message||'Could not save class.','error');
      }finally{setLoading(btn,false);}
    };
  }catch(e){
    console.error(e);
    root.innerHTML=`<div class="class-empty"><h3>Unable to open class editor</h3><p>${esc(e.message||'Please try again.')}</p><a class="btn btn-primary" href="classes.html">Back to Classes</a></div>`;
  }
}
