/* Workforce & Operational Intelligence Platform - prototype. All KPIs computed in-browser from data/data.js
   (same processed CSV data + KPI definitions as the Power BI package). */
(() => {
const D = window.DEMO_DATA, $ = s => document.querySelector(s);
const C = {teal:'#1CABB0',dark:'#004E7A',navy:'#00357A',cyan:'#0097B2',amber:'#FFBD59',grey:'#9AA7B2'};
const PC = [C.navy, C.teal, C.amber, C.cyan], SC = [C.navy, C.teal, C.amber];
const PN = D.plants.map(p => p.plant_name), LN = D.lines.map(l => l.line_id.replace('PLT-',''));
const STAT = ['Open','In Progress','Under Review','Completed'], PRI = ['High','Medium','Low'], DEPT = ['Production','Quality','Maintenance','HR & Workforce'];
const SIM = '<span class="src sim">Simulated</span>', UP = '<span class="src up">Uploaded</span>', MDL = '<span class="src mdl">Model</span>';
const st = {page:(location.hash||'#exec').slice(1), plants:[0,1,2,3], shifts:[0,1,2], cmp:'plant', focus:null, view:'a', from:D.date_min, to:D.date_max, q:'', zoom:{}, sort:{}, as:'All', all:false};
const PAGES = {
  exec:['Executive Dashboard','COO & senior management: one connected view across plants'],
  hr:['HR & Workforce','HR & workforce management: aggregate team and shift patterns'],
  prod:['Production','Production managers: output, productivity and losses'],
  qual:['Quality','Quality managers: defects, rework and first-pass yield'],
  maint:['Maintenance','Maintenance managers: machine condition and failure risk'],
  actions:['Action & Investigation Tracker','Each function records its own actions, owners and outcomes'],
  sources:['Data Sources & Quality','What is connected, what is simulated, and what is missing']};
if(!PAGES[st.page]) st.page='exec';
// ---------- one time concept: the selected period. Everything (KPIs, charts, issues) is computed for it
// and compared with the previous period of the same length (when the data goes back that far).
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const mIdx = d => +d.slice(0,4)*12 + (+d.slice(5,7)-1), mStr = i => Math.floor(i/12)+'-'+String(i%12+1).padStart(2,'0');
const mlab = ym => MON[+ym.slice(5,7)-1]+' '+ym.slice(0,4);
const perLab = (a,b) => { const x=a.slice(0,7), y=b.slice(0,7); return x===y ? mlab(x) : x.slice(0,4)===y.slice(0,4) ? MON[+x.slice(5,7)-1]+'–'+MON[+y.slice(5,7)-1]+' '+y.slice(0,4) : mlab(x)+'–'+mlab(y); };
const span = () => mIdx(st.to)-mIdx(st.from)+1, inR = (d,a,b) => d>=a && d<=b;
function prevRange(){ const n=span(), a=mIdx(st.from), lo=mIdx(D.date_min); let pa=a-n; const pb=a-1; if(pa<lo) pa=lo; if(pb<lo) return null;
  const len=pb-pa+1; if(len<Math.min(2,n)) return null; return {from:mStr(pa)+'-01', to:mStr(pb)+'-31', months:len, n}; }
const defRange = () => [mStr(Math.max(mIdx(D.date_max)-5, mIdx(D.date_min)))+'-01', D.date_max];
const presetRange = p => { if(p==='all') return [D.date_min,D.date_max]; const i=Math.max(mIdx(D.date_max)-(+p-1), mIdx(D.date_min)); return [mStr(i)+'-01', D.date_max]; };
[st.from,st.to]=defRange();

// ---------- formatting & helpers
const n0 = v => isFinite(v) ? Math.round(v).toLocaleString('en-US') : '–', nd = (v,d=1) => isFinite(v) ? v.toFixed(d) : '–', pc = v => isFinite(v) ? v.toFixed(1)+'%' : '–';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const grp = (rows,f) => { const m = new Map(); rows.forEach(r => { const k = f(r); (m.get(k) || m.set(k,[]).get(k)).push(r); }); return m; };
const okP = p => st.plants.includes(p), okS = s => st.shifts.includes(s), okD = d => d>=st.from && d<=st.to;
const okM = m => m>=st.from.slice(0,7) && m<=st.to.slice(0,7);
// L: date,plant,line,shift,target,output,good,hrs,dt,run,insp,fp,def,rework,scrap | W: date,plant,shift,hc,absent,sched,ot | M: date,plant,line,type,air,proc,rpm,torque,wear,fail,twf..rnf
const Lr = (allPlants) => D.line_rows.filter(r => okD(r[0]) && (allPlants||okP(r[1])) && okS(r[3]));
const Wr = (allPlants) => D.wf_rows.filter(r => okD(r[0]) && (allPlants||okP(r[1])) && okS(r[2]));
const Mr = (allPlants) => D.mt_rows.filter(r => okD(r[0]) && (allPlants||okP(r[1])));
const Lx = (a,b) => D.line_rows.filter(r => inR(r[0],a,b) && okS(r[3])), Wx = (a,b) => D.wf_rows.filter(r => inR(r[0],a,b) && okS(r[2]));
const aggL = rs => { const a = {target:0,output:0,good:0,hrs:0,dt:0,run:0,insp:0,fp:0,def:0,rework:0,scrap:0}; const k = Object.keys(a);
  rs.forEach(r => k.forEach((n,i) => a[n] += r[i+4])); return a; };
const aggW = rs => { const a = {hc:0,absent:0,sched:0,ot:0}, d = new Set(); rs.forEach(r => { a.hc+=r[3]; a.absent+=r[4]; a.sched+=r[5]; a.ot+=r[6]; d.add(r[0]); }); a.days = d.size; return a; };
// KPI definitions (see documentation/KPI_definitions.md)
const K = {prod:a=>a.good/a.hrs, ach:a=>a.output/a.target*100, fpy:a=>a.fp/a.insp*100, dfr:a=>a.def/a.insp*100, rwr:a=>a.rework/a.insp*100, dtp:a=>a.dt/a.run*100,
           abs:a=>a.absent/a.sched*100, ot100:a=>a.ot/a.hc*100, fail:rs=>rs.length ? rs.reduce((s,r)=>s+r[9],0)/rs.length*100 : NaN};
const mon = r => r[0].slice(0,7);
function series(rows, agg, kf, pi=1){ const months=[...new Set(rows.map(mon))].sort(), ps=[...new Set(rows.map(r=>r[pi]))].sort();
  return {labels:months, datasets:ps.map(p => ({label:PN[p], borderColor:PC[p], backgroundColor:PC[p], tension:.25, pointRadius:2,
    data:months.map(m => { const rs=rows.filter(r=>r[pi]===p && mon(r)===m); return rs.length ? kf(agg(rs)) : null; })}))}; }
// ---------- danger levels (absence/overtime from insight rules; others = 15% worse than the median of the four plants)
const peerThr = (f,hib) => { const rs=Lr(true), v=D.plants.map((_,i)=>f(aggL(rs.filter(r=>r[1]===i)))).filter(isFinite); return v.length ? med(v)*(hib?0.85:1.15) : NaN; };
const thrDs = (labels,label,val,axis,dash=[6,4]) => ({type:'line',label,data:labels.map(()=>val),borderColor:'#B42318',borderDash:dash,borderWidth:1.6,pointRadius:0,fill:false,order:0,yAxisID:axis,isThr:true});
const thrSet = (d,list) => { list.forEach(([label,val,axis]) => { if(isFinite(val)) d.datasets.push(thrDs(d.labels,label,val,axis)); }); return d; };
const ABS_T = () => D.insight_config.absenteeism_rate_pct, OT_T = () => D.insight_config.overtime_hours_per_100_workers_day;
const pear = (x,y) => { const n=x.length, mx=x.reduce((a,b)=>a+b,0)/n, my=y.reduce((a,b)=>a+b,0)/n; let sxy=0,sx=0,sy=0; for(let i=0;i<n;i++){ sxy+=(x[i]-mx)*(y[i]-my); sx+=(x[i]-mx)**2; sy+=(y[i]-my)**2; } return sxy/Math.sqrt(sx*sy); };
const THR = {id:'thrLabel',afterDatasetsDraw(ch){ const x=ch.ctx, ca=ch.chartArea; ch.data.datasets.forEach((d,i)=>{ if(!d.isThr||!ch.isDatasetVisible(i)) return; const sc=ch.scales[d.yAxisID||'y']; if(!sc) return; const y=sc.getPixelForValue(d.data[0]), right=d.yAxisID==='y1', t=d.label.replace('Danger level','Danger').replace(/,\s*/,': ');
  x.save(); x.font='600 11px Inter,Segoe UI,sans-serif'; x.textBaseline='bottom'; x.textAlign=right?'right':'left'; const px=right?ca.right-6:ca.left+6, w=x.measureText(t).width; x.fillStyle='rgba(255,255,255,.85)'; x.fillRect(right?px-w-3:px-3,y-15,w+6,14); x.fillStyle='#B42318'; x.fillText(t,px,y-3); x.restore(); }); }};
const ARC = {id:'arcNum',afterDatasetsDraw(ch){ const m=ch.getDatasetMeta(0), d=ch.data.datasets[0].data, x=ch.ctx, ca=ch.chartArea; x.save(); x.textAlign='center'; x.textBaseline='middle';
  m.data.forEach((arc,i)=>{ if(!d[i]) return; const p=arc.tooltipPosition(); x.fillStyle=i===0?'#3A2A00':'#fff'; x.font='700 15px Inter,Segoe UI,sans-serif'; x.fillText(d[i],p.x,p.y); });
  const cx=(ca.left+ca.right)/2, cy=(ca.top+ca.bottom)/2, t=d.reduce((a,b)=>a+b,0); x.fillStyle='#0B1F2E'; x.font='700 24px Inter,Segoe UI,sans-serif'; x.fillText(t,cx,cy-8); x.fillStyle='#5A6B7A'; x.font='12px Inter,Segoe UI,sans-serif'; x.fillText('actions',cx,cy+12); x.restore(); }};
// ---------- charts
const charts = {};
function mk(id,type,data,opt={},plug=[]){ const el=document.getElementById(id); if(!el) return;
  if(typeof Chart==='undefined'){ el.parentNode.innerHTML='<p class="muted">Chart library not loaded. The Chart.js CDN needs an internet connection.</p>'; return; }
  const n=(data.labels||[]).length, k=Math.max(1,data.datasets.filter(d=>!d.isThr).length), inner=el.parentNode;
  if(opt.indexAxis==='y') inner.style.minHeight=(n*26+60)+'px'; else if(type==='bar'&&n>10) inner.style.minWidth=(n*(k*12+10)+110)+'px'; else if(type==='line'&&n>18) inner.style.minWidth=(n*30+110)+'px';
  charts[id] = new Chart(el,{type,data,plugins:[THR,...plug],options:Object.assign({responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:12,filter:(it,cd)=>!(cd.datasets[it.datasetIndex]&&cd.datasets[it.datasetIndex].isThr)}}}},opt)}); }
const yAx = (t,min) => ({scales:{y:{title:{display:!!t,text:t},min}}});
// ---------- html helpers
const UNIT = {'Frontline workforce':'people, average per day','Frontline headcount':'people, average per day','Labor productivity':'good units per labor hour','Production achievement':'% of target output','Achievement':'% of target output','First-pass yield':'% passed first inspection','Defect rate':'% of inspected units','Rework rate':'% of inspected units','Absenteeism':'% of scheduled shifts','Downtime':'% of planned run time','Machine failure rate':'% of machine observations','Open actions':'actions not yet completed','Separations':'people who left','Behavior event count':'events recorded','Lapse events / 100 people-months':'conduct / quality lapses','Output':'units produced','Target':'units planned','Direct labor hours':'hours worked','Inspected units':'units','Scrap units':'units','Machine observations':'records','Failures':'machine failures','Avg tool wear':'minutes of tool use','Avg torque':'newton-metres','Avg rotational speed':'revolutions per minute'};
const card = (l,v,s='',d='') => `<div class="kpi${/dl bad/.test(d)?' bad':''}"><span>${l}</span><div class="kv"><b>${v}</b>${d}</div><small>${l==='Overtime'?'total hours'+(s?' · '+s.replace('worker-days','workers/day'):''):(UNIT[l]||s)}</small></div>`;
const SRCRE = /<span class="src[^>]*>.*?<\/span>/g;
const splitNote = n => ({tags:(String(n||'').match(SRCRE)||[]).join(' '), text:String(n||'').replace(SRCRE,'').trim()});
const info = (t,lab='Details') => t ? `<details class="inf"><summary>ⓘ ${lab}</summary><div class="inf-b">${t}</div></details>` : '';
const rl = rows => `<div class="rl">${rows.map(([k,t,d])=>`<div class="r"><i class="sw ${k}"></i><div><b>${t}</b><span>${d}</span></div></div>`).join('')}</div>`;
const ZS = [1,1.5,2,3];
const zc = id => `<div class="zoom"><button type="button" data-z="out" aria-label="Zoom out" title="Zoom out">−</button><span class="zv"></span><button type="button" data-z="in" aria-label="Zoom in" title="Zoom in">+</button><button type="button" data-z="full" aria-label="Expand or collapse" title="Expand / collapse">⛶</button></div>`;
const box = (id,t,note='',h,sub='',head='',det='') => { const {tags,text}=splitNote(note), s=sub||(text.length<90?text:''); return `<section class="panel cardfix chartcard" id="cc-${id}"><div class="ph"><h3>${t}${tags?' '+tags:''}${head}</h3><div class="ctl">${info(det)}${zc(id)}</div></div><div class="sub1">${s}</div><div class="cvs"><div class="cvi"><canvas id="${id}"></canvas></div></div></section>`; };
const panel = (t,inner,note='',det='',cls='') => { const {tags,text}=splitNote(note); return `<section class="panel cardfix ${cls}"><div class="ph"><h3>${t}${tags?' '+tags:''}</h3>${info(det)}</div><div class="pbody">${inner}</div>${text?`<p class="pfoot">${text}</p>`:''}</section>`; };
function applyZoom(card){ const id=card.id.slice(3), z=st.zoom[id]||1, i=card.querySelector('.cvi'); i.style.width=z*100+'%'; i.style.height=z*100+'%';
  card.querySelector('.zv').textContent = z>1 ? Math.round(z*100)+'%' : ''; card.querySelector('[data-z=out]').disabled = z<=1; card.querySelector('[data-z=in]').disabled = z>=ZS[ZS.length-1]; }
function tbl(id,cols,rows){ const s=st.sort[id], q=st.q.toLowerCase();
  let r = rows.filter(x => !q || Object.values(x).join(' ').toLowerCase().includes(q));
  if(s) r = [...r].sort((a,b)=>{const x=a[s.k],y=b[s.k]; return (typeof x==='number'||typeof y==='number' ? (x??-1e9)-(y??-1e9) : String(x).localeCompare(String(y)))*s.d;});
  return `<div class="tw"><table><thead><tr>${cols.map(c=>`<th data-t="${id}" data-k="${c.k}" class="${c.n?'num':''}">${c.l}${s&&s.k===c.k?(s.d>0?' ▲':' ▼'):''}</th>`).join('')}</tr></thead><tbody>${
    r.map(x=>`<tr>${cols.map(c=>`<td class="${c.n?'num':''} ${c.c?c.c(x):''}">${c.f?c.f(x[c.k],x):esc(x[c.k])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="muted">No rows match the current filters/search.</td></tr>`}</tbody></table></div>`; }
const selPid = () => st.plants.length===D.plants.length ? null : st.plants.map(i=>D.plants[i].plant_id);
let GRP = [];
const SEVN = {High:0,Medium:1,Low:2};
function groupIns(list){ const m=new Map(); list.forEach(i=>{ const k=i.label+'|'+(i.plant_id||'')+'|'+i.department; if(!m.has(k)) m.set(k,[]); m.get(k).push(i); });
  return [...m.values()].map(items=>{ items.sort((a,b)=>SEVN[a.severity]-SEVN[b.severity]); const f=items[0], sg=new Map();
    items.forEach(i=>{ let s=sg.get(i.metric); if(!s){ s={metric:i.metric,val:i.val,refs:[],why:[],how:[],sev:i.severity}; sg.set(i.metric,s); }
      i.refs.forEach(r=>{ if(!s.refs.includes(r)) s.refs.push(r); }); if(!s.why.includes(i.why_it_matters)) s.why.push(i.why_it_matters); if(!s.how.includes(i.method)) s.how.push(i.method); if(SEVN[i.severity]<SEVN[s.sev]) s.sev=i.severity; });
    return {label:f.label,model:f.label==='Model-generated prediction',plant_id:f.plant_id,plant:f.plant,department:f.department,severity:f.severity,signals:[...sg.values()].sort((a,b)=>SEVN[a.sev]-SEVN[b.sev]),items}; })
    .sort((a,b)=>SEVN[a.severity]-SEVN[b.severity]||b.signals.length-a.signals.length||String(a.plant_id).localeCompare(String(b.plant_id)))
    .map((g,n)=>({...g,id:'G'+(n+1)})); }
const visGroups = (dept,noModel) => { const q=st.q.toLowerCase(), sp=selPid(); return GRP.filter(g => !(noModel&&g.model) && (!sp||!g.plant_id||sp.includes(g.plant_id)) && (!dept||g.department===dept) && (!q||JSON.stringify(g).toLowerCase().includes(q))); };
const human = s => { const o=[]; let peer=''; s.refs.forEach(r=>{ let m;
  if(m=r.match(/^limit (.+)$/)) o.push('above the '+m[1]+' limit');
  else if(m=r.match(/^peers (.+)$/)) peer=m[1];
  else if(m=r.match(/^(\d+)% worse$/)) o.push(m[1]+'% worse than the other plants'+(peer?' ('+peer+')':''));
  else if(m=r.match(/^up (\d+)% \(was (.+)\)$/)) o.push('up '+m[1]+'% from '+m[2]+' in the previous period');
  else if(m=r.match(/^other months (.+) \(\+(\d+)%\)$/)) o.push(m[2]+'% higher than the other months ('+m[1]+')');
  else o.push(r); }); const t=o.join(', and '); return t.charAt(0).toUpperCase()+t.slice(1)+'.'; };
const sgRow = s => `<div class="sg"><span class="n">${esc(s.metric)}</span><b class="v ${s.sev}">${esc(s.val)}</b><span class="r">${esc(s.refs.join(' · '))}</span></div>`;
const sgRowOld = s => `<div class="sg"><span class="n">${esc(s.metric)}</span><b class="v ${s.sev}">${esc(s.val)}</b><span class="r">${esc(s.refs.join(' · '))}</span></div>`;
function insList(dept,limit,noModel){ const l=visGroups(dept,noModel), shown = limit && !st.all ? l.slice(0,limit) : l;
  return `<div class="ins${limit&&st.all?' xp':''}">${shown.map(g=>`<button class="in sev-${g.severity}" data-ins="${g.id}"><span class="in-t"><b>${esc(g.plant)} · ${esc(g.department)}</b>${g.model?'<span class="tagm">Model</span>':`<span class="pill ${g.severity}">${g.severity}</span>`}</span>${g.signals.slice(0,3).map(sgRow).join('')}<span class="in-f"><span>${g.signals.length>3?'+'+(g.signals.length-3)+' more indicators':''}</span><b>Details ›</b></span></button>`).join('') || '<p class="muted">No issues for this selection.</p>'}</div>${limit&&l.length>limit?`<button class="btn ghost more" id="toggleAll">${st.all?'Show top '+limit+' only':'Show all '+l.length+' issues'}</button>`:''}`; }
// ---------- action storage (browser localStorage only)
const KEY='woip_actions_v1'; let ACTS;
try { ACTS = JSON.parse(localStorage.getItem(KEY)); } catch(e) { ACTS = null; }
if(!Array.isArray(ACTS)) ACTS = JSON.parse(JSON.stringify(D.actions));
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ACTS)); toast('Saved in this browser only (not sent to any corporate system)'); } catch(e) { toast('Could not save: browser storage unavailable'); } };
function toast(m){ const t=$('#toast'); t.textContent=m; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,2200); }
const nextId = () => 'ACT-' + String(Math.max(0,...ACTS.map(a=>+a.action_id.slice(4)||0))+1).padStart(3,'0');

// ---------- rule-based insight engine (JS port of scripts/analytics_engine.py, recomputed for the selected period and shifts)
let INS = [];
const f1 = v => Number(v).toFixed(1);
const med = a => { const v=[...a].sort((x,y)=>x-y), m=Math.floor(v.length/2); return v.length%2 ? v[m] : (v[m-1]+v[m])/2; };
function computeInsights(){
  const cfg=D.insight_config, PR=prevRange(), cur=Lx(st.from,st.to), curW=Wx(st.from,st.to), PL=perLab(st.from,st.to), P=[0,1,2,3], mo=D.model, bm=mo.at_best_f1;
  const out=[], fin=l=>l.map((x,k)=>({...x,id:'INS-'+String(k+1).padStart(3,'0')}));
  const modelIns = D.insights.filter(i=>i.label==='Model-generated prediction').map(i=>({...i,metric:'Failure model',val:'PR-AUC '+nd(mo.pr_auc,2),refs:['base rate '+pc(mo.base_rate_test*100),'precision '+nd(bm.precision,2)+' · recall '+nd(bm.recall,2)]}));
  if(!cur.length) return fin(modelIns);
  const add=(pi,dept,ind,metric,val,refs,obs,why,rev,method,sev)=>out.push({label:'Rule-based alert',plant_id:D.plants[pi].plant_id,plant:PN[pi],department:dept,indicators:ind,metric,val,refs,observation:obs,why_it_matters:why,review_by:rev,method,severity:sev,validation_status:'Not yet validated by humans'});
  // 1. gap versus the other plants
  [['labor_productivity','Labor productivity','Production',1,K.prod,v=>nd(v,2)],['first_pass_yield','First-pass yield','Quality',1,K.fpy,pc],['production_achievement','Production achievement','Production',1,K.ach,pc],['downtime_pct','Downtime','Maintenance',0,K.dtp,pc]].forEach(([ind,lab,dept,hib,f,fmt])=>{
    const v=P.map(i=>f(aggL(cur.filter(r=>r[1]===i)))); P.forEach(i=>{ const m=med(v.filter((_,j)=>j!==i)), gap=(hib?(m-v[i]):(v[i]-m))/m*100;
      if(isFinite(gap)&&gap>=cfg.gap_vs_peer_median_pct) add(i,dept,[ind],lab,fmt(v[i]),['peers '+fmt(m),gap.toFixed(0)+'% worse'],`${PN[i]} ${lab.toLowerCase()} is ${fmt(v[i])} vs peer median ${fmt(m)} (${gap.toFixed(1)}% worse) in ${PL}.`,'A sustained gap versus comparable plants running standardized processes warrants investigation; the gap does not itself identify a cause.',[dept,'COO / Operations'],`Plant value vs median of the other plants; flagged if ${f1(cfg.gap_vs_peer_median_pct)}% or more worse.`,gap>=15?'High':'Medium'); }); });
  // 2. change versus the previous period of the same length
  if(PR){ const pL=Lx(PR.from,PR.to), pW=Wx(PR.from,PR.to), pl=perLab(PR.from,PR.to);
    P.forEach(i=>[['downtime_pct','Downtime','Maintenance',rs=>K.dtp(aggL(rs)),0],['defect_rate','Defect rate','Quality',rs=>K.dfr(aggL(rs)),0],['absenteeism_rate','Absenteeism','HR & Workforce',rs=>K.abs(aggW(rs)),1]].forEach(([ind,lab,dept,f,w])=>{
      const r=f((w?curW:cur).filter(x=>x[1]===i)), b=f((w?pW:pL).filter(x=>x[1]===i)), ch=(r-b)/b*100;
      if(isFinite(ch)&&ch>=cfg.trend_increase_pct) add(i,dept,[ind],lab,pc(r),[`up ${ch.toFixed(0)}% (was ${pc(b)})`],`${PN[i]} ${lab.toLowerCase()} rose from ${pc(b)} (${pl}) to ${pc(r)} (${PL}), +${ch.toFixed(0)}%.`,"A marked deterioration against the plant's own history; check whether it is persistent, seasonal, or linked to a known event.",[dept,'Plant Manager'],`Selected period vs the previous period of the same length (${pl}); flagged if up ${f1(cfg.trend_increase_pct)}% or more.`,ch>=50?'High':'Medium'); })); }
  // 3. fixed limits
  P.forEach(i=>{ const w=aggW(curW.filter(r=>r[1]===i)), ab=K.abs(w), ot=K.ot100(w);
    if(ab>=cfg.absenteeism_rate_pct) add(i,'HR & Workforce',['absent_shifts'],'Absenteeism',pc(ab),[`limit ${f1(cfg.absenteeism_rate_pct)}%`],`${PN[i]} absenteeism is ${ab.toFixed(1)}% in ${PL} (threshold ${f1(cfg.absenteeism_rate_pct)}%).`,'Sustained absenteeism raises scheduling risk and may increase overtime.',['HR & Workforce','Production'],`Absent / scheduled shifts at or above ${f1(cfg.absenteeism_rate_pct)}%.`,ab>=6?'High':'Medium');
    if(ot>=cfg.overtime_hours_per_100_workers_day) add(i,'HR & Workforce',['overtime_hours'],'Overtime',ot.toFixed(1)+' h',[`limit ${cfg.overtime_hours_per_100_workers_day} h`],`${PN[i]} overtime is ${ot.toFixed(1)} h per 100 workers per day in ${PL} (threshold ${f1(cfg.overtime_hours_per_100_workers_day)}).`,'High overtime can signal capacity or absence pressure; review before it affects retention.',['HR & Workforce','Production'],`Overtime hours per 100 scheduled workers per workday at or above ${cfg.overtime_hours_per_100_workers_day}.`,'Medium'); });
  // 4. one-month defect spikes inside the period
  const months=[...new Set(cur.map(mon))].sort();
  if(months.length>=3) P.forEach(i=>{ const pr=cur.filter(r=>r[1]===i); for(const m of months.slice(-6)){ const oth=aggL(pr.filter(r=>mon(r)!==m)), c=aggL(pr.filter(r=>mon(r)===m)), b=K.dfr(oth), v=K.dfr(c), ch=(v-b)/b*100;
    if(isFinite(ch)&&ch>=40){ add(i,'Quality',['defect_units'],'Defect spike, '+mlab(m),pc(v),[`other months ${pc(b)} (+${ch.toFixed(0)}%)`],`${PN[i]} defect rate was ${v.toFixed(2)}% in ${mlab(m)} vs ${b.toFixed(2)}% in the other months of ${PL} (+${ch.toFixed(0)}%).`,'A temporary spike can reveal a process, material, or inspection change; confirm whether it has been resolved.',['Quality','Production'],'Month defect rate vs the plant\'s other months in the period; flagged if up 40% or more.','Medium'); break; } } });
  out.sort((a,b)=>SEVN[a.severity]-SEVN[b.severity]||a.plant_id.localeCompare(b.plant_id));
  return fin([...out,...modelIns]); }
// ---------- pages
let post = [];
function exec(){
  const L=Lr(), W=Wr(), M=Mr(), a=aggL(L), w=aggW(W), open=ACTS.filter(x=>x.status!=='Completed').length, cfg=D.insight_config;
  const bL=Lr(true), bW=Wr(true), bM=Mr(true), byShift=st.cmp==='shift';
  const PL=perLab(st.from,st.to), PR=prevRange(), pl=PR?perLab(PR.from,PR.to):'';
  const pL=PR?D.line_rows.filter(r=>inR(r[0],PR.from,PR.to)&&okP(r[1])&&okS(r[3])):[], pW=PR?D.wf_rows.filter(r=>inR(r[0],PR.from,PR.to)&&okP(r[1])&&okS(r[2])):[], pM=PR?D.mt_rows.filter(r=>inR(r[0],PR.from,PR.to)&&okP(r[1])):[];
  const pa=pL.length?aggL(pL):null, pw=pW.length?aggW(pW):null;
  const dl=(c,p,hib)=>{ if(!isFinite(c)||!isFinite(p)||!p) return ''; const ch=(c-p)/p*100, ab=Math.abs(ch); if(ab<0.05) return '<em class="dl">no change</em>';
    const cls = hib===undefined||ab<2 ? '' : ((hib?ch<0:ch>0) ? 'bad' : 'ok'); return `<em class="dl ${cls}">${ch>0?'▲':'▼'} ${ab.toFixed(ab<10?1:0)}%</em>`; };

  // ---- needs attention
  const rules = rl([['k1','Behind other plants',`KPI ${cfg.gap_vs_peer_median_pct}%+ worse than the other plants' median`],['k2','Getting worse',`Downtime, defects or absenteeism up ${cfg.trend_increase_pct}%+ vs previous period`],['k3','Over a limit',`Absenteeism ≥ ${cfg.absenteeism_rate_pct}% · overtime ≥ ${cfg.overtime_hours_per_100_workers_day} h per 100 workers/day`],['k4','Defect spike',`A month's defect rate 40%+ above the plant's other months`]]);
  const pchip = st.plants.map(i=>{ const n=GRP.filter(g=>!g.model&&g.plant_id===D.plants[i].plant_id).length, sv=GRP.some(g=>!g.model&&g.plant_id===D.plants[i].plant_id&&g.severity==='High')?'High':n?'Medium':''; return `<span class="pst ${sv}"><i></i>${PN[i]} <b>${n?n+' issue'+(n>1?'s':''):'no issues'}</b></span>`; }).join('');
  const needs = `<section class="panel mb"><div class="ph"><h3>Needs attention <span class="sub">${PL}${PR?' · compared with '+pl:' · no earlier data to compare with'}</span></h3><div class="pst-row">${pchip}</div></div>${insList(null,3,true)}</section>`;

  // ---- plant / shift comparison
  const mkRow = (name,i,aL,aW,fail) => ({name, i, ach:K.ach(aL), prod:K.prod(aL), fpy:K.fpy(aL), dfr:K.dfr(aL), abs:K.abs(aW), ot100:K.ot100(aW), dtp:K.dtp(aL), fail});
  const rows = byShift
    ? st.shifts.map(s => mkRow(D.shifts[s], s, aggL(D.line_rows.filter(r=>inR(r[0],st.from,st.to)&&okP(r[1])&&r[3]===s)), aggW(D.wf_rows.filter(r=>inR(r[0],st.from,st.to)&&okP(r[1])&&r[2]===s)), NaN))
    : D.plants.map((p,i) => mkRow(p.plant_name, i, aggL(bL.filter(r=>r[1]===i)), aggW(bW.filter(r=>r[1]===i)), K.fail(bM.filter(r=>r[1]===i))));
  const dir = {ach:1,prod:1,fpy:1,dfr:-1,abs:-1,ot100:-1,dtp:-1,fail:-1}, mdn = k => med(rows.map(r=>r[k]).filter(isFinite));
  const cl = k => x => { if(rows.length<2) return ''; const m=mdn(k), g=(x[k]-m)/m*dir[k]; return g<=-0.05 ? 'bad' : g>=0.05 ? 'good' : ''; };
  const col = (k,l,f) => ({k,l,n:1,f:v=>f(v),c:cl(k)}), hd = (t,u) => `${t}<small>${u}</small>`;
  const sel = x => !byShift && st.plants.length<D.plants.length && st.plants.includes(x.i) ? 'sel' : '';
  const pStat = x => { if(byShift) return ''; const gs=GRP.filter(g=>!g.model&&g.plant_id===D.plants[x.i].plant_id); return gs.some(g=>g.severity==='High')?'High':gs.length?'Medium':'ok'; };
  const cols = [{k:'name',l:byShift?'Shift':'Plant',c:sel,f:(v,x)=>byShift?esc(v):`<i class="sd ${pStat(x)}"></i>${esc(v)}`},col('ach',hd('Achievement','% of target'),pc),col('prod',hd('Productivity','good units / labor hr'),v=>nd(v,2)),col('fpy',hd('First-pass yield','% passed'),pc),col('dfr',hd('Defect rate','% of inspected'),pc),col('abs',hd('Absenteeism','% of shifts'),pc),col('ot100',hd('Overtime','h per 100 workers/day'),v=>nd(v,1)),col('dtp',hd('Downtime','% of run time'),pc)];
  if(!byShift) cols.push(col('fail',hd('Machine failure','% of observations'),pc));
  const cmpNote = `<div class="inf-t">How to read the table</div>${rl([['bad','Red cell',`At least 5% worse than the median ${byShift?'of the selected shifts':'of the four plants'}`],['good','Green cell','At least 5% better than the median'],...(byShift?[]:[['hi','Red dot','Plant has a high-priority issue'],['md','Amber dot','Medium-priority issue'],['ok','Green dot','No issue flagged']])])}`;
  const cmpPanel = `<section class="panel"><div class="ph"><h3>${byShift?'Shift':'Plant'} comparison</h3><div class="ctl">${info(cmpNote)}<div class="seg" data-seg="cmp"><button data-v="plant" class="${byShift?'':'on'}">By plant</button><button data-v="shift" class="${byShift?'on':''}">By shift</button></div></div></div>${tbl('pc',cols,rows)}</section>`;

  // ---- connected view
  const months=[...new Set(bL.map(mon))].sort(), pAll=D.plants.map((_,i)=>K.dtp(aggL(bL.filter(r=>r[1]===i))));
  const topG = GRP.find(g=>!g.model&&g.plant_id), topI = topG ? D.plants.findIndex(p=>p.plant_id===topG.plant_id) : pAll.indexOf(Math.max(...pAll));
  const fi = st.focus ?? topI;
  const mm = months.map(m => { const aL=aggL(bL.filter(r=>r[1]===fi&&mon(r)===m)), aW=aggW(bW.filter(r=>r[1]===fi&&mon(r)===m)); return {dt:K.dtp(aL),prod:K.prod(aL),dfr:K.dfr(aL),abs:K.abs(aW),ot:K.ot100(aW)}; });
  const fc = {L:aggL(bL.filter(r=>r[1]===fi)), W:aggW(bW.filter(r=>r[1]===fi))}, fp = PR ? {L:aggL(Lx(PR.from,PR.to).filter(r=>r[1]===fi)), W:aggW(Wx(PR.from,PR.to).filter(r=>r[1]===fi))} : null;
  const SIG=[['Downtime',a=>K.dtp(a.L),0],['Absenteeism',a=>K.abs(a.W),0],['Overtime',a=>K.ot100(a.W),0],['Defect rate',a=>K.dfr(a.L),0],['Labor productivity',a=>K.prod(a.L),1]];
  const sig = fp ? SIG.map(([n,f,hib]) => { const p=(f(fc)-f(fp))/f(fp)*100; return {n,p,worse:hib?p<=-5:p>=5}; }).filter(x=>isFinite(x.p)) : [];
  const nW = sig.filter(x=>x.worse).length;
  const badge = sig.length ? `<span class="chg ${nW>=3?'bad':nW?'warn':'ok'}">${nW} of ${sig.length} worse</span>` : '';
  const VIEWS = {
    a:{t:'Downtime vs productivity', A:['Downtime','dt','bar','#FFBD59','y','Downtime (% of run time)'], B:['Labor productivity','prod','line',C.navy,'y1','Productivity (good units / labor hr)'], thr:[['Danger level, downtime '+nd(peerThr(K.dtp,false),1)+'%',peerThr(K.dtp,false),'y'],['Danger level, productivity '+nd(peerThr(K.prod,true),2),peerThr(K.prod,true),'y1']]},
    b:{t:'Absenteeism vs overtime', A:['Absenteeism','abs','line',C.navy,'y','Absenteeism (% of shifts)'], B:['Overtime','ot','bar','#FFBD59','y1','Overtime (h per 100 workers/day)'], thr:[['Danger level, absenteeism '+ABS_T()+'%',ABS_T(),'y'],['Danger level, overtime '+OT_T()+' h',OT_T(),'y1']]},
    c:{t:'Downtime vs defects', A:['Downtime','dt','bar','#FFBD59','y','Downtime (% of run time)'], B:['Defect rate','dfr','line',C.navy,'y1','Defect rate (% of inspected)'], thr:[['Danger level, downtime '+nd(peerThr(K.dtp,false),1)+'%',peerThr(K.dtp,false),'y'],['Danger level, defects '+nd(peerThr(K.dfr,false),1)+'%',peerThr(K.dfr,false),'y1']]}};
  const V = VIEWS[st.view]||VIEWS.a, [A,B]=[V.A,V.B], r=pear(mm.map(x=>x[A[1]]),mm.map(x=>x[B[1]])), ar=Math.abs(r);
  const cap = !isFinite(r) ? '' : ar<.4 ? `${A[0]} and ${B[0].toLowerCase()} show no clear link over ${mm.length} months (r = ${nd(r,2)}).` : `${A[0]} and ${B[0].toLowerCase()} move ${r>0?'together':'in opposite directions'} (${ar>=.7?'strongly':'moderately'}, r = ${nd(r,2)} over ${mm.length} months). Moving together does not prove one causes the other.`;
  const connInfo = `${sig.length?`<div class="inf-t">${PN[fi]} vs ${pl}</div><div class="chips2">${sig.map(x=>`<span class="chg ${x.worse?'bad':''}">${x.n} ${x.p>=0?'+':''}${nd(x.p,0)}%</span>`).join('')}</div>${nW>=3?'<p>Three or more indicators worse at once suggests a shared cause worth checking.</p>':''}`:'<p>No earlier data to compare with.</p>'}${cap?`<div class="inf-t sp">Link between the two lines</div><p>${cap}</p>`:''}${rl([['dash','Danger level','Dashed red line on the chart']])}`;
  const selects = `<select data-focus aria-label="Plant">${D.plants.map((p,i)=>`<option value="${i}" ${i===fi?'selected':''}>${p.plant_name}</option>`).join('')}</select><select data-viewsel aria-label="Indicators">${Object.entries(VIEWS).map(([k,v])=>`<option value="${k}" ${k===st.view?'selected':''}>${v.t}</option>`).join('')}</select>`;

  // ---- trend charts + one-line takeaway each
  const dProd=thrSet(series(L,aggL,K.prod),[['Danger level '+nd(peerThr(K.prod,true),2),peerThr(K.prod,true)]]);
  const dDt=thrSet(series(L,aggL,K.dtp),[['Danger level '+nd(peerThr(K.dtp,false),1)+'%',peerThr(K.dtp,false)]]);
  const dAbs=thrSet(series(W,aggW,K.abs,1),[['Danger level '+ABS_T()+'%',ABS_T()]]);
  const dOt=thrSet(series(W,aggW,K.ot100,1),[['Danger level '+OT_T()+' h',OT_T()]]);
  const tk=(d,fmt,hib)=>{ const v=d.datasets.filter(x=>!x.isThr).map(x=>({n:x.label,v:[...x.data].reverse().find(y=>y!=null)})).filter(x=>isFinite(x.v)); if(!v.length) return ''; v.sort((p,q)=>hib?p.v-q.v:q.v-p.v);
    return `${mlab(d.labels[d.labels.length-1])}: ${hib?'lowest':'highest'} is <b>${v[0].n}</b> ${fmt(v[0].v)}`; };
  const dsOf = ([n,k,type,color,ax]) => ({type,label:n,data:mm.map(x=>x[k]),yAxisID:ax,borderColor:color,backgroundColor:type==='bar'?color+'AA':color,tension:.25,pointRadius:type==='line'?3:0,order:type==='bar'?3:1});
  post.push(()=>{
    mk('cx','bar',thrSet({labels:months,datasets:[dsOf(A),dsOf(B)]},V.thr),{scales:{y:{position:'left',beginAtZero:true,title:{display:true,text:A[5]}},y1:{position:'right',beginAtZero:B[1]!=='prod',grid:{drawOnChartArea:false},title:{display:true,text:B[5]}}}});
    mk('c1','line',dProd,yAx('Good units / labor hour')); mk('c5','line',dDt,yAx('% of planned run time',0));
    mk('c2','line',dAbs,yAx('% of scheduled shifts')); mk('c4','line',dOt,yAx('h per 100 workers/day'));
    const cnt=STAT.map(s=>ACTS.filter(x=>x.status===s).length);
    mk('c3','doughnut',{labels:STAT.map((s,i)=>`${s} · ${cnt[i]}`),datasets:[{data:cnt,backgroundColor:[C.amber,C.teal,C.cyan,C.navy]}]},{cutout:'52%'},[ARC]); });
  const dnote = `Dashed red line = danger level. `;

  return `${needs}
  <div class="kh"><span>Key indicators</span><i>${PL}${PR?' · arrows compare with '+pl:''}</i></div>
  <div class="grid k mb">${card('Frontline workforce',n0(w.hc/Math.max(1,w.days)),'',dl(w.hc/w.days,pw&&pw.hc/pw.days))}${card('Labor productivity',nd(K.prod(a),2),'',dl(K.prod(a),pa&&K.prod(pa),1))}${card('Production achievement',pc(K.ach(a)),'',dl(K.ach(a),pa&&K.ach(pa),1))}${card('First-pass yield',pc(K.fpy(a)),'',dl(K.fpy(a),pa&&K.fpy(pa),1))}${card('Defect rate',pc(K.dfr(a)),'',dl(K.dfr(a),pa&&K.dfr(pa),0))}${card('Absenteeism',pc(K.abs(w)),'',dl(K.abs(w),pw&&K.abs(pw),0))}${card('Overtime',n0(w.ot)+' h','',dl(K.ot100(w),pw&&K.ot100(pw),0))}${card('Downtime',pc(K.dtp(a)),'',dl(K.dtp(a),pa&&K.dtp(pa),0))}${card('Machine failure rate',pc(K.fail(M)),'',dl(K.fail(M),pM.length?K.fail(pM):NaN,0))}${card('Open actions',open)}</div>
  <div class="mb">${cmpPanel}</div>
  <div class="cg">${box('cx','Connected view','',0,selects,badge,connInfo)}${box('c1','Labor productivity by plant',dnote+'Productivity is flagged when it is 15% below the median of the four plants.',0,tk(dProd,v=>nd(v,2),1))}${box('c5','Downtime by plant',dnote+'Flagged when 15% above the median of the four plants.',0,tk(dDt,pc,0))}${box('c2','Absenteeism by plant',dnote+'Limit '+ABS_T()+'% of scheduled shifts.',0,tk(dAbs,pc,0))}${box('c4','Overtime by plant',dnote+'Limit '+OT_T()+' h per 100 workers per day.',0,tk(dOt,v=>nd(v,1)+' h',0))}${box('c3','Action status','Number of actions in each status.',0,`${open} of ${ACTS.length} actions not completed`)}</div>`;
}
function hr(){
  const W=Wr(), w=aggW(W), sp=selPid(), ppl = D.wfs_people.filter(r=>okM(r[0])&&okP(r[2])&&okS(r[3])), pm = ppl.reduce((s,r)=>s+r[4],0);
  const teams = D.wfs_team.filter(r=>okM(r[0])&&okP(r[2])&&okS(r[3])), lapse = teams.filter(r=>r[4]==='Conduct/quality lapse').reduce((s,r)=>s+(r[5]||0),0);
  const tr = D.turnover.filter(r=>okM(r[1].slice(0,7))&&(!sp||sp.includes(r[0]))), sep = tr.reduce((s,r)=>s+r[3],0), hcT = tr.length ? [...grp(tr,r=>r[1]).values()][0].reduce((s,r)=>s+r[2],0) : NaN;
  const hcBy = D.plants.map((p,i)=>SC.map((_,s)=>{ const rs=W.filter(r=>r[1]===i&&r[2]===s), d=new Set(rs.map(r=>r[0])).size; return d ? rs.reduce((t,r)=>t+r[3],0)/d : 0; }));
  const cats = ['Positive contribution','Conduct/quality lapse','Absence','Workforce change'], months = [...new Set(teams.map(r=>r[0]))].sort();
  const ppM = m => ppl.filter(r=>r[0]===m).reduce((s,r)=>s+r[4],0);
  const sh = D.wfs_shift.filter(r=>okM(r[0])&&okS(r[1])), types = [...new Set(sh.map(r=>r[2]))].sort(), tcount = t => sh.filter(r=>r[2]===t).reduce((s,r)=>s+(r[3]||0),0);
  post.push(()=>{ mk('h1','bar',{labels:PN,datasets:SC.map((s,k)=>({label:D.shifts[k],backgroundColor:SC[k],data:hcBy.map(r=>r[k])}))},{scales:{x:{stacked:true},y:{stacked:true,title:{display:true,text:'Avg headcount'}}}});
    mk('h2','line',thrSet(series(W,aggW,K.abs,1),[['Danger level '+ABS_T()+'%',ABS_T()]]),yAx('Absenteeism %')); mk('h3','line',thrSet(series(W,aggW,K.ot100,1),[['Danger level '+OT_T()+' h',OT_T()]]),yAx('OT hours per 100 worker-days'));
    mk('h4','line',{labels:months,datasets:cats.map((c,i)=>({label:c,borderColor:[C.teal,C.amber,C.navy,C.cyan][i],tension:.25,pointRadius:2,data:months.map(m=>{const p=ppM(m);return p?teams.filter(r=>r[0]===m&&r[4]===c).reduce((s,r)=>s+(r[5]||0),0)/p*100:null;})}))},yAx('Recorded events per 100 people-months'));
    mk('h5','bar',{labels:types,datasets:[{label:'Recorded events',data:types.map(tcount),backgroundColor:C.teal}]},{indexAxis:'y',plugins:{legend:{display:false}}}); });
  const tm = [...grp(teams,r=>r[1]).entries()].map(([t,rs])=>{ const o={team:t,plant:PN[rs[0][2]],shift:D.shifts[rs[0][3]],people:Math.round(ppl.filter(r=>r[1]===t).reduce((s,r)=>s+r[4],0)/Math.max(1,new Set(ppl.filter(r=>r[1]===t).map(r=>r[0])).size))};
    cats.forEach((c,i)=>{ const x=rs.filter(r=>r[4]===c); o['c'+i]=x.reduce((s,r)=>s+(r[5]||0),0); o['s'+i]=x.some(r=>r[5]===null); }); return o; });
  const cc = i => ({k:'c'+i,l:cats[i].replace('/quality','')+' events',n:1,f:(v,x)=>n0(v)+(x['s'+i]?'*':'')});
  return `<div class="grid k mb">${card('Frontline headcount',n0(w.hc/Math.max(1,w.days)),'avg daily · '+SIM+' (from WFS people counts)')}${card('Absenteeism',pc(K.abs(w)),SIM)}${card('Overtime',n0(w.ot)+' h',nd(K.ot100(w),1)+' h per 100 worker-days')}${card('Separations',n0(sep),isFinite(hcT)?pc(sep/hcT*100)+' of avg headcount · '+SIM:SIM)}${card('Behavior event count',n0(teams.reduce((s,r)=>s+(r[5]||0),0)),UP+' WFS, supervisor-recorded, aggregated')}${card('Lapse events / 100 people-months',nd(pm?lapse/pm*100:NaN,1),'recorded conduct/quality lapses')}</div>
  <div class="cg mb">${box('h1','Workforce distribution by plant and shift',SIM)}${box('h2','Absenteeism trend',SIM)}${box('h3','Overtime pattern',SIM)}${box('h4','Behavior event rates by category')}${box('h5','Behavior events by type (all plants)')}${panel('Workforce-related alerts',insList('HR & Workforce'))}${panel('Team-level behavior patterns (aggregate only)',tbl('tm',[{k:'team',l:'Team'},{k:'plant',l:'Plant (sim.)'},{k:'shift',l:'Shift'},{k:'people',l:'Avg people',n:1},cc(0),cc(1),cc(2),cc(3)],tm),'* Includes months with a count under 5 people (suppressed).','','span2')}</div>`;
}
function prod(){
  const L=Lr(), a=aggL(L), lines=[...grp(L,r=>r[2]).entries()].map(([li,rs])=>{const x=aggL(rs); return {line:LN[li],plant:PN[rs[0][1]],output:x.output,ach:K.ach(x),prod:K.prod(x),dtp:K.dtp(x)};});
  const med=[...lines.map(l=>l.dtp)].sort((x,y)=>x-y)[Math.floor(lines.length/2)];
  const months=[...new Set(L.map(mon))].sort(), by=m=>aggL(L.filter(r=>mon(r)===m));
  const ps=[...new Set(L.map(r=>r[1]))].sort();
  post.push(()=>{ mk('p1','bar',{labels:months,datasets:[{type:'bar',label:'Output',data:months.map(m=>by(m).output),backgroundColor:C.teal},{type:'line',label:'Target',data:months.map(m=>by(m).target),borderColor:C.navy,pointRadius:2}]},yAx('Units'));
    mk('p2','bar',{labels:ps.map(p=>PN[p]),datasets:SC.map((_,s)=>({label:D.shifts[s],backgroundColor:SC[s],data:ps.map(p=>{const rs=L.filter(r=>r[1]===p&&r[3]===s);return rs.length?K.ach(aggL(rs)):null;})}))},yAx('Achievement %'));
    mk('p3','line',thrSet(series(L,aggL,K.prod),[['Danger level '+nd(peerThr(K.prod,true),2),peerThr(K.prod,true)]]),yAx('Good units / labor hour')); mk('p4','line',thrSet(series(L,aggL,K.dtp),[['Danger level '+nd(peerThr(K.dtp,false),1)+'%',peerThr(K.dtp,false)]]),yAx('Downtime % of planned run time',0)); });
  return `<div class="grid k mb">${card('Output',n0(a.output),'units · '+SIM)}${card('Target',n0(a.target),'units')}${card('Achievement',pc(K.ach(a)),'output ÷ target')}${card('Labor productivity',nd(K.prod(a),2),'good units ÷ direct labor hours')}${card('Downtime',pc(K.dtp(a)),'production-loss indicator')}${card('Direct labor hours',n0(a.hrs),'h')}</div>
  <div class="cg">${box('p1','Output vs target (monthly)',SIM)}${box('p2','Target achievement by plant and shift',SIM)}${box('p3','Labor productivity trend',SIM)}${box('p4','Production loss: downtime trend',SIM)}${panel('Line comparison · potential bottlenecks',tbl('pl',[{k:'plant',l:'Plant'},{k:'line',l:'Line'},{k:'output',l:'Output',n:1,f:n0},{k:'ach',l:'Achievement',n:1,f:pc},{k:'prod',l:'Productivity',n:1,f:v=>nd(v,2)},{k:'dtp',l:'Downtime',n:1,f:pc,c:x=>x.dtp>med*1.25?'bad':''}],lines),'Red: downtime more than 25% above the median line.')}${panel('Production-related alerts',insList('Production'))}</div>`;
}
function qual(){
  const L=Lr(), a=aggL(L), ps=[...new Set(L.map(r=>r[1]))].sort(), lines=[...grp(L,r=>r[2]).entries()].sort((x,y)=>x[0]-y[0]);
  const rows=lines.map(([li,rs])=>{const x=aggL(rs);return {plant:PN[rs[0][1]],line:LN[li],insp:x.insp,fpy:K.fpy(x),dfr:K.dfr(x),rwr:K.rwr(x),scrap:x.scrap};});
  post.push(()=>{ mk('q1','line',thrSet(series(L,aggL,K.dfr),[['Danger level '+nd(peerThr(K.dfr,false),1)+'%',peerThr(K.dfr,false)]]),yAx('Defect rate %')); mk('q2','bar',{labels:ps.map(p=>PN[p]),datasets:[{label:'First-pass yield %',data:ps.map(p=>K.fpy(aggL(L.filter(r=>r[1]===p)))),backgroundColor:ps.map(p=>PC[p])}]},{plugins:{legend:{display:false}},scales:{y:{min:90,max:100,title:{display:true,text:'FPY %'}}}});
    mk('q3','bar',{labels:lines.map(([li])=>LN[li]),datasets:[{label:'Defect rate %',data:lines.map(([,rs])=>K.dfr(aggL(rs))),backgroundColor:lines.map(([,rs])=>PC[rs[0][1]])}]},{plugins:{legend:{display:false}},...yAx('Defect rate %',0)});
    mk('q4','bar',{labels:ps.map(p=>PN[p]),datasets:[{label:'Rework',backgroundColor:C.amber,data:ps.map(p=>aggL(L.filter(r=>r[1]===p)).rework)},{label:'Scrap',backgroundColor:C.navy,data:ps.map(p=>aggL(L.filter(r=>r[1]===p)).scrap)}]},{scales:{x:{stacked:true},y:{stacked:true,title:{display:true,text:'Units'}}}}); });
  return `<div class="grid k mb">${card('Inspected units',n0(a.insp),SIM)}${card('Defect rate',pc(K.dfr(a)),'defect units ÷ inspected')}${card('Rework rate',pc(K.rwr(a)),'rework units ÷ inspected')}${card('First-pass yield',pc(K.fpy(a)),'passed first inspection ÷ inspected')}${card('Scrap units',n0(a.scrap),'defects not recovered')}</div>
  <div class="cg">${box('q1','Defect rate trend by plant',SIM)}${box('q2','First-pass yield by plant',SIM+' axis starts at 90%')}${box('q3','Defect rate by production line','Colour = plant')}${box('q4','Rework and scrap units by plant',SIM)}${panel('Quality performance by line',tbl('ql',[{k:'plant',l:'Plant'},{k:'line',l:'Line'},{k:'insp',l:'Inspected',n:1,f:n0},{k:'fpy',l:'FPY',n:1,f:pc},{k:'dfr',l:'Defect',n:1,f:pc},{k:'rwr',l:'Rework',n:1,f:pc},{k:'scrap',l:'Scrap',n:1,f:n0}],rows))}${panel('Quality-related alerts',insList('Quality'))}</div>`;
}
function maint(){
  const M=Mr(), n=M.length, f=M.reduce((s,r)=>s+r[9],0), avg=i=>M.reduce((s,r)=>s+r[i],0)/Math.max(1,n), mo=D.model, b=mo.at_best_f1;
  const modes=['TWF','HDF','PWF','OSF','RNF'], mc=modes.map((_,i)=>M.reduce((s,r)=>s+r[10+i],0));
  const wb=['0–49','50–99','100–149','150–199','200–249','250+'], wr=wb.map((_,k)=>{const rs=M.filter(r=>Math.min(5,Math.floor(r[8]/50))===k);return rs.length?K.fail(rs):null;});
  const tr=['L','M','H'].map((_,k)=>K.fail(M.filter(r=>r[3]===k))), months=[...new Set(M.map(mon))].sort(), mm=m=>M.filter(r=>mon(r)===m);
  const lines=[...grp(M,r=>r[2]).entries()].map(([li,rs])=>({line:LN[li],obs:rs.length,fails:rs.reduce((s,r)=>s+r[9],0),rate:K.fail(rs),wear:rs.reduce((s,r)=>s+r[8],0)/rs.length,hi:rs.filter(r=>r[8]>=200).length/rs.length*100}));
  post.push(()=>{ mk('m1','bar',{labels:modes,datasets:[{data:mc,backgroundColor:C.navy}]},{plugins:{legend:{display:false}},...yAx('Failures flagged')});
    mk('m2','bar',{labels:wb,datasets:[{data:wr,backgroundColor:C.teal}]},{plugins:{legend:{display:false}},...yAx('Failure rate %',0)});
    mk('m3','bar',{labels:['L','M','H'],datasets:[{data:tr,backgroundColor:C.cyan}]},{plugins:{legend:{display:false}},...yAx('Failure rate %',0)});
    mk('m4','scatter',{datasets:[{label:'No failure (sample)',data:M.filter((r,i)=>!r[9]&&i%8===0).map(r=>({x:r[6],y:r[7]})),backgroundColor:'rgba(28,171,176,.35)',pointRadius:2},{label:'Failure',data:M.filter(r=>r[9]).map(r=>({x:r[6],y:r[7]})),backgroundColor:C.amber,pointRadius:3}]},{scales:{x:{title:{display:true,text:'Rotational speed [rpm]'},min:1100},y:{title:{display:true,text:'Torque [Nm]'}}}});
    mk('m5','line',{labels:months,datasets:[{label:'Air temp [K]',borderColor:C.teal,data:months.map(m=>mm(m).reduce((s,r)=>s+r[4],0)/mm(m).length),pointRadius:2},{label:'Process temp [K]',borderColor:C.navy,data:months.map(m=>mm(m).reduce((s,r)=>s+r[5],0)/mm(m).length),pointRadius:2}]},yAx('Kelvin'));
    mk('m6','bar',{labels:Object.keys(mo.feature_importance),datasets:[{data:Object.values(mo.feature_importance),backgroundColor:C.dark}]},{indexAxis:'y',plugins:{legend:{display:false}}}); });
  return `<div class="grid k mb">${card('Machine observations',n0(n),UP+' AI4I · plant/date are generated demo tags')}${card('Failures',n0(f),'Machine failure = 1')}${card('Machine failure rate',pc(K.fail(M)),'failures ÷ observations')}${card('Avg tool wear',nd(avg(8),0)+' min','')}${card('Avg torque',nd(avg(7),1)+' Nm','')}${card('Avg rotational speed',n0(avg(6))+' rpm','')}</div>
  <div class="cg">${box('m1','Failure mode distribution','A failure can carry several flags. '+UP)}${box('m2','Failure rate by tool wear (min)',UP)}${box('m3','Failure rate by machine type',UP)}${box('m4','Operating conditions: torque vs speed','Failures + 1-in-8 sample of non-failures. '+UP)}${box('m5','Air and process temperature (monthly avg)','Generated dates, trend is illustrative. '+UP)}${box('m6','Model feature importance',MDL)}${panel('Predictive maintenance demonstration '+MDL,`<div class="cm"><div></div><b>Predicted failure</b><b>Predicted OK</b><b>Observed failure</b><span class="ok">${b.tp}<small>caught</small></span><span class="no">${b.fn}<small>missed</small></span><b>Observed OK</b><span class="no">${b.fp}<small>false alarm</small></span><span class="ok">${b.tn}<small>correct</small></span></div><div class="mets"><div><b>${nd(b.precision,2)}</b><span>Precision</span></div><div><b>${nd(b.recall,2)}</b><span>Recall</span></div><div><b>${nd(b.f1,2)}</b><span>F1</span></div><div><b>${nd(mo.pr_auc,2)}</b><span>PR-AUC</span></div></div><p class="note">Failure base rate in the test set is ${pc(mo.base_rate_test*100)}.</p>`,'',`<div class="inf-t">About this model</div><p>Small Random Forest on machine type, temperatures, speed, torque and tool wear. Failure-mode flags are excluded to prevent leakage. Held-out test set: ${n0(mo.n_test)} observations, ${mo.test_failures} failures.</p><div class="inf-t sp">Limits</div><ul>${mo.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`)}${panel('Highest predicted risk: predicted vs observed (test set)',tbl('tp',[{k:'udi',l:'UDI'},{k:'machine_type',l:'Type'},{k:'predicted_probability',l:'Risk score',n:1,f:v=>nd(v,2)},{k:'predicted_failure',l:'Predicted',f:v=>v?'Failure':'OK'},{k:'machine_failure',l:'Observed',f:v=>v?'Failure':'OK'}],D.top_pred))}${panel('Equipment risk indicators by line (demo tags)',tbl('ml',[{k:'line',l:'Line'},{k:'obs',l:'Obs',n:1,f:n0},{k:'fails',l:'Failures',n:1,f:n0},{k:'rate',l:'Failure rate',n:1,f:pc},{k:'wear',l:'Avg wear',n:1,f:v=>nd(v,0)},{k:'hi',l:'Wear ≥200 min',n:1,f:pc}],lines))}${panel('Maintenance alerts',insList('Maintenance'))}</div>`;
}
function actions(){
  const q=st.q.toLowerCase(), sp=selPid(), list=ACTS.filter(a=>(st.as==='All'||a.status===st.as)&&(!sp||!a.plant_id||sp.includes(a.plant_id))&&(!q||JSON.stringify(a).toLowerCase().includes(q)));
  const opt=(arr,v)=>arr.map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join('');
  return `<div class="chips">${['All',...STAT].map(s=>`<button class="chip ${st.as===s?'on':''}" data-as="${s}">${s} (${s==='All'?ACTS.length:ACTS.filter(a=>a.status===s).length})</button>`).join('')}<span style="flex:1"></span><button class="btn" id="addAct">+ New action</button> <button class="btn ghost" id="resetActs">Reset to demo data</button></div>
  <div class="acts">${list.map(a=>`<div class="act"><div><span class="pill ${a.priority}">${a.priority}</span> <span class="pill">${esc(a.department)}</span> <span class="pill">${a.plant_id?esc(a.plant_id.replace('PLT-','Plant ')):'All plants'}</span> <b style="float:right">${esc(a.action_id)}</b></div><div><b>Issue:</b> ${esc(a.issue)}</div><div class="muted">Indicators: ${esc(String(a.contributing_indicators).replace(/;/g,', '))}${a.insight_id?' · from '+esc(a.insight_id):''}</div><div><b>Action:</b> ${esc(a.action)}</div>
  <div class="r2"><label>Owner<input type="text" data-aid="${a.action_id}" data-f="owner_role" value="${esc(a.owner_role)}"></label><label>Due date<input type="date" data-aid="${a.action_id}" data-f="due_date" value="${esc(a.due_date)}"></label><label>Status<select data-aid="${a.action_id}" data-f="status">${opt(STAT,a.status)}</select></label><label>Priority<select data-aid="${a.action_id}" data-f="priority">${opt(PRI,a.priority)}</select></label></div>
  <label>Notes / investigation findings<textarea data-aid="${a.action_id}" data-f="notes">${esc(a.notes)}</textarea></label><label>Outcome / effectiveness review<textarea data-aid="${a.action_id}" data-f="outcome_review">${esc(a.outcome_review)}</textarea></label></div>`).join('')||'<p class="muted">No actions match.</p>'}</div>`;
}
function sources(){
  const win={'AI4I 2020 Predictive Maintenance':'No timestamps; demo dates 2021-07 to 2022-06','WFS Behaviors & Records':'2021-01-01 to 2022-06-30'}, rows=D.sources.map(s=>({...s,win:win[s.name]||'2021-07-01 to 2022-06-30',status:'Static file loaded at build time'}));
  return `${panel('Connected demo data sources',tbl('ds',[{k:'name',l:'Dataset'},{k:'type',l:'Source type',f:v=>v==='Uploaded Dataset'?UP:SIM},{k:'file',l:'File'},{k:'records',l:'Records',n:1,f:n0},{k:'grain',l:'Grain'},{k:'win',l:'Data window'},{k:'completeness',l:'Completeness (fields used)',f:v=>`<div class="bar"><i style="width:${v}%"></i></div>${nd(v,0)}%`},{k:'status',l:'Integration status'},{k:'note',l:'Notes'}],rows),'','','auto')}`;
}
// ---------- render & events
function render(){
  Object.values(charts).forEach(c=>c.destroy()); for(const k in charts) delete charts[k]; post=[]; document.body.classList.remove('has-full'); INS=computeInsights(); GRP=groupIns(INS);
  document.body.dataset.page=st.page; $('#pgTitle').textContent=PAGES[st.page][0];
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.p===st.page));
  $('#view').innerHTML = {exec,hr,prod,qual,maint,actions,sources}[st.page](); post.forEach(f=>f()); document.querySelectorAll('.chartcard').forEach(applyZoom);
}
$('#nav').innerHTML = Object.entries(PAGES).map(([k,v])=>`<button data-p="${k}">${v[0]}</button>`).join('');
const MS = {plants:{el:'#fPlant',names:PN,all:'All plants',noun:'plants'}, shifts:{el:'#fShift',names:D.shifts,all:'All shifts',noun:'shifts'}};
for(const m of Object.values(MS)){ $(m.el).innerHTML = `<button type="button" class="ms-b" aria-haspopup="true"></button><div class="ms-m" hidden>${m.names.map((n,i)=>`<label><input type="checkbox" value="${i}"> ${esc(n)}</label>`).join('')}<button type="button" class="ms-all">Select all</button></div>`; }
const syncMS = () => { for(const [key,m] of Object.entries(MS)){ const el=$(m.el), sel=st[key]; el.querySelectorAll('input').forEach(i=>i.checked=sel.includes(+i.value));
  el.querySelector('.ms-b').textContent = sel.length===m.names.length ? m.all : sel.length<=2 ? sel.map(i=>m.names[i]).join(' + ') : `${sel.length} of ${m.names.length} ${m.noun}`; } };
for(const [key,m] of Object.entries(MS)){ const el=$(m.el);
  el.querySelector('.ms-b').onclick = e => { const menu=el.querySelector('.ms-m'), was=menu.hidden; document.querySelectorAll('.ms-m').forEach(x=>x.hidden=true); menu.hidden=!was; e.stopPropagation(); };
  el.querySelector('.ms-m').onclick = e => e.stopPropagation();
  el.querySelector('.ms-m').onchange = e => { const v=[...el.querySelectorAll('input:checked')].map(i=>+i.value); if(!v.length){ e.target.checked=true; return; } st[key]=v; syncMS(); render(); };
  el.querySelector('.ms-all').onclick = () => { st[key]=m.names.map((_,i)=>i); syncMS(); render(); }; }
document.addEventListener('click',e=>{ document.querySelectorAll('.ms-m').forEach(x=>x.hidden=true); document.querySelectorAll('.inf[open]').forEach(d=>{ if(!d.contains(e.target)) d.removeAttribute('open'); }); });
for(const id of ['#fFrom','#fTo']){ $(id).min=D.date_min; $(id).max=D.date_max; }
const syncF = () => { syncMS(); $('#fFrom').value=st.from; $('#fTo').value=st.to; }; syncF();
const mobile = () => matchMedia('(max-width:900px)').matches;
const setNav = open => { document.body.classList.toggle('nav-open', open && mobile()); document.body.classList.toggle('nav-collapsed', !open && !mobile()); $('#menu').setAttribute('aria-expanded', open); };
$('#nav').onclick = e => { const b=e.target.closest('button'); if(b){ st.page=b.dataset.p; location.hash=st.page; if(mobile()) setNav(false); render(); window.scrollTo(0,0); } };
$('#menu').onclick = () => setNav(mobile() ? !document.body.classList.contains('nav-open') : document.body.classList.contains('nav-collapsed'));
$('#sideClose').onclick = $('#backdrop').onclick = () => setNav(false);
document.addEventListener('keydown', e => { if(e.key==='Escape'){ if(document.body.classList.contains('nav-open')) setNav(false); closeM(); document.querySelectorAll('.chartcard.full').forEach(c=>c.classList.remove('full')); document.body.classList.remove('has-full'); document.querySelectorAll('.inf[open]').forEach(d=>d.removeAttribute('open')); } });
addEventListener('resize', () => document.body.classList.remove('nav-open','nav-collapsed'));
$('#fFrom').onchange = e => { st.from=e.target.value||D.date_min; if(st.from>st.to) st.to=st.from; syncF(); render(); };
$('#fTo').onchange = e => { st.to=e.target.value||D.date_max; if(st.to<st.from) st.from=st.to; syncF(); render(); };
$('#reset').onclick = () => { Object.assign(st,{plants:[0,1,2,3],shifts:[0,1,2],cmp:'plant',focus:null,view:'a',q:'',zoom:{},sort:{},as:'All',all:false}); [st.from,st.to]=defRange(); $('#search').value=''; syncF(); render(); };
let tmr; $('#search').oninput = e => { clearTimeout(tmr); tmr=setTimeout(()=>{ st.q=e.target.value.trim(); render(); },250); };
const modal = h => { $('#mbox').innerHTML=h; $('#modal').hidden=false; }, closeM = () => $('#modal').hidden=true;
$('#modal').onclick = e => { if(e.target.id==='modal'||e.target.dataset.close!==undefined) closeM(); };
function newAction(o){ const a=Object.assign({action_id:nextId(),insight_id:'',issue:'',plant_id:'',department:'Production',contributing_indicators:'',action:'',owner_role:'',priority:'Medium',due_date:'2022-08-31',status:'Open',notes:'',outcome_review:'Pending',source:'Created in prototype'},o); ACTS.unshift(a); save(); }
$('#view').onclick = e => {
  const zb=e.target.closest('[data-z]'); if(zb){ const card=zb.closest('.chartcard'), id=card.id.slice(3);
    if(zb.dataset.z==='full'){ card.classList.toggle('full'); document.body.classList.toggle('has-full',card.classList.contains('full')); setTimeout(()=>charts[id]&&charts[id].resize(),60); return; }
    const i=ZS.indexOf(st.zoom[id]||1); st.zoom[id]=ZS[Math.max(0,Math.min(ZS.length-1,i+(zb.dataset.z==='in'?1:-1)))]; applyZoom(card); return; }
  const sg=e.target.closest('[data-seg] button'); if(sg){ st[sg.parentNode.dataset.seg]=sg.dataset.v; render(); return; }
  const th=e.target.closest('th[data-t]'); if(th){ const s=st.sort[th.dataset.t]; st.sort[th.dataset.t]={k:th.dataset.k,d:s&&s.k===th.dataset.k?-s.d:1}; render(); return; }
  const ins=e.target.closest('[data-ins]'); if(ins){ const g=GRP.find(x=>x.id===ins.dataset.ins), u=k=>[...new Set(g.items.flatMap(i=>i[k]))], PR=prevRange();
    const li=k=>g.signals.flatMap(s=>s[k].map(t=>`<li><b>${esc(s.metric)}:</b> ${esc(t)}</li>`)).join('');
    modal(`<div class="m-h"><h2>${esc(g.plant)} · ${esc(g.department)}</h2>${g.model?'<span class="tagm">Model</span>':`<span class="pill ${g.severity}">${g.severity} priority</span>`}</div>
      <ul class="finds">${g.items.map(i=>`<li>${esc(i.observation)}</li>`).join('')}</ul>
      <details class="mdet"><summary>Why it matters and how it was flagged</summary>
        <div class="mdb">${g.signals.map(x=>`<div class="sgd ${x.sev}"><div class="sgd-h"><span class="sgd-n">${esc(x.metric)}</span><b class="sgd-v ${x.sev}">${esc(x.val)}</b></div><p class="why">${esc(x.why[0].split(';')[0].replace(/\.$/,'')+'.')}</p><p class="how">Flagged: ${esc(human(x))}</p></div>`).join('')}</div>
      </details>
      <p class="m-meta">Review with ${esc(u('review_by').join(', '))}. Not a confirmed cause until checked on site.</p>
      <div class="row"><button class="btn ghost" data-close>Close</button><button class="btn" id="mkAct" data-i="${g.id}">Create action</button></div>`); return; }
  if(e.target.id==='toggleAll'){ st.all=!st.all; render(); return; }
  const as=e.target.closest('[data-as]'); if(as){ st.as=as.dataset.as; render(); return; }
  if(e.target.id==='resetActs'&&confirm('Reset all actions to the demo seed? Your edits will be lost.')){ ACTS=JSON.parse(JSON.stringify(D.actions)); save(); render(); }
  if(e.target.id==='addAct') modal(`<h2>New action</h2><form id="naf"><label>Issue<input type="text" name="issue" required></label><label>Action<input type="text" name="action" required></label><label>Plant<select name="plant_id"><option value="">All plants</option>${D.plants.map(p=>`<option value="${p.plant_id}">${p.plant_name}</option>`).join('')}</select></label><label>Department<select name="department">${DEPT.map(d=>`<option>${d}</option>`).join('')}</select></label><label>Owner (role)<input type="text" name="owner_role"></label><label>Priority<select name="priority">${PRI.map(d=>`<option>${d}</option>`).join('')}</select></label><label>Due date<input type="date" name="due_date" value="2022-08-31"></label><div class="row"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Add action</button></div></form>`);
};
$('#mbox').onclick = e => { if(e.target.id==='mkAct'){ const g=GRP.find(x=>x.id===e.target.dataset.i), dep=g.department, o=g.items.map(i=>i.observation);
    newAction({insight_id:g.items.map(i=>i.id).join(','),issue:o.slice(0,2).join(' | ')+(o.length>2?` (+${o.length-2} more)`:''),plant_id:g.plant_id||'',department:dep,contributing_indicators:[...new Set(g.items.flatMap(i=>i.indicators))].join(';'),action:'To be defined by '+dep+' after reviewing this finding.',owner_role:{Production:'Production Manager',Quality:'Quality Manager',Maintenance:'Maintenance Manager','HR & Workforce':'HR Business Partner'}[dep],priority:g.severity});
    closeM(); st.page='actions'; st.as='All'; location.hash='actions'; render(); } };
$('#mbox').onsubmit = e => { e.preventDefault(); const f=Object.fromEntries(new FormData(e.target)); newAction(f); closeM(); st.page='actions'; location.hash='actions'; render(); };
$('#view').onchange = e => { const t=e.target; if(t.dataset.focus!==undefined){ st.focus=+t.value; render(); return; } if(t.dataset.viewsel!==undefined){ st.view=t.value; render(); return; } const id=t.dataset.aid; if(!id) return; const a=ACTS.find(x=>x.action_id===id); a[t.dataset.f]=t.value; save(); if(t.dataset.f==='status'||t.dataset.f==='priority') render(); };
window.onhashchange = () => { const p=location.hash.slice(1); if(PAGES[p]&&p!==st.page){ st.page=p; render(); } };
render();
})();
