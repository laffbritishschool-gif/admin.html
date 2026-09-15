import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://moqpmrhholbbhuedvbgg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IfSp9O5zUubH6rifFbfmZQ_DJttLC1f';
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export const DEFAULT_SCHOOL_SETTINGS = {
  school_name: 'Laff British Montessori School', motto: '', logo_url: 'https://i.ibb.co/whtP8S5v/image.png',
  primary_color: '#0b5ed7', secondary_color: '#f4c20d',
  ui_settings: { navigation: 'sidebar', theme: 'light', compact_sidebar: false, show_breadcrumbs: true },
  result_settings: { show_position: true, publish_requires_approval: true },
  grading_rules: [
    {max:100,min:70,grade:'A',point:5},{max:69,min:60,grade:'B',point:4},{max:59,min:50,grade:'C',point:3},
    {max:49,min:45,grade:'D',point:2},{max:44,min:40,grade:'E',point:1},{max:39,min:0,grade:'F',point:0}
  ]
};

const nav = [
  ['index.html','Dashboard','▦'], ['students.html','Students','♙'], ['register-student.html','Register Student','＋'],
  ['teachers.html','Teachers','♟'], ['register-teacher.html','Register Teacher','＋'], ['classes.html','Classes','▤'],
  ['subjects.html','Subjects','◈'], ['results.html','Results','✓'], ['attendance.html','Attendance','◷'],
  ['timetable.html','Timetable','▦'], ['announcements.html','Announcements','◉'], ['fees.html','Fees & Payments','₦'],
  ['id-cards.html','ID Cards','▣'], ['settings.html','Settings','⚙']
];

export function toast(message, type='success') {
  let host = document.querySelector('#toast-host');
  if (!host) { host=document.createElement('div'); host.id='toast-host'; document.body.appendChild(host); }
  const el=document.createElement('div'); el.className=`toast toast-${type}`;
  el.innerHTML=`<span class="toast-icon">${type==='success'?'✓':type==='error'?'!':'i'}</span><span>${escapeHtml(message)}</span>`;
  host.appendChild(el); requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{el.classList.remove('show'); setTimeout(()=>el.remove(),250)},3800);
}
export function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c));}
export function setLoading(button, loading, text='Please wait…') {
  if(!button)return;
  if(loading){button.dataset.originalText=button.innerHTML;button.disabled=true;button.innerHTML=`<span class="spinner spinner-sm"></span>${text}`}
  else{button.disabled=false;button.innerHTML=button.dataset.originalText||'Continue'}
}
export function pageLoading(show=true){document.body.classList.toggle('is-loading',show);const x=document.querySelector('#page-loader');if(x)x.classList.toggle('active',show)}

function mergeSettings(settings={}){
  return {
    ...DEFAULT_SCHOOL_SETTINGS,
    ...settings,
    ui_settings:{...DEFAULT_SCHOOL_SETTINGS.ui_settings,...(settings.ui_settings||{})},
    result_settings:{...DEFAULT_SCHOOL_SETTINGS.result_settings,...(settings.result_settings||{})},
    grading_rules:Array.isArray(settings.grading_rules)&&settings.grading_rules.length?settings.grading_rules:DEFAULT_SCHOOL_SETTINGS.grading_rules
  };
}

export function getCachedSchoolSettings(){
  try{return mergeSettings(JSON.parse(localStorage.getItem('laff-school-settings')||'{}'));}catch{return mergeSettings();}
}

function injectGlobalUiStyles(){
  if(document.querySelector('#school-ui-settings-style'))return;
  const style=document.createElement('style');style.id='school-ui-settings-style';style.textContent=`
    body{--blue:var(--school-primary,#123d8f);--blue2:var(--school-primary,#0a66c2);--yellow:var(--school-secondary,#f4c400);}
    .nav-header .sidebar{position:sticky;top:0;left:0;right:0;width:100%;height:auto;min-height:76px;padding:10px 20px;display:flex;flex-direction:row;align-items:center;gap:18px;border-right:0;border-bottom:1px solid var(--line);box-shadow:0 8px 24px rgba(19,43,88,.06)}
    .nav-header .brand{padding:4px 8px;min-width:190px}.nav-header .sidebar nav{display:flex;align-items:center;gap:4px;overflow:auto;flex:1}.nav-header .nav-item{white-space:nowrap;padding:10px 11px}.nav-header .nav-item:hover{transform:translateY(-1px)}.nav-header .nav-item.active{box-shadow:inset 0 -3px var(--blue)}.nav-header .logout{margin:0;white-space:nowrap;padding:10px 13px}.nav-header .main{margin-left:0}.nav-header .menu{display:none}
    .compact-sidebar .sidebar{width:82px;padding:16px 9px}.compact-sidebar .main{margin-left:82px}.compact-sidebar .brand{justify-content:center;padding:4px 0 20px}.compact-sidebar .brand div{display:none}.compact-sidebar .nav-item{justify-content:center;padding:12px 8px}.compact-sidebar .nav-item em{display:none}.compact-sidebar .nav-item span{width:auto}.compact-sidebar .logout{font-size:0}.compact-sidebar .logout span{font-size:17px}
    .nav-header.compact-sidebar .sidebar{width:100%;padding:9px 12px;min-height:68px}.nav-header.compact-sidebar .main{margin-left:0}.nav-header.compact-sidebar .brand{min-width:auto;padding:3px 6px}.nav-header.compact-sidebar .brand div{display:block}.nav-header.compact-sidebar .nav-item em{display:inline}.nav-header.compact-sidebar .logout{font-size:13px}.nav-header.compact-sidebar .logout span{font-size:inherit}
    body.school-dark{--ink:#edf3ff;--muted:#9eacc4;--line:#26334b;--bg:#0d1422;--white:#131d2d;background:#0d1422;color:var(--ink)}
    body.school-dark .sidebar,body.school-dark .topbar,body.school-dark .panel,body.school-dark .btn.secondary,body.school-dark .btn-ghost{background:#131d2d;color:var(--ink)}
    body.school-dark .nav-item{color:#b8c4d8}.school-dark .nav-item:hover{background:#1a2940}.school-dark .nav-item.active{background:#1b3153;color:#fff}.school-dark .brand small,.school-dark .user-chip small{color:#9eacc4}.school-dark .avatar{background:#1b3153;color:#fff}.school-dark input,.school-dark select,.school-dark textarea{background:#0d1422;color:var(--ink);border-color:#30405b}.school-dark .btn.secondary,.school-dark .btn-ghost{color:var(--ink)}
    @media(max-width:760px){.nav-header .sidebar{flex-wrap:wrap;min-height:auto}.nav-header .brand{min-width:auto}.nav-header .sidebar nav{order:3;flex-basis:100%;padding-bottom:4px}.nav-header .logout{margin-left:auto}.compact-sidebar .sidebar{width:72px}.compact-sidebar .main{margin-left:72px}.page-content{padding:20px}}
  `;document.head.appendChild(style);
}

export function applySchoolSettings(raw={}){
  const s=mergeSettings(raw);injectGlobalUiStyles();
  document.documentElement.style.setProperty('--school-primary',s.primary_color||DEFAULT_SCHOOL_SETTINGS.primary_color);
  document.documentElement.style.setProperty('--school-secondary',s.secondary_color||DEFAULT_SCHOOL_SETTINGS.secondary_color);
  document.body.classList.toggle('school-dark',s.ui_settings.theme==='dark');
  document.body.classList.toggle('nav-header',s.ui_settings.navigation==='header');
  document.body.classList.toggle('compact-sidebar',!!s.ui_settings.compact_sidebar);
  try{localStorage.setItem('laff-school-settings',JSON.stringify(s));}catch{}
  document.querySelectorAll('.brand img').forEach(x=>x.src=s.logo_url||DEFAULT_SCHOOL_SETTINGS.logo_url);
  document.querySelectorAll('.brand strong').forEach(x=>x.textContent=(s.school_name||DEFAULT_SCHOOL_SETTINGS.school_name).replace(/\s+Montessori.*$/i,'').trim()||'Laff British');
  document.querySelectorAll('.brand small').forEach(x=>x.textContent='Montessori School');
  document.querySelectorAll('.topbar .eyebrow').forEach(x=>x.textContent=s.school_name||DEFAULT_SCHOOL_SETTINGS.school_name);
  document.querySelectorAll('[data-school-name]').forEach(x=>x.textContent=s.school_name||DEFAULT_SCHOOL_SETTINGS.school_name);
  return s;
}

export async function loadSchoolSettings(){
  const cached=getCachedSchoolSettings();applySchoolSettings(cached);
  try{
    const {data,error}=await supabase.from('school_settings').select('*').limit(1).maybeSingle();
    if(error)throw error;
    return applySchoolSettings(data||cached);
  }catch(e){console.warn('School settings could not be refreshed',e);return cached;}
}

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'OWNER'];

export async function getAdminProfile(userId){
  const {data:profile,error:profileError}=await supabase
    .from('profiles').select('id,full_name,role,is_active,must_change_password').eq('id',userId).maybeSingle();
  if(profileError) throw new Error('We could not verify your school staff profile.');
  if(profile && profile.is_active && ADMIN_ROLES.includes(String(profile.role||'').trim().toUpperCase())) return profile;
  const {data:staff,error:staffError}=await supabase
    .from('admin_staff').select('user_id,full_name,role,is_active,must_change_password').eq('user_id',userId).maybeSingle();
  if(staffError && !profile) throw new Error('We could not verify your administrator account.');
  if(staff && staff.is_active && ADMIN_ROLES.includes(String(staff.role||'').trim().toUpperCase())) return {id:userId,full_name:staff.full_name,role:String(staff.role).trim().toUpperCase(),is_active:staff.is_active,must_change_password:staff.must_change_password};
  return null;
}

export async function requireAdmin(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){location.replace('login.html');return null;}
  try{
    const profile=await getAdminProfile(session.user.id);
    if(!profile){await supabase.auth.signOut();location.replace('login.html?error=access');return null;}
    return {...session.user, profile};
  }catch(e){console.error('Admin access verification failed',e);await supabase.auth.signOut();location.replace('login.html?error=verify');return null;}
}
export async function signOut(){await supabase.auth.signOut();location.replace('login.html');}
export function mountShell(user){
  const path=location.pathname.split('/').pop()||'index.html';
  const active=nav.findIndex(n=>n[0]===path);
  const shell=document.querySelector('#app-shell'); if(!shell)return;
  const s=getCachedSchoolSettings();applySchoolSettings(s);
  shell.innerHTML=`<aside class="sidebar" id="sidebar"><div class="brand"><img src="${escapeHtml(s.logo_url)}" alt="${escapeHtml(s.school_name)}"><div><strong>${escapeHtml((s.school_name||'Laff British').replace(/\s+Montessori.*$/i,'').trim()||'Laff British')}</strong><small>Montessori School</small></div></div><nav>${nav.map((n,i)=>`<a class="nav-item ${i===active?'active':''}" href="${n[0]}"><span>${n[2]}</span><em>${n[1]}</em></a>`).join('')}</nav><button class="logout" id="logout"><span>↪</span> Sign out</button></aside><main class="main"><header class="topbar"><button class="menu" id="menu">☰</button><div><p class="eyebrow">${escapeHtml(s.school_name)}</p><h1>${document.body.dataset.title||'Administration'}</h1></div><div class="user-chip"><span class="avatar">${escapeHtml((user?.email||'A')[0].toUpperCase())}</span><div><strong>${escapeHtml(user?.profile?.full_name||'Administrator')}</strong><small>${escapeHtml(user?.profile?.role||'Admin')}</small></div></div></header><section class="page-content">${shell.dataset.content||''}</section></main>`;
  document.querySelector('#logout')?.addEventListener('click',signOut);document.querySelector('#menu')?.addEventListener('click',()=>document.querySelector('#sidebar')?.classList.toggle('open'));
  loadSchoolSettings();
}
export function renderStats(items=[]){return `<div class="stats-grid">${items.map(x=>`<article class="stat-card"><div class="stat-icon">${x.icon||'•'}</div><div><span>${escapeHtml(x.label)}</span><strong>${escapeHtml(x.value??'—')}</strong><small>${escapeHtml(x.meta||'')}</small></div></article>`).join('')}</div>`}

window.addEventListener('error',e=>{console.error(e.error||e.message);toast('Something went wrong. Please refresh and try again.','error')});
window.addEventListener('unhandledrejection',e=>{console.error(e.reason);toast('The request could not be completed. Please try again.','error')});
