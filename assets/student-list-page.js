import { supabase, escapeHtml, toast } from './app.js';

const esc = escapeHtml;
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
  } catch {
    return '';
  }
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
          <p>View, search and manage every student record from one place. Class placement, student IDs and account details stay together in the directory.</p>
          <div class="students-hero-actions">
            <a class="btn students-hero-btn" href="register-student.html">+ Register Student</a>
            <button class="btn secondary students-hero-secondary" id="student-refresh-top" type="button">Refresh Records</button>
          </div>
        </div>
        <div class="students-hero-side">
          <div class="students-hero-total"><strong id="students-total">0</strong><span>Students shown</span></div>
          <div class="students-hero-mini"><span>Session</span><strong id="students-session">—</strong></div>
        </div>
      </section>

      <section class="students-stat-grid" aria-label="Student statistics">
        <article class="student-stat">
          <div class="student-stat-icon">◉</div><div><span>Total Students</span><strong id="student-stat-total">0</strong><small>All records in school</small></div>
        </article>
        <article class="student-stat">
          <div class="student-stat-icon">✓</div><div><span>Active</span><strong id="student-stat-active">0</strong><small>Currently active</small></div>
        </article>
        <article class="student-stat">
          <div class="student-stat-icon">⌂</div><div><span>Classes</span><strong id="student-stat-classes">0</strong><small>With student records</small></div>
        </article>
        <article class="student-stat">
          <div class="student-stat-icon">▣</div><div><span>With Passport</span><strong id="student-stat-photos">0</strong><small>Photo available</small></div>
        </article>
      </section>

      <section class="panel students-command">
        <div class="students-command-head">
          <div><span class="section-kicker">DIRECTORY TOOLS</span><h3>Find a student</h3><p>Search by name, registration number, exam number, email or class.</p></div>
          <button class="btn btn-ghost" id="student-refresh" type="button">Refresh</button>
        </div>
        <div class="students-command-fields">
          <label class="student-search-box"><span aria-hidden="true">⌕</span><input id="student-search" type="search" placeholder="Search students…"><button id="student-search-clear" type="button" aria-label="Clear search">×</button></label>
          <select id="student-class"><option value="">All classes</option></select>
          <select id="student-status">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="GRADUATED">Graduated</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </select>
        </div>
        <div class="students-command-foot"><span id="student-result-note">Loading student records…</span><span id="student-filter-count">0 shown</span></div>
      </section>

      <section id="students-results"></section>
    </div>
  `;

  const list = root.querySelector('#students-results');
  const total = root.querySelector('#students-total');
  const sessionName = root.querySelector('#students-session');
  const search = root.querySelector('#student-search');
  const searchClear = root.querySelector('#student-search-clear');
  const classFilter = root.querySelector('#student-class');
  const status = root.querySelector('#student-status');
  const refresh = root.querySelector('#student-refresh');
  const refreshTop = root.querySelector('#student-refresh-top');
  const resultNote = root.querySelector('#student-result-note');
  const filterCount = root.querySelector('#student-filter-count');
  const statTotal = root.querySelector('#student-stat-total');
  const statActive = root.querySelector('#student-stat-active');
  const statClasses = root.querySelector('#student-stat-classes');
  const statPhotos = root.querySelector('#student-stat-photos');

  let rows = [];
  let classOptions = [];
  let loading = false;

  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const wantedClass = classFilter.value;
    const wantedStatus = status.value;

    const filtered = rows.filter(s => {
      const hay = [
        fullName(s), s.student_id, s.exam_number, s.school_email, s.phone,
        s.class_name, s.class_level
      ].filter(Boolean).join(' ').toLowerCase();
      return (!q || hay.includes(q)) &&
        (!wantedClass || s.class_id === wantedClass) &&
        (!wantedStatus || String(s.status || 'ACTIVE').toUpperCase() === wantedStatus);
    });

    total.textContent = filtered.length;
    filterCount.textContent = filtered.length + ' shown';
    resultNote.textContent = filtered.length === rows.length
      ? rows.length + ' student' + (rows.length === 1 ? '' : 's') + ' in the directory'
      : 'Showing ' + filtered.length + ' of ' + rows.length + ' students';

    if (!filtered.length) {
      list.innerHTML = `
        <section class="panel students-empty">
          <div class="students-empty-icon">⌕</div>
          <h3>No students found</h3>
          <p>Try a different name, class or status filter.</p>
          <button class="btn btn-ghost" type="button" id="reset-student-filters">Clear filters</button>
        </section>`;
      root.querySelector('#reset-student-filters')?.addEventListener('click', () => {
        search.value=''; classFilter.value=''; status.value=''; draw(); search.focus();
      });
      return;
    }

    list.innerHTML = '<div class="students-directory">' + filtered.map((s,i) => {
      const name = fullName(s);
      const classText = s.class_name ? s.class_name + (s.class_level ? ' · ' + s.class_level : '') : 'No active class';
      const photo = s.photo_signed_url;
      const avatar = photo
        ? '<img src="' + esc(photo) + '" alt="' + esc(name) + '">'
        : '<span class="student-avatar-initials">' + esc(initials(s)) + '</span>';

      return `
        <article class="student-directory-card" style="--delay:${Math.min(i,12)*45}ms">
          <div class="student-directory-head">
            <div class="student-directory-avatar">${avatar}</div>
            <div class="student-directory-identity">
              <span class="student-directory-label">${esc(statusLabel(s.status))}</span>
              <h3>${esc(name)}</h3>
              <p>${esc(s.student_id || 'No Student ID')}</p>
            </div>
            <span class="badge ${statusClass(s.status)}">${esc(statusLabel(s.status))}</span>
          </div>

          <div class="student-directory-class">
            <span class="class-icon">⌂</span>
            <div><small>Current class</small><strong>${esc(classText)}</strong></div>
          </div>

          <div class="student-directory-grid">
            <div><span>Exam Number</span><strong>${esc(s.exam_number || '—')}</strong></div>
            <div><span>Gender</span><strong>${esc(s.gender || '—')}</strong></div>
            <div><span>School Email</span><strong title="${esc(s.school_email || '')}">${esc(s.school_email || '—')}</strong></div>
            <div><span>Admission</span><strong>${esc(dateFmt(s.admission_date || s.created_at))}</strong></div>
          </div>

          <div class="student-directory-footer">
            <span>${s.session_name ? esc(s.session_name) : 'No session'}</span>
            <div>
              <a class="btn btn-sm btn-ghost" href="student-details.html?id=${encodeURIComponent(s.id)}">View</a>
              <a class="btn btn-sm btn-primary" href="register-student.html?id=${encodeURIComponent(s.id)}">Edit</a>
            </div>
          </div>
        </article>`;
    }).join('') + '</div>';
  };

  const load = async () => {
    if (loading) return;
    loading = true;
    refresh.disabled = true;
    refreshTop.disabled = true;
    refresh.textContent = 'Loading…';
    list.innerHTML = '<section class="panel students-loading"><span class="spinner"></span><div><strong>Loading students</strong><p>Fetching the latest student directory.</p></div></section>';

    try {
      const [{ data: students, error: studentError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
        supabase.from('students')
          .select('id,student_id,exam_number,first_name,middle_name,last_name,gender,photo_url,school_email,phone,status,admission_date,created_at')
          .order('created_at', { ascending:false }),
        supabase.from('enrollments')
          .select('student_id,class_id,session_id,status,created_at,classes(name,level),academic_sessions(name,is_current)')
          .order('created_at', { ascending:false })
      ]);
      if (studentError) throw studentError;
      if (enrollmentError) throw enrollmentError;

      const enrollmentMap = new Map();
      (enrollments || []).forEach(e => {
        const existing = enrollmentMap.get(e.student_id);
        const isBetter = !existing ||
          (e.status === 'ACTIVE' && existing.status !== 'ACTIVE') ||
          (e.academic_sessions?.is_current && !existing.academic_sessions?.is_current);
        if (isBetter) enrollmentMap.set(e.student_id, e);
      });

      rows = await Promise.all((students || []).map(async s => {
        const e = enrollmentMap.get(s.id);
        return {
          ...s,
          class_id: e?.class_id || '',
          class_name: e?.classes?.name || '',
          class_level: e?.classes?.level || '',
          session_name: e?.academic_sessions?.name || '',
          photo_signed_url: await resolvePhoto(s.photo_url)
        };
      }));

      classOptions = Array.from(new Map(rows.filter(x=>x.class_id).map(x=>[x.class_id,{id:x.class_id,name:x.class_name,level:x.class_level}])).values())
        .sort((a,b)=>a.name.localeCompare(b.name));
      classFilter.innerHTML = '<option value="">All classes</option>' + classOptions.map(x => '<option value="' + esc(x.id) + '">' + esc(x.name) + (x.level ? ' · ' + esc(x.level) : '') + '</option>').join('');

      const currentSession = rows.map(x=>x.session_name).find(Boolean) || '2026/2027';
      sessionName.textContent = currentSession;
      statTotal.textContent = rows.length;
      statActive.textContent = rows.filter(x=>String(x.status||'ACTIVE').toUpperCase()==='ACTIVE').length;
      statClasses.textContent = classOptions.length;
      statPhotos.textContent = rows.filter(x=>x.photo_signed_url).length;

      draw();
    } catch (error) {
      console.error('Students page load failed:', error);
      list.innerHTML = '<section class="panel students-error"><strong>Unable to load students.</strong><p>' + esc(error?.message || 'Please refresh the page and try again.') + '</p><button class="btn btn-primary" type="button" id="retry-students">Try again</button></section>';
      root.querySelector('#retry-students')?.addEventListener('click', load);
      total.textContent = '0';
      filterCount.textContent = '0 shown';
      resultNote.textContent = 'Unable to load records';
      toast(error?.message || 'Unable to load students.', 'error');
    } finally {
      loading = false;
      refresh.disabled = false;
      refreshTop.disabled = false;
      refresh.textContent = 'Refresh';
      refreshTop.textContent = 'Refresh Records';
    }
  };

  search.addEventListener('input', draw);
  searchClear.addEventListener('click', () => { search.value=''; draw(); search.focus(); });
  classFilter.addEventListener('change', draw);
  status.addEventListener('change', draw);
  refresh.addEventListener('click', load);
  refreshTop.addEventListener('click', load);
  await load();
}
