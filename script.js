// ── CONSTANTS ──
const P=0.001,F=0.5;
const CH={
  Channel_F:{name:'FAST',fee:5,cap:2,lat:1,col:'#4f8fff',label:'Fast'},
  Channel_S:{name:'STD', fee:1,cap:4,lat:3,col:'#34d399',label:'Standard'},
  Channel_B:{name:'BULK',fee:.2,cap:10,lat:10,col:'#a78bfa',label:'Bulk'},
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
  const lanes=[{y:.27,label:'FAST',col:'#4f8fff'},{y:.54,label:'STD',col:'#34d399'},{y:.80,label:'BULK',col:'#a78bfa'}];
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
    const sg=ctx.createRadialGradient(sx,sy,0,sx,sy,18*devicePixelRatio);sg.addColorStop(0,'rgba(79,143,255,.2)');sg.addColorStop(1,'transparent');
    ctx.beginPath();ctx.arc(sx,sy,18*devicePixelRatio,0,Math.PI*2);ctx.fillStyle=sg;ctx.fill();
    ctx.beginPath();ctx.arc(sx,sy,7*devicePixelRatio,0,Math.PI*2);ctx.fillStyle='rgba(79,143,255,.8)';ctx.fill();
    ctx.font=`${8*devicePixelRatio}px Geist Mono,monospace`;ctx.fillStyle='rgba(79,143,255,.5)';ctx.textAlign='center';ctx.fillText('TXN',sx,sy+22*devicePixelRatio);
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
      strategy: document.getElementById('strategy').value,
      priority_weight: +document.getElementById('pw-range').value,
      urgency_weight: +document.getElementById('uw-range').value,
      allow_graceful_fail: document.getElementById('grace').checked
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
    const tx=txMap[a.tx_id]||{};const delay=a.failed?null:a.start_time-tx.arrival_time;const pen=a.failed?null:P*tx.amount*delay;
    const tag=a.failed?'<span class="ch-tag ct-fail">Failed</span>':a.channel_id==='Channel_F'?'<span class="ch-tag ct-fast">Fast</span>':a.channel_id==='Channel_S'?'<span class="ch-tag ct-std">Std</span>':'<span class="ch-tag ct-bulk">Bulk</span>';
    h+=`<tr style="animation-delay:${idx*55}ms"><td style="font-family:'Geist Mono',monospace;font-size:.78rem;font-weight:500;color:var(--text)">${a.tx_id}</td><td style="font-family:'Geist Mono',monospace">₹${(tx.amount||0).toLocaleString()}</td><td><span style="font-weight:700;color:${tx.priority>=4?'var(--fast)':tx.priority>=3?'var(--text2)':'var(--text3)'}">${tx.priority??'—'}</span></td><td>${tag}</td><td style="font-family:'Geist Mono',monospace;color:var(--text2)">${a.start_time??'—'}</td><td style="color:${delay>0?'var(--amber)':'var(--std)'};font-weight:500">${delay===null?'—':delay===0?'—':delay+'m'}</td><td style="font-family:'Geist Mono',monospace;color:var(--text3)">${pen===null?'—':pen===0?'₹0.00':'₹'+pen.toFixed(2)}</td></tr>`;
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
    ctx.textAlign='center';ctx.fillStyle='#e8eaf0';
    ctx.font=`700 ${18}px Geist Mono,monospace`;ctx.fillText(total,cx,cy+6);
    ctx.font=`400 ${9}px Geist,sans-serif`;ctx.fillStyle='#5a6280';ctx.fillText('total',cx,cy+18);
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
  const fees=asgn.filter(a=>!a.failed&&a.channel_id).reduce((s,a)=>s+CH[a.channel_id].fee,0);
  const failP=nF>0?asgn.filter(a=>a.failed).reduce((s,a)=>s+F*(txMap[a.tx_id]?.amount||0),0):0;
  const delayP=Math.max(0,Math.round((cost-fees-failP)*100)/100);
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
    ctx.globalAlpha=progress;ctx.textAlign='center';ctx.fillStyle='#e8eaf0';
    ctx.font=`700 14px Geist Mono,monospace`;ctx.fillText('₹'+(cost*progress).toFixed(2),cx,cy+5);
    ctx.font=`400 8px Geist,sans-serif`;ctx.fillStyle='#5a6280';ctx.fillText('total',cx,cy+16);
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

// ── JSON FLOW CANVAS ── 
function buildJSONFlow(data){
  const canvas=document.getElementById('json-canvas');
  const ctx=canvas.getContext('2d');
  const wrap=canvas.parentElement;
  const DPR=devicePixelRatio||1;
  let W=wrap.clientWidth||400,H=wrap.clientHeight||420;
  canvas.width=W*DPR;canvas.height=H*DPR;canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.scale(DPR,DPR);

  const jsonStr=JSON.stringify(data,null,2);
  const lines=jsonStr.split('\n');

  // Populate text panel with staggered lines
  let html='';
  lines.forEach((line,i)=>{html+=`<div class="jl" style="animation-delay:${i*22}ms"><span class="jln">${i+1}</span><span>${colorJSON(line)}</span></div>`;});
  document.getElementById('json-text-panel').innerHTML=html;

  // Canvas: particles flow from left (JSON source) to right (field nodes)
  const fields=Object.keys(data).filter(k=>typeof data[k]!=='object'||data[k]===null);
  const arrLen=data.assignments?data.assignments.length:0;
  const nodes=[];
  // Main nodes
  const mainKeys=['total_system_cost_estimate','assignments'];
  const extraKeys=Object.keys(data).filter(k=>!mainKeys.includes(k));
  [...mainKeys,...extraKeys].forEach((k,i)=>{
    const y=60+i*(H-100)/Math.max(mainKeys.length+extraKeys.length-1,1);
    nodes.push({key:k,x:W-90,y,col:k==='total_system_cost_estimate'?'#fbbf24':k==='assignments'?'#4f8fff':'#34d399'});
  });
  // sub assignment nodes
  const subNodes=[];
  if(data.assignments){
    data.assignments.slice(0,6).forEach((a,i)=>{
      subNodes.push({
        key:a.tx_id,x:W-24,
        y:80+i*(H-120)/Math.max(data.assignments.length-1,1),
        col:a.channel_id==='Channel_F'?'#4f8fff':a.channel_id==='Channel_S'?'#34d399':'#a78bfa',
        failed:a.failed
      });
    });
  }

  // Particle system
  const particles=[];
  class JP{
    constructor(){this.reset()}
    reset(){
      const n=nodes[Math.floor(Math.random()*nodes.length)];
      this.tx=n.x;this.ty=n.y;this.col=n.col;
      this.x=30+Math.random()*20;this.y=H/2+(Math.random()-.5)*H*.4;
      this.spd=1.2+Math.random()*1.8;this.r=1.5+Math.random()*1.5;
      this.alpha=0;this.trail=[];this.phase='fly';
      this.key=n.key;
    }
    update(){
      this.trail.push({x:this.x,y:this.y,a:this.alpha});if(this.trail.length>12)this.trail.shift();
      if(this.phase==='fly'){
        this.alpha=Math.min(.85,this.alpha+.06);
        const dx=this.tx-this.x,dy=this.ty-this.y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<4){this.phase='burst';}
        else{this.x+=dx*this.spd*.04;this.y+=dy*this.spd*.04;}
      } else {this.r*=1.1;this.alpha-=.07;if(this.alpha<=0)this.reset();}
    }
    draw(){
      this.trail.forEach((pt,i)=>{const a=(i/this.trail.length)*this.alpha*.15;ctx.beginPath();ctx.arc(pt.x,pt.y,this.r*(i/this.trail.length)*.6,0,Math.PI*2);ctx.fillStyle=hexA(this.col,a);ctx.fill();});
      const g=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.r*3.5);g.addColorStop(0,hexA(this.col,this.alpha*.4));g.addColorStop(1,'transparent');
      ctx.beginPath();ctx.arc(this.x,this.y,this.r*3.5,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
      ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.fillStyle=hexA(this.col,this.alpha);ctx.fill();
    }
  }
  function hexA(hex,a){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`rgba(${r},${g},${b},${Math.max(0,Math.min(1,a))})`;}
  for(let i=0;i<20;i++)particles.push(new JP());

  if(jsonFlowAnim)cancelAnimationFrame(jsonFlowAnim);
  let t=0;
  function frame(){
    ctx.clearRect(0,0,W,H);
    t+=0.012;
    // Source node (left)
    const sx=28,sy=H/2;
    const sg=ctx.createRadialGradient(sx,sy,0,sx,sy,22);sg.addColorStop(0,'rgba(79,143,255,.22)');sg.addColorStop(1,'transparent');
    ctx.beginPath();ctx.arc(sx,sy,22,0,Math.PI*2);ctx.fillStyle=sg;ctx.fill();
    ctx.beginPath();ctx.arc(sx,sy,9,0,Math.PI*2);ctx.fillStyle='rgba(79,143,255,.8)';ctx.fill();
    ctx.font='bold 7px Geist,sans-serif';ctx.fillStyle='rgba(79,143,255,.6)';ctx.textAlign='center';ctx.fillText('JSON',sx,sy+19);

    // Draw field nodes
    nodes.forEach((n,i)=>{
      const pulse=Math.sin(t*2+i)*0.12+0.88;
      const gn=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,16);gn.addColorStop(0,hexA(n.col,.25*pulse));gn.addColorStop(1,'transparent');
      ctx.beginPath();ctx.arc(n.x,n.y,16,0,Math.PI*2);ctx.fillStyle=gn;ctx.fill();
      ctx.beginPath();ctx.arc(n.x,n.y,6,0,Math.PI*2);ctx.fillStyle=hexA(n.col,.85);ctx.fill();
      // Label
      const label=n.key.replace(/_/g,' ').slice(0,18);
      ctx.font='bold 7.5px Geist Mono,monospace';ctx.fillStyle=hexA(n.col,.7);ctx.textAlign='right';ctx.fillText(label,n.x-12,n.y+3);
      // Connection line
      ctx.beginPath();ctx.moveTo(sx+10,sy);ctx.bezierCurveTo(sx+80,sy,n.x-80,n.y,n.x-8,n.y);
      ctx.strokeStyle=hexA(n.col,.12+Math.sin(t+i)*.04);ctx.lineWidth=1;ctx.stroke();
    });

    // Sub assignment nodes
    subNodes.forEach((n,i)=>{
      const mainAssign=nodes.find(nd=>nd.key==='assignments');
      if(!mainAssign)return;
      const pulse=Math.sin(t*2.5+i+1)*.1+.9;
      ctx.beginPath();ctx.arc(n.x,n.y,4,0,Math.PI*2);ctx.fillStyle=hexA(n.col,.7*pulse);ctx.fill();
      ctx.beginPath();ctx.moveTo(mainAssign.x+8,mainAssign.y);ctx.lineTo(n.x-6,n.y);
      ctx.strokeStyle=hexA(n.col,.12);ctx.lineWidth=.8;ctx.stroke();
      ctx.font='6.5px Geist Mono,monospace';ctx.fillStyle=hexA(n.col,.5);ctx.textAlign='left';ctx.fillText(n.key,n.x+7,n.y+2);
    });

    particles.forEach(p=>{p.update();p.draw()});
    jsonFlowAnim=requestAnimationFrame(frame);
  }
  frame();
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
