// ── CONSTANTS ──
const P=0.001,F=0.5;
const CH={
  Channel_F:{name:'FAST',fee:5,cap:2,lat:1,col:'#2563eb',label:'Fast'},
  Channel_S:{name:'STD', fee:1,cap:4,lat:3,col:'#059669',label:'Standard'},
  Channel_B:{name:'BULK',fee:.2,cap:10,lat:10,col:'#7c3aed',label:'Bulk'},
};
const SAMPLE=`tx_id,amount,arrival_time,max_delay,priority\nT1,10000,0,10,5\nT2,500,1,30,2\nT3,2000,2,5,4\nT4,15000,3,2,5\nT5,250,5,60,1\nT6,8000,6,8,4\nT7,1200,7,3,3\nT8,600,7,15,2`;

// ── CHANGE 1: Single place to update if host/port ever changes ──
const API_BASE = 'http://localhost:8000';

let txData=[],result=null,jsonFlowAnim=null,tlAnimId=null;

// ── CHANNEL BARS ──
setTimeout(()=>document.querySelectorAll('.ch-bar').forEach(b=>b.style.width=b.dataset.w+'%'),500);

// ── HERO CANVAS (PAYMENT FLOW) ──
(function(){
  const canvas=document.getElementById('vis-canvas');
  const ctx=canvas.getContext('2d');
  let W,H,particles=[];
  const lanes=[{y:.27,label:'FAST',col:'#2563eb'},{y:.54,label:'STD',col:'#059669'},{y:.80,label:'BULK',col:'#7c3aed'}];
  function resize(){const r=canvas.parentElement.getBoundingClientRect();W=canvas.width=r.width*devicePixelRatio;H=canvas.height=r.height*devicePixelRatio;canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';}
  resize();window.addEventListener('resize',resize);
  function hexA(hex,a){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`rgba(${r},${g},${b},${Math.max(0,Math.min(1,a))})`}
  class Particle{
    constructor(){this.reset(true)}
    reset(init){
      this.lane=Math.floor(Math.random()*3);this.col=lanes[this.lane].col;
      this.ty=lanes[this.lane].y*H;
      this.x=init?Math.random()*W*.75+55*devicePixelRatio:55*devicePixelRatio;
      this.y=H*.5+(Math.random()-.5)*H*.25;
      this.spd=(1.8+Math.random()*2.8)*devicePixelRatio;
      this.r=(2+Math.random()*2.5)*devicePixelRatio;
      this.alpha=init?Math.random()*.85:0;this.phase=init?'travel':'approach';this.trail=[];
    }
    update(){
      this.trail.push({x:this.x,y:this.y,a:this.alpha});if(this.trail.length>16)this.trail.shift();
      if(this.phase==='approach'){this.alpha=Math.min(.9,this.alpha+.05);this.y+=(this.ty-this.y)*.1;this.x+=this.spd;if(this.x>W*.44)this.phase='travel';}
      else if(this.phase==='travel'){this.y+=(this.ty-this.y)*.06;this.x+=this.spd*1.15;if(this.x>W*.83)this.phase='settle';}
      else{this.r*=1.06;this.alpha-=.06;if(this.alpha<=0)this.reset(false);}
    }
    draw(){
      this.trail.forEach((pt,i)=>{const a=(i/this.trail.length)*this.alpha*.18;ctx.beginPath();ctx.arc(pt.x,pt.y,this.r*(i/this.trail.length)*.7,0,Math.PI*2);ctx.fillStyle=hexA(this.col,a);ctx.fill();});
      const g=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.r*4);g.addColorStop(0,hexA(this.col,this.alpha*.3));g.addColorStop(1,'transparent');
      ctx.beginPath();ctx.arc(this.x,this.y,this.r*4,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
      ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.fillStyle=hexA(this.col,this.alpha);ctx.fill();
    }
  }
  for(let i=0;i<16;i++)particles.push(new Particle());
  function frame(){
    ctx.clearRect(0,0,W,H);
    lanes.forEach(l=>{
      const y=l.y*H;
      ctx.beginPath();ctx.moveTo(50*devicePixelRatio,y);ctx.lineTo(W-28*devicePixelRatio,y);
      ctx.strokeStyle=hexA(l.col,.08);ctx.lineWidth=1.5*devicePixelRatio;ctx.setLineDash([4*devicePixelRatio,8*devicePixelRatio]);ctx.stroke();ctx.setLineDash([]);
      ctx.font=`${8.5*devicePixelRatio}px Geist Mono,monospace`;ctx.fillStyle=hexA(l.col,.5);ctx.textAlign='right';ctx.fillText(l.label,44*devicePixelRatio,y+3*devicePixelRatio);
      const nx=W-24*devicePixelRatio;
      const ng=ctx.createRadialGradient(nx,y,0,nx,y,12*devicePixelRatio);ng.addColorStop(0,hexA(l.col,.2));ng.addColorStop(1,'transparent');
      ctx.beginPath();ctx.arc(nx,y,12*devicePixelRatio,0,Math.PI*2);ctx.fillStyle=ng;ctx.fill();
      ctx.beginPath();ctx.arc(nx,y,5*devicePixelRatio,0,Math.PI*2);ctx.fillStyle=hexA(l.col,.6);ctx.fill();
    });
    const sx=52*devicePixelRatio,sy=H*.5;
    const sg=ctx.createRadialGradient(sx,sy,0,sx,sy,18*devicePixelRatio);sg.addColorStop(0,'rgba(37,99,235,.25)');sg.addColorStop(1,'transparent');
    ctx.beginPath();ctx.arc(sx,sy,18*devicePixelRatio,0,Math.PI*2);ctx.fillStyle=sg;ctx.fill();
    ctx.beginPath();ctx.arc(sx,sy,7*devicePixelRatio,0,Math.PI*2);ctx.fillStyle='rgba(37,99,235,.9)';ctx.fill();
    ctx.font=`${8*devicePixelRatio}px Geist Mono,monospace`;ctx.fillStyle='rgba(37,99,235,.6)';ctx.textAlign='center';ctx.fillText('TXN',sx,sy+22*devicePixelRatio);
    particles.forEach(p=>{p.update();p.draw()});
    requestAnimationFrame(frame);
  }
  frame();setInterval(()=>{if(particles.length<20)particles.push(new Particle())},650);
})();

// ── STEP NAV ──
function goTo(n){
  ['step1','step2','step3','step4'].forEach((id,i)=>document.getElementById(id).style.display=i+1===n?'block':'none');
  for(let i=1;i<=4;i++){
    const sn=document.getElementById('sn'+i),sl=document.getElementById('sl'+i);
    if(i<n){sn.className='ws-num done';sn.textContent='✓';sl.className='ws-lbl done'}
    else if(i===n){sn.className='ws-num active';sn.textContent=i;sl.className='ws-lbl active'}
    else{sn.className='ws-num pending';sn.textContent=i;sl.className='ws-lbl pending'}
    if(i<=3)document.getElementById('wl'+i).className='ws-line '+(i<n?'done':'pending');
  }
  window.scrollTo({top:document.querySelector('.wizard').offsetTop-80,behavior:'smooth'});
}

// ── CSV ──
function parseCSV(t){const lines=t.trim().split('\n'),hdr=lines[0].split(',').map(h=>h.trim());return lines.slice(1).map(l=>{const v=l.split(',').map(s=>s.trim()),o={};hdr.forEach((h,i)=>o[h]=v[i]);['amount','arrival_time','max_delay','priority'].forEach(k=>o[k]=+o[k]);return o;}).filter(r=>r.tx_id);}
function loadSample(){txData=parseCSV(SAMPLE);afterLoad('sample')}
function afterLoad(src){
  const n=txData.length,total=txData.reduce((s,t)=>s+t.amount,0);
  document.getElementById('upload-msg').innerHTML=`<div class="notice notice-ok">✓ &nbsp;Loaded <strong>${n} transactions</strong>${src==='sample'?' from sample dataset':''} · Total volume ₹${total.toLocaleString()}</div>`;
  buildStep2();setTimeout(()=>goTo(2),500);
}
document.getElementById('file-inp').addEventListener('change',function(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{txData=parseCSV(ev.target.result);const req=['tx_id','amount','arrival_time','max_delay','priority'];
      if(!req.every(k=>k in(txData[0]||{}))){document.getElementById('upload-msg').innerHTML=`<div class="notice notice-err">⚠ Missing required columns</div>`;return;}
      afterLoad('file');
    }catch(err){document.getElementById('upload-msg').innerHTML=`<div class="notice notice-err">⚠ ${err.message}</div>`}
  };reader.readAsText(file);
});
const ua=document.getElementById('upload-area');
ua.addEventListener('dragover',e=>{e.preventDefault();ua.classList.add('drag')});
ua.addEventListener('dragleave',()=>ua.classList.remove('drag'));
ua.addEventListener('drop',e=>{e.preventDefault();ua.classList.remove('drag');document.getElementById('file-inp').files=e.dataTransfer.files;document.getElementById('file-inp').dispatchEvent(new Event('change'))});

function buildStep2(){
  const total=txData.reduce((s,t)=>s+t.amount,0);
  const avgD=(txData.reduce((s,t)=>s+t.max_delay,0)/txData.length).toFixed(1);
  const hp=txData.filter(t=>t.priority>=4).length;
  document.getElementById('tx-summary').innerHTML=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem">
    <div class="rm rm-fast"><span class="rm-val rm-blue">${txData.length}</span><div class="rm-lbl">Transactions</div></div>
    <div class="rm rm-std"><span class="rm-val rm-green">₹${total.toLocaleString()}</span><div class="rm-lbl">Total Volume</div></div>
    <div class="rm"><span class="rm-val" style="color:var(--amber)">${avgD}m</span><div class="rm-lbl">Avg Max Delay</div></div>
    <div class="rm rm-bulk"><span class="rm-val rm-purple">${hp}</span><div class="rm-lbl">High Priority</div></div>
  </div>`;
  const cols=['tx_id','amount','arrival_time','max_delay','priority'];
  let h=`<table><thead><tr>${cols.map(c=>`<th>${c.replace(/_/g,' ')}</th>`).join('')}</tr></thead><tbody>`;
  txData.forEach(t=>{h+=`<tr>${cols.map(c=>c==='amount'?`<td style="font-family:'Geist Mono',monospace">₹${(+t[c]).toLocaleString()}</td>`:c==='priority'?`<td><span style="font-weight:600;color:${t.priority>=4?'var(--fast)':t.priority>=3?'var(--text2)':'var(--text3)'}">${t[c]}</span></td>`:`<td>${t[c]}</td>`).join('')}</tr>`;});
  document.getElementById('preview-tbl').innerHTML=h+'</tbody></table>';
}

// ── OPTIMIZER ──
function runOptimizer(){
  ['step1','step2','step3','step4'].forEach((id,i)=>document.getElementById(id).style.display=i===2?'block':'none');
  for(let i=1;i<=4;i++){
    const sn=document.getElementById('sn'+i),sl=document.getElementById('sl'+i);
    if(i<3){sn.className='ws-num done';sn.textContent='✓';sl.className='ws-lbl done'}
    else if(i===3){sn.className='ws-num active';sn.textContent='3';sl.className='ws-lbl active'}
    else{sn.className='ws-num pending';sn.textContent=i;sl.className='ws-lbl pending'}
    if(i<=3)document.getElementById('wl'+i).className='ws-line '+(i<3?'done':'pending');
  }
  window.scrollTo({top:document.querySelector('.wizard').offsetTop-80,behavior:'smooth'});
  const stages=[[15,'Parsing transaction manifest'],[30,'Scoring by priority & urgency'],[50,'Simulating channel assignments'],[68,'Resolving capacity conflicts'],[85,'Computing cost estimates'],[100,'Finalizing schedule']];
  let si=0;
  function next(){
    if(si>0){const prev=document.getElementById('stage-'+(si-1));prev.classList.remove('active');prev.classList.add('done');prev.querySelector('.stage-icon').textContent='✓'}
    if(si>=stages.length){setTimeout(()=>{buildResults();goTo(4)},300);return}
    const[pct]=stages[si];
    document.getElementById('stage-'+si).classList.add('active');document.getElementById('stage-'+si).querySelector('.stage-icon').textContent='›';
    document.getElementById('pbar').style.width=pct+'%';document.getElementById('ppct').textContent=pct+'%';
    si++;setTimeout(next,si===stages.length?200:430);
  }

  // ── CHANGE 2: POST /optimize ──
  // Sends CSV as multipart/form-data with key "file"
  // Reads fraud toggle if you add <input type="checkbox" id="fraud-toggle"> in HTML
  const fraudFlag = document.getElementById('fraud-toggle')?.checked ? '?fraud=true' : '';

  const csvRows = [
    'tx_id,amount,arrival_time,max_delay,priority',
    ...txData.map(t=>`${t.tx_id},${t.amount},${t.arrival_time},${t.max_delay},${t.priority}`)
  ].join('\n');
  const formData = new FormData();
  formData.append('file', new Blob([csvRows], {type:'text/csv'}), 'transactions.csv');

  // Do NOT set Content-Type header — browser sets it automatically with multipart boundary
  fetch(`${API_BASE}/optimize${fraudFlag}`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(10000)
  })
  .then(r=>r.json())
  .then(d=>{result=d;next()})
  .catch(()=>{
    // Falls back to local optimizer when API unreachable
    result=localOptimize({
      strategy: 'Priority Score Heuristic',
      priority_weight: 1.0,
      urgency_weight: 1.2,
      allow_graceful_fail: true
    });
    next();
  });
}

function localOptimize(cfg){
  const slots={Channel_F:[],Channel_S:[],Channel_B:[]};
  const sorted=[...txData].sort((a,b)=>{const sa=cfg.priority_weight*a.priority+cfg.urgency_weight*a.amount/(a.max_delay+1);const sb=cfg.priority_weight*b.priority+cfg.urgency_weight*b.amount/(b.max_delay+1);return sb-sa;});
  const asgn=[];let cost=0;
  sorted.forEach(tx=>{
    const deadline=tx.arrival_time+tx.max_delay;let bCh=null,bT=null,bC=Infinity;
    ['Channel_F','Channel_S','Channel_B'].forEach(ch=>{
      const{fee,cap,lat}=CH[ch];if(lat>tx.max_delay)return;
      let t=tx.arrival_time;while(t<=deadline){const active=slots[ch].filter(([s,e])=>s<=t&&t<e).length;if(active<cap)break;t++;}
      if(t>deadline)return;const c=fee+P*tx.amount*(t-tx.arrival_time);if(c<bC){bC=c;bCh=ch;bT=t}
    });
    if(bCh){slots[bCh].push([bT,bT+CH[bCh].lat]);cost+=bC;asgn.push({tx_id:tx.tx_id,channel_id:bCh,start_time:bT})}
    else if(cfg.allow_graceful_fail){cost+=F*tx.amount;asgn.push({tx_id:tx.tx_id,channel_id:null,start_time:null,failed:true})}
    else{slots['Channel_F'].push([tx.arrival_time,tx.arrival_time+1]);cost+=5;asgn.push({tx_id:tx.tx_id,channel_id:'Channel_F',start_time:tx.arrival_time})}
  });
  const nf=asgn.filter(a=>a.failed).length;
  return{assignments:asgn,total_system_cost_estimate:Math.round(cost*100)/100,summary:{total:asgn.length,successful:asgn.length-nf,failed:nf}};
}

// ── CHANGE 3: GET /results — re-fetch last result without re-uploading ──
// Call this from a "Re-fetch Results" button: onclick="refetchResults()"
function refetchResults(){
  fetch(`${API_BASE}/results`, {signal:AbortSignal.timeout(5000)})
    .then(r=>r.json())
    .then(d=>{
      if(d.error){alert('No results yet. Run the optimizer first.');return;}
      result=d;
      buildResults();
      goTo(4);
    })
    .catch(()=>alert('Could not reach API. Make sure the backend is running.'));
}

// ── ANIMATED COUNTER ──
function animCount(el,target,pre='',suf='',dec=0,dur=1000){
  const start=performance.now();
  (function step(now){const p=Math.min(1,(now-start)/dur),e=1-Math.pow(1-p,3),v=target*e;el.textContent=pre+(dec>0?v.toFixed(dec):Math.round(v))+suf;if(p<1)requestAnimationFrame(step);})(start);
}

// ── BUILD RESULTS ──
function buildResults(){
  const asgn=result.assignments,cost=result.total_system_cost_estimate;
  const nS=asgn.filter(a=>!a.failed).length,nF=asgn.filter(a=>a.failed).length;
  const cc={Channel_F:0,Channel_S:0,Channel_B:0};
  asgn.filter(a=>!a.failed&&a.channel_id).forEach(a=>cc[a.channel_id]=(cc[a.channel_id]||0)+1);

  const costEl=document.getElementById('rcost');costEl.textContent='₹0.00';
  setTimeout(()=>animCount(costEl,cost,'₹','',2,1400),300);
  document.getElementById('rcost-sub').textContent=`${nS} settled successfully · ${nF} failed · ${asgn.length} total`;

  document.getElementById('res-metrics').innerHTML=`
    <div class="rm rm-fast"><span class="rm-val rm-blue" id="mc-f">0</span><div class="rm-lbl">⚡ Fast</div></div>
    <div class="rm rm-std"><span class="rm-val rm-green" id="mc-s">0</span><div class="rm-lbl">⚙ Standard</div></div>
    <div class="rm rm-bulk"><span class="rm-val rm-purple" id="mc-b">0</span><div class="rm-lbl">📦 Bulk</div></div>
    <div class="rm rm-failed"><span class="rm-val rm-red" id="mc-fail">0</span><div class="rm-lbl">✗ Failed</div></div>`;
  setTimeout(()=>{animCount(document.getElementById('mc-f'),cc.Channel_F,'','',0,700);animCount(document.getElementById('mc-s'),cc.Channel_S,'','',0,700);animCount(document.getElementById('mc-b'),cc.Channel_B,'','',0,700);animCount(document.getElementById('mc-fail'),nF,'','',0,700);},500);

  const txMap={};txData.forEach(t=>txMap[t.tx_id]=t);
  let h=`<table><thead><tr><th>TX ID</th><th>Amount</th><th>Priority</th><th>Channel</th><th>Start Time</th><th>Delay</th><th>Delay Penalty</th></tr></thead><tbody>`;
  asgn.forEach((a,idx)=>{
    // Use fields embedded by main.py in the assignment; fall back to local txData
    const tx=txMap[a.tx_id]||{};
    const amount=a.amount??tx.amount??0;
    const arrival_time=a.arrival_time??tx.arrival_time??null;
    const priority=a.priority??tx.priority??null;
    const delay=a.failed?null:(arrival_time!=null?a.start_time-arrival_time:null);
    const pen=a.failed?null:(delay!=null?P*amount*delay:null);
    const tag=a.failed?'<span class="ch-tag ct-fail">Failed</span>':a.channel_id==='Channel_F'?'<span class="ch-tag ct-fast">Fast</span>':a.channel_id==='Channel_S'?'<span class="ch-tag ct-std">Std</span>':'<span class="ch-tag ct-bulk">Bulk</span>';
    h+=`<tr style="animation-delay:${idx*55}ms"><td style="font-family:'Geist Mono',monospace;font-size:.78rem;font-weight:500;color:var(--text)">${a.tx_id}</td><td style="font-family:'Geist Mono',monospace">₹${(+amount).toLocaleString()}</td><td><span style="font-weight:700;color:${priority>=4?'var(--fast)':priority>=3?'var(--text2)':'var(--text3)'}">${priority??'—'}</span></td><td>${tag}</td><td style="font-family:'Geist Mono',monospace;color:var(--text2)">${a.start_time??'—'}</td><td style="color:${delay>0?'var(--amber)':'var(--std)'};font-weight:500">${delay===null?'—':delay===0?'—':delay+'m'}</td><td style="font-family:'Geist Mono',monospace;color:var(--text3)">${pen===null?'—':pen===0?'₹0.00':'₹'+pen.toFixed(2)}</td></tr>`;
  });
  document.getElementById('res-table').innerHTML=h+'</tbody></table>';

  // ── CHANGE 4: GET /download-submission — dl-json points to backend endpoint ──
  // Backend must set: Content-Disposition: attachment; filename="submission.json"
  const dlJson = document.getElementById('dl-json');
  dlJson.href = `${API_BASE}/download-submission`;
  dlJson.download = 'submission.json';

  // CSV downloads stay local (built from in-memory result data)
  let csv='tx_id,channel_id,start_time,failed\n';asgn.forEach(a=>csv+=`${a.tx_id},${a.channel_id??''},${a.start_time??''},${a.failed??false}\n`);
  document.getElementById('dl-csv').href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  document.getElementById('dl-txcsv').href=URL.createObjectURL(new Blob([SAMPLE],{type:'text/csv'}));

  buildAnalytics(asgn,cost,cc,nF,txMap);
  buildJSONFlow(result);
}

// ── ANALYTICS ──
function buildAnalytics(asgn,cost,cc,nF,txMap){
  buildDonutCanvas(cc,nF);
  buildCostRings(asgn,cost,nF,txMap);
  buildTimelineCanvas(asgn);
}

// DONUT — canvas based animated
function buildDonutCanvas(cc,nF){
  const canvas=document.getElementById('donut-canvas');
  const ctx=canvas.getContext('2d');
  const DPR=devicePixelRatio||1;canvas.width=140*DPR;canvas.height=140*DPR;canvas.style.width='140px';canvas.style.height='140px';ctx.scale(DPR,DPR);
  const data=[{label:'Fast',count:cc.Channel_F,col:'#4f8fff'},{label:'Standard',count:cc.Channel_S,col:'#34d399'},{label:'Bulk',count:cc.Channel_B,col:'#a78bfa'},{label:'Failed',count:nF,col:'#f87171'}].filter(d=>d.count>0);
  const total=data.reduce((s,d)=>s+d.count,0);
  const cx=70,cy=70,R=58,ri=38;
  let startT=null;const dur=900;
  function drawDonut(progress){
    ctx.clearRect(0,0,140,140);
    let ang=-Math.PI/2;
    data.forEach(d=>{
      const targetSlice=(d.count/total)*Math.PI*2;
      const slice=targetSlice*progress;
      ctx.beginPath();ctx.moveTo(cx+ri*Math.cos(ang),cy+ri*Math.sin(ang));
      ctx.lineTo(cx+R*Math.cos(ang),cy+R*Math.sin(ang));
      ctx.arc(cx,cy,R,ang,ang+slice);
      ctx.lineTo(cx+ri*Math.cos(ang+slice),cy+ri*Math.sin(ang+slice));
      ctx.arc(cx,cy,ri,ang+slice,ang,-1);
      ctx.closePath();
      // Glow
      ctx.shadowColor=d.col;ctx.shadowBlur=12*progress;
      ctx.fillStyle=d.col;ctx.globalAlpha=.9*progress;ctx.fill();
      ctx.shadowBlur=0;ctx.globalAlpha=1;
      ang+=targetSlice;
    });
    // Center text
    ctx.globalAlpha=progress;
    ctx.textAlign='center';ctx.fillStyle='#1a2042';
    ctx.font=`700 ${18}px Geist Mono,monospace`;ctx.fillText(total,cx,cy+6);
    ctx.font=`400 ${9}px Geist,sans-serif`;ctx.fillStyle='#7a88b8';ctx.fillText('total',cx,cy+18);
    ctx.globalAlpha=1;
  }
  function animate(ts){if(!startT)startT=ts;const p=Math.min(1,(ts-startT)/dur);const ease=1-Math.pow(1-p,3);drawDonut(ease);if(p<1)requestAnimationFrame(animate);}
  requestAnimationFrame(animate);
  // Legend
  let leg='';
  data.forEach((d,i)=>{const pct=Math.round(d.count/total*100);leg+=`<div class="legend-item" style="animation:fadeUp .3s ${i*80+400}ms ease both;opacity:0"><div class="legend-dot" style="background:${d.col};box-shadow:0 0 8px ${d.col}40"></div><span>${d.label}</span><span style="margin-left:auto;font-family:'Geist Mono',monospace;font-size:.76rem;color:var(--text);font-weight:500">${d.count} <span style="color:var(--text4)">${pct}%</span></span></div>`;});
  document.getElementById('donut-legend').innerHTML=leg;
}

// COST RINGS — animated concentric rings
function buildCostRings(asgn,cost,nF,txMap){
  const canvas=document.getElementById('cost-rings-canvas');
  const ctx=canvas.getContext('2d');
  const DPR=devicePixelRatio||1;canvas.width=160*DPR;canvas.height=160*DPR;canvas.style.width='160px';canvas.style.height='160px';ctx.scale(DPR,DPR);
  // Read breakdown using exact keys from optimizer.py cost_breakdown():
  //   fee_cost, delay_penalty, failure_penalty
  // Fall back to local recalculation only when backend breakdown absent (local mode)
  let fees,delayP,failP;
  if(result&&result.breakdown){
    fees  =result.breakdown.fee_cost;
    delayP=result.breakdown.delay_penalty;
    failP =result.breakdown.failure_penalty;
  } else {
    const _txMap={};txData.forEach(t=>_txMap[t.tx_id]=t);
    fees  =asgn.filter(a=>!a.failed&&a.channel_id).reduce((s,a)=>s+CH[a.channel_id].fee,0);
    failP =nF>0?asgn.filter(a=>a.failed).reduce((s,a)=>s+F*((a.amount??_txMap[a.tx_id]?.amount)||0),0):0;
    delayP=Math.max(0,Math.round((cost-fees-failP)*100)/100);
  }
  const rings=[
    {label:'Channel Fees',icon:'💳',val:fees,col:'#4f8fff',R:62,ri:48,desc:'Flat fee per tx'},
    {label:'Delay Penalty',icon:'⏱',val:delayP,col:'#fbbf24',R:44,ri:32,desc:'Waiting cost'},
    {label:'Fail Penalty',icon:'⚠',val:failP,col:'#f87171',R:26,ri:14,desc:'Failed tx cost'},
  ];
  const maxVal=Math.max(...rings.map(r=>r.val),0.01);
  const cx=80,cy=80;
  let startT=null;const dur=1100;
  function drawRings(progress){
    ctx.clearRect(0,0,160,160);
    // Background rings
    rings.forEach(r=>{
      ctx.beginPath();ctx.arc(cx,cy,r.R,0,Math.PI*2);
      ctx.strokeStyle=`${r.col}18`;ctx.lineWidth=r.R-r.ri;ctx.stroke();
    });
    // Filled arcs
    rings.forEach(r=>{
      const pct=Math.min(r.val/maxVal,1);const arc=pct*Math.PI*2*progress;
      if(arc<0.01)return;
      ctx.save();ctx.lineCap='round';
      ctx.beginPath();ctx.arc(cx,cy,(r.R+r.ri)/2,-Math.PI/2,-Math.PI/2+arc);
      ctx.strokeStyle=r.col;ctx.lineWidth=r.R-r.ri-2;
      ctx.shadowColor=r.col;ctx.shadowBlur=10*progress;ctx.stroke();
      ctx.restore();
      // End dot
      if(arc>0.1){
        const ex=cx+((r.R+r.ri)/2)*Math.cos(-Math.PI/2+arc);const ey=cy+((r.R+r.ri)/2)*Math.sin(-Math.PI/2+arc);
        ctx.beginPath();ctx.arc(ex,ey,(r.R-r.ri)/2,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
      }
    });
    // Center
    ctx.globalAlpha=progress;ctx.textAlign='center';ctx.fillStyle='#1a2042';
    ctx.font=`700 14px Geist Mono,monospace`;ctx.fillText('₹'+(cost*progress).toFixed(2),cx,cy+5);
    ctx.font=`400 8px Geist,sans-serif`;ctx.fillStyle='#7a88b8';ctx.fillText('total',cx,cy+16);
    ctx.globalAlpha=1;
  }
  function animate(ts){if(!startT)startT=ts;const p=Math.min(1,(ts-startT)/dur);const ease=1-Math.pow(1-p,4);drawRings(ease);if(p<1)requestAnimationFrame(animate);}
  requestAnimationFrame(animate);
  // Ring legend
  let leg='';
  rings.forEach((r,i)=>{const pct=cost>0?Math.round(r.val/cost*100):0;leg+=`<div class="cr-item" style="animation:fadeUp .3s ${i*100+500}ms ease both;opacity:0"><div class="cr-swatch" style="background:${r.col}18;border:1px solid ${r.col}30">${r.icon}</div><div class="cr-info"><div class="cr-label">${r.label}</div><div class="cr-sub">${r.desc}</div></div><div style="text-align:right"><div class="cr-val" id="crv-${i}">₹0.00</div><div class="cr-pct">${pct}% of total</div></div></div>`;});
  document.getElementById('cost-ring-legend').innerHTML=leg;
  setTimeout(()=>rings.forEach((r,i)=>animCount(document.getElementById('crv-'+i),r.val,'₹','',2,900)),550);
}

// TIMELINE — canvas animated
function buildTimelineCanvas(asgn){
  const canvas=document.getElementById('tl-canvas');
  const ctx=canvas.getContext('2d');
  const DPR=devicePixelRatio||1;
  const W=canvas.parentElement.clientWidth||800,H=160;
  canvas.width=W*DPR;canvas.height=H*DPR;canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.scale(DPR,DPR);
  const active=asgn.filter(a=>!a.failed&&a.start_time!=null);
  const maxT=Math.max(active.reduce((m,a)=>Math.max(m,a.start_time+(CH[a.channel_id]?.lat||0)),10),10);
  const padL=72,padR=20,padT=18,trackH=22;
  const chKeys=['Channel_F','Channel_S','Channel_B'],chY={Channel_F:padT+trackH*.5,Channel_S:padT+trackH*1.9,Channel_B:padT+trackH*3.3};
  const scX=t=>padL+(t/maxT)*(W-padL-padR);
  let startT=null;const dur=1200;
  if(tlAnimId)cancelAnimationFrame(tlAnimId);
  function draw(progress){
    ctx.clearRect(0,0,W,H);
    // Grid
    for(let t=0;t<=maxT;t+=Math.max(1,Math.round(maxT/8))){
      const x=scX(t);ctx.beginPath();ctx.moveTo(x,padT-6);ctx.lineTo(x,H-16);
      ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;ctx.stroke();
      ctx.font='8px Geist Mono,monospace';ctx.fillStyle='rgba(255,255,255,.18)';ctx.textAlign='center';ctx.fillText(t+'m',x,H-4);
    }
    // Lane rows
    chKeys.forEach(ch=>{
      const c=CH[ch],y=chY[ch];
      ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);
      ctx.strokeStyle=c.col+'20';ctx.lineWidth=trackH;ctx.stroke();
      ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);
      ctx.setLineDash([3,6]);ctx.strokeStyle=c.col+'40';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
      ctx.font='bold 8px Geist Mono,monospace';ctx.fillStyle=c.col+'90';ctx.textAlign='right';ctx.fillText(c.name,padL-6,y+3);
    });
    // Bars
    active.forEach(a=>{
      const c=CH[a.channel_id],y=chY[a.channel_id];
      const x1=scX(a.start_time),x2=scX(a.start_time+c.lat);
      const w=Math.max(4,(x2-x1)*progress);
      // Bar glow
      ctx.save();ctx.shadowColor=c.col;ctx.shadowBlur=8;
      const grad=ctx.createLinearGradient(x1,0,x1+w,0);grad.addColorStop(0,c.col+'dd');grad.addColorStop(1,c.col+'aa');
      ctx.beginPath();ctx.roundRect(x1,y-9,w,18,4);ctx.fillStyle=grad;ctx.fill();ctx.restore();
      // Label
      if(w>22&&progress>.7){ctx.globalAlpha=Math.max(0,(progress-.7)/.3);ctx.font='bold 7.5px Geist,sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(a.tx_id,x1+w/2,y+3);ctx.globalAlpha=1;}
    });
    // Now cursor
    const nowX=scX(maxT*progress);
    ctx.beginPath();ctx.moveTo(nowX,padT-8);ctx.lineTo(nowX,H-16);
    ctx.strokeStyle='rgba(79,143,255,.5)';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(nowX,padT-8,3,0,Math.PI*2);ctx.fillStyle='#4f8fff';ctx.fill();
  }
  function animate(ts){if(!startT)startT=ts;const p=Math.min(1,(ts-startT)/dur);const ease=1-Math.pow(1-p,2.5);draw(ease);if(p<1)tlAnimId=requestAnimationFrame(animate);}
  tlAnimId=requestAnimationFrame(animate);
}

// ── JSON FLOW CANVAS — Transaction Timeline Visualization ──
function buildJSONFlow(data){
  const canvas=document.getElementById('json-canvas');
  const ctx=canvas.getContext('2d');
  const wrap=canvas.parentElement;
  const DPR=devicePixelRatio||1;
  let W=wrap.clientWidth||400,H=wrap.clientHeight||420;
  canvas.width=W*DPR;canvas.height=H*DPR;canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.scale(DPR,DPR);

  // Populate JSON text panel
  const jsonStr=JSON.stringify(data,null,2);
  const lines=jsonStr.split('\n');
  let html='';
  lines.forEach((line,i)=>{html+=`<div class="jl" style="animation-delay:${i*22}ms"><span class="jln">${i+1}</span><span>${colorJSON(line)}</span></div>`;});
  document.getElementById('json-text-panel').innerHTML=html;

  if(jsonFlowAnim)cancelAnimationFrame(jsonFlowAnim);

  const asgn=(data.assignments||[]).filter(a=>!a.failed&&a.channel_id!=null&&a.start_time!=null);
  if(!asgn.length)return;

  // Channel config
  const CHANNELS={
    Channel_F:{label:'FAST',col:'#4f8fff',lat:1},
    Channel_S:{label:'STD', col:'#34d399',lat:3},
    Channel_B:{label:'BULK',col:'#a78bfa',lat:10},
  };
  const chKeys=['Channel_F','Channel_S','Channel_B'];

  // Layout
  const padL=64,padR=32,padT=36,padB=36;
  const laneCount=chKeys.length;
  const laneH=(H-padT-padB)/laneCount;
  const chY={};
  chKeys.forEach((k,i)=>chY[k]=padT+i*laneH+laneH/2);

  const maxT=Math.max(...asgn.map(a=>a.start_time+(CHANNELS[a.channel_id]?.lat||1)),10)+1;
  const scX=t=>padL+(t/maxT)*(W-padL-padR);

  function hexA(hex,a){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`rgba(${r},${g},${b},${Math.max(0,Math.min(1,a))})`;}

  // Build per-tx particle state: each tx is a moving dot along its channel lane
  const txParticles=asgn.map(a=>{
    const ch=CHANNELS[a.channel_id];
    const x0=scX(a.start_time);
    const x1=scX(a.start_time+ch.lat);
    const y=chY[a.channel_id];
    return{a,ch,x0,x1,y,progress:0,trail:[],settled:false,settlePulse:0};
  });

  // Stagger starts by start_time so they don't all launch at once
  const animDur=3200; // total loop ms
  let animStart=null;
  const loopDur=animDur;

  // Steady-state ambient particles per channel (background flow)
  class AmbientParticle{
    constructor(chKey){
      this.chKey=chKey;this.ch=CHANNELS[chKey];this.y=chY[chKey];
      this.reset(true);
    }
    reset(init){
      this.x=init?Math.random()*W:padL;
      this.spd=0.6+Math.random()*0.8;
      this.r=1.2+Math.random()*1.2;
      this.alpha=init?Math.random()*0.18:0;
      this.phase='live';
    }
    update(){
      if(this.phase==='live'){
        this.alpha=Math.min(0.18,this.alpha+0.02);
        this.x+=this.spd;
        if(this.x>W-padR+10)this.reset(false);
      }
    }
    draw(){
      ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
      ctx.fillStyle=hexA(this.ch.col,this.alpha);ctx.fill();
    }
  }
  const ambient=[];
  chKeys.forEach(k=>{for(let i=0;i<6;i++)ambient.push(new AmbientParticle(k));});

  function frame(ts){
    if(!animStart)animStart=ts;
    const elapsed=(ts-animStart)%loopDur;
    const globalP=elapsed/loopDur; // 0→1 over loop

    ctx.clearRect(0,0,W,H);

    // ── Background: time axis ──
    const tickStep=Math.max(1,Math.round(maxT/8));
    for(let t=0;t<=maxT;t+=tickStep){
      const x=scX(t);
      ctx.beginPath();ctx.moveTo(x,padT-10);ctx.lineTo(x,H-padB+8);
      ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;ctx.stroke();
      ctx.font=`9px Geist Mono,monospace`;ctx.fillStyle='rgba(255,255,255,0.2)';ctx.textAlign='center';
      ctx.fillText(t+'m',x,H-padB+20);
    }
    // Axis label
    ctx.font=`9px Geist,sans-serif`;ctx.fillStyle='rgba(255,255,255,0.18)';ctx.textAlign='center';
    ctx.fillText('time (minutes)',W/2,H-4);

    // ── Channel lanes ──
    chKeys.forEach(chKey=>{
      const ch=CHANNELS[chKey];const y=chY[chKey];
      // Lane band
      ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);
      ctx.strokeStyle=hexA(ch.col,0.07);ctx.lineWidth=laneH*0.82;ctx.stroke();
      // Lane centre line
      ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);
      ctx.setLineDash([4,8]);ctx.strokeStyle=hexA(ch.col,0.18);ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
      // Label
      ctx.font=`bold 9px Geist Mono,monospace`;ctx.fillStyle=hexA(ch.col,0.65);ctx.textAlign='right';
      ctx.fillText(ch.label,padL-8,y+3);
    });

    // ── Ambient drift particles ──
    ambient.forEach(p=>{p.update();p.draw();});

    // ── Transaction particles ──
    // Map start_time to a normalised launch offset within the loop
    const tMin=Math.min(...asgn.map(a=>a.start_time));
    const tMax=maxT;

    txParticles.forEach((tp,idx)=>{
      const launchAt=(tp.a.start_time-tMin)/(tMax||1); // 0→1 within loop
      const arriveAt=launchAt+(tp.ch.lat/tMax);
      // Local progress within this tx window
      let lp;
      if(globalP<launchAt){lp=0;}
      else if(globalP<arriveAt){lp=(globalP-launchAt)/Math.max(arriveAt-launchAt,0.01);}
      else{lp=1;}

      const x=tp.x0+(tp.x1-tp.x0)*lp;
      const y=tp.y;
      const col=tp.ch.col;

      // Trail
      tp.trail.push({x,y});if(tp.trail.length>20)tp.trail.shift();
      tp.trail.forEach((pt,i)=>{
        const ta=(i/tp.trail.length)*0.35*Math.min(lp*6,1);
        ctx.beginPath();ctx.arc(pt.x,pt.y,2.5*(i/tp.trail.length),0,Math.PI*2);
        ctx.fillStyle=hexA(col,ta);ctx.fill();
      });

      if(lp===0)return; // not launched yet

      const alpha=lp<1?0.92:0.6+0.4*Math.sin(ts*0.004+idx);
      const r=lp<1?4.5:3.5;

      // Glow
      const g=ctx.createRadialGradient(x,y,0,x,y,r*4);
      g.addColorStop(0,hexA(col,alpha*0.35));g.addColorStop(1,'transparent');
      ctx.beginPath();ctx.arc(x,y,r*4,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();

      // Core
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fillStyle=hexA(col,alpha);ctx.fill();
      ctx.beginPath();ctx.arc(x,y,r*0.45,0,Math.PI*2);
      ctx.fillStyle=hexA('#ffffff',alpha*0.7);ctx.fill();

      // Settled pulse ring
      if(lp>=1){
        const pulse=(Math.sin(ts*0.004+idx)*0.5+0.5);
        ctx.beginPath();ctx.arc(x,y,r+4+pulse*4,0,Math.PI*2);
        ctx.strokeStyle=hexA(col,0.25*(1-pulse));ctx.lineWidth=1.5;ctx.stroke();
      }

      // TX label
      const labelAlpha=lp>0.15?Math.min(1,(lp-0.15)/0.15):0;
      if(labelAlpha>0.01){
        ctx.globalAlpha=labelAlpha;
        ctx.font=`bold 8px Geist Mono,monospace`;ctx.fillStyle=col;ctx.textAlign='center';
        ctx.fillText(tp.a.tx_id,x,y-r-4);
        ctx.globalAlpha=1;
      }

      // Progress bar beneath particle while in flight
      if(lp>0&&lp<1){
        const bw=tp.x1-tp.x0;
        ctx.beginPath();ctx.roundRect(tp.x0,y+laneH*0.38,bw,2,1);
        ctx.fillStyle=hexA(col,0.12);ctx.fill();
        ctx.beginPath();ctx.roundRect(tp.x0,y+laneH*0.38,bw*lp,2,1);
        ctx.fillStyle=hexA(col,0.45);ctx.fill();
      }
    });

    // ── "NOW" cursor ──
    const nowX=scX(globalP*tMax);
    ctx.beginPath();ctx.moveTo(nowX,padT-12);ctx.lineTo(nowX,H-padB+6);
    ctx.setLineDash([3,5]);ctx.strokeStyle='rgba(79,143,255,0.4)';ctx.lineWidth=1.2;ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(nowX,padT-12,3.5,0,Math.PI*2);ctx.fillStyle='#4f8fff';ctx.fill();
    ctx.font=`8px Geist Mono,monospace`;ctx.fillStyle='rgba(79,143,255,0.55)';ctx.textAlign='center';
    ctx.fillText((globalP*tMax).toFixed(1)+'m',nowX,padT-20);

    jsonFlowAnim=requestAnimationFrame(frame);
  }
  jsonFlowAnim=requestAnimationFrame(frame);

}

function colorJSON(line){
  return line.replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/"([^"]+)"(\s*:)/g,'<span class="jk">"$1"</span>$2')
    .replace(/:\s*"([^"]*)"/g,(m,v)=>m.replace(`"${v}"`,'<span class="js">"'+v+'"</span>'))
    .replace(/:\s*(-?\d+\.?\d*)/g,(m,v)=>m.replace(v,'<span class="jn">'+v+'</span>'))
    .replace(/:\s*(true|false)/g,(m,v)=>m.replace(v,'<span class="jb">'+v+'</span>'))
    .replace(/:\s*(null)/g,'<span class="jnull">null</span>')
    .replace(/([{}\[\]])/g,'<span class="jbr">$1</span>');
}

function copyJSON(){
  navigator.clipboard.writeText(JSON.stringify(result,null,2)).then(()=>{
    const btn=document.getElementById('copy-btn');btn.textContent='✓ Copied!';btn.style.color='var(--green)';
    setTimeout(()=>{btn.textContent='Copy JSON';btn.style.color='';},2000);
  });
}

function showTab(id,btn){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');btn.classList.add('active');
  if(id==='analytics'&&result){
    const asgn=result.assignments,cost=result.total_system_cost_estimate,nF=asgn.filter(a=>a.failed).length;
    const cc={Channel_F:0,Channel_S:0,Channel_B:0};asgn.filter(a=>!a.failed&&a.channel_id).forEach(a=>cc[a.channel_id]=(cc[a.channel_id]||0)+1);
    const txMap={};txData.forEach(t=>txMap[t.tx_id]=t);
    setTimeout(()=>{buildDonutCanvas(cc,nF);buildCostRings(asgn,cost,nF,txMap);buildTimelineCanvas(asgn);},50);
  }
  if(id==='json'&&result)setTimeout(()=>buildJSONFlow(result),50);
}

function resetAll(){
  if(jsonFlowAnim)cancelAnimationFrame(jsonFlowAnim);
  if(tlAnimId)cancelAnimationFrame(tlAnimId);
  txData=[];result=null;
  document.getElementById('upload-msg').innerHTML='';document.getElementById('file-inp').value='';
  goTo(1);
}

// ── CHANGE 5: GET /health — now uses API_BASE constant ──
function checkApi(){
  fetch(`${API_BASE}/health`,{signal:AbortSignal.timeout(2000)})
    .then(()=>{document.getElementById('api-dot').className='api-dot ok';document.getElementById('api-txt').textContent='API Connected'})
    .catch(()=>{document.getElementById('api-dot').className='api-dot warn';document.getElementById('api-txt').textContent='Local mode'});
}
setTimeout(checkApi,1000);setInterval(checkApi,12000);