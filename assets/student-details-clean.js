import { supabase, escapeHtml, toast } from './app.js';
const esc = escapeHtml;
const text = (v) => esc(v ?? '—');
const fullName = (s) => [s?.first_name, s?.middle_name, s?.last_name].filter(Boolean).join(' ') || 'Unnamed Student';
const dateFmt = (v) => v ? new Date(v).toLocaleDateString('en-NG', {day:'2-digit', month:'short', year:'numeric'}) : '—';
const money = (v) => v == null ? '—' : '₦' + Number(v).toLocaleString('en-NG', {minimumFractionDigits:2, maximumFractionDigits:2});

export async function renderStudentDetailsClean() {
  const root = document.querySelector('.page-content');
  const id = new URLSearchParams(location.search).get('id');
  if (!root) return;
  if (!id) {
    root.innerHTML = '<div class="student-clean-empty"><h2>No student selected</h2><a href="students.html">Return to Students</a></div>';
    return;
  }

  root.innerHTML = `
    
    <div class="student-clean"><div class="student-clean-empty">Loading student record…</div></div>
  `;

  const {data:s,error} = await supabase.from('students').select('*').eq('id',id).maybeSingle();
  if(error || !s){
    console.error('Student details load failed:', error);
    root.innerHTML = '<div class="student-clean-empty"><h2>Student record could not be loaded</h2><p>Please return to the Students directory and try again.</p><a href="students.html">Return to Students</a></div>';
    toast('Could not load student details.','error');
    return;
  }

  const {data:enrollments} = await supabase.from('enrollments').select('id,status,created_at,classes(name,level),academic_sessions(name,is_current)').eq('student_id',id).order('created_at',{ascending:false});
  const en = enrollments || [];
  const ids = en.map(x=>x.id);
  let results=[],attendance=[];
  if(ids.length){
    const [rr,aa]=await Promise.all([
      supabase.from('results').select('id,enrollment_id,ca_score,exam_score,total,grade,position,status,created_at,subjects(name,code),terms(name)').in('enrollment_id',ids).order('created_at',{ascending:false}),
      supabase.from('attendance').select('id,enrollment_id,attendance_date,status,note,created_at').in('enrollment_id',ids).order('attendance_date',{ascending:false})
    ]);
    results=rr.data||[];attendance=aa.data||[];
  }
  const [feesR,payR,cardsR,credsR]=await Promise.all([
    supabase.from('fees').select('id,title,amount,due_date,created_at').eq('student_id',id).order('created_at',{ascending:false}),
    supabase.from('payments').select('id,reference,amount,status,provider,paid_at,created_at').eq('student_id',id).order('created_at',{ascending:false}),
    supabase.from('id_cards').select('id,card_number,issued_at,expires_at,is_active,created_at').eq('student_id',id).order('created_at',{ascending:false}),
    supabase.from('result_access_credentials').select('id,serial_number,is_active,expires_at,created_at').eq('student_id',id).order('created_at',{ascending:false})
  ]);
  const fees=feesR.data||[],payments=payR.data||[],cards=cardsR.data||[],creds=credsR.data||[];
  const active=en.find(x=>x.status==='ACTIVE')||en[0];
  const feeTotal=fees.reduce((n,x)=>n+Number(x.amount||0),0);
  const paidTotal=payments.filter(x=>x.status==='PAID').reduce((n,x)=>n+Number(x.amount||0),0);
  const present=attendance.filter(x=>String(x.status).toUpperCase()==='PRESENT').length;
  const attendanceRate=attendance.length?Math.round(present/attendance.length*100):0;
  const initials=[s.first_name,s.last_name].filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'?';

  root.innerHTML=`
    <div class="student-clean">
      <section class="student-clean-hero">
        <div class="student-clean-copy">
          <span class="student-clean-kicker">STUDENT PROFILE</span>
          <h1>${esc(fullName(s))}</h1>
          <p>Complete student information, academic history, attendance, fees and school services.</p>
          <div class="student-clean-tags"><span class="student-clean-tag">${text(s.student_id)}</span><span class="student-clean-tag">${text(s.exam_number)}</span><span class="student-clean-tag">${text(s.status)}</span></div>
          <div class="student-clean-actions"><a class="student-clean-btn light" href="students.html">← Students</a><a class="student-clean-btn ghost" href="register-student.html?edit=${encodeURIComponent(s.id)}">✎ Edit Student</a><button class="student-clean-btn gold" id="student-print-clean">Print Profile</button></div>
        </div>
        <div class="student-clean-photo"><div class="student-clean-ring"></div><div class="student-clean-avatar">${s.photo_url?'<img src="'+esc(s.photo_url)+'" alt="Student photo">':'<span>'+esc(initials)+'</span>'}</div></div>
      </section>

      <div class="student-clean-summary">
        <div class="student-clean-stat"><span>Current Class</span><strong>${text(active?.classes?.name||'Not enrolled')}</strong><small>${text(active?.classes?.level||'')}</small></div>
        <div class="student-clean-stat"><span>Academic Session</span><strong>${text(active?.academic_sessions?.name||'—')}</strong><small>Current placement</small></div>
        <div class="student-clean-stat"><span>Results</span><strong>${results.length}</strong><small>Recorded entries</small></div>
        <div class="student-clean-stat"><span>Attendance</span><strong>${attendanceRate}%</strong><small>${present} present of ${attendance.length}</small></div>
        <div class="student-clean-stat"><span>Fee Balance</span><strong>${money(Math.max(0,feeTotal-paidTotal))}</strong><small>Outstanding amount</small></div>
      </div>

      <div class="student-clean-heading"><span class="num">01</span><div><h2>Student Information</h2><p>Identity, contact and guardian details</p></div></div>
      <div class="student-clean-grid">
        <section class="student-clean-panel"><div class="student-clean-panel-head"><h3>Personal Information</h3></div><div class="student-clean-panel-body"><div class="student-clean-info">
          ${[['Student ID',s.student_id],['Exam Number',s.exam_number],['First Name',s.first_name],['Middle Name',s.middle_name],['Last Name',s.last_name],['Gender',s.gender],['Date of Birth',dateFmt(s.date_of_birth)],['Admission Date',dateFmt(s.admission_date)],['School Email',s.school_email],['Phone',s.phone],['Address',s.address]].map(([k,v])=>'<div class="student-clean-info-item"><span>'+esc(k)+'</span><strong>'+text(v)+'</strong></div>').join('')}
        </div></div></section>
        <section class="student-clean-panel"><div class="student-clean-panel-head"><h3>Parent / Guardian</h3></div><div class="student-clean-panel-body"><div class="student-clean-info">
          ${[['Guardian Name',s.guardian_name],['Guardian Phone',s.guardian_phone],['Guardian Email',s.guardian_email]].map(([k,v])=>'<div class="student-clean-info-item"><span>'+esc(k)+'</span><strong>'+text(v)+'</strong></div>').join('')}
        </div></div></section>
      </div>

      <div class="student-clean-heading"><span class="num">02</span><div><h2>Academic Journey</h2><p>Enrollment, results and attendance history</p></div></div>
      <div class="student-clean-grid">
        <section class="student-clean-panel"><div class="student-clean-panel-head"><h3>Enrollment History</h3><span>${en.length}</span></div><div class="student-clean-table-wrap">${en.length?'<table><thead><tr><th>Class</th><th>Session</th><th>Status</th><th>Date</th></tr></thead><tbody>'+en.map(x=>'<tr><td>'+text(x.classes?.name)+'</td><td>'+text(x.academic_sessions?.name)+'</td><td><span class="student-clean-badge">'+text(x.status)+'</span></td><td>'+dateFmt(x.created_at)+'</td></tr>').join('')+'</tbody></table>':'<div class="student-clean-empty">No enrollment records.</div>'}</div></section>
        <section class="student-clean-panel"><div class="student-clean-panel-head"><h3>Fees & Payments</h3></div><div class="student-clean-panel-body"><div class="student-clean-mini"><div><span>Total</span><strong>${money(feeTotal)}</strong></div><div><span>Paid</span><strong>${money(paidTotal)}</strong></div><div><span>Balance</span><strong>${money(Math.max(0,feeTotal-paidTotal))}</strong></div></div>${fees.length?'<div class="student-clean-table-wrap"><table><thead><tr><th>Fee</th><th>Amount</th><th>Due</th></tr></thead><tbody>'+fees.map(x=>'<tr><td>'+text(x.title)+'</td><td>'+money(x.amount)+'</td><td>'+dateFmt(x.due_date)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="student-clean-empty">No fee records.</div>'}</div></section>
      </div>
      <section class="student-clean-panel" style="margin-top:16px"><div class="student-clean-panel-head"><h3>Academic Results</h3><span>${results.length}</span></div><div class="student-clean-table-wrap">${results.length?'<table><thead><tr><th>Subject</th><th>Term</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Position</th><th>Status</th></tr></thead><tbody>'+results.map(r=>'<tr><td>'+text(r.subjects?.name)+'</td><td>'+text(r.terms?.name)+'</td><td>'+text(r.ca_score)+'</td><td>'+text(r.exam_score)+'</td><td><strong>'+text(r.total)+'</strong></td><td>'+text(r.grade)+'</td><td>'+text(r.position)+'</td><td>'+text(r.status)+'</td></tr>').join('')+'</tbody></table>':'<div class="student-clean-empty">No results recorded.</div>'}</div></section>
      <section class="student-clean-panel" style="margin-top:16px"><div class="student-clean-panel-head"><h3>Attendance</h3><span>${attendance.length}</span></div><div class="student-clean-table-wrap">${attendance.length?'<table><thead><tr><th>Date</th><th>Status</th><th>Note</th></tr></thead><tbody>'+attendance.slice(0,150).map(a=>'<tr><td>'+dateFmt(a.attendance_date)+'</td><td><span class="student-clean-badge">'+text(a.status)+'</span></td><td>'+text(a.note)+'</td></tr>').join('')+'</tbody></table>':'<div class="student-clean-empty">No attendance records.</div>'}</div></section>

      <div class="student-clean-heading"><span class="num">03</span><div><h2>School Services</h2><p>ID cards, result access and payment history</p></div></div>
      <div class="student-clean-grid">
        <section class="student-clean-panel"><div class="student-clean-panel-head"><h3>ID Cards</h3><span>${cards.length}</span></div><div class="student-clean-panel-body">${cards.length?cards.map(c=>'<div style="padding:12px 0;border-bottom:1px solid var(--border,#e5e7eb)"><strong>'+text(c.card_number)+'</strong><div style="color:#64748b;font-size:11px;margin-top:4px">Issued '+dateFmt(c.issued_at)+' · Expires '+dateFmt(c.expires_at)+' · '+(c.is_active?'ACTIVE':'INACTIVE')+'</div></div>').join(''):'<div class="student-clean-empty">No ID card records.</div>'}</div></section>
        <section class="student-clean-panel"><div class="student-clean-panel-head"><h3>Result Access</h3><span>${creds.length}</span></div><div class="student-clean-panel-body">${creds.length?creds.map(c=>'<div style="padding:12px 0;border-bottom:1px solid var(--border,#e5e7eb)"><strong>'+text(c.serial_number)+'</strong><div style="color:#64748b;font-size:11px;margin-top:4px">Expires '+dateFmt(c.expires_at)+' · '+(c.is_active?'ACTIVE':'INACTIVE')+'</div></div>').join(''):'<div class="student-clean-empty">No result access credentials.</div>'}</div></section>
      </div>
      <section class="student-clean-panel" style="margin-top:16px"><div class="student-clean-panel-head"><h3>Payment History</h3><span>${payments.length}</span></div><div class="student-clean-table-wrap">${payments.length?'<table><thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Provider</th><th>Paid At</th></tr></thead><tbody>'+payments.map(p=>'<tr><td>'+text(p.reference)+'</td><td>'+money(p.amount)+'</td><td>'+text(p.status)+'</td><td>'+text(p.provider)+'</td><td>'+dateFmt(p.paid_at)+'</td></tr>').join('')+'</tbody></table>':'<div class="student-clean-empty">No payment records.</div>'}</div></section>
      <div class="student-clean-footer"><span>Record ID: ${esc(s.id)}</span><span>Last updated: ${dateFmt(s.updated_at)}</span></div>
    </div>
  `;
  const print=document.querySelector('#student-print-clean');
  if(print) print.onclick=()=>window.print();
}
