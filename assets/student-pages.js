import { supabase, escapeHtml, toast } from './app.js';

const esc = escapeHtml;
const display = (value) => esc(value ?? '—');
const date = (value) => value ? new Date(value).toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const money = (value) => value == null ? '—' : `₦${Number(value).toLocaleString('en-NG', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
const fullName = (s) => [s?.first_name, s?.middle_name, s?.last_name].filter(Boolean).join(' ') || 'Unnamed Student';

function stat(label, value, hint='') {
  return `<div class="stat-card"><span class="stat-label">${esc(label)}</span><strong class="stat-value">${esc(String(value))}</strong>${hint ? `<small class="muted">${esc(hint)}</small>` : ''}</div>`;
}

function info(title, items) {
  return `<div class="panel"><div class="panel-head"><h2>${esc(title)}</h2></div><div class="info-grid">${items.map(([k,v]) => `<div class="info-item"><span>${esc(k)}</span><strong>${display(v)}</strong></div>`).join('')}</div></div>`;
}

export async function renderStudentsPage() {
  const root = document.querySelector('.page-content');
  root.innerHTML = `<div class="page-head"><div><h2>Students</h2><p>View students at a glance. Open a student to see the complete record.</p></div><a class="btn btn-primary" href="register-student.html">+ Register Student</a></div><div class="panel"><div class="toolbar"><input id="student-search" placeholder="Search by name, Student ID or exam number…"><button class="btn btn-ghost" id="student-refresh">Refresh</button></div><div id="student-list"><div class="loading-inline">Loading students…</div></div></div>`;

  const list = document.querySelector('#student-list');
  const search = document.querySelector('#student-search');
  let timer;

  async function load() {
    list.innerHTML = '<div class="loading-inline">Loading students…</div>';
    let q = supabase.from('students').select('id,student_id,exam_number,first_name,middle_name,last_name,gender,date_of_birth,photo_url,school_email,phone,guardian_name,guardian_phone,status,admission_date,created_at').order('created_at',{ascending:false}).limit(100);
    const term = search.value.trim();
    if (term) q = q.or(`first_name.ilike.%${term}%,middle_name.ilike.%${term}%,last_name.ilike.%${term}%,student_id.ilike.%${term}%,exam_number.ilike.%${term}%`);
    const {data,error} = await q;
    if (error) { console.error(error); list.innerHTML='<div class="empty">Could not load student records.</div>'; toast('Could not load student records.','error'); return; }
    if (!data?.length) { list.innerHTML='<div class="empty">No students found.</div>'; return; }
    list.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Student ID</th><th>Exam Number</th><th>Gender</th><th>Status</th><th>Admission</th><th>Action</th></tr></thead><tbody>${data.map(s=>`<tr><td><div class="person-cell">${s.photo_url?`<img class="avatar-sm" src="${esc(s.photo_url)}" alt="">`:'<div class="avatar-sm avatar-fallback">'+esc((s.first_name||'?')[0])+'</div>'}<div><strong>${esc(fullName(s))}</strong><small>${esc(s.school_email||s.phone||'')}</small></div></div></td><td>${display(s.student_id)}</td><td>${display(s.exam_number)}</td><td>${display(s.gender)}</td><td><span class="badge">${display(s.status)}</span></td><td>${date(s.admission_date)}</td><td><a class="btn btn-sm btn-primary" href="student-details.html?id=${encodeURIComponent(s.id)}">View details</a></td></tr>`).join('')}</tbody></table></div>`;
  }

  document.querySelector('#student-refresh').onclick = load;
  search.oninput = () => { clearTimeout(timer); timer=setTimeout(load,250); };
  await load();
}

export async function renderStudentDetails() {
  const root = document.querySelector('.page-content');
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { root.innerHTML='<div class="empty">No student was selected. <a href="students.html">Return to students</a>.</div>'; return; }

  root.innerHTML='<div class="loading-inline">Loading complete student record…</div>';
  const {data:student,error:studentError} = await supabase.from('students').select('*').eq('id',id).maybeSingle();
  if (studentError || !student) { console.error(studentError); root.innerHTML='<div class="empty">Student record could not be found. <a href="students.html">Return to students</a>.</div>'; return; }

  const [enrollments, results, attendance, fees, payments, cards, credentials] = await Promise.all([
    supabase.from('enrollments').select('id,status,created_at,class_id,session_id,classes(name,level),academic_sessions(name,is_current)').eq('student_id',id).order('created_at',{ascending:false}),
    supabase.from('results').select('id,enrollment_id,term_id,subject_id,ca_score,exam_score,total,grade,grade_point,teacher_remark,principal_remark,position,status,published_at,created_at,subjects(name,code),terms(name)').in('enrollment_id',[]),
    supabase.from('attendance').select('id,enrollment_id,attendance_date,status,note,created_at').in('enrollment_id',[]),
    supabase.from('fees').select('id,session_id,term_id,title,amount,due_date,created_at').eq('student_id',id).order('created_at',{ascending:false}),
    supabase.from('payments').select('id,fee_id,reference,amount,status,provider,paid_at,created_at').eq('student_id',id).order('created_at',{ascending:false}),
    supabase.from('id_cards').select('id,card_number,issued_at,expires_at,is_active,created_at').eq('student_id',id).order('created_at',{ascending:false}),
    supabase.from('result_access_credentials').select('id,serial_number,is_active,expires_at,created_at').eq('student_id',id).order('created_at',{ascending:false})
  ]);

  const activeEnroll = (enrollments.data||[]).find(x=>x.status==='ACTIVE') || enrollments.data?.[0];
  let resultRows = [], attendanceRows = [];
  if (activeEnroll || enrollments.data?.length) {
    const ids = (enrollments.data||[]).map(x=>x.id);
    const r = await supabase.from('results').select('id,enrollment_id,term_id,subject_id,ca_score,exam_score,total,grade,grade_point,teacher_remark,principal_remark,position,status,published_at,created_at,subjects(name,code),terms(name)').in('enrollment_id',ids).order('created_at',{ascending:false});
    const a = await supabase.from('attendance').select('id,enrollment_id,attendance_date,status,note,created_at').in('enrollment_id',ids).order('attendance_date',{ascending:false});
    resultRows = r.data||[]; attendanceRows = a.data||[];
  }

  const totalFees = (fees.data||[]).reduce((n,x)=>n+Number(x.amount||0),0);
  const totalPaid = (payments.data||[]).filter(x=>x.status==='PAID').reduce((n,x)=>n+Number(x.amount||0),0);
  const attendancePresent = attendanceRows.filter(x=>x.status==='PRESENT').length;
  const attendanceTotal = attendanceRows.length;
  const initials = [student.first_name,student.last_name].filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase();

  root.innerHTML = `<div class="page-head"><div><a class="back-link" href="students.html">← Back to Students</a><h2>${esc(fullName(student))}</h2><p>${display(student.student_id)} · Complete student record</p></div><a class="btn btn-ghost" href="register-student.html?id=${encodeURIComponent(student.id)}">Edit student</a></div>
  <section class="student-profile-hero"><div class="student-portrait">${student.photo_url?`<img src="${esc(student.photo_url)}" alt="Student photo">`:`<span>${esc(initials||'?')}</span>`}</div><div><div class="eyebrow">STUDENT PROFILE</div><h1>${esc(fullName(student))}</h1><div class="hero-meta"><span>${display(student.student_id)}</span><span>${display(student.exam_number)}</span><span class="badge">${display(student.status)}</span></div></div></section>
  <div class="stats-grid">${stat('Current class',activeEnroll?.classes?.name||'Not enrolled')}${stat('Session',activeEnroll?.academic_sessions?.name||'—')}${stat('Results',resultRows.length)}${stat('Attendance',attendanceTotal ? `${attendancePresent}/${attendanceTotal}` : 'No records')}</div>
  ${info('Personal information',[['Student ID',student.student_id],['Exam Number',student.exam_number],['First Name',student.first_name],['Middle Name',student.middle_name],['Last Name',student.last_name],['Gender',student.gender],['Date of Birth',date(student.date_of_birth)],['Admission Date',date(student.admission_date)],['School Email',student.school_email],['Phone',student.phone],['Address',student.address]])}
  ${info('Parent / guardian information',[['Guardian Name',student.guardian_name],['Guardian Phone',student.guardian_phone],['Guardian Email',student.guardian_email]])}
  <div class="two-col-panels"><div class="panel"><div class="panel-head"><h2>Enrollment history</h2></div>${enrollments.data?.length?`<div class="table-wrap"><table><thead><tr><th>Class</th><th>Session</th><th>Status</th><th>Added</th></tr></thead><tbody>${enrollments.data.map(x=>`<tr><td>${display(x.classes?.name)}</td><td>${display(x.academic_sessions?.name)}</td><td>${display(x.status)}</td><td>${date(x.created_at)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No enrollment records.</div>'}</div>
  <div class="panel"><div class="panel-head"><h2>Fees & payments</h2></div><div class="mini-summary"><div><span>Total fees</span><strong>${money(totalFees)}</strong></div><div><span>Paid</span><strong>${money(totalPaid)}</strong></div><div><span>Balance</span><strong>${money(Math.max(0,totalFees-totalPaid))}</strong></div></div>${fees.data?.length?`<div class="table-wrap"><table><thead><tr><th>Fee</th><th>Amount</th><th>Due</th></tr></thead><tbody>${fees.data.map(x=>`<tr><td>${display(x.title)}</td><td>${money(x.amount)}</td><td>${date(x.due_date)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No fee records.</div>'}</div></div>
  <div class="panel"><div class="panel-head"><h2>Academic results</h2></div>${resultRows.length?`<div class="table-wrap"><table><thead><tr><th>Subject</th><th>Term</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Position</th><th>Status</th></tr></thead><tbody>${resultRows.map(r=>`<tr><td>${display(r.subjects?.name)}</td><td>${display(r.terms?.name)}</td><td>${display(r.ca_score)}</td><td>${display(r.exam_score)}</td><td><strong>${display(r.total)}</strong></td><td>${display(r.grade)}</td><td>${display(r.position)}</td><td>${display(r.status)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No results recorded for this student.</div>'}</div>
  <div class="panel"><div class="panel-head"><h2>Attendance</h2></div>${attendanceRows.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Note</th></tr></thead><tbody>${attendanceRows.slice(0,50).map(a=>`<tr><td>${date(a.attendance_date)}</td><td>${display(a.status)}</td><td>${display(a.note)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No attendance records.</div>'}</div>
  <div class="two-col-panels"><div class="panel"><div class="panel-head"><h2>ID cards</h2></div>${cards.data?.length?cards.data.map(c=>`<div class="record-line"><div><strong>${display(c.card_number)}</strong><small>Issued ${date(c.issued_at)} · Expires ${date(c.expires_at)}</small></div><span class="badge">${c.is_active?'ACTIVE':'INACTIVE'}</span></div>`).join(''):'<div class="empty">No ID card records.</div>'}</div>
  <div class="panel"><div class="panel-head"><h2>Result access</h2></div>${credentials.data?.length?credentials.data.map(c=>`<div class="record-line"><div><strong>${display(c.serial_number)}</strong><small>Expires ${date(c.expires_at)}</small></div><span class="badge">${c.is_active?'ACTIVE':'INACTIVE'}</span></div>`).join(''):'<div class="empty">No result access credential records.</div>'}</div></div>
  <div class="panel"><div class="panel-head"><h2>Payment history</h2></div>${payments.data?.length?`<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Provider</th><th>Paid at</th></tr></thead><tbody>${payments.data.map(p=>`<tr><td>${display(p.reference)}</td><td>${money(p.amount)}</td><td>${display(p.status)}</td><td>${display(p.provider)}</td><td>${date(p.paid_at)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No payment records.</div>'}</div>`;
}
