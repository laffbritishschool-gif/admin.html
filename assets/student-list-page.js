import { supabase, escapeHtml, toast } from './app.js';

const esc = escapeHtml;
const svg = (name) => {
  const paths = {
    students:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    classes:'<path d="M3 6.5 12 2l9 4.5v11L12 22l-9-4.5z"/><path d="m3 6.5 9 4.5 9-4.5M12 11v11"/>',
    camera:'<path d="M14 4h-4l-2 3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>',
    refresh:'<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2"/>' , plus:'<path d="M12 5v14M5 12h14"/>' , close:'<path d="m18 6-12 12M6 6l12 12"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g>'+(paths[name]||paths.students)+'</g></svg>';
};
const fullName = s => [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ') || 'Unnamed Student';
const dateFmt = v => v ? new Date(v).toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const initials = s => [s.first_name, s.last_name].filter(Boolean).map(x => x[0]).join('').slice(0,2).toUpperCase() || 'ST';
const statusLabel = value => {
  const v = String(value || 'ACTIVE').toUpperCase();
  return v === 'GRADUATED' ? 'Graduated' : v === 'WITHDRAWN' ? 'Withdrawn' : v === 'INACTIVE' ? 'Inactive' : 'Active';
};
const statusClass = value => 'status-' + String(value || 'ACTIVE').toLowerCase();

async function resolvePhoto(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  try {
    const { data } = await supabase.storage.from('student-passports').createSignedUrl(path, 3600);
    return data?.signedUrl || '';
  } catch { return ''; }
}

function downloadCredentials(credentials) {
  if (!credentials?.length) return;
  const quote = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  const csv = [
    ['Student ID','Student Name','School Email','Temporary Password'],
    ...credentials.map(x => [x.student_id,x.student_name,x.school_email,x.temporary_password])
  ].map(row => row.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Laff-student-login-credentials-' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function renderStudentsList() {
  const root = document.querySelector('.page-content');
  if (!root) return;

  root.innerHTML = `
    <div class="students-page">
      <section class="students-hero">
        <div class="students-hero-copy">
          <span class="section-kicker students-hero-kicker">STUDENT MANAGEMENT</span>
          <h2>Student Directory</h2>
          <p>View, search and manage every student record. Students without login accounts are clearly marked beside their names.</p>
          <div class="students-hero-actions">
            <a class="btn students-hero-btn" href="/register-student">${svg("plus")}<span>Register Student</span></a>
            <button class="btn students-hero-secondary" id="student-activate-all" type="button">Activate All Student Logins</button>
            <button class="btn students-hero-secondary" id="student-refresh-top" type="button">Refresh Records</button>
          </div>
        </div>
        <div class="students-hero-side">
          <div class="students-hero-total"><strong id="students-total">0</strong><span>Students shown</span></div>
          <div class="students-hero-mini"><span>Awaiting login</span><strong id="students-pending">0</strong></div>
          <div class="students-hero-mini"><span>Session</span><strong id="students-session">—</strong></div>
        </div>
      </section>

      <section class="students-stat-grid" aria-label="Student statistics">
        <article class="student-stat"><div class="student-stat-icon">${svg("students")}</div><div><span>Total Students</span><strong id="student-stat-total">0</strong><small>All records in school</small></div></article>
        <article class="student-stat"><div class="student-stat-icon">${svg("check")}</div><div><span>Active</span><strong id="student-stat-active">0</strong><small>Currently active</small></div></article>
        <article class="student-stat"><div class="student-stat-icon">${svg("classes")}</div><div><span>Classes</span><strong id="student-stat-classes">0</strong><small>With student records</small></div></article>
        <article class="student-stat"><div class="student-stat-icon">${svg("camera")}</div><div><span>With Passport</span><strong id="student-stat-photos">0</strong><small>Photo available</small></div></article>
      </section>

      <section class="panel students-command">
        <div class="students-command-head">
          <div><span class="section-kicker">DIRECTORY TOOLS</span><h3>Find a student</h3><p>Search by name, registration number, exam number, email or class.</p></div>
          <button class="btn btn-ghost" id="student-refresh" type="button">${svg("refresh")}<span>Refresh</span></button>
        </div>
        <div class="students-command-fields">
          <label class="student-search-box"><span class="student-search-icon">${svg("search")}</span><input id="student-search" type="search" placeholder="Search students…"><button id="student-search-clear" type="button" aria-label="Clear search">${svg("close")}</button></label>
          <select id="student-class"><option value="">All classes</option></select>
          <select id="student-status"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="GRADUATED">Graduated</option><option value="WITHDRAWN">Withdrawn</option></select>
        </div>
        <div class="students-command-foot"><span id="student-result-note">Loading student records…</span><span id="student-filter-count">0 shown</span></div>
      </section>
      <section id="students-results"></section>
    </div>`;

  const $ = selector => root.querySelector(selector);
  const list=$('#students-results'), total=$('#students-total'), sessionName=$('#students-session');
  const search=$('#student-search'), searchClear=$('#student-search-clear'), classFilter=$('#student-class'), status=$('#student-status');
  const refresh=$('#student-refresh'), refreshTop=$('#student-refresh-top'), activateAll=$('#student-activate-all');
  const resultNote=$('#student-result-note'), filterCount=$('#student-filter-count');
  const statTotal=$('#student-stat-total'), statActive=$('#student-stat-active'), statClasses=$('#student-stat-classes'), statPhotos=$('#student-stat-photos');
  const pendingCount=$('#students-pending');
  let rows=[], classOptions=[], loading=false, activating=false;

  const draw = () => {
    const q=search.value.trim().toLowerCase(), wantedClass=classFilter.value, wantedStatus=status.value;
    const filtered=rows.filter(s=>{
      const hay=[fullName(s),s.student_id,s.exam_number,s.school_email,s.phone,s.class_name,s.class_level].filter(Boolean).join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(!wantedClass||s.class_id===wantedClass)&&(!wantedStatus||String(s.status||'ACTIVE').toUpperCase()===wantedStatus);
    });
    total.textContent=filtered.length; filterCount.textContent=filtered.length+' shown';
    resultNote.textContent=filtered.length===rows.length?rows.length+' student'+(rows.length===1?'':'s')+' in the directory':'Showing '+filtered.length+' of '+rows.length+' students';
    if(!filtered.length){
      list.innerHTML='<section class="panel students-empty"><div class="students-empty-icon">${svg("search")}</div><h3>No students found</h3><p>Try a different name, class or status filter.</p><button class="btn btn-ghost" type="button" id="reset-student-filters">Clear filters</button></section>';
      $('#reset-student-filters')?.addEventListener('click',()=>{search.value='';classFilter.value='';status.value='';draw();search.focus();});
      return;
    }
    list.innerHTML='<div class="students-directory">'+filtered.map((s,i)=>{
      const name=fullName(s), classText=s.class_name?s.class_name+(s.class_level?' · '+s.class_level:''):'No active class';
      const avatar=s.photo_signed_url?'<img src="'+esc(s.photo_signed_url)+'" alt="'+esc(name)+'">':'<span class="student-avatar-initials">'+esc(initials(s))+'</span>';
      const needsLogin=!s.user_id;
      const loginBadge=needsLogin?'<span class="student-login-badge" title="This student does not have a login account">NO LOGIN</span>':'<span class="student-login-active">LOGIN ACTIVE</span>';
      return `
        <article class="student-directory-card" style="--delay:${Math.min(i,12)*45}ms">
          <div class="student-directory-head">
            <div class="student-directory-avatar">${avatar}</div>
            <div class="student-directory-identity">
              <div class="student-name-line">${loginBadge}<h3>${esc(name)}</h3></div>
              <p>${esc(s.student_id||'No Student ID')}</p>
            </div>
            <span class="badge ${statusClass(s.status)}">${esc(statusLabel(s.status))}</span>
          </div>
          <div class="student-directory-class"><span class="class-icon">${svg("home")}</span><div><small>Current class</small><strong>${esc(classText)}</strong></div></div>
          <div class="student-directory-grid">
            <div><span>Exam Number</span><strong>${esc(s.exam_number||'—')}</strong></div>
            <div><span>Gender</span><strong>${esc(s.gender||'—')}</strong></div>
            <div><span>School Email</span><strong title="${esc(s.school_email||'')}">${esc(s.school_email||'—')}</strong></div>
            <div><span>Admission</span><strong>${esc(dateFmt(s.admission_date||s.created_at))}</strong></div>
          </div>
          <div class="student-directory-footer"><span>${s.session_name?esc(s.session_name):'No session'}</span><div>
            <a class="btn btn-sm btn-ghost" href="/student-details?id=${encodeURIComponent(s.id)}">View</a>
            <a class="btn btn-sm btn-primary" href="/register-student?id=${encodeURIComponent(s.id)}">Edit</a>
          </div></div>
        </article>`;
    }).join('')+'</div>';
  };

  const load=async()=>{
    if(loading)return;
    loading=true;refresh.disabled=true;refreshTop.disabled=true;refresh.textContent='Loading…';
    list.innerHTML='<section class="panel students-loading"><span class="spinner"></span><div><strong>Loading students</strong><p>Fetching the latest student directory.</p></div></section>';
    try{
      const [{data:students,error:studentError},{data:enrollments,error:enrollmentError}]=await Promise.all([
        supabase.from('students').select('id,student_id,exam_number,first_name,middle_name,last_name,gender,photo_url,school_email,phone,status,admission_date,created_at,user_id').order('created_at',{ascending:false}),
        supabase.from('enrollments').select('student_id,class_id,session_id,status,created_at,classes(name,level),academic_sessions(name,is_current)').order('created_at',{ascending:false})
      ]);
      if(studentError)throw studentError;if(enrollmentError)throw enrollmentError;
      const enrollmentMap=new Map();
      (enrollments||[]).forEach(e=>{const old=enrollmentMap.get(e.student_id);if(!old||(e.status==='ACTIVE'&&old.status!=='ACTIVE')||(e.academic_sessions?.is_current&&!old.academic_sessions?.is_current))enrollmentMap.set(e.student_id,e);});
      rows=await Promise.all((students||[]).map(async s=>{const e=enrollmentMap.get(s.id);return {...s,class_id:e?.class_id||'',class_name:e?.classes?.name||'',class_level:e?.classes?.level||'',session_name:e?.academic_sessions?.name||'',photo_signed_url:await resolvePhoto(s.photo_url)};}));
      classOptions=Array.from(new Map(rows.filter(x=>x.class_id).map(x=>[x.class_id,{id:x.class_id,name:x.class_name,level:x.class_level}])).values()).sort((a,b)=>a.name.localeCompare(b.name));
      classFilter.innerHTML='<option value="">All classes</option>'+classOptions.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+(x.level?' · '+esc(x.level):'')+'</option>').join('');
      const pending=rows.filter(s=>!s.user_id&&String(s.status||'ACTIVE').toUpperCase()==='ACTIVE').length;
      pendingCount.textContent=pending;activateAll.textContent=pending?'Activate All Student Logins ('+pending+')':'All Student Logins Active';
      activateAll.disabled=activating||pending===0;
      sessionName.textContent=rows.map(x=>x.session_name).find(Boolean)||'2026/2027';
      statTotal.textContent=rows.length;statActive.textContent=rows.filter(x=>String(x.status||'ACTIVE').toUpperCase()==='ACTIVE').length;
      statClasses.textContent=classOptions.length;statPhotos.textContent=rows.filter(x=>x.photo_signed_url).length;
      draw();
    }catch(error){
      console.error('Students page load failed:',error);
      list.innerHTML='<section class="panel students-error"><strong>Unable to load students.</strong><p>'+esc(error?.message||'Please refresh the page and try again.')+'</p><button class="btn btn-primary" type="button" id="retry-students">Try again</button></section>';
      $('#retry-students')?.addEventListener('click',load);total.textContent='0';filterCount.textContent='0 shown';resultNote.textContent='Unable to load records';
      toast(error?.message||'Unable to load students.','error');
    }finally{loading=false;refresh.disabled=false;refreshTop.disabled=false;refresh.textContent='Refresh';refreshTop.textContent='Refresh Records';}
  };

  const activate=async()=>{
    if(activating)return;
    const pending=rows.filter(s=>!s.user_id&&String(s.status||'ACTIVE').toUpperCase()==='ACTIVE');
    if(!pending.length){toast('All active students already have login accounts.','info');return;}
    const confirmed=window.confirm('Create login accounts for '+pending.length+' active student(s) who do not currently have one? Existing student logins will not be changed.');
    if(!confirmed)return;
    activating=true;activateAll.disabled=true;activateAll.textContent='Activating student logins…';
    try{
      const {data,error}=await supabase.functions.invoke('admin-activate-students',{body:{}});
      if(error)throw error;
      if(!data?.ok&&!data?.created_count&&!data?.failed_count)throw new Error(data?.error||'The activation service did not return a result.');
      if(data?.credentials?.length){
        downloadCredentials(data.credentials);
        toast(data.created_count+' student login(s) created. A private credentials CSV has been downloaded.','success');
      }else toast(data?.message||'No new student logins were created.','info');
      if(data?.failures?.length){
        const details=data.failures.map(x=>x.student_id+': '+x.error).join('\n');
        window.alert('Some student accounts need attention:\n\n'+details);
      }
      await load();
    }catch(error){
      console.error('Student account activation request failed:',error);
      toast(error?.message||'Unable to activate student logins. Please sign in again and retry.','error');
    }finally{activating=false;const stillPending=rows.filter(s=>!s.user_id&&String(s.status||'ACTIVE').toUpperCase()==='ACTIVE').length;activateAll.disabled=stillPending===0;activateAll.textContent=stillPending?'Activate All Student Logins ('+stillPending+')':'All Student Logins Active';}
  };

  search.addEventListener('input',draw);searchClear.addEventListener('click',()=>{search.value='';draw();search.focus();});
  classFilter.addEventListener('change',draw);status.addEventListener('change',draw);
  refresh.addEventListener('click',load);refreshTop.addEventListener('click',load);activateAll.addEventListener('click',activate);
  await load();
}
