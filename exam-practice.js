"use strict";
const CONFIG = {
  endpoint:"https://qekcgsfeomjckctiubgm.supabase.co/functions/v1/year5-exam-drills",
  publishableKey:"sb_publishable_yJbCYOLDeMreuqM01g_oqA_eF5YEWwq"
};
const TASKS = {
  "p6-1":{part:6,title:"Learning a New Hobby",friend:"Nadia",marks:10,min:30,max:50},
  "p6-2":{part:6,title:"Joining a School Club",friend:"Harith",marks:10,min:30,max:50},
  "p7-1":{part:7,title:"Storybook Adventure Festival",friend:"Iman",marks:15,min:60,max:80},
  "p7-2":{part:7,title:"Community Culture Day",friend:"Rafiq",marks:15,min:60,max:80}
};
const state={code:"",pupil:null,summary:[],current:null,history:[],busy:false,filter:"all"};
function el(id){return document.getElementById(id)}
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]})}
function countWords(str){return (String(str||"").trim().match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)||[]).length}
function notice(id,message,bad){el(id).innerHTML='<div class="msg '+(bad?"bad":"ok")+'">'+esc(message)+'</div>'}
function clearNotice(id){el(id).innerHTML=""}
function safeGet(key){try{return localStorage.getItem(key)}catch(_){return null}}
function safeSet(key,value){try{localStorage.setItem(key,value)}catch(_){}}
function draftKey(){return "y5_exam_practice_"+state.code+"_"+state.current}
function currentDraft(){
  try{return JSON.parse(safeGet(draftKey())||"{}")||{}}
  catch(_){return {}}
}
function saveDraft(silent){
  if(!state.current)return;
  safeSet(draftKey(),JSON.stringify({to:el("emailTo").value,subject:el("emailSubject").value,body:el("answerBox").value}));
  if(!silent)notice("writeMessage","Draft saved on this device. Submitted attempts are saved online.",false);
}
function updateWordCount(){
  if(!state.current)return;
  const t=TASKS[state.current];
  const wc=countWords(el("answerBox").value);
  const item=el("wordCount");item.textContent=wc+" word"+(wc===1?"":"s");
  item.classList.toggle("outside",wc<t.min||wc>t.max);
}
async function api(action,data){
  const payload=Object.assign({action:action,pupilCode:state.code},data||{});
  const response=await fetch(CONFIG.endpoint,{method:"POST",
    headers:{"Content-Type":"application/json",apikey:CONFIG.publishableKey},
    body:JSON.stringify(payload)
  });
  const obj=await response.json().catch(function(){return {success:false,error:"The server did not send a valid response"}});
  if(!response.ok||!obj.success)throw new Error(obj.error||"Request failed");
  return obj;
}
function setBusy(flag,text){
  state.busy=flag;
  el("submitBtn").disabled=flag;
  el("loginBtn").disabled=flag;
  el("submitBtn").textContent=flag?(text||"Checking answer…"):"Submit for AI Marking";
  el("loginBtn").textContent=flag?"Loading…":"Start / Continue";
}
async function login(){
  if(state.busy)return;
  state.code=el("pupilCode").value.trim().toUpperCase();
  if(!state.code){notice("accessMsg","Enter your pupil code first.",true);return}
  setBusy(true,"Loading…");
  clearNotice("accessMsg");
  try{
    const response=await api("list");
    state.pupil=response.pupil;state.summary=response.attempts||[];
    safeSet("part6_drill_code",state.code);
    el("studentTag").textContent=state.pupil.name+" · "+(state.pupil.className||"");
    el("access").classList.add("hide");
    el("workspace").classList.remove("hide");
    el("switchBtn").classList.remove("hide");
    showList();
  }catch(error){
    notice("accessMsg",error.message,true);
  }finally{setBusy(false)}
}
function switchPupil(){
  if(state.current)saveDraft(true);
  state.code="";state.pupil=null;state.summary=[];state.history=[];state.current=null;
  el("access").classList.remove("hide");
  el("workspace").classList.add("hide");
  el("switchBtn").classList.add("hide");
  el("studentTag").textContent="";
  el("pupilCode").value="";
  el("pupilCode").focus();
}
function refreshTiles(){
  Object.keys(TASKS).forEach(function(id){
    const rows=state.summary.filter(function(item){return item.drill_id===id});
    const latest=rows[0],box=document.querySelector('[data-status="'+id+'"]');
    if(box)box.textContent=latest?("Latest: "+latest.total_score+"/"+TASKS[id].marks+" · "+rows.length+" attempt"+(rows.length===1?"":"s")+" →"):"Start practice →";
  });
}
function showList(){
  state.current=null;
  el("listPage").classList.remove("hide");
  el("writingPage").classList.add("hide");
  refreshTiles();
  selectFilter(state.filter);
  window.scrollTo({top:0,behavior:"smooth"});
}
function selectFilter(next){
  state.filter=next;
  document.querySelectorAll("[data-filter]").forEach(function(b){b.classList.toggle("active",b.dataset.filter===next)});
  document.querySelectorAll("[data-task]").forEach(function(card){
    card.classList.toggle("hide",next!=="all"&&card.dataset.part!==next);
  });
}
function openTask(id){
  const task=TASKS[id];if(!task)return;
  state.current=id;state.history=[];
  el("listPage").classList.add("hide");
  el("writingPage").classList.remove("hide");
  el("taskTitle").textContent=(task.part===6?"Part 6":"Part 7")+" · "+task.title;
  el("taskPart").textContent="Part "+task.part;
  el("taskMarks").textContent=task.marks+" marks";
  el("questionSlot").innerHTML=el("question-"+id).innerHTML;
  el("posterSlot").innerHTML=task.part===7?el("poster-"+id).innerHTML:"";
  el("rangeText").textContent="Target: about "+task.min+"–"+task.max+" words";
  el("emailTo").placeholder="e.g. "+task.friend;
  const draft=currentDraft();
  el("emailTo").value=draft.to||"";
  el("emailSubject").value=draft.subject||"";
  el("answerBox").value=draft.body||"";
  el("resultSlot").innerHTML="";
  clearNotice("writeMessage");
  updateWordCount();
  window.scrollTo({top:0,behavior:"smooth"});
}
function gradeParts(record){
  const s=record.scores||{},p=TASKS[record.drillId]||TASKS[state.current];
  if(!p)return "";
  const bits=p.part===6?
    ["Content & Communication: "+(s.cca||0)+"/5","Organisation & Language: "+(s.ol||0)+"/5"]:
    ["Content: "+(s.content||0)+"/5","Organisation: "+(s.organisation||0)+"/5","Language: "+(s.language||0)+"/5"];
  bits.push(record.wordCount+" words");
  return bits.map(function(x){return "<span>"+esc(x)+"</span>"}).join("");
}
function resultHtml(attempt){
  const a=attempt,t=TASKS[a.drillId]||TASKS[state.current];
  const checks=(a.contentChecks||[]).map(function(c){
    const status=["MET","PARTIAL","MISSING"].includes(c.status)?c.status:"PARTIAL";
    return '<div class="criteria '+status+'"><b>'+esc(c.criterion)+'</b><em>'+esc(status)+'</em><p>'+esc(c.evidence)+'</p></div>';
  }).join("");
  const fixes=(a.corrections||[]).map(function(c){
    return '<div class="criteria"><b>✎ '+esc(c.original)+'</b><p><b>Try:</b> '+esc(c.suggested)+'</p><p>'+esc(c.explanation)+'</p></div>';
  }).join("");
  const feedback=a.feedback||{};
  return '<div class="score"><strong>'+esc(a.totalScore)+'/'+t.marks+'</strong><div><b>AI practice mark · Attempt '+esc(a.attemptNo)+'</b><div class="chips">'+gradeParts(a)+'</div></div></div>'+
    '<h3>Task fulfilment</h3>'+checks+
    '<div class="feedbackGrid"><article><b>✓ What you did well</b><p>'+esc(feedback.strengths||"")+'</p></article>'+
    '<article><b>↗ What to improve</b><p>'+esc(feedback.improve||"")+'</p></article></div>'+
    (fixes?'<h3>Corrections to try</h3>'+fixes:"")+
    '<div class="msg"><b>Writing tip:</b> '+esc(feedback.tip||"")+'</div>'+
    '<p class="note">This is an AI-generated formative mark, not an official examination grade. Your teacher may review the response differently.</p>';
}
async function submit(){
  if(state.busy||!state.current)return;
  const t=TASKS[state.current],body=el("answerBox").value.trim();
  if(!body){notice("writeMessage","Write your email before submitting.",true);return}
  const count=countWords(body);
  if((count<t.min||count>t.max)&&!confirm("Your email has "+count+" words. The target is about "+t.min+"–"+t.max+" words. Submit anyway?"))return;
  saveDraft(true);
  setBusy(true,"AI marking…");
  notice("writeMessage","Checking your writing. Please keep this page open.",false);
  try{
    const response=await api("submit",{drillId:state.current,responseText:body,submissionId:crypto.randomUUID()});
    el("resultSlot").innerHTML=resultHtml(response.attempt);
    notice("writeMessage","Marked and saved online. You can improve this answer and submit again.",false);
    await refreshSummary();
    el("resultSlot").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){notice("writeMessage",error.message+". Your draft is still saved on this device.",true)}
  finally{setBusy(false)}
}
async function refreshSummary(){
  try{const response=await api("list");state.summary=response.attempts||[];refreshTiles()}catch(_){}
}
async function loadHistory(){
  if(!state.current||state.busy)return;
  el("resultSlot").innerHTML='<div class="msg">Loading your earlier attempts…</div>';
  try{
    const data=await api("history",{drillId:state.current});
    state.history=data.attempts||[];
    if(!state.history.length){el("resultSlot").innerHTML='<div class="msg">No submitted attempts yet. Your draft is saved on this device.</div>';return}
    el("resultSlot").innerHTML="<h3>Previous Attempts</h3>"+state.history.map(function(item,i){
      return '<div class="hist"><button class="btn outline" type="button" data-review="'+i+'">View mark</button><b>Attempt '+item.attemptNo+' · '+item.totalScore+'/'+TASKS[item.drillId].marks+'</b>'+
        '<div class="subtitle">'+esc(new Date(item.createdAt).toLocaleString())+'</div><p>'+esc(item.responseText)+'</p></div>';
    }).join("");
    document.querySelectorAll("[data-review]").forEach(function(button){
      button.addEventListener("click",function(){
        el("resultSlot").innerHTML='<div class="actions"><button type="button" class="btn ghost" id="returnHistory">← All attempts</button></div>'+
          resultHtml(state.history[Number(button.dataset.review)]);
        el("returnHistory").addEventListener("click",loadHistory);
      });
    });
  }catch(error){notice("resultSlot",error.message,true)}
}
el("loginBtn").addEventListener("click",login);
el("pupilCode").addEventListener("keydown",function(e){if(e.key==="Enter")login()});
el("switchBtn").addEventListener("click",switchPupil);
el("backBtn").addEventListener("click",function(){if(state.current)saveDraft(true);showList()});
el("submitBtn").addEventListener("click",submit);
el("saveBtn").addEventListener("click",function(){saveDraft(false)});
el("historyBtn").addEventListener("click",loadHistory);
el("answerBox").addEventListener("input",function(){saveDraft(true);updateWordCount()});
el("emailTo").addEventListener("input",function(){saveDraft(true)});
el("emailSubject").addEventListener("input",function(){saveDraft(true)});
document.querySelectorAll("[data-task]").forEach(function(button){button.addEventListener("click",function(){openTask(button.dataset.task)})});
document.querySelectorAll("[data-filter]").forEach(function(button){button.addEventListener("click",function(){selectFilter(button.dataset.filter)})});
const savedCode=safeGet("part6_drill_code");
if(savedCode){el("pupilCode").value=savedCode;login()}
