import { supabase, escapeHtml, toast, setLoading, pageLoading } from './app.js';

const esc = escapeHtml;

function shellError(root, message='The subjects page could not be loaded.') {
  root.innerHTML = `
    <section class="subject-page">
      <div class="subject-empty">
        <div class="empty-icon">◈</div>
        <h3>${esc(message)}</h3>
        <p>Please refresh the page and try again.</p>
        <button class="btn btn-primary" id="retry-subjects">↻ Refresh Subjects</button>
      </div>
    </section>`;
  root.querySelector('#retry-subjects')?.addEventListener('click', () => location.reload());
}

function kindLabel(row) {
  return row.subject_kind === 'GROUP'
    ? 'Combined Subject'
    : (row.parent_subject_id ? 'Component Subject' : 'Standalone Subject');
}

function iconFor(row) {
  return row.subject_kind === 'GROUP' ? '▦' : (row.parent_subject_id ? '↳' : '◈');
}

function groupChildren(rows, parentId) {
  return rows
    .filter(r => r.parent_subject_id === parentId)
    .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0) || String(a.name).localeCompare(String(b.name)));
}

async function fetchRows() {
  const { data, error } = await supabase
    .from('subjects')
    .select('id,name,code,max_ca,max_exam,is_active,created_at,parent_subject_id,subject_kind,display_order')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function hasUsage(id) {
  const checks = await Promise.all([
    supabase.from('class_subjects').select('id', { count: 'exact', head: true }).eq('subject_id', id),
    supabase.from('results').select('id', { count: 'exact', head: true }).eq('subject_id', id),
    supabase.from('timetables').select('id', { count: 'exact', head: true }).eq('subject_id', id)
  ]);
  const failure = checks.find(x => x.error);
  if (failure) throw failure.error;
  return checks.reduce((sum, x) => sum + Number(x.count || 0), 0);
}

export async function renderSubjectsPage() {
  const root = document.querySelector('.page-content');
  if (!root) return;

  pageLoading?.(true);
  root.innerHTML = `
    <section class="subject-page">
      <div class="subject-hero">
        <div>
          <span class="eyebrow">ACADEMIC MANAGEMENT</span>
          <h1>Subjects</h1>
          <p>Organise combined subjects, component subjects and standalone subjects for the school result system.</p>
        </div>
        <button class="btn hero-add" id="add-subject">+ Add New Subject</button>
      </div>

      <div class="subject-metrics" id="subject-metrics">
        <div class="metric-skeleton"></div><div class="metric-skeleton"></div><div class="metric-skeleton"></div>
      </div>

      <div class="subject-toolbar">
        <div class="subject-search">
          <span>⌕</span>
          <input id="subject-search" placeholder="Search subject, group or code…">
        </div>
        <select id="subject-status" aria-label="Filter by status">
          <option value="all">All subjects</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <button class="btn btn-ghost" id="subject-refresh">↻ Refresh</button>
      </div>

      <div class="subject-help-strip">
        <div><strong>Combined subjects</strong><span>Use a group for BST, RNV, PVS and similar structures.</span></div>
        <div><strong>Component subjects</strong><span>Each component keeps its own score and can be moved to another group.</span></div>
        <div><strong>Safe delete</strong><span>Subjects already used in classes, results or timetables are protected.</span></div>
      </div>

      <div id="subject-list" class="subject-manager-grid">
        <div class="subject-loading-card"><span class="spinner"></span><strong>Loading subjects</strong><small>Preparing your academic records…</small></div>
      </div>
    </section>`;

  const list = root.querySelector('#subject-list');
  const search = root.querySelector('#subject-search');
  const status = root.querySelector('#subject-status');

  let rows = [];

  function matches(row, q) {
    return `${row.name || ''} ${row.code || ''} ${kindLabel(row)}`.toLowerCase().includes(q);
  }

  function render(rowsToRender) {
    const q = search.value.trim().toLowerCase();
    const activeFilter = status.value;
    const allFiltered = rowsToRender.filter(r =>
      activeFilter === 'all' || (activeFilter === 'active' ? r.is_active : !r.is_active)
    );
    const matching = q ? allFiltered.filter(r => matches(r, q)) : allFiltered;
    const matchingIds = new Set(matching.map(r => r.id));

    const groups = rowsToRender
      .filter(r => r.subject_kind === 'GROUP')
      .filter(g => {
        const children = groupChildren(rowsToRender, g.id);
        const groupVisible = matchingIds.has(g.id);
        const childVisible = children.some(c => matchingIds.has(c.id));
        return (activeFilter === 'all' || (activeFilter === 'active' ? g.is_active : !g.is_active))
          && (!q || groupVisible || childVisible);
      })
      .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0) || a.name.localeCompare(b.name));

    const standalone = rowsToRender
      .filter(r => r.subject_kind !== 'GROUP' && !r.parent_subject_id)
      .filter(r => matchingIds.has(r.id))
      .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0) || a.name.localeCompare(b.name));

    const orphaned = rowsToRender
      .filter(r => r.subject_kind !== 'GROUP' && r.parent_subject_id && !rowsToRender.some(g => g.id === r.parent_subject_id))
      .filter(r => matchingIds.has(r.id));

    root.querySelector('#subject-metrics').innerHTML = `
      <div class="subject-metric"><span>Total Subjects</span><strong>${rowsToRender.length}</strong><small>All configured records</small></div>
      <div class="subject-metric"><span>Combined Groups</span><strong>${rowsToRender.filter(x => x.subject_kind === 'GROUP').length}</strong><small>Top-level subject groups</small></div>
      <div class="subject-metric"><span>Component / Standalone</span><strong>${rowsToRender.filter(x => x.subject_kind !== 'GROUP').length}</strong><small>Scorable subject records</small></div>`;

    const cards = [];

    for (const group of groups) {
      const children = groupChildren(rowsToRender, group.id).filter(child => {
        const passStatus = activeFilter === 'all' || (activeFilter === 'active' ? child.is_active : !child.is_active);
        return passStatus && (!q || matches(child, q) || matches(group, q));
      });

      cards.push(`
        <article class="subject-group-card">
          <div class="subject-group-head">
            <div class="subject-group-title">
              <div class="subject-icon group-icon">${iconFor(group)}</div>
              <div>
                <div class="subject-badges">
                  <span class="subject-type-badge">COMBINED</span>
                  <span class="subject-status ${group.is_active ? 'active' : 'inactive'}">${group.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <h2>${esc(group.name)}</h2>
                <p>${esc(group.code || 'No code')} · ${children.length} component${children.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            <div class="subject-group-actions">
              <button class="btn btn-sm btn-ghost edit-subject" data-id="${group.id}">Edit</button>
              <button class="btn btn-sm btn-ghost toggle-subject" data-id="${group.id}" data-active="${group.is_active}">${group.is_active ? 'Deactivate' : 'Activate'}</button>
              <button class="btn btn-sm btn-danger delete-subject" data-id="${group.id}" data-name="${esc(group.name)}">Delete</button>
            </div>
          </div>
          <div class="subject-children">
            ${children.length ? children.map(child => `
              <div class="subject-child-row">
                <div class="child-name-cell">
                  <span class="child-mark">↳</span>
                  <div><strong>${esc(child.name)}</strong><small>${esc(child.code || 'No code')} · ${esc(kindLabel(child))}</small></div>
                </div>
                <div class="child-score-cell"><strong>${Number(child.max_ca || 0) + Number(child.max_exam || 0)}</strong><small>Max total</small></div>
                <span class="subject-status ${child.is_active ? 'active' : 'inactive'}">${child.is_active ? 'Active' : 'Inactive'}</span>
                <div class="child-actions">
                  <button class="icon-action edit-subject" data-id="${child.id}" title="Edit subject">Edit</button>
                  <button class="icon-action move-subject" data-id="${child.id}" title="Move subject">Move</button>
                  <button class="icon-action ${child.is_active ? 'warn' : ''} toggle-subject" data-id="${child.id}" data-active="${child.is_active}">${child.is_active ? 'Off' : 'On'}</button>
                  <button class="icon-action danger delete-subject" data-id="${child.id}" data-name="${esc(child.name)}" title="Delete subject">Delete</button>
                </div>
              </div>`).join('') : `
              <div class="subject-child-empty">No component subjects yet. Use <strong>Add New Subject</strong> and choose this group.</div>`}
          </div>
        </article>`);
    }

    if (standalone.length) {
      cards.push(`
        <article class="subject-group-card standalone-card">
          <div class="subject-group-head">
            <div class="subject-group-title">
              <div class="subject-icon">${iconFor({subject_kind:'LEAF'})}</div>
              <div>
                <div class="subject-badges"><span class="subject-type-badge standalone">STANDALONE</span></div>
                <h2>Standalone Subjects</h2>
                <p>Subjects that are not inside a combined group</p>
              </div>
            </div>
          </div>
          <div class="subject-children">
            ${standalone.map(child => `
              <div class="subject-child-row">
                <div class="child-name-cell">
                  <span class="child-mark">•</span>
                  <div><strong>${esc(child.name)}</strong><small>${esc(child.code || 'No code')}</small></div>
                </div>
                <div class="child-score-cell"><strong>${Number(child.max_ca || 0) + Number(child.max_exam || 0)}</strong><small>Max total</small></div>
                <span class="subject-status ${child.is_active ? 'active' : 'inactive'}">${child.is_active ? 'Active' : 'Inactive'}</span>
                <div class="child-actions">
                  <button class="icon-action edit-subject" data-id="${child.id}">Edit</button>
                  <button class="icon-action move-subject" data-id="${child.id}">Move</button>
                  <button class="icon-action ${child.is_active ? 'warn' : ''} toggle-subject" data-id="${child.id}" data-active="${child.is_active}">${child.is_active ? 'Off' : 'On'}</button>
                  <button class="icon-action danger delete-subject" data-id="${child.id}" data-name="${esc(child.name)}">Delete</button>
                </div>
              </div>`).join('')}
          </div>
        </article>`);
    }

    if (orphaned.length) {
      cards.push(`
        <article class="subject-group-card orphan-card">
          <div class="subject-group-head">
            <div>
              <div class="subject-badges"><span class="subject-type-badge orphan">ORPHANED</span></div>
              <h2>Needs attention</h2>
              <p>These component subjects reference a missing group.</p>
            </div>
          </div>
          <div class="subject-children">
            ${orphaned.map(child => `
              <div class="subject-child-row">
                <div class="child-name-cell"><span class="child-mark">!</span><div><strong>${esc(child.name)}</strong><small>${esc(child.code || 'No code')}</small></div></div>
                <div class="child-score-cell"><strong>${Number(child.max_ca || 0) + Number(child.max_exam || 0)}</strong><small>Max total</small></div>
                <div class="child-actions"><button class="icon-action move-subject" data-id="${child.id}">Move</button></div>
              </div>`).join('')}
          </div>
        </article>`);
    }

    if (!cards.length) {
      list.innerHTML = `
        <div class="subject-empty">
          <div class="empty-icon">◈</div>
          <h3>${rowsToRender.length ? 'No matching subjects' : 'No subjects yet'}</h3>
          <p>${rowsToRender.length ? 'Try a different search or filter.' : 'Create your first subject to start organising the curriculum.'}</p>
          <button class="btn btn-primary" id="empty-add-subject">+ Add New Subject</button>
        </div>`;
      root.querySelector('#empty-add-subject')?.addEventListener('click', () => location.href='new-subject.html');
      return;
    }

    list.innerHTML = cards.join('');
  }

  async function refresh() {
    list.innerHTML = `<div class="subject-loading-card"><span class="spinner"></span><strong>Loading subjects</strong><small>Refreshing academic records…</small></div>`;
    try {
      rows = await fetchRows();
      render(rows);
    } catch (err) {
      console.error('Subjects load failed:', err);
      shellError(root, 'Unable to load subjects right now.');
      toast(err.message || 'Could not load subjects.', 'error');
    }
  }

  async function toggle(id, active, button) {
    button.disabled = true;
    try {
      const { error } = await supabase.from('subjects').update({ is_active: !active }).eq('id', id);
      if (error) throw error;
      toast(active ? 'Subject deactivated.' : 'Subject activated.');
      await refresh();
    } catch (err) {
      toast(err.message || 'Could not update subject status.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function remove(id, name, button) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    button.disabled = true;
    try {
      const current = rows.find(r => r.id === id);
      if (!current) throw new Error('Subject record not found.');
      const childCount = rows.filter(r => r.parent_subject_id === id).length;
      if (childCount) throw new Error('This combined subject still has component subjects. Move or delete those components first.');
      const usage = await hasUsage(id);
      if (usage > 0) {
        throw new Error(`This subject is already used by ${usage} class, result or timetable record${usage === 1 ? '' : 's'}. Deactivate it instead of deleting it.`);
      }
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;
      toast('Subject deleted.');
      await refresh();
    } catch (err) {
      console.error('Delete subject failed:', err);
      toast(err.message || 'Could not delete subject.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  root.querySelector('#add-subject').onclick = () => location.href='new-subject.html';
  root.querySelector('#subject-refresh').onclick = refresh;
  search.oninput = () => render(rows);
  status.onchange = () => render(rows);

  list.addEventListener('click', async e => {
    const edit = e.target.closest('.edit-subject');
    const move = e.target.closest('.move-subject');
    const toggleBtn = e.target.closest('.toggle-subject');
    const del = e.target.closest('.delete-subject');

    if (edit) location.href = `new-subject.html?id=${encodeURIComponent(edit.dataset.id)}`;
    else if (move) location.href = `new-subject.html?id=${encodeURIComponent(move.dataset.id)}&focus=group`;
    else if (toggleBtn) await toggle(toggleBtn.dataset.id, toggleBtn.dataset.active === 'true', toggleBtn);
    else if (del) await remove(del.dataset.id, del.dataset.name, del);
  });

  await refresh();
  pageLoading?.(false);
}
