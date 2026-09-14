import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://moqpmrhholbbhuedvbgg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IfSp9O5zUubH6rifFbfmZQ_DJttLC1f';
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

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

const ADMIN_ROLES = ['ADMIN','SUPER_ADMIN','OWNER'];

export async function getAdminProfile(userId){
  const {data:profile,error:profileError}=await supabase
    .from('profiles')
    .select('id,full_name,role,is_active,must_change_password')
    .eq('id',userId)
    .maybeSingle();

  if(profileError) throw new Error('We could not verify your school staff profile.');
  if(profile && profile.is_active && ADMIN_ROLES.includes(String(profile.role||'').trim().toUpperCase())) return profile;

  // The live system also keeps the administrative staff record. This fallback
  // prevents a valid administrator from being rejected when profile metadata
  // and staff metadata are temporarily out of sync.
  const {data:staff,error:staffError}=await supabase
    .from('admin_staff')
    .select('user_id,full_name,role,is_active,must_change_password')
    .eq('user_id',userId)
    .maybeSingle();

  if(staffError && !profile) throw new Error('We could not verify your administrator account.');
  if(staff && staff.is_active && ADMIN_ROLES.includes(String(staff.role||'').trim().toUpperCase())) {
    return {
      id:userId,
      full_name:staff.full_name,
      role:String(staff.role).trim().toUpperCase(),
      is_active:staff.is_active,
      must_change_password:staff.must_change_password
    };
  }
  return null;
}

export async function requireAdmin(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){location.replace('login.html');return null;}
  try{
    const profile=await getAdminProfile(session.user.id);
    if(!profile){await supabase.auth.signOut();location.replace('login.html?error=access');return null;}
    return {...session.user, profile};
  }catch(e){
    console.error('Admin access verification failed',e);
    await supabase.auth.signOut();
    location.replace('login.html?error=verify');
    return null;
  }
}
export async function signOut(){await supabase.auth.signOut();location.replace('login.html');}
export function mountShell(user){
  const path=location.pathname.split('/').pop()||'index.html';
  const active=nav.findIndex(n=>n[0]===path);
  const shell=document.querySelector('#app-shell'); if(!shell)return;
  shell.innerHTML=`<aside class="sidebar" id="sidebar"><div class="brand"><img src="https://i.ibb.co/whtP8S5v/image.png" alt="Laff British Montessori School"><div><strong>Laff British</strong><small>Montessori School</small></div></div><nav>${nav.map((n,i)=>`<a class="nav-item ${i===active?'active':''}" href="${n[0]}"><span>${n[2]}</span><em>${n[1]}</em></a>`).join('')}</nav><button class="logout" id="logout"><span>↪</span> Sign out</button></aside><main class="main"><header class="topbar"><button class="menu" id="menu">☰</button><div><p class="eyebrow">Laff British Montessori School</p><h1>${document.body.dataset.title||'Administration'}</h1></div><div class="user-chip"><span class="avatar">${escapeHtml((user?.email||'A')[0].toUpperCase())}</span><div><strong>${escapeHtml(user?.profile?.full_name||'Administrator')}</strong><small>${escapeHtml(user?.profile?.role||'Admin')}</small></div></div></header><section class="page-content">${shell.dataset.content||''}</section></main>`;
  document.querySelector('#logout')?.addEventListener('click',signOut);document.querySelector('#menu')?.addEventListener('click',()=>document.querySelector('#sidebar')?.classList.toggle('open'));
}
export function renderStats(items=[]){return `<div class="stats-grid">${items.map(x=>`<article class="stat-card"><div class="stat-icon">${x.icon||'•'}</div><div><span>${escapeHtml(x.label)}</span><strong>${escapeHtml(x.value??'—')}</strong><small>${escapeHtml(x.meta||'')}</small></div></article>`).join('')}</div>`}

window.addEventListener('error',e=>{console.error(e.error||e.message);toast('Something went wrong. Please refresh and try again.','error')});
window.addEventListener('unhandledrejection',e=>{console.error(e.reason);toast('The request could not be completed. Please try again.','error')});
