import { supabase, escapeHtml, toast } from './app.js';

const esc = escapeHtml;
const fullName = (s) => [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ') || 'Unnamed Student';
const dateFmt = (v) => v ? new Date(v).toLocaleDateString('en-NG', {day:'2-digit', month:'short', year:'numeric'}) : '—';

export async function renderStudentsList() {
  const root = document.querySelector('.page-content');
  if (!root) return;

  root.innerHTML = `
    <style>
      .students-page{display:grid;gap:20px;animation:studentsIn .45s ease both}
      .students-hero{position:relative;overflow:hidden;padding:28px;border-radius:24px;background:linear-gradient(135deg,#111827,#1f2937 55%,#0f766e);color:#fff;box-shadow:0 20px 55px rgba(15,23,42,.18)}
      .students-hero:before,.students-hero:after{content:"";position:absolute;border-radius:999px;background:rgba(255,255,255,.08);pointer-events:none}
      .students-hero:before{width:220px;height:220px;right:-60px;top:-80px}.students-hero:after{width:140px;height:140px;right:120px;bottom:-80px}
      .students-hero-inner{position:relative;z-index:1;display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap}
      .students-kicker{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.8}
      .students-hero h1{margin:8px 0 6px;font-size:clamp(28px,4vw,44px);line-height:1.05}.students-hero p{margin:0;max-width:720px;color:rgba(255,255,255,.78)}
      .students-count{min-width:130px;padding:16px 18px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(255,255,255,.08);backdrop-filter:blur(10px)}
      .students-count strong{display:block;font-size:30px;line-height:1}.students-count span{display:block;margin-top:6px;font-size:12px;color:rgba(255,255,255,.72)}
      .students-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 180px auto;gap:12px;padding:14px;border:1px solid var(--border,#e5e7eb);border-radius:20px;background:var(--card,#fff);box-shadow:0 10px 30px rgba(15,23,42,.05)}
      .students-toolbar input,.students-toolbar select{width:100%;min-height:46px;padding:0 14px;border:1px solid var(--border,#e5e7eb);border-radius:13px;background:var(--bg,#fff);color:inherit;outline:none}
      .students-toolbar input:focus,.students-toolbar select:focus{border-color:#0f766e;box-shadow:0 0 0 3px rgba(15,118,110,.12)}
      .students-btn{min-height:46px;border:0;border-radius:13px;padding:0 16px;font-weight:800;cursor:pointer;background:#0f766e;color:#fff}
      .students-btn:hover{transform:translateY(-1px)}.students-btn:active{transform:translateY(0)}
      .students-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
      .student-card{position:relative;overflow:hidden;padding:18px;border:1px solid var(--border,#e5e7eb);border-radius:20px;background:var(--card,#fff);box-shadow:0 12px 32px rgba(15,23,42,.06);animation:studentCardIn .5s ease both;animation-delay:var(--delay)}
      .student-card:hover{transform:translateY(-3px);box-shadow:0 18px 40px rgba(15,23,42,.10)}
      .student-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
      .student-avatar{width:62px;height:62px;border-radius:18px;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#e2e8f0,#cbd5e1);color:#334155;font-weight:900;font-size:20px}
      .student-avatar img{width:100%;height:100%;object-fit:cover}.student-status{padding:6px 9px;border-radius:999px;background:rgba(15,118,110,.1);color:#0f766e;font-size:11px;font-weight:900}
      .student-name{margin:14px 0 4px;font-size:18px;font-weight:900}.student-meta{color:#64748b;font-size:13px;line-height:1.7}
      .student-details{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border,#e5e7eb)}
      .student-detail{min-width:0}.student-detail span{display:block;color:#94a3b8;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.student-detail strong{display:block;margin-top:3px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .student-actions{display:flex;gap:9px;margin-top:16px}.student-link{flex:1;display:inline-flex;justify-content:center;align-items:center;min-height:40px;border-radius:11px;text-decoration:none;font-size:13px;font-weight:800;background:#0f766e;color:#fff}.student-link.secondary{background:#f1f5f9;color:#334155}
      .students-empty{padding:45px 20px;border:1px dashed #cbd5e1;border-radius:20px;text-align:center;color:#64748b;background:rgba(248,250,252,.7)}
      .students-error{padding:18px;border-radius:16px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b}
      @keyframes studentsIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      @keyframes studentCardIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
      @media(max-width:1000px){.students-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:700px){.students-toolbar{grid-template-columns:1fr}.students-grid{grid-template-columns:1fr}.students-hero{padding:22px}.student-details{grid-template-columns:1fr}}
    </style>

    <div class="students-page">
      <section class="students-hero">
        <div class="students-hero-inner">
          <div>
            <div class="students-kicker">School Administration · Student Directory</div>
            <h1>Students</h1>
            <p>Manage enrolled students, view student profiles, and quickly find records using the directory below.</p>
          </div>
          <div class="students-count"><strong id="students-total">0</strong><span>Students found</span></div>
        </div>
      </section>

      <section class="students-toolbar">
        <input id="student-search" type="search" placeholder="Search name, Student ID, exam number or email">
        <select id="student-status">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="GRADUATED">Graduated</option>
          <option value="WITHDRAWN">Withdrawn</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <button class="students-btn" id="student-refresh" type="button">Refresh</button>
      </section>

      <section id="students-results"></section>
    </div>
  `;

  const list = root.querySelector('#students-results');
  const total = root.querySelector('#students-total');
  const search = root.querySelector('#student-search');
  const status = root.querySelector('#student-status');
  const refresh = root.querySelector('#student-refresh');
  let rows = [];

  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const wanted = status.value;
    const filtered = rows.filter(s => {
      const hay = [fullName(s), s.student_id, s.exam_number, s.school_email, s.phone].filter(Boolean).join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (!wanted || s.status === wanted);
    });

    total.textContent = filtered.length;

    if (!filtered.length) {
      list.innerHTML = '<div class="students-empty"><h3>No students found</h3><p>Try another search or status filter.</p></div>';
      return;
    }

    list.innerHTML = '<div class="students-grid">' + filtered.map((s,i) => {
      const name = fullName(s);
      const initials = [s.first_name, s.last_name].filter(Boolean).map(x => x[0]).join('').slice(0,2).toUpperCase() || '?';
      const avatar = s.photo_url
        ? '<img src="' + esc(s.photo_url) + '" alt="' + esc(name) + '">'
        : '<span>' + esc(initials) + '</span>';
      return '<article class="student-card" style="--delay:' + Math.min(i,12) * 45 + 'ms">' +
        '<div class="student-top"><div class="student-avatar">' + avatar + '</div><span class="student-status">' + esc(s.status || 'ACTIVE') + '</span></div>' +
        '<div class="student-name">' + esc(name) + '</div>' +
        '<div class="student-meta">' + esc(s.student_id || 'No Student ID') + '</div>' +
        '<div class="student-details">' +
          '<div class="student-detail"><span>Exam Number</span><strong>' + esc(s.exam_number || '—') + '</strong></div>' +
          '<div class="student-detail"><span>School Email</span><strong title="' + esc(s.school_email || '') + '">' + esc(s.school_email || '—') + '</strong></div>' +
          '<div class="student-detail"><span>Gender</span><strong>' + esc(s.gender || '—') + '</strong></div>' +
          '<div class="student-detail"><span>Admitted</span><strong>' + esc(dateFmt(s.admission_date || s.created_at)) + '</strong></div>' +
        '</div>' +
        '<div class="student-actions"><a class="student-link" href="student-details.html?id=' + encodeURIComponent(s.id) + '">View Details</a><a class="student-link secondary" href="register-student.html?edit=' + encodeURIComponent(s.id) + '">Edit</a></div>' +
      '</article>';
    }).join('') + '</div>';
  };

  const load = async () => {
    refresh.disabled = true;
    refresh.textContent = 'Loading…';
    list.innerHTML = '<div class="students-empty">Loading students…</div>';
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id,student_id,exam_number,first_name,middle_name,last_name,gender,photo_url,school_email,phone,status,admission_date,created_at')
        .order('created_at', { ascending:false });
      if (error) throw error;
      rows = data || [];
      draw();
    } catch (error) {
      console.error('Students page load failed:', error);
      list.innerHTML = '<div class="students-error"><strong>Unable to load students.</strong><br>' + esc(error?.message || 'Please refresh the page and try again.') + '</div>';
      total.textContent = '0';
      toast(error?.message || 'Unable to load students.', 'error');
    } finally {
      refresh.disabled = false;
      refresh.textContent = 'Refresh';
    }
  };

  search.addEventListener('input', draw);
  status.addEventListener('change', draw);
  refresh.addEventListener('click', load);
  await load();
}
