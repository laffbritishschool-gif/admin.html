import { supabase, escapeHtml, toast, setLoading, pageLoading } from './app.js';

const esc = escapeHtml;

function shellError(root, message='The subjects page could not be loaded.') {
  root.innerHTML = `<section class="subject-page"><div class="subject-empty"><div class="empty-icon">◈</div><h3>${esc(message)}</h3><p>Please refresh the page and try again.</p><button class="btn btn-primary" id="retry-subjects">↻ Refresh Subjects</button></div></section>`;
  root.querySelector('#retry-subjects')?.addEventListener('click', () => location.reload());
}

export async function renderSubjectsPage() {
  const root = document.querySelector('.page-content');
  if (!root) return;

  pageLoading?.(true);
  root.innerHTML = `
    <section class="subject-page">
      <div class="subject-hero">
        <div><span class="eyebrow">ACADEMIC MANAGEMENT</span><h1>Subjects</h1><p>Manage the subjects taught across Laff British Montessori School and keep assessment settings organised.</p></div>
        <button class="btn hero-add" id="add-subject">+ Add New Subject</button>
      </div>
      <div class="subject-metrics" id="subject-metrics">
        <div class="metric-skeleton"></div><div class="metric-skeleton"></div><div class="metric-skeleton"></div>
      </div>
      <div class="subject-toolbar">
        <div class="subject-search"><span>⌕</span><input id="subject-search" placeholder="Search subject or code…"></div>
        <select id="subject-status"><option value="all">All subjects</option><option value="active">Active only</option><option value="inactive">Inactive only</option></select>
        <button class="btn btn-ghost" id="subject-refresh">↻ Refresh</button>
      </div>
      <div id="subject-list" class="subject-grid">
        <div class="subject-loading-card"><span class="spinner"></span><strong>Loading subjects</strong><small>Preparing your academic records…</small></div>
      </div>
      <div id="subject-editor" class="subject-editor hidden"></div>
    </section>`;

  const list = root.querySelector('#subject-list');
  const editor = root.querySelector('#subject-editor');
  const search = root.querySelector('#subject-search');
  const status = root.querySelector('#subject-status');

  async function load() {
    const { data, error } = await supabase.from('subjects')
      .select('id,name,code,max_ca,max_exam,is_active,created_at')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function refresh() {
    list.innerHTML = `<div class="subject-loading-card"><span class="spinner"></span><strong>Loading subjects</strong><small>Refreshing academic records…</small></div>`;
    try {
      const rows = await load();
      const q = search.value.trim().toLowerCase();
      const filtered = rows.filter(r =>
        (status.value === 'all' || (status.value === 'active' ? r.is_active : !r.is_active)) &&
        (!q || `${r.name || ''} ${r.code || ''}`.toLowerCase().includes(q))
      );

      root.querySelector('#subject-metrics').innerHTML = `
        <div class="subject-metric"><span>Total Subjects</span><strong>${rows.length}</strong><small>Configured subjects</small></div>
        <div class="subject-metric"><span>Active Subjects</span><strong>${rows.filter(x => x.is_active).length}</strong><small>Available for academic use</small></div>
        <div class="subject-metric"><span>Assessment Total</span><strong>${rows.reduce((a,x) => a + Number(x.max_ca || 0) + Number(x.max_exam || 0), 0)}</strong><small>Maximum marks configured</small></div>`;

      if (!filtered.length) {
        list.innerHTML = `<div class="subject-empty"><div class="empty-icon">◈</div><h3>${rows.length ? 'No matching subjects' : 'No subjects yet'}</h3><p>${rows.length ? 'Try a different search or filter.' : 'Create your first subject to start organising the curriculum.'}</p>${!rows.length ? '<button class="btn btn-primary" id="empty-add-subject">+ Add New Subject</button>' : ''}</div>`;
        root.querySelector('#empty-add-subject')?.addEventListener('click', () => openEditor());
        return;
      }

      list.innerHTML = filtered.map((r, i) => `
        <article class="subject-card" style="--delay:${i * 60}ms">
          <div class="subject-card-top"><div class="subject-icon">${esc((r.code || r.name || 'SU').slice(0,2).toUpperCase())}</div><span class="subject-status ${r.is_active ? 'active' : 'inactive'}">${r.is_active ? 'Active' : 'Inactive'}</span></div>
          <div class="subject-card-body"><h2>${esc(r.name)}</h2><p>${esc(r.code || 'No subject code')}</p>
            <div class="mark-grid"><div><strong>${Number(r.max_ca || 0)}</strong><span>Max CA</span></div><div><strong>${Number(r.max_exam || 0)}</strong><span>Max Exam</span></div><div><strong>${Number(r.max_ca || 0) + Number(r.max_exam || 0)}</strong><span>Total</span></div></div>
          </div>
          <div class="subject-card-footer"><button class="btn btn-sm btn-ghost edit-subject" data-id="${r.id}">Edit Subject</button><button class="btn btn-sm ${r.is_active ? 'btn-danger' : 'btn-primary'} toggle-subject" data-id="${r.id}" data-active="${r.is_active}">${r.is_active ? 'Deactivate' : 'Activate'}</button></div>
        </article>`).join('');
    } catch (err) {
      console.error('Subjects load failed:', err);
      shellError(root, 'Unable to load subjects right now.');
      toast(err.message || 'Could not load subjects.', 'error');
    }
  }

  function openEditor(row = null) {
    editor.classList.remove('hidden');
    editor.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>${row ? 'Edit Subject' : 'Add New Subject'}</h2><p>${row ? 'Update the subject details and assessment limits.' : 'Create a subject for the academic programme.'}</p></div><button type="button" class="btn btn-ghost" id="close-subject">Close</button></div>
      <form id="subject-form" class="form-grid"><label>Subject Name *<input name="name" required value="${esc(row?.name || '')}" placeholder="e.g. Mathematics"></label><label>Subject Code<input name="code" value="${esc(row?.code || '')}" placeholder="e.g. MATH"></label><label>Maximum CA<input name="max_ca" type="number" min="0" value="${Number(row?.max_ca ?? 30)}"></label><label>Maximum Exam<input name="max_exam" type="number" min="0" value="${Number(row?.max_exam ?? 70)}"></label><label class="check full-field"><input name="is_active" type="checkbox" ${row?.is_active !== false ? 'checked' : ''}> Active subject</label><div class="form-actions"><button class="btn btn-primary" type="submit">${row ? 'Save Changes' : 'Create Subject'}</button><button class="btn btn-ghost" type="button" id="cancel-subject">Cancel</button></div></form></div>`;
    editor.querySelector('#close-subject').onclick = () => editor.classList.add('hidden');
    editor.querySelector('#cancel-subject').onclick = () => editor.classList.add('hidden');
    editor.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]'); setLoading(btn, true, 'Saving…');
      const fd = new FormData(e.target);
      const payload = { name: String(fd.get('name') || '').trim(), code: String(fd.get('code') || '').trim() || null, max_ca: Number(fd.get('max_ca') || 0), max_exam: Number(fd.get('max_exam') || 0), is_active: fd.get('is_active') === 'on' };
      try {
        const res = row ? await supabase.from('subjects').update(payload).eq('id', row.id) : await supabase.from('subjects').insert(payload);
        if (res.error) throw res.error;
        toast(row ? 'Subject updated successfully.' : 'Subject created successfully.'); editor.classList.add('hidden'); await refresh();
      } catch (err) { console.error(err); toast(err.message || 'Could not save subject.', 'error'); }
      finally { setLoading(btn, false); }
    };
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  root.querySelector('#add-subject').onclick = () => openEditor();
  root.querySelector('#subject-refresh').onclick = refresh;
  search.oninput = refresh;
  status.onchange = refresh;
  list.addEventListener('click', async e => {
    const edit = e.target.closest('.edit-subject');
    const toggle = e.target.closest('.toggle-subject');
    if (edit) { try { const rows = await load(); openEditor(rows.find(x => x.id === edit.dataset.id)); } catch (err) { toast(err.message || 'Could not open subject.', 'error'); } }
    if (toggle) {
      const active = toggle.dataset.active === 'true'; toggle.disabled = true;
      const { error } = await supabase.from('subjects').update({ is_active: !active }).eq('id', toggle.dataset.id);
      if (error) toast(error.message, 'error'); else { toast(active ? 'Subject deactivated.' : 'Subject activated.'); await refresh(); }
      toggle.disabled = false;
    }
  });

  await refresh();
  pageLoading?.(false);
}
