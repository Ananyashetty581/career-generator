// ---------- Settings ----------
// PUT YOUR GEMINI KEY BETWEEN THE QUOTES BELOW (example: var API_KEY = "AIza...";)
var API_KEY = "";
// Models are tried in this order. If one is busy or renamed, the next one is used.
var GEMINI_MODELS = ["gemini-3.5-flash-lite","gemini-3.5-flash","gemini-2.5-flash","gemini-2.5-flash-lite","gemini-3.6-flash"];
var SECTIONS = [
 {id:"summary",title:"Professional Summary",ask:"Write a 4 to 5 line professional summary for a resume and LinkedIn. First person, confident, no cliches."},
 {id:"gap",title:"Skill-Gap Report",ask:"Write a skill-gap report: (1) skills the student has that fit the role, (2) missing skills each marked High, Medium or Low priority, (3) a one-line readiness verdict."},
 {id:"learning",title:"Learning Plan",ask:"Give 5 specific learning recommendations (free courses, projects or books) and a simple 4-week plan covering High priority gaps first."},
 {id:"interview",title:"Interview Prep",ask:"Give 8 likely interview questions for the target role (technical and HR), each with a short sample answer using the student's background."}
];
var RULES = "Plain text only, no markdown symbols like ** or #. Use headings in CAPS and lines starting with '-'. Stay strictly consistent with the master profile: same target role, same skills, same tone.";
var $ = function(id){return document.getElementById(id)};
var claudeSample = null, claudeDownloads = null, charts = {}, lastModel = null;
var ICONS = {summary:"📝",gap:"🔍",learning:"📚",interview:"🎤"};

if (API_KEY) { $("keybox").classList.add("hide"); }

// If this page runs inside Claude, use it and hide the key box.
if (window.claude && claude.use) {
  claude.use("sample").then(function(s){ if(s){claudeSample=s; $("keybox").classList.add("hide");} }).catch(function(){});
  claude.use("downloads").then(function(d){ claudeDownloads=d; }).catch(function(){});
}

// ---------- One function talks to the AI ----------
var currentPrompt = "";
function ask(prompt){
  currentPrompt = prompt;
  if (claudeSample) return claudeSample(prompt).then(function(r){return r.text||"";});
  var key = API_KEY || $("key").value.trim();
  if (!key) return Promise.reject(new Error("Please paste your Gemini API key."));
  return callGemini(key,0,0);
}

// Tries each model in turn. Busy (503/429) or unknown model (404) -> next model; after all models, waits and tries the list again (up to 3 rounds).
function callGemini(key,mi,round){
  var url="https://generativelanguage.googleapis.com/v1beta/models/"+GEMINI_MODELS[mi]+":generateContent?key="+encodeURIComponent(key);
  var ctl=new AbortController(), timer=setTimeout(function(){ctl.abort();},45000);
  function next(err){
    if(mi+1<GEMINI_MODELS.length){return callGemini(key,mi+1,round);}
    if(round<2){
      $("status").textContent="Google is busy, retrying in 8 seconds...";
      return new Promise(function(res){setTimeout(res,8000);}).then(function(){return callGemini(key,0,round+1);});
    }
    throw err;
  }
  return fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},signal:ctl.signal,
    body:JSON.stringify({contents:[{parts:[{text:currentPrompt}]}]})})
   .then(function(r){return r.json();})
   .then(function(d){
     clearTimeout(timer);
     if(d.error){
       var c=d.error.code;
       if(c===429||c===503||c===404){return next(new Error(d.error.message));}
       throw new Error(d.error.message);
     }
     if(!d.candidates||!d.candidates[0].content){return next(new Error("Gemini returned an empty answer. Try again."));}
     return d.candidates[0].content.parts.map(function(p){return p.text||"";}).join("");
   },function(e){
     clearTimeout(timer);
     if(e.name==="AbortError"){return next(new Error("Request timed out. Check your internet and try again."));}
     throw e;
   });
}

function parseJSON(t){
  var a=t.indexOf("{"), b=t.lastIndexOf("}");
  return JSON.parse(t.slice(a,b+1));
}

// ---------- Charts ----------
function draw(id,cfg){
  if(charts[id]) charts[id].destroy();
  charts[id]=new Chart($(id),cfg);
}
function renderCharts(m){
  var blue="#1d4ed8", light="rgba(59,130,246,.25)", grey="#94a3b8";
  var names=m.skills.map(function(s){return s.name});
  $("kRole").textContent=m.role; $("kScore").textContent=m.readiness+"%"; $("kGaps").textContent=m.gaps.length;
  draw("cRadar",{type:"radar",data:{labels:names,datasets:[
    {label:"Current",data:m.skills.map(function(s){return s.current}),borderColor:blue,backgroundColor:light},
    {label:"Required",data:m.skills.map(function(s){return s.required}),borderColor:grey,backgroundColor:"rgba(148,163,184,.15)"}]},
    options:{scales:{r:{min:0,max:100}}}});
  draw("cDonut",{type:"doughnut",data:{labels:["Ready","Gap"],datasets:[{data:[m.readiness,100-m.readiness],backgroundColor:[blue,"#dbeafe"]}]},
    options:{cutout:"65%"}});
  draw("cBar",{type:"bar",data:{labels:names,datasets:[{label:"Gap (required - current)",
    data:m.skills.map(function(s){return Math.max(0,s.required-s.current)}),backgroundColor:"#3b82f6"}]},
    options:{indexAxis:"y",scales:{x:{min:0,max:100}}}});
  draw("cLine",{type:"line",data:{labels:m.weekly_hours.map(function(w){return w.week}),
    datasets:[{label:"Hours",data:m.weekly_hours.map(function(w){return w.hours}),borderColor:blue,backgroundColor:light,fill:true,tension:.3}]},
    options:{scales:{y:{beginAtZero:true}}}});
}

// ---------- Tabs ----------
function buildTabs(){
  $("tabs").textContent=""; $("panels").textContent="";
  SECTIONS.forEach(function(s,i){
    var b=document.createElement("button"); b.className="tab"+(i?"":" on"); b.textContent=ICONS[s.id]+" "+s.title; b.dataset.id=s.id;
    b.onclick=function(){
      document.querySelectorAll(".tab").forEach(function(t){t.classList.toggle("on",t===b)});
      SECTIONS.forEach(function(x){$("p-"+x.id).classList.toggle("hide",x.id!==s.id)});
    };
    $("tabs").appendChild(b);
    var p=document.createElement("div"); p.id="p-"+s.id; p.className="out"+(i?" hide":""); p.textContent="Generating...";
    $("panels").appendChild(p);
  });
}

// ---------- Main flow ----------
$("go").onclick=function(){
  var name=$("name").value.trim()||"Student", skills=$("skills").value.trim(),
      interests=$("interests").value.trim()||"not given", goal=$("goal").value.trim();
  if(!skills||!goal){$("status").textContent="Please enter at least your skills and career goal.";return;}
  var btn=$("go"); btn.disabled=true; $("status").className="note";
  $("status").textContent="Step 1/2: building master profile and charts...";

  var p1="Create a master profile for a student. Reply with ONLY valid JSON, no extra text, in this shape: "+
   '{"role":"","strengths":[""],"missing":[""],"tone":"","readiness":0,"skills":[{"name":"","current":0,"required":0}],'+
   '"gaps":[{"skill":"","priority":"High|Medium|Low"}],"weekly_hours":[{"week":"Week 1","hours":0}]}. '+
   "Rules: exactly 6 skills with values 0-100 relevant to the goal; readiness 0-100; exactly 4 weekly_hours entries (Week 1-4).\n"+
   "Name: "+name+"\nSkills: "+skills+"\nInterests: "+interests+"\nGoal: "+goal;

  ask(p1).then(function(t){
    var m=parseJSON(t);
    $("results").classList.remove("hide"); buildTabs(); renderCharts(m); lastModel=m;
    $("status").textContent="Step 2/2: writing the four sections...";
    var base="Master profile (use exactly, stay consistent):\n"+JSON.stringify(m)+"\nStudent name: "+name+"\n"+RULES+"\n\nTask: ";
    var chain=Promise.resolve();
    SECTIONS.forEach(function(s,i){
      chain=chain.then(function(){
        $("status").textContent="Step 2/2: writing section "+(i+1)+" of 4 ("+s.title+")...";
        return ask(base+s.ask).then(function(x){$("p-"+s.id).textContent=x.trim();})
          .catch(function(e){$("p-"+s.id).textContent="Could not generate this section: "+(e.message||"unknown error");});
      });
    });
    return chain;
  }).then(function(){ $("status").textContent="Done. Use the tabs below the charts."; })
  .catch(function(e){ $("status").className="note err"; $("status").textContent=e.message||"Something went wrong. Please try again."; })
  .then(function(){btn.disabled=false;});
};

// ---------- Download report (.html, open in browser, print to PDF if needed) ----------
function esc(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
$("dl").onclick=function(){
  if(!lastModel){return;}
  var name=$("name").value.trim()||"Student";
  var h='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Career Report - '+esc(name)+'</title>'+
   '<style>body{font-family:Arial,sans-serif;max-width:820px;margin:auto;padding:24px;color:#13203a;line-height:1.6}'+
   'h1{color:#1d4ed8}h2{color:#1d4ed8;border-bottom:2px solid #cfe0fb;padding-bottom:4px;margin-top:28px}'+
   'pre{white-space:pre-wrap;font-family:inherit}.row{display:flex;flex-wrap:wrap;gap:8px}.row img{width:48%;border:1px solid #cfe0fb;border-radius:8px}'+
   '.k{background:#eff6ff;border:1px solid #cfe0fb;border-radius:8px;padding:8px 14px;display:inline-block;margin-right:8px}</style></head><body>'+
   '<h1>Career Report: '+esc(name)+'</h1>'+
   '<p><span class="k">Target role: <b>'+esc(lastModel.role)+'</b></span><span class="k">Readiness: <b>'+esc(lastModel.readiness)+'%</b></span></p>'+
   '<h2>Analysis charts</h2><div class="row">';
  ["cRadar","cDonut","cBar","cLine"].forEach(function(id){h+='<img src="'+$(id).toDataURL("image/png")+'" alt="">';});
  h+='</div>';
  SECTIONS.forEach(function(s){h+='<h2>'+esc(s.title)+'</h2><pre>'+esc($("p-"+s.id).textContent)+'</pre>';});
  h+='</body></html>';
  var file="career-report-"+name.replace(/\s+/g,"-").toLowerCase()+".html";
  var blob=new Blob([h],{type:"text/html"});
  if(claudeDownloads){ claudeDownloads.save({filename:file,data:blob}).catch(function(){}); return; }
  var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=file;
  document.body.appendChild(a); a.click(); a.remove();
};

// ---------- Remember the API key in this browser only (localStorage) ----------
try{
  var saved=localStorage.getItem("gemini_key");
  if(saved){$("key").value=saved;}
}catch(e){}
$("go").addEventListener("click",function(){
  try{
    if($("rem").checked&&$("key").value.trim()){localStorage.setItem("gemini_key",$("key").value.trim());}
    else if(!$("rem").checked){localStorage.removeItem("gemini_key");}
  }catch(e){}
});
