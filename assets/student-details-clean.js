
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
    <style>
      .student-clean{max-width:1400px;margin:0 auto;padding-bottom:44px;animation:sdIn .45s ease both}
      .student-clean-hero{position:relative;overflow:hidden;min-height:270px;padding:34px;border-radius:28px;background:linear-gradient(135deg,#064e3b 0%,#047857 58%,#16a34a 100%);color:#fff;box-shadow:0 22px 60px rgba(4,120,87,.2);display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:24px;align-items:center}
      .student-clean-hero:before,.student-clean-hero:after{content:"";position:absolute;border-radius:999px;background:rgba(255,255,255,.07);pointer-events:none}.student-clean-hero:before{width:260px;height:260px;right:-90px;top:-100px}.student-clean-hero:after{width:170px;height:170px;right:110px;bottom:-120px}
      .student-clean-copy,.student-clean-photo{position:relative;z-index:1}.student-clean-kicker{display:inline-flex;padding:7px 11px;border:1px solid rgba(255,255,255,.17);border-radius:999px;background:rgba(255,255,255,.08);font-size:11px;font-weight:900;letter-spacing:.12em}.student-clean h1{margin:12px 0 7px;font-size:clamp(30px,4vw,46px);line-height:1.05}.student-clean-copy p{margin:0;max-width:700px;color:rgba(255,255,255,.76)}
      .student-clean-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:17px}.student-clean-tag{padding:7px 10px;border-radius:10px;background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.14);font-size:11px;font-weight:800}.student-clean-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:19px}
      .student-clean-btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 14px;border-radius:11px;text-decoration:none;border:1px solid transparent;font-size:12px;font-weight:900;cursor:pointer}.student-clean-btn.light{background:#fff;color:#065f46}.student-clean-btn.ghost{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.18);color:#fff}.student-clean-btn.gold{background:#facc15;color:#1f2937}
      .student-clean-photo{width:184px;height:184px;justify-self:center;display:grid;place-items:center}.student-clean-ring{position:absolute;inset:0;border-radius:50%;border:1px solid rgba(255,255,255,.25);box-shadow:0 0 0 14px rgba(255,255,255,.04);animation:spinSoft 12s linear infinite}.student-clean-avatar{width:136px;height:136px;overflow:hidden;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14);border:4px solid rgba(255,255,255,.8);font-size:38px;font-weight:900}.student-clean-avatar img{width:100%;height:100%;object-fit:cover}
      .student-clean-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:18px 0}.student-clean-stat{padding:17px;border:1px solid var(--border,#e5e7eb);border-radius:18px;background:var(--card,#fff);box-shadow:0 9px 26px rgba(15,23,42,.05);animation:cardIn .55s ease both}.student-clean-stat span{display:block;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.student-clean-stat strong{display:block;margin-top:7px;font-size:20px}.student-clean-stat small{display:block;margin-top:4px;color:#94a3b8}
      .student-clean-heading{display:flex;align-items:center;gap:12px;margin:25px 0 12px}.student-clean-heading .num{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:rgba(4,120,87,.10);color:#047857;font-weight:900}.student-clean-heading h2{margin:0;font-size:18px}.student-clean-heading p{margin:3px 0 0;color:#64748b;font-size:12px}
      .student-clean-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.student-clean-panel{border:1px solid var(--border,#e5e7eb);border-radius:20px;background:var(--card,#fff);overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.05);animation:cardIn .55s ease both}.student-clean-panel h3{margin:0;font-size:16px}.student-clean-panel-head{padding:17px 19px;border-bottom:1px solid var(--border,#e5e7eb);display:flex;justify-content:space-between;gap:12px;align-items:center}.student-clean-panel-body{padding:18px}
      .student-clean-info{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--border,#e5e7eb);border:1px solid var(--border,#e5e7eb);border-radius:14px;overflow:hidden}.student-clean-info-item{padding:14px;background:var(--card,#fff)}.student-clean-info-item span{display:block;color:#94a3b8;font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}.student-clean-info-item strong{display:block;overflow-wrap:anywhere;font-size:13px}
      .student-clean-table-wrap{overflow:auto}.student-clean table{width:100%;border-collapse:collapse;font-size:12px}.student-clean th,.student-clean td{padding:12px 13px;border-bottom:1px solid var(--border,#e5e7eb);text-align:left;white-space:nowrap}.student-clean th{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;background:rgba(248,250,252,.7)}.student-clean tr:last-child td{border-bottom:0}
      .student-clean-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:rgba(4,120,87,.10);color:#047857;font-size:10px;font-weight:900}
      .student-clean-mini{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:15px}.student-clean-mini>div{padding:12px;border-radius:13px;background:rgba(4,120,87,.06)}.student-clean-mini span{display:block;color:#64748b;font-size:10px}.student-clean-mini strong{display:block;margin-top:4px;font-size:13px}
      .student-clean-empty{padding:28px;text-align:center;color:#64748b}.student-clean-empty a{color:#047857;font-weight:800}
      .student-clean-footer{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;margin-top:22px;padding:14px 2px;color:#94a3b8;font-size:11px}
      @keyframes sdIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes cardIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes spinSoft{to{transform:rotate(360deg)}}
      @media(max-width:1050px){.student-clean-summary{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:820px){.student-clean-hero{grid-template-columns:1fr}.student-clean-photo{justify-self:start}.student-clean-grid{grid-template-columns:1fr}.student-clean-info{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.student-clean-hero{padding:22px}.student-clean-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.student-clean-info{grid-template-columns:1fr}.student-clean-actions{width:100%}.student-clean-btn{flex:1}.student-clean-photo{width:150px;height:150px}.student-clean-avatar{width:112px;height:112px}}@media print{.student-clean-actions{display:none}.student-clean-panel{box-shadow:none}.student-clean-hero{box-shadow:none}}
    </style>
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
