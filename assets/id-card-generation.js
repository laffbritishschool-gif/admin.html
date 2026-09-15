import { supabase, escapeHtml, toast } from './app.js';

function makeCardNumber(){
  const d=new Date();
  return `LBS-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
}

function overlay(){
  const old=document.querySelector('#id-generation-overlay');
  if(old)old.remove();
  const el=document.createElement('div');
  el.id='id-generation-overlay';
  el.innerHTML=`<div class="id-draw-modal" role="dialog" aria-live="polite" aria-label="Generating student ID card">
    <div class="id-draw-icon"><span class="draw-ring"></span><span class="draw-pencil">✎</span></div>
    <div class="id-draw-title">Generating ID Card</div>
    <p class="id-draw-name">Preparing student card…</p>
    <div class="id-draw-stage"><div class="draw-card-outline"><div class="draw-line draw-line-1"></div><div class="draw-line draw-line-2"></div><div class="draw-line draw-line-3"></div><div class="draw-photo-box"></div><div class="draw-line draw-line-4"></div><div class="draw-line draw-line-5"></div></div><div class="draw-scan"></div></div>
    <div class="id-draw-status"><span class="draw-check" id="draw-check-1">✓</span><span id="draw-status-text">Creating card layout…</span></div>
    <div class="id-draw-progress"><span id="id-draw-progress-bar"></span></div>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  return el;
}

function updateStage(el,text,percent,done=false){
  const status=el.querySelector('#draw-status-text');
  const bar=el.querySelector('#id-draw-progress-bar');
  if(status)status.textContent=text;
  if(bar)bar.style.width=`${percent}%`;
  if(done)el.querySelector('#draw-check-1')?.classList.add('done');
}

async function generate(studentId,button){
  const el=overlay();
  const studentName=el.querySelector('.id-draw-name');
  try{
    updateStage(el,'Finding student record…',12);
    const {data:student,error:studentError}=await supabase.from('students').select('id,first_name,middle_name,last_name').eq('id',studentId).maybeSingle();
    if(studentError)throw studentError;
    if(!student)throw new Error('Student record not found.');
    const name=[student.first_name,student.middle_name,student.last_name].filter(Boolean).join(' ');
    if(studentName)studentName.textContent=name;

    updateStage(el,'Drawing card frame…',30);
    await new Promise(r=>setTimeout(r,700));
    updateStage(el,'Drawing student identity details…',52);
    await new Promise(r=>setTimeout(r,700));
    updateStage(el,'Adding school security details…',72);
    await new Promise(r=>setTimeout(r,650));

    const {data:existing,error:checkError}=await supabase.from('id_cards').select('id').eq('student_id',studentId).limit(1);
    if(checkError)throw checkError;
    if(existing?.length){
      updateStage(el,'ID card already exists — opening it…',100,true);
      await new Promise(r=>setTimeout(r,500));
      location.href=`id-card-details.html?student=${encodeURIComponent(studentId)}`;
      return;
    }

    updateStage(el,'Saving finished ID card…',88);
    const expires=new Date();expires.setFullYear(expires.getFullYear()+1);
    const {data:userData}=await supabase.auth.getUser();
    const {error}=await supabase.from('id_cards').insert({student_id:studentId,card_number:makeCardNumber(),expires_at:expires.toISOString(),is_active:true,created_by:userData?.user?.id||null});
    if(error)throw error;
    updateStage(el,'ID card ready!',100,true);
    await new Promise(r=>setTimeout(r,650));
    toast('Student ID card generated successfully.','success');
    location.href=`id-card-details.html?student=${encodeURIComponent(studentId)}`;
  }catch(e){
    console.error('Animated ID card generation failed',e);
    el.querySelector('.id-draw-title').textContent='Generation could not be completed';
    updateStage(el,e?.message||'Please try again.',0);
    el.querySelector('.id-draw-modal')?.classList.add('generation-error');
    await new Promise(r=>setTimeout(r,1300));
    el.classList.remove('show');
    setTimeout(()=>el.remove(),250);
    if(button){button.disabled=false;button.innerHTML='Generate ID Card';}
    toast(e?.message||'Could not generate ID card.','error');
  }
}

document.addEventListener('click',event=>{
  const button=event.target.closest?.('.generate-id');
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(button.disabled)return;
  button.disabled=true;
  button.innerHTML='<span class="spinner spinner-sm"></span>Preparing…';
  generate(button.dataset.student,button);
},true);
