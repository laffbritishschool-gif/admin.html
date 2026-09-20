import { supabase, escapeHtml, toast } from './app.js';

const esc = escapeHtml;
const fullName = (s) => [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ') || 'Unnamed Student';
const dateFmt = (v) => v ? new Date(v).toLocaleDateString('en-NG', {day:'2-digit', month:'short', year:'numeric'}) : '—';

export async function renderStudentsList() {
  const root = document.querySelector('.page-content');
  if (!root) return;

  root.innerHTML = `
    

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
