Deno.serve(async (req) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Jason's Workout Tracker</title>
<style>
:root{--black:#080808;--dark:#111;--card:#181818;--card2:#1e1e1e;--border:#252525;--border2:#303030;--white:#f0f0ee;--dim:#555;--dim2:#888;--accent:#e8ff47;--red:#ff4d4d;--blue:#4daaff;--green:#4dffaa;--orange:#ff9a4d;--purple:#c084fc;--gold:#ffd700}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{background:var(--black);color:var(--white);font-family:-apple-system,BlinkMacSystemFont,sans-serif;height:100%;overflow:hidden}
.app{display:flex;flex-direction:column;height:100dvh;max-width:480px;margin:0 auto}
.hdr{background:var(--black);padding:12px 16px 0;border-bottom:1px solid var(--border);flex-shrink:0}
.hdr-top{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:8px}
.brand-sub{font-size:9px;letter-spacing:3px;color:var(--accent);font-weight:700;text-transform:uppercase;margin-bottom:2px}
.brand-title{font-size:26px;font-weight:700;letter-spacing:1px;line-height:1}
.hdr-right{text-align:right}
.hdr-day{font-size:9px;color:var(--dim2);letter-spacing:2px;text-transform:uppercase}
.hdr-wtype{font-size:15px;font-weight:700;letter-spacing:1px}
.day-scroll{overflow-x:auto;scrollbar-width:none;display:flex;gap:5px;padding:8px 16px}
.day-pill{flex-shrink:0;display:flex;flex-direction:column;align-items:center;padding:7px 9px;border-radius:11px;border:1px solid var(--border);background:none;cursor:pointer;min-width:50px;gap:2px}
.day-pill.active{background:var(--card2);border-color:var(--border2)}
.day-pill.today{border-color:rgba(232,255,71,0.45)}
.dp-name{font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--dim2)}
.day-pill.active .dp-name,.day-pill.today .dp-name{color:var(--white)}
.dp-num{font-size:17px;color:var(--dim);line-height:1}
.day-pill.active .dp-num,.day-pill.today .dp-num{color:var(--white)}
.dp-type{font-size:7px;letter-spacing:1px;text-transform:uppercase;font-weight:700}
.c-push{color:var(--orange)}.c-pull{color:var(--blue)}.c-legs{color:var(--accent)}.c-upper{color:var(--purple)}.c-fort{color:var(--red)}.c-rest{color:var(--dim2)}
.b-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:var(--dark);border-top:1px solid var(--border);display:flex;z-index:100}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;padding:9px 0 13px;gap:3px;background:none;border:none;cursor:pointer;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;color:var(--dim2)}
.nav-btn.active{color:var(--accent)}
.nav-icon{font-size:17px}
.scroll-area{flex:1;overflow-y:auto;padding:13px;padding-bottom:90px;-webkit-overflow-scrolling:touch}
.w-header{margin-bottom:12px}
.w-title{font-size:25px;font-weight:700;letter-spacing:1px;margin-bottom:4px;display:flex;align-items:center;gap:8px}
.w-chips{display:flex;gap:5px;flex-wrap:wrap}
.wchip{font-size:9px;letter-spacing:1.2px;text-transform:uppercase;padding:3px 8px;border-radius:20px;font-weight:700}
.bg-push{background:rgba(255,154,77,0.12)}.bg-pull{background:rgba(77,170,255,0.12)}.bg-legs{background:rgba(232,255,71,0.1)}.bg-upper{background:rgba(192,132,252,0.12)}.bg-fort{background:rgba(255,77,77,0.12)}
.ex-card{background:var(--card);border:1px solid var(--border);border-radius:13px;margin-bottom:8px;overflow:hidden}
.ex-hdr{display:flex;align-items:center;padding:11px 13px;gap:10px;cursor:pointer}
.check-btn{width:27px;height:27px;border-radius:50%;border:2px solid var(--border2);background:none;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;font-size:12px;color:transparent}
.ex-card.done .check-btn{background:var(--accent);border-color:var(--accent);color:var(--black)}
.ex-card.done{opacity:0.52;border-color:var(--accent)}
.ex-info{flex:1;min-width:0}
.ex-name{font-weight:600;font-size:14px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ex-chips{display:flex;gap:4px;margin-top:4px;flex-wrap:wrap}
.chip{font-size:9px;padding:2px 6px;border-radius:9px;font-weight:700}
.chip-sets{background:var(--border2);color:var(--dim2)}
.chip-reps{background:rgba(232,255,71,0.1);color:var(--accent)}
.chip-hassan{background:rgba(192,132,252,0.12);color:var(--purple)}
.ex-arrow{color:var(--dim);font-size:11px;transition:transform 0.2s;flex-shrink:0}
.ex-detail{display:none;padding:0 13px 13px;border-top:1px solid var(--border)}
.ex-card.expanded .ex-detail{display:block}
.ex-card.expanded .ex-arrow{transform:rotate(90deg)}
.hassan-tag{display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--purple);background:rgba(192,132,252,0.12);padding:3px 8px;border-radius:9px;margin-top:9px}
.set-table{width:100%;border-collapse:collapse;margin-top:9px;font-size:12px}
.set-table th{text-align:left;color:var(--dim);font-weight:500;letter-spacing:1px;font-size:9px;text-transform:uppercase;padding:0 0 5px;border-bottom:1px solid var(--border)}
.set-table td{padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:middle}
.set-num{color:var(--dim);width:18px;font-weight:600;font-size:10px}
.set-reps{color:var(--accent);font-weight:700}
.w-input{background:var(--border);border:1px solid var(--border2);border-radius:6px;color:var(--white);padding:4px 7px;font-size:14px;font-weight:700;width:62px;text-align:center}
.w-input:focus{outline:none;border-color:var(--accent)}
.complete-btn{width:100%;margin-top:11px;padding:10px;border-radius:9px;border:none;background:var(--accent);color:var(--black);font-size:15px;font-weight:700;letter-spacing:1.5px;cursor:pointer}
.complete-btn.done-state{background:var(--border2);color:var(--dim2)}
.prog-row{display:flex;align-items:center;gap:8px;margin-top:9px}
.prog-label{font-size:10px;color:var(--dim2);width:56px;flex-shrink:0}
.mini-bar{flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden}
.mini-bar-fill{height:100%;border-radius:2px;transition:width 0.4s;width:0%}
.prog-pct{font-size:10px;font-weight:700;width:30px;text-align:right}
.rest-card{background:var(--card);border:1px solid var(--border);border-radius:15px;padding:26px 18px;text-align:center;margin:6px 0}
.rest-icon{font-size:40px;margin-bottom:10px}
.rest-title{font-size:22px;font-weight:700;letter-spacing:1px;margin-bottom:5px}
.rest-sub{font-size:12px;color:var(--dim2);line-height:1.5}
.rest-tips{margin-top:14px;display:flex;flex-direction:column;gap:7px}
.rest-tip{background:var(--card2);border:1px solid var(--border2);border-radius:9px;padding:9px 12px;font-size:11px;color:var(--dim2);text-align:left;display:flex;align-items:flex-start;gap:7px}
.rt-icon{font-size:14px;flex-shrink:0}
.empty-state{text-align:center;padding:40px 16px;color:var(--dim2);font-size:12px}
.notes-section{margin-top:14px}
.notes-label{font-size:9px;letter-spacing:2px;color:var(--dim2);text-transform:uppercase;font-weight:700;margin-bottom:5px}
.notes-input{width:100%;background:var(--card);border:1px solid var(--border2);border-radius:9px;color:var(--white);padding:9px 11px;font-size:12px;resize:none;min-height:56px}
.save-btn{width:100%;margin-top:9px;padding:12px;border-radius:11px;border:none;background:var(--accent);color:var(--black);font-size:17px;font-weight:700;letter-spacing:2px;cursor:pointer}
.toast{position:fixed;bottom:76px;left:50%;transform:translateX(-50%) translateY(16px);background:var(--green);color:var(--black);font-size:13px;font-weight:700;letter-spacing:2px;padding:9px 18px;border-radius:18px;z-index:300;opacity:0;transition:all 0.3s;pointer-events:none;white-space:nowrap}
.toast.visible{opacity:1;transform:translateX(-50%) translateY(0)}
.load-overlay{position:fixed;inset:0;background:var(--black);display:flex;align-items:center;justify-content:center;z-index:500;transition:opacity 0.5s}
.load-overlay.hidden{opacity:0;pointer-events:none}
.load-icon{font-size:30px}
</style>
</head>
<body>
<div class="load-overlay" id="loadOverlay"><div class="load-icon">🏋️</div></div>
<div class="toast" id="toast">✓ SAVED</div>
<div class="app">
  <div class="hdr">
    <div class="hdr-top">
      <div>
        <div class="brand-sub">Jason's System</div>
        <div class="brand-title">WORKOUT TRACKER</div>
      </div>
      <div class="hdr-right">
        <div class="hdr-day" id="hdrDay">—</div>
        <div class="hdr-wtype" id="hdrType">—</div>
      </div>
    </div>
    <div class="day-scroll" id="dayScroll"></div>
    <div class="prog-row">
      <span class="prog-label">Progress</span>
      <div class="mini-bar"><div class="mini-bar-fill" id="dayProg" style="width:0%"></div></div>
      <span class="prog-pct" id="dayPct">0%</span>
    </div>
  </div>
  <div class="scroll-area" id="mainScroll"></div>
</div>
<div class="b-nav">
  <button class="nav-btn active" id="navWorkout" onclick="switchView('workout')"><span class="nav-icon">🏋️</span>TODAY</button>
  <button class="nav-btn" id="navSummary" onclick="switchView('summary')"><span class="nav-icon">📊</span>SUMMARY</button>
  <button class="nav-btn" id="navHistory" onclick="switchView('history')"><span class="nav-icon">📅</span>HISTORY</button>
</div>
<script>
const WEEK=[{key:'mon',name:'Mon',type:'upper',label:'UPPER'},{key:'tue',name:'Tue',type:'fort',label:'FORT/LOWER'},{key:'wed',name:'Wed',type:'rest',label:'RECOVERY'},{key:'thu',name:'Thu',type:'push',label:'PUSH'},{key:'fri',name:'Fri',type:'pull',label:'PULL'},{key:'sat',name:'Sat',type:'rest',label:'RECOVERY'},{key:'sun',name:'Sun',type:'legs',label:'LEGS'}];
const WORKOUTS={upper:{title:'UPPER DAY',emoji:'💪',sections:[{label:'Chest',exercises:[{id:'u-fly',name:'Cable Low-to-High Fly',muscle:'chest',sets:[{wt:20,reps:'Warm'},{wt:30,reps:'FAIL'}],chips:{sets:'2 Sets',reps:'Pre-Exhaust'},hassan:true},{id:'u-chest',name:'Machine Chest Press',muscle:'chest',sets:[{wt:121,reps:8},{wt:143,reps:'FAIL'},{wt:121,reps:20,note:'Burnout'}],chips:{sets:'2 Sets',reps:'8-12'},hassan:true}]},{label:'Back',exercises:[{id:'u-lat',name:'Lat Pulldown (Wide Grip)',muscle:'back',sets:[{wt:121,reps:8},{wt:143,reps:'FAIL'},{wt:110,reps:20,note:'Burnout'}],chips:{sets:'2 Sets',reps:'8-12'},hassan:true},{id:'u-row',name:'Seated Cable Row',muscle:'back',sets:[{wt:132,reps:6},{wt:154,reps:'FAIL'}],chips:{sets:'2 Sets',reps:'10-12'},hassan:true}]},{label:'Shoulders + Arms',exercises:[{id:'u-shoulder',name:'Seated Shoulder Press',muscle:'shoulders',sets:[{wt:121,reps:6},{wt:143,reps:'FAIL'},{wt:121,reps:20,note:'Burnout'}],chips:{sets:'2 Sets',reps:'8-10'},hassan:true},{id:'u-lat-raise',name:'Cable Lateral Raise',muscle:'shoulders',sets:[{wt:15,reps:15},{wt:15,reps:15}],chips:{sets:'2 Sets',reps:'12-15'}},{id:'u-bicep',name:'Cable Bicep Curl',muscle:'biceps',sets:[{wt:40,reps:12},{wt:50,reps:'FAIL'}],chips:{sets:'2 Sets',reps:'12-15'},hassan:true},{id:'u-tricep',name:'Tricep Rope Pushdown',muscle:'triceps',sets:[{wt:55,reps:'FAIL'},{wt:55,reps:'FAIL'}],chips:{sets:'2 Sets',reps:'12-15'},hassan:true}]}]},push:{title:'PUSH DAY',emoji:'🔥',sections:[{label:'Pre-Exhaust',exercises:[{id:'p-fly',name:'Cable Low-to-High Fly',muscle:'chest',sets:[{wt:20,reps:'Warm'},{wt:30,reps:'FAIL'}],chips:{sets:'2 Sets',reps:'15-20'},hassan:true}]},{label:'Main Movement',exercises:[{id:'p-chest',name:'Machine Chest Press',muscle:'chest',sets:[{wt:132,reps:6},{wt:154,reps:'FAIL'},{wt:121,reps:20,note:'Burnout'}],chips:{sets:'2 Sets',reps:'8-12'},hassan:true},{id:'p-shoulder',name:'Seated Shoulder Press',muscle:'shoulders',sets:[{wt:121,reps:4},{wt:143,reps:'FAIL'},{wt:121,reps:20,note:'Burnout'}],chips:{sets:'2 Sets',reps:'8-10'},hassan:true}]},{label:'Isolation',exercises:[{id:'p-lat-raise',name:'Cable Lateral Raise',muscle:'shoulders',sets:[{wt:35,reps:15},{wt:35,reps:15}],chips:{sets:'2 Sets',reps:'12-15'}},{id:'p-tricep',name:'Tricep Rope Pushdown',muscle:'triceps',sets:[{wt:130,reps:'FAIL'},{wt:130,reps:'FAIL'}],chips:{sets:'2 Sets',reps:'12-15'},hassan:true}]},{label:'Ab Finisher',exercises:[{id:'p-bicycle',name:'Bicycle Crunch',muscle:'core',sets:[{wt:0,reps:'12/side'},{wt:0,reps:'12/side'}],chips:{sets:'2 Sets',reps:'12/side'}}]}]},pull:{title:'PULL DAY',emoji:'💙',sections:[{label:'Pre-Exhaust',exercises:[{id:'pull-sa',name:'Straight-Arm Cable Pulldown',muscle:'back',sets:[{wt:100,reps:17},{wt:100,reps:20}],chips:{sets:'2 Sets',reps:'15-20'}}]},{label:'Main Movement',exercises:[{id:'pull-lat',name:'Lat Pulldown (Wide Grip)',muscle:'back',sets:[{wt:121,reps:6},{wt:154,reps:'FAIL'},{wt:110,reps:20,note:'Burnout'}],chips:{sets:'2 Sets',reps:'8-12'},hassan:true},{id:'pull-row',name:'Floor Cable Row',muscle:'back',sets:[{wt:200,reps:15},{wt:200,reps:15}],chips:{sets:'2 Sets',reps:'10-15'}}]},{label:'Isolation',exercises:[{id:'pull-face',name:'Rope Face Pull',muscle:'back_fly',sets:[{wt:100,reps:20},{wt:100,reps:20}],chips:{sets:'2 Sets',reps:'15-20'}},{id:'pull-curl',name:'Bayesian Cable Curl (Single Arm)',muscle:'biceps',sets:[{wt:50,reps:12},{wt:60,reps:12},{wt:60,reps:'FAIL'}],chips:{sets:'3 Sets',reps:'12/arm'}}]}]},legs:{title:'LEG DAY',emoji:'🦵',sections:[{label:'Pre-Exhaust',exercises:[{id:'l-curl',name:'Lying Leg Curl',muscle:'hams',sets:[{wt:110,reps:15},{wt:132,reps:'FAIL'}],chips:{sets:'2 Sets',reps:'To Failure'},hassan:true},{id:'l-ext',name:'Leg Extension',muscle:'quads',sets:[{wt:99,reps:15},{wt:121,reps:'FAIL'}],chips:{sets:'2 Sets',reps:'To Failure'},hassan:true}]},{label:'Main Compound',exercises:[{id:'l-squat',name:'Smith Machine Squat',muscle:'quads',sets:[{wt:135,reps:10},{wt:155,reps:'8-10'}],chips:{sets:'2 Sets',reps:'8-12'}},{id:'l-rdl',name:'Smith Machine RDL',muscle:'hams',sets:[{wt:245,reps:10},{wt:275,reps:'10-12'}],chips:{sets:'2 Sets',reps:'10-12'}}]},{label:'Glutes + Calves',exercises:[{id:'l-abduct',name:'Hip Abduction Machine',muscle:'glutes',sets:[{wt:55,reps:'15-20'},{wt:55,reps:'15-20'}],chips:{sets:'2 Sets',reps:'15-20'}},{id:'l-calf',name:'Smith Machine Calf Raise',muscle:'calves',sets:[{wt:225,reps:'15-20'},{wt:225,reps:'15-20'},{wt:225,reps:'15-20'}],chips:{sets:'3 Sets',reps:'15-20'}}]}]},fort:{title:'FORT/LOWER DAY',emoji:'🏙️',sections:[{label:'If Lower Day',exercises:[{id:'f-ext',name:'Leg Extension',muscle:'quads',sets:[{wt:99,reps:15},{wt:121,reps:'FAIL'}],chips:{sets:'2 Sets',reps:'To Failure'},hassan:true},{id:'f-squat',name:'Smith Machine Squat',muscle:'quads',sets:[{wt:145,reps:8},{wt:165,reps:'8-10'}],chips:{sets:'2 Sets',reps:'8-12'}},{id:'f-curl',name:'Lying Leg Curl',muscle:'hams',sets:[{wt:121,reps:15},{wt:143,reps:'FAIL'}],chips:{sets:'2 Sets',reps:'To Failure'},hassan:true},{id:'f-abduct',name:'Hip Abduction Machine',muscle:'glutes',sets:[{wt:55,reps:'15-20'},{wt:66,reps:'15-20'}],chips:{sets:'2 Sets',reps:'15-20'}}]}]}};
const REST_CONTENT={wed:{title:'ACTIVE RECOVERY',icon:'🧘',sub:'No weights. Recover. Grow.',tips:[{icon:'🚶',text:'Fasted incline walk: 6% grade, 3.0 mph, 30-45 min'},{icon:'🏃',text:'Optional sprints: 4 × 30 sec'},{icon:'🧘',text:'Hip mobility + thoracic spine work: 15-20 min'},{icon:'💧',text:'Extra hydration + electrolytes'},{icon:'😴',text:'Magnesium before bed. 7-8 hour sleep target'}]},sat:{title:'ACTIVE RECOVERY',icon:'🌤️',sub:'Recharge. Legs are tomorrow.',tips:[{icon:'♨️',text:'Steam room / sauna: 20-30 min'},{icon:'🚶',text:'Optional light walk or swimming'},{icon:'🥗',text:'Hit 175-190g protein target'}]}};
let currentDayIdx=0,currentView='workout',sessionState={},historyStore=[],prStore={};
const st={get:k=>localStorage.getItem(k),set:(k,v)=>localStorage.setItem(k,v)};
async function init(){const d=new Date().getDay(),m=[6,0,1,2,3,4,5];currentDayIdx=m[d];try{historyStore=JSON.parse(st.get('workout-history')||'[]')}catch(e){historyStore=[]}try{prStore=JSON.parse(st.get('pr-store')||'{}')}catch(e){prStore={}}try{const tk='session-'+new Date().toISOString().split('T')[0];sessionState=JSON.parse(st.get(tk)||'{}')}catch(e){sessionState={}}buildUI();setTimeout(()=>document.getElementById('loadOverlay').classList.add('hidden'),400)}
function buildUI(){buildDayPills();updateHeader();renderCurrentView()}
function getDayDate(i){const d=new Date(),t=[6,0,1,2,3,4,5][d.getDay()];d.setDate(d.getDate()+i-t);return d.toISOString().split('T')[0]}
function buildDayPills(){const w=document.getElementById('dayScroll'),t=[6,0,1,2,3,4,5][new Date().getDay()];w.innerHTML='';WEEK.forEach((d,i)=>{const b=document.createElement('button');b.className='day-pill'+(i===currentDayIdx?' active':'')+(i===t?' today':'');b.innerHTML=\`<span class="dp-name c-\${d.type}">\${d.name}</span><span class="dp-num">\${new Date().getDate()+i-t}</span><span class="dp-type c-\${d.type}">\${d.label.split('/')[0]}</span>\`;b.onclick=()=>{currentDayIdx=i;buildDayPills();if(currentView==='workout')renderWorkoutView()};w.appendChild(b)})}
function updateHeader(){const d=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];document.getElementById('hdrDay').textContent=d[new Date().getDay()];document.getElementById('hdrType').textContent=WEEK[currentDayIdx].label}
function switchView(v){currentView=v;['navWorkout','navSummary','navHistory'].forEach(id=>document.getElementById(id).classList.remove('active'));document.getElementById({workout:'navWorkout',summary:'navSummary',history:'navHistory'}[v]).classList.add('active');renderCurrentView()}
function renderCurrentView(){if(currentView==='workout')renderWorkoutView();else if(currentView==='summary')renderSummaryView();else renderHistoryView()}
function renderWorkoutView(){const d=WEEK[currentDayIdx],s=document.getElementById('mainScroll');if(d.type==='rest'){renderRestDay(d.key);return}const w=WORKOUTS[d.type];if(!w){s.innerHTML='<div class="empty-state">No workout</div>';return}
let h=\`<div class="w-header"><div class="w-title"><span>\${w.emoji}</span>\${w.title}</div></div><div class="prog-row"><span class="prog-label">Progress</span><div class="mini-bar"><div class="mini-bar-fill" id="dayProg" style="width:0%"></div></div><span class="prog-pct" id="dayPct">0%</span></div>\`;let done=0,total=0;w.sections.forEach(sect=>{h+=\`<div class="sec-label" style="font-size:11px;letter-spacing:3px;color:var(--dim);margin:16px 0 7px">\${sect.label}</div>\`;sect.exercises.forEach(ex=>{total++;const st=sessionState[ex.id]||{},doneSt=st.done||false;if(doneSt)done++;const exp=st.expanded||false;h+=\`<div class="ex-card \${doneSt?'done':''} \${exp?'expanded':''}" id="card-\${ex.id}"><div class="ex-hdr" onclick="toggleDetail('\${ex.id}')"><button class="check-btn" onclick="event.stopPropagation();toggleDone('\${ex.id}')">\${doneSt?'✓':''}</button><div class="ex-info"><div class="ex-name">\${ex.name}</div><div class="ex-chips">\${ex.chips.sets?`<span class="chip chip-sets">\${ex.chips.sets}</span>`:''}\${ex.chips.reps?`<span class="chip chip-reps">\${ex.chips.reps}</span>`:''}\${ex.hassan?'<span class="chip chip-hassan">HASSAN</span>':''}</div></div><span class="ex-arrow">▶</span></div><div class="ex-detail">\${ex.hassan?'<div class="hassan-tag">🔥 HASSAN PROTOCOL</div>':''}<table class="set-table"><tr><th>Set</th><th>Weight</th><th>Reps</th></tr>\${ex.sets.map((ss,i)=>`<tr><td><span class="set-num">\${i+1}</span></td><td><input class="w-input" id="wt_\${ex.id}_\${i}" value="\${st['wt_'+i]??ss.wt}" oninput="saveSet('\${ex.id}',\${i},'wt',this.value)"></td><td><input class="w-input" id="reps_\${ex.id}_\${i}" value="\${st['reps_'+i]??ss.reps}" oninput="saveSet('\${ex.id}',\${i},'reps',this.value)"></td></tr>`).join('')}</table><button class="complete-btn \${doneSt?'done-state':''}" onclick="toggleDone('\${ex.id}')">\${doneSt?'✓ COMPLETED':'MARK COMPLETE'}</button></div></div>\`})});h+='<div class="notes-section"><div class="notes-label">Session Notes</div><textarea class="notes-input" id="sessionNotes" placeholder="How did it feel?" oninput="saveNotes()">'+(sessionState.__notes__||'')+'</textarea><button class="save-btn" onclick="saveWorkout()">💾 SAVE WORKOUT</button></div>';s.innerHTML=h;const pct=total>0?Math.round((done/total)*100):0;document.getElementById('dayProg').style.width=pct+'%';document.getElementById('dayPct').textContent=pct+'%'}
function toggleDetail(id){const c=document.getElementById('card-'+id),exp=c.classList.contains('expanded');document.querySelectorAll('.ex-card.expanded').forEach(x=>x.classList.remove('expanded'));if(!exp){c.classList.add('expanded');(sessionState[id]||{}).expanded=true}else{(sessionState[id]||{}).expanded=false}saveSessionState()}
function toggleDone(id){const c=document.getElementById('card-'+id),done=c.classList.contains('done');if(done){c.classList.remove('done');(sessionState[id]||{}).done=false}else{c.classList.add('done');(sessionState[id]||{}).done=true}renderWorkoutView()}
function saveSet(id,si,f,v){if(!sessionState[id])sessionState[id]={};sessionState[id][f+'_'+si]=v;saveSessionState()}
function saveNotes(){sessionState.__notes__=document.getElementById('sessionNotes').value;saveSessionState()}
function saveSessionState(){const tk='session-'+new Date().toISOString().split('T')[0];st.set(tk,JSON.stringify(sessionState))}
async function saveWorkout(){const d=WEEK[currentDayIdx],dateStr=getDayDate(currentDayIdx),w=WORKOUTS[d.type],exercises=[],newPRs=[];w.sections.forEach(s=>{s.exercises.forEach(ex=>{const st=sessionState[ex.id]||{},sets=ex.sets.map((ss,i)=>({weight:st['wt_'+i]??ss.wt,reps:st['reps_'+i]??ss.reps}));exercises.push({id:ex.id,name:ex.name,sets,done:st.done||false});if(st.done){const maxWt=Math.max(...sets.map(s=>parseFloat(s.weight)||0));if(maxWt>0&&(!prStore[ex.id]||maxWt>prStore[ex.id].weight)){newPRs.push({id:ex.id,name:ex.name,weight:maxWt})}}})});const entry={date:dateStr,type:d.type,title:w.title,exercises,notes:sessionState.__notes__||'',newPRs};const ei=historyStore.findIndex(h=>h.date===dateStr);if(ei>=0)historyStore[ei]=entry;else historyStore.unshift(entry);newPRs.forEach(pr=>{prStore[pr.id]={weight:pr.weight,date:dateStr}});st.set('workout-history',JSON.stringify(historyStore));st.set('pr-store',JSON.stringify(prStore));sessionState={};saveSessionState();showToast(newPRs.length>0?'🏆 NEW PR!':'✓ SAVED');buildDayPills()}
function showToast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('visible');setTimeout(()=>t.classList.remove('visible'),2500)}
function renderRestDay(k){const c=REST_CONTENT[k];if(!c){document.getElementById('mainScroll').innerHTML='<div class="empty-state">Rest day!</div>';return}document.getElementById('mainScroll').innerHTML=\`<div class="rest-card"><div class="rest-icon">\${c.icon}</div><div class="rest-title">\${c.title}</div><div class="rest-sub">\${c.sub}</div><div class="rest-tips">\${c.tips.map(t=>\`<div class="rest-tip"><span class="rt-icon">\${t.icon}</span><span>\${t.text}</span></div>\`).join('')}</div></div>\`}
function renderSummaryView(){const s=document.getElementById('mainScroll');if(historyStore.length===0){s.innerHTML='<div class="empty-state">No workouts logged yet</div>';return}const latest=historyStore[0];let h=\`<div class="summary-section"><div class="w-header"><div class="w-title">\${latest.title}</div></div><div class="notes-label" style="margin-bottom:8px">\${latest.date}</div>\`;latest.exercises.forEach(ex=>{h+=\`<div class="ex-card"><div class="ex-name">\${ex.name}</div><div class="ex-chips">\${ex.sets.map(s=>\`<span class="chip chip-sets">\${s.weight}×\${s.reps}</span>\`).join('')}</div></div>\`});if(latest.notes)h+=\`<div class="notes-section"><div class="notes-label">Notes</div>\${latest.notes}</div>\`;s.innerHTML=h+'</div>'}
function renderHistoryView(){const s=document.getElementById('mainScroll');if(historyStore.length===0){s.innerHTML='<div class="empty-state">No history</div>';return}let h='<div class="summary-section">';historyStore.forEach(e=>{h+=\`<div class="ex-card"><div class="ex-name">\${e.title}</div><div class="ex-chips"><span class="chip chip-sets">\${e.date}</span></div></div>\`});s.innerHTML=h+'</div>'}
init();
</script>
</body>
</html>`;
  return new Response(html, {headers:{'Content-Type':'text/html; charset=utf-8'}});
}
