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
    supabase.from('class_subjects').select('id,subject_id,teacher_id,subjects(id,name,code,parent_subject_id,subject_kind),teachers(full_name,staff_id)').eq('class_id',id),
    supabase.from('timetables').select('id,day_of_week,start_time,end_time,room,subjects(name),teachers(full_name)').eq('class_id',id).order('day_of_week').order('start_time')
  ]);
  if(e1) throw e1;if(e2)throw e2;if(e3)throw e3;if(e4)throw e4;
  if(!row) throw new Error('Class not found');
  return {row,students:students||[],assignments:assignments||[],timetable:timetable||[]};
}

function renderClassSubjectAssignments(assignments=[]){
  const normalized=(assignments||[]).filter(a=>a.subjects).map(a=>({...a,subject:a.subjects}));
  const groups=new Map();
  normalized.filter(a=>a.subject.subject_kind==='GROUP').forEach(a=>{
    if(!groups.has(a.subject.id)) groups.set(a.subject.id,{subject:a.subject,children:[]});
  });
  normalized.filter(a=>a.subject.subject_kind!=='GROUP' && a.subject.parent_subject_id).forEach(a=>{
    const group=groups.get(a.subject.parent_subject_id);
    if(group) group.children.push(a);
  });

  const groupedHtml=[...groups.values()]
    .filter(g=>g.children.length)
    .sort((a,b)=>Number(a.subject.display_order||0)-Number(b.subject.display_order||0)||String(a.subject.name).localeCompare(String(b.subject.name)))
    .map(g=>{
      g.children.sort((a,b)=>Number(a.subject.display_order||0)-Number(b.subject.display_order||0)||String(a.subject.name).localeCompare(String(b.subject.name)));
      return `
        <section class="result-subject-group">
          <div class="result-group-header">
            <div class="result-group-code">${esc(g.subject.code||'GROUP')}</div>
            <div class="result-group-title">
              <strong>${esc(g.subject.code||g.subject.name)}</strong>
              <span>${esc(g.subject.name.replace(/^[^–-]+[–-]\s*/,'')||g.subject.name)}</span>
            </div>
            <span class="result-group-count">${g.children.length} subject${g.children.length===1?'':'s'}</span>
          </div>
          <div class="result-group-rule"></div>
          <div class="result-group-children">
            ${g.children.map((a,i)=>`
              <div class="result-subject-line" style="--i:${i}">
                <div class="result-line-branch"></div>
                <div class="result-subject-name">
                  <strong>${esc(a.subject.name)}</strong>
                  <span>${esc(a.subject.code||'Component subject')}</span>
                </div>
                <div class="result-subject-teacher">
                  <strong>${esc(a.teachers?.full_name||'Unassigned')}</strong>
                  <span>${esc(a.teachers?.staff_id||'Teacher not assigned')}</span>
                </div>
              </div>`).join('')}
          </div>
        </section>`;
    }).join('');

  const groupedIds=new Set([...groups.values()].flatMap(g=>g.children.map(a=>a.subject.id)));
  const standalone=normalized
    .filter(a=>a.subject.subject_kind!=='GROUP' && !a.subject.parent_subject_id && !groupedIds.has(a.subject.id))
    .sort((a,b)=>Number(a.subject.display_order||0)-Number(b.subject.display_order||0)||String(a.subject.name).localeCompare(String(b.subject.name)));

  const standaloneHtml=standalone.length?`
    <section class="result-subject-group standalone-result-group">
      <div class="result-group-header">
        <div class="result-group-code standalone-code">•</div>
        <div class="result-group-title"><strong>Standalone Subjects</strong><span>Individual subjects assigned to this class</span></div>
        <span class="result-group-count">${standalone.length}</span>
      </div>
      <div class="result-group-rule"></div>
      <div class="result-group-children">
        ${standalone.map((a,i)=>`
          <div class="result-subject-line" style="--i:${i}">
            <div class="result-line-branch"></div>
            <div class="result-subject-name">
              <strong>${esc(a.subject.name)}</strong>
              <span>${esc(a.subject.code||'Standalone subject')}</span>
            </div>
            <div class="result-subject-teacher">
              <strong>${esc(a.teachers?.full_name||'Unassigned')}</strong>
              <span>${esc(a.teachers?.staff_id||'Teacher not assigned')}</span>
            </div>
          </div>`).join('')}
      </div>
    </section>`:'';

  return groupedHtml+standaloneHtml;
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
          <section class="profile-panel reveal"><div class="profile-panel-head"><div><span class="panel-kicker">TEACHING PLAN</span><h2>Subjects & Teachers</h2><p>Combined subjects are shown as headers with their selected subjects underneath.</p></div><span class="panel-count">${assignments.length}</span></div>${assignments.length?`<div class="result-subject-structure">${renderClassSubjectAssignments(assignments)}</div>`:'<div class="empty-profile">No subjects have been assigned yet.</div>'}</section>
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

    const groups=subjects.filter(s=>s.subject_kind==='GROUP');
    const leaves=subjects.filter(s=>s.subject_kind!=='GROUP');
    const assignmentMap=new Map(assignments.map(a=>[a.subject_id,a]));
    const groupedLeaves=new Map(groups.map(g=>[g.id,[]]));
    leaves.filter(s=>s.parent_subject_id && groupedLeaves.has(s.parent_subject_id))
      .forEach(s=>groupedLeaves.get(s.parent_subject_id).push(s));

    root.innerHTML=`<section class="edit-class-page">
      <div class="edit-class-header">
        <div class="edit-breadcrumb"><a href="classes.html">Classes</a><span>/</span><strong>${existing?'Edit Class':'Register Class'}</strong></div>
        <div class="edit-header-main">
          <div class="edit-class-badge">${existing?'EDIT':'NEW'}</div>
          <div><span class="eyebrow">ACADEMIC MANAGEMENT</span><h1>${existing?'Edit Class':'Register New Class'}</h1><p>${existing?'Update the class details and choose the subjects that belong to this class.':'Create the class, then choose its combined subjects and individual subjects.'}</p></div>
        </div>
        <div class="edit-header-actions"><a class="btn btn-ghost" href="classes.html">Cancel</a><button form="class-form" class="btn btn-primary" type="submit">${existing?'Save Changes':'Create Class'}</button></div>
      </div>

      <form id="class-form" class="edit-class-layout">
        <div class="edit-main-column">
          <section class="edit-card edit-reveal">
            <div class="edit-card-heading"><div class="edit-step">01</div><div><h2>Class Information</h2><p>Enter the basic details for this class.</p></div></div>
            <div class="class-basic-grid">
              <div class="class-input-group"><label for="class-name">Class Name <span>*</span></label><input id="class-name" name="name" required maxlength="120" value="${esc(existing?.name||'')}" placeholder="e.g. Primary 1"></div>
              <div class="class-input-group"><label for="class-level">Level / Stage</label><input id="class-level" name="level" list="class-level-options" value="${esc(existing?.level||'')}" placeholder="e.g. Primary 1"><datalist id="class-level-options"><option value="Nursery 1"><option value="Nursery 2"><option value="Nursery 3"><option value="Primary 1"><option value="Primary 2"><option value="Primary 3"><option value="Primary 4"><option value="Primary 5"><option value="Primary 6"><option value="JSS 1"><option value="JSS 2"><option value="JSS 3"></datalist></div>
              <div class="class-input-group class-description-group"><label for="class-description">Class Description</label><textarea id="class-description" name="description" rows="5" maxlength="500" placeholder="Add a short description or useful class information.">${esc(existing?.description||'')}</textarea><small><span id="description-count">${String(existing?.description||'').length}</span>/500</small></div>
            </div>
          </section>

          <section class="edit-card edit-reveal">
            <div class="edit-card-heading"><div class="edit-step">02</div><div><h2>Choose Subjects</h2><p>Select a combined subject, then choose all of its component subjects or select them one by one.</p></div></div>

            <div class="subject-selector-box">
              <div class="subject-selector-title"><div class="subject-selector-icon">▦</div><div><strong>Choose Combined Subject</strong><span>Pick BST, RNV, PVS or another combined subject.</span></div></div>
              <div class="subject-selector-row"><select id="combined-subject-picker"><option value="">Choose combined subject…</option>${groups.map(g=>`<option value="${g.id}">${esc(g.code||g.name)} — ${esc(g.name.replace(/^[^–-]+[–-]\s*/,'')||g.name)}</option>`).join('')}</select><button type="button" class="btn btn-primary" id="add-combined">Add Combined Subject</button></div>
            </div>

            <div id="combined-boards" class="combined-boards"></div>

            <div class="subject-selector-box standalone-selector-box">
              <div class="subject-selector-title"><div class="subject-selector-icon standalone">•</div><div><strong>Choose Standalone Subject</strong><span>Use this for Mathematics, English, Yoruba, History, CCA, Writing or another standalone subject.</span></div></div>
              <div class="subject-selector-row"><select id="standalone-subject-picker"><option value="">Choose standalone subject…</option>${leaves.filter(s=>!s.parent_subject_id).map(s=>`<option value="${s.id}" ${!s.is_active?'disabled':''}>${esc(s.name)}${s.code?` — ${esc(s.code)}`:''}${!s.is_active?' (Inactive)':''}</option>`).join('')}</select><button type="button" class="btn btn-ghost" id="add-standalone">Add Standalone Subject</button></div>
            </div>

            <div id="standalone-assignments" class="standalone-assignments"></div>
          </section>
        </div>

        <aside class="edit-side-column">
          <div class="edit-summary-card edit-reveal">
            <span class="panel-kicker">LIVE SUMMARY</span>
            <div class="summary-avatar" id="summary-avatar">${esc(initials(existing?.name||'Class'))}</div>
            <h3 id="summary-name">${esc(existing?.name||'New Class')}</h3>
            <span class="summary-level" id="summary-level">${esc(existing?.level||'Academic Class')}</span>
            <div class="summary-stats-row">
              <div><strong id="summary-count">0</strong><span>Selected Subjects</span></div>
              <div><strong id="summary-groups">0</strong><span>Combined Groups</span></div>
            </div>
            <p>Use the checkboxes under each combined subject to choose every component you want to teach and assess.</p>
          </div>

          <div class="edit-help-card edit-reveal">
            <div class="help-icon">✓</div>
            <div><strong>How subject selection works</strong><p>Choose BST, RNV or PVS. Its component subjects slide down below the header. Use the box beside the header to select all, or tick each component individually.</p></div>
          </div>
        </aside>
      </form>
    </section>`;

    const combinedBoards=document.querySelector('#combined-boards');
    const standaloneAssignments=document.querySelector('#standalone-assignments');
    const combinedPicker=document.querySelector('#combined-subject-picker');
    const standalonePicker=document.querySelector('#standalone-subject-picker');

    const teacherOptions=(selected='')=>'<option value="">Unassigned teacher</option>'+teachers.map(t=>`<option value="${t.id}" ${selected===t.id?'selected':''}>${esc(t.full_name)}${t.staff_id?` — ${esc(t.staff_id)}`:''}</option>`).join('');

    function childrenOf(groupId){
      return (groupedLeaves.get(groupId)||[]).slice().sort((a,b)=>Number(a.display_order||0)-Number(b.display_order||0)||a.name.localeCompare(b.name));
    }

    function selectedSubjectIds(){
      const ids=[];
      combinedBoards.querySelectorAll('.component-check:checked').forEach(x=>ids.push(x.value));
      standaloneAssignments.querySelectorAll('.standalone-check:checked').forEach(x=>ids.push(x.value));
      return ids;
    }

    function syncSummary(){
      const name=document.querySelector('#class-name').value.trim()||'New Class';
      const level=document.querySelector('#class-level').value.trim()||'Academic Class';
      const ids=selectedSubjectIds();
      document.querySelector('#summary-name').textContent=name;
      document.querySelector('#summary-level').textContent=level;
      document.querySelector('#summary-avatar').textContent=initials(name);
      document.querySelector('#summary-count').textContent=ids.length;
      document.querySelector('#summary-groups').textContent=combinedBoards.querySelectorAll('.combined-subject-board').length;
    }

    function refreshGroupState(board){
      const checks=[...board.querySelectorAll('.component-check')];
      const selected=checks.filter(x=>x.checked);
      const selectAll=board.querySelector('.group-select-all');
      const some=selected.length>0;
      selectAll.checked=checks.length>0 && selected.length===checks.length;
      selectAll.indeterminate=some && selected.length<checks.length;
      board.classList.toggle('has-selection',some);
      board.querySelectorAll('.component-teacher').forEach((select,index)=>{
        const check=checks[index];
        select.disabled=!check.checked;
      });
      board.querySelector('.group-selected-count').textContent=`${selected.length}/${checks.length} selected`;
      syncSummary();
    }

    function addCombined(groupId, forceOpen=true){
      if(!groupId)return;
      const group=groups.find(g=>g.id===groupId);
      if(!group)return;
      if(combinedBoards.querySelector(`.combined-subject-board[data-group-id="${groupId}"]`)){
        const existingBoard=combinedBoards.querySelector(`.combined-subject-board[data-group-id="${groupId}"]`);
        existingBoard.classList.add('board-flash');
        setTimeout(()=>existingBoard.classList.remove('board-flash'),500);
        existingBoard.scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
      const children=childrenOf(groupId);
      if(!children.length){
        toast(`${group.name} has no component subjects configured yet.`,'error');
        return;
      }

      const board=document.createElement('section');
      board.className='combined-subject-board';
      board.dataset.groupId=groupId;
      board.innerHTML=`
        <div class="combined-subject-header">
          <label class="group-check-wrap" title="Select all components">
            <input type="checkbox" class="group-select-all">
            <span class="fake-checkbox"></span>
          </label>
          <div class="combined-subject-heading">
            <div class="combined-code">${esc(group.code||'GROUP')}</div>
            <div><strong>${esc(group.name)}</strong><span>${children.length} component subjects</span></div>
          </div>
          <span class="group-selected-count">0/${children.length} selected</span>
          <button type="button" class="remove-group" title="Remove combined subject">×</button>
        </div>
        <div class="combined-subject-body">
          ${children.map(child=>{
            const saved=assignmentMap.get(child.id);
            const checked=!!saved;
            return `<div class="component-row ${checked?'selected':''}">
              <label class="component-check-wrap">
                <input type="checkbox" class="component-check" value="${child.id}" ${checked?'checked':''}>
                <span class="fake-checkbox"></span>
              </label>
              <div class="component-name"><strong>${esc(child.name)}</strong><span>${esc(child.code||'')}</span></div>
              <div class="component-teacher-wrap"><label>Teacher</label><select class="component-teacher" ${checked?'':'disabled'}>${teacherOptions(saved?.teacher_id||'')}</select></div>
            </div>`;
          }).join('')}
        </div>`;
      combinedBoards.appendChild(board);

      const selectAll=board.querySelector('.group-select-all');
      selectAll.addEventListener('change',()=>{
        board.querySelectorAll('.component-check').forEach(check=>{check.checked=selectAll.checked;});
        board.querySelectorAll('.component-row').forEach(row=>row.classList.toggle('selected',selectAll.checked));
        refreshGroupState(board);
      });
      board.querySelectorAll('.component-check').forEach(check=>check.addEventListener('change',()=>{
        check.closest('.component-row')?.classList.toggle('selected',check.checked);
        refreshGroupState(board);
      }));
      board.querySelector('.remove-group').addEventListener('click',()=>{
        board.classList.add('board-remove');
        setTimeout(()=>{board.remove();syncSummary();},180);
      });
      refreshGroupState(board);
      if(forceOpen) setTimeout(()=>board.scrollIntoView({behavior:'smooth',block:'nearest'}),30);
    }

    function addStandalone(subjectId){
      if(!subjectId)return;
      const subject=leaves.find(s=>s.id===subjectId);
      if(!subject)return;
      if(standaloneAssignments.querySelector(`.standalone-assignment-row[data-subject-id="${subjectId}"]`)){
        const existingRow=standaloneAssignments.querySelector(`.standalone-assignment-row[data-subject-id="${subjectId}"]`);
        existingRow.classList.add('board-flash');setTimeout(()=>existingRow.classList.remove('board-flash'),500);
        return;
      }
      const saved=assignmentMap.get(subjectId);
      const row=document.createElement('div');
      row.className='standalone-assignment-row';
      row.dataset.subjectId=subjectId;
      row.innerHTML=`
        <label class="component-check-wrap"><input type="checkbox" class="standalone-check" value="${subject.id}" checked><span class="fake-checkbox"></span></label>
        <div class="component-name"><strong>${esc(subject.name)}</strong><span>${esc(subject.code||'Standalone subject')}</span></div>
        <div class="component-teacher-wrap"><label>Teacher</label><select class="standalone-teacher">${teacherOptions(saved?.teacher_id||'')}</select></div>
        <button type="button" class="remove-standalone">×</button>`;
      standaloneAssignments.appendChild(row);
      row.querySelector('.standalone-check').addEventListener('change',e=>{
        row.classList.toggle('selected',e.target.checked);
        row.querySelector('.standalone-teacher').disabled=!e.target.checked;
        syncSummary();
      });
      row.querySelector('.remove-standalone').addEventListener('click',()=>{row.remove();syncSummary();});
      row.classList.add('selected');
      syncSummary();
    }

    groups.forEach(g=>{
      if(childrenOf(g.id).some(child=>assignmentMap.has(child.id))) addCombined(g.id,false);
    });

    leaves.filter(s=>!s.parent_subject_id && assignmentMap.has(s.id)).forEach(s=>addStandalone(s.id));

    document.querySelector('#add-combined').onclick=()=>{
      const groupId=combinedPicker.value;
      if(!groupId){toast('Choose a combined subject first.','error');return;}
      addCombined(groupId,true);
      combinedPicker.value='';
    };
    document.querySelector('#add-standalone').onclick=()=>{
      const subjectId=standalonePicker.value;
      if(!subjectId){toast('Choose a standalone subject first.','error');return;}
      addStandalone(subjectId);
      standalonePicker.value='';
    };

    document.querySelectorAll('#class-name,#class-level').forEach(x=>x.addEventListener('input',syncSummary));
    const description=document.querySelector('#class-description');
    description?.addEventListener('input',()=>{document.querySelector('#description-count').textContent=description.value.length;});
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

        const {data:duplicates,error:dupError}=await supabase.from('classes').select('id,name,level').ilike('name',name);
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

        const pairs=[];
        combinedBoards.querySelectorAll('.combined-subject-board').forEach(board=>{
          const teacherBySubject=[...board.querySelectorAll('.component-row')];
          teacherBySubject.forEach(row=>{
            const check=row.querySelector('.component-check');
            if(!check?.checked)return;
            pairs.push({
              class_id:classId,
              subject_id:check.value,
              teacher_id:row.querySelector('.component-teacher')?.value||null
            });
          });
        });
        standaloneAssignments.querySelectorAll('.standalone-assignment-row').forEach(row=>{
          const check=row.querySelector('.standalone-check');
          if(!check?.checked)return;
          pairs.push({
            class_id:classId,
            subject_id:check.value,
            teacher_id:row.querySelector('.standalone-teacher')?.value||null
          });
        });

        const duplicateSubjectIds=pairs.map(x=>x.subject_id).filter((x,i,a)=>a.indexOf(x)!==i);
        if(duplicateSubjectIds.length)throw new Error('A subject can only be selected once in the class.');

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
