// SY Mr X v18 – fixes + features
const REVEAL_STEPS=[3,8,13,18,24];

// ---------- Tabs & basic state ----------
const tabs=document.querySelectorAll('.tab');
const views={map:document.getElementById('view-map'), mrx:document.getElementById('view-mrx'), players:document.getElementById('view-players')};
let CURRENT_TAB='map';
let SHOW_X_PATHS=true;       // trasy Mr.X
let SHOW_DET_PATHS=false;    // trasy detektivů
tabs.forEach(t=>t.addEventListener('click',()=>switchTab(t.dataset.tab)));

function switchTab(to){
  CURRENT_TAB=to;
  tabs.forEach(t=>t.classList.toggle('active', t.dataset.tab===to));
  Object.entries(views).forEach(([k,el])=>el.classList.toggle('active', k===to));
  if(to==='map') fit();
  if(to==='mrx') renderMrXCards();
  if(to==='players') renderPlayersTable();
}
document.getElementById('toggleXPaths').addEventListener('click',()=>{
  SHOW_X_PATHS = !SHOW_X_PATHS;
  document.body.classList.toggle('hidden-mrx', !SHOW_X_PATHS);
  draw();
});
document.getElementById('toggleDetPaths').addEventListener('click',()=>{SHOW_DET_PATHS=!SHOW_DET_PATHS; draw();});

// ---------- Canvas / Map ----------
const canvas=document.getElementById('board'); const ctx=canvas.getContext('2d',{alpha:false}); canvas.style.touchAction='none';
const state={img:null,graph:{nodes:[],edges:[]}, scale:1,panX:0,panY:0,dpi:window.devicePixelRatio||1, nodeRadius:13, fontPx:28};

function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
async function tryImages(){ try{ return await loadImage('assets/board.webp'); } catch { return loadImage('assets/board.jpeg'); } }
function normalize(g){const n=(g.nodes||[]).map(x=>({id:String(x.id??x.node??x.name),x:+x.x,y:+x.y,label:String(x.label??x.id??'')}));const e=(g.edges||g.links||[]).map(x=>({from:String(x.from??x.source),to:String(x.to??x.target),type:String(x.type??x.transport??'').toLowerCase()}));return{nodes:n,edges:e};}
async function boot(){const [img,graph]=await Promise.all([tryImages(), fetch('assets/sy_nodes_edges.json',{cache:'no-store'}).then(r=>r.json())]); state.img=img; state.graph=normalize(graph); centerAndFit(); fit(); refreshTickets(); draw(); switchTab('map');}
window.addEventListener('DOMContentLoaded', ()=>{ document.getElementById('mrxDest').classList.add('num-only'); boot().catch(console.error); });

function fit(){const r=canvas.getBoundingClientRect(),d=state.dpi;const w=Math.max(1,Math.floor(r.width*d)),h=Math.max(1,Math.floor(r.height*d)); if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;} draw();}
window.addEventListener('resize',fit);
function screenToBoard(sx,sy){const r=canvas.getBoundingClientRect();return {x:(sx-r.left-state.panX)/state.scale,y:(sy-r.top-state.panY)/state.scale};}
function centerAndFit(){const r=canvas.getBoundingClientRect(); if(!state.img){state.scale=1;state.panX=r.width/2;state.panY=r.height/2;return;} const sx=r.width/state.img.width, sy=r.height/state.img.height; state.scale=Math.min(sx,sy)*0.98; state.panX=(r.width-state.img.width*state.scale)/2; state.panY=(r.height-state.img.height*state.scale)/2;}

document.getElementById('fit').onclick=()=>{centerAndFit(); draw();};
document.getElementById('zoomIn').onclick=()=>{const r=canvas.getBoundingClientRect(); zoomAt(r.width/2,r.height/2,1.2)};
document.getElementById('zoomOut').onclick=()=>{const r=canvas.getBoundingClientRect(); zoomAt(r.width/2,r.height/2,1/1.2)};
canvas.addEventListener('wheel',e=>{e.preventDefault(); zoomAt(e.clientX,e.clientY,Math.pow(1.0010,-e.deltaY));},{passive:false});

const pts=new Map();let pinch=null;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});});
canvas.addEventListener('pointerup',e=>{canvas.releasePointerCapture(e.pointerId);pts.delete(e.pointerId);if(pts.size<2)pinch=null;});
canvas.addEventListener('pointercancel',e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;});
canvas.addEventListener('pointermove',e=>{
  if(!pts.has(e.pointerId))return;
  const prev=pts.get(e.pointerId),cur={x:e.clientX,y:e.clientY};pts.set(e.pointerId,cur);
  const arr=[...pts.values()];
  if(arr.length===1){state.panX+=cur.x-prev.x;state.panY+=cur.y-prev.y;draw();return;}
  if(arr.length===2){
    const [a,b]=arr;const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;const dist=Math.hypot(b.x-a.x,b.y-a.y);
    if(!pinch){pinch={cx,cy,dist};return;}
    const by=dist/pinch.dist;zoomAt(cx,cy,by);state.panX+=(cx-pinch.cx);state.panY+=(cy-pinch.cy);pinch={cx,cy,dist};
  }
});
canvas.addEventListener('dblclick',e=>{
  const p=screenToBoard(e.clientX,e.clientY);
  const n=nearestNode(p.x,p.y); if(n) focusOn(n); else zoomAt(e.clientX,e.clientY,1.4);
});
function zoomAt(sx,sy,by){const before=screenToBoard(sx,sy); state.scale*=by; state.scale=Math.max(0.2,Math.min(6,state.scale)); const after=screenToBoard(sx,sy); state.panX+=(after.x-before.x)*state.scale; state.panY+=(after.y-before.y)*state.scale; draw();}
function nearestNode(x,y,max=40){let best=null,bd=1e9;for(const n of state.graph.nodes){const d=Math.hypot(n.x-x,n.y-y);if(d<bd){bd=d;best=n}}return bd<=max?best:null;}
function focusOn(n){const r=canvas.getBoundingClientRect();const s=Math.min(5,Math.max(1.6,Math.min(r.width,r.height)/260));state.scale=s;state.panX=r.width/2-n.x*s;state.panY=r.height/2-n.y*s;draw();}

const colFor=(t)=>t==='taxi'?'#FFD54A':t==='bus'?'#4CD964':t==='metro'?'#FF3B30':t==='lod'?'#4DA3FF':t==='black'?'#000':'#9CA3AF';
const offsetFor=(t)=>t==='taxi'?-4:t==='metro'?4:0;
const isDashed=(t)=>t==='black';
function drawArrow(x,y,ang,size,outline=null){ if(outline){ctx.fillStyle=outline;ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-size,size*0.6);ctx.lineTo(-size,-size*0.6);ctx.closePath();ctx.fill();ctx.restore();} ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-size*0.9, size*0.54);ctx.lineTo(-size*0.9,-size*0.54);ctx.closePath();ctx.fill();ctx.restore();}
function segPoints(a,b,type){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;const px=-dy/len,py=dx/len;const off=offsetFor(type);return{ax:a.x+px*off,ay:a.y+py*off,bx:b.x+px*off,by:b.y+py*off};}

// ---------- Game / rules / logging ----------
const RULES={reveal:[3,8,13,18,24], black:5, double:2};
const game={moves:[]};
const commitStack=[]; // {moves:[{ticket,to}], usedBlack, usedDouble, gainedBlack, gainedDouble}
let ACCRUED={black:0,double:0};

function refreshTickets(){const box=document.getElementById('mrxTicketsLeft'); if(box) box.textContent=`Zbývá: Black ${RULES.black}, Double ${RULES.double}`;}
function addLog(m,c=''){
  const d=document.createElement('div');
  d.className='entry '+c;
  // označ záznamy Mr.X pro filtrování
  if(c === 'ok' && m.startsWith('Mr X')) d.classList.add('mrx'); // with non-breaking space variant
  if(c === 'ok' && m.startsWith('Mr X')) d.classList.add('mrx'); // fallback plain space
  if(m.includes('Odhalení')) d.classList.add('reveal');
  d.innerHTML=m;
  document.getElementById('log').prepend(d);

  // autoscroll na začátek (nejnovější nahoře)
  const scroller = document.getElementById('logContainer');
  if (scroller) scroller.scrollTop = 0;
}
function edgeExistsTyped(a,b,ptype){a=String(a);b=String(b);return state.graph.edges.some(e=>{const f=String(e.from),t=String(e.to),tt=String(e.type).toLowerCase();return (((f===a&&t===b)||(f===b&&t===a)) && tt===ptype);});}
function edgeExistsAny(a,b){return edgeExistsTyped(a,b,'taxi')||edgeExistsTyped(a,b,'bus')||edgeExistsTyped(a,b,'metro')||edgeExistsTyped(a,b,'lod');}

document.getElementById('mrxCommit').onclick=()=>{
  const ticket=document.getElementById('mrxTicket').value;
  const to=parseInt(document.getElementById('mrxDest').value,10);
  const dbl=document.getElementById('mrxDouble').checked;
  if(Number.isNaN(to)){addLog('Zadej cílový uzel.','err');return;}
  const last=game.moves.length?game.moves[game.moves.length-1].to:null;

  if(last){
    if(ticket==='black'){ if(!edgeExistsAny(last,to)){ addLog(`Black: musí existovat spojení (taxi/bus/metro/lod) mezi ${last} → ${to}.`,'err'); return; } }
    else { if(!edgeExistsTyped(last,to,ticket)){ addLog(`Neplatná hrana ${last} → ${to} pro ${ticket}.`,'err'); return; } }
  }

  let usedBlack=0, usedDouble=0;
  if(ticket==='black'){ if(RULES.black<=0){ addLog('Došly Black.','err'); return; } RULES.black--; usedBlack++; }
  const movesTurn=[{ticket,to}];

  if(dbl){
    if(RULES.double<=0){ addLog('Došly Double.','err'); return; }
    RULES.double--; usedDouble=1;
    const to2 = parseInt(prompt('Druhý cíl:')||'',10);
    const t2  = (prompt('Druhá jízdenka (taxi/bus/metro/black):','taxi')||'').toLowerCase();
    if(!to2 || !['taxi','bus','metro','black'].includes(t2)){ addLog('Neplatný druhý tah.','err'); return; }
    const from2 = to;
    if(t2==='black'){ if(!edgeExistsAny(from2,to2)){ addLog('Black: Druhý tah nemá platné spojení.','err'); return; } if(RULES.black<=0){ addLog('Došly Black pro 2. tah.','err'); return; } RULES.black--; usedBlack++; }
    else { if(!edgeExistsTyped(from2,to2,t2)){ addLog('Neplatná druhá hrana.','err'); return; } }
    movesTurn.push({ticket:t2,to:to2});
  }

  for(const m of movesTurn) game.moves.push(m);
  commitStack.push({moves:movesTurn, usedBlack, usedDouble, gainedBlack:ACCRUED.black, gainedDouble:ACCRUED.double});
  ACCRUED.black=0; ACCRUED.double=0;

  if(movesTurn.length===2){
    const [a,b]=movesTurn; addLog(`Mr X double: ${a.ticket} → ${a.to}, ${b.ticket} → ${b.to}`,'ok');
  } else {
    addLog(`Mr X ${ticket} → ${to}`,'ok');
  }
  const c=game.moves.length; if(RULES.reveal.includes(c)){ addLog(`Odhalení po ${c}. tahu: <strong>${game.moves[c-1].to}</strong>`,'ok'); }

  refreshTickets(); draw(); renderMrXCards();
};

document.getElementById('btnAddBlack').onclick=()=>{ RULES.black++; ACCRUED.black++; const cur=game.moves.length?game.moves[game.moves.length-1].to:'?'; refreshTickets(); addLog(`+1 Black přidán na pozici ${cur}`,'ok'); };
document.getElementById('btnAddDouble').onclick=()=>{ RULES.double++; ACCRUED.double++; const cur=game.moves.length?game.moves[game.moves.length-1].to:'?'; refreshTickets(); addLog(`+1 Double přidán na pozici ${cur}`,'ok'); };
document.getElementById('btnUndo').onclick=()=>{
  if(!commitStack.length){ addLog('Není co vracet.','err'); return; }
  const lastTurn=commitStack.pop();
  for(let i=0;i<lastTurn.moves.length;i++) game.moves.pop();
  RULES.black += lastTurn.usedBlack||0; RULES.double += lastTurn.usedDouble||0;
  RULES.black -= lastTurn.gainedBlack||0; RULES.double -= lastTurn.gainedDouble||0;
  if(RULES.black<0) RULES.black=0; if(RULES.double<0) RULES.double=0;
  refreshTickets(); draw(); renderMrXCards();
  addLog('Poslední tah vrácen (včetně získaných jízdenek).','ok');
};

// ---------- Drawing ----------
function draw(){
  const d=state.dpi; ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='#0b0f14'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save(); ctx.scale(d,d); ctx.translate(state.panX,state.panY); ctx.scale(state.scale,state.scale);
  if(state.img) ctx.drawImage(state.img,0,0);

  // Build segments from moves
  const segs=[]; for(let i=1;i<game.moves.length;i++){ const a=game.moves[i-1], b=game.moves[i]; segs.push({from:String(a.to), to:String(b.to), type:String(b.ticket).toLowerCase(), idx:i}); }

  if(SHOW_X_PATHS){
    // draw non-last
    for(const s of segs.slice(0,-1)){
      const A=state.graph.nodes.find(n=>n.id===s.from), B=state.graph.nodes.find(n=>n.id===s.to); if(!A||!B) continue;
      const {ax,ay,bx,by}=segPoints(A,B,s.type); const col=colFor(s.type);
      // outline
      ctx.lineCap='round'; ctx.setLineDash([]); ctx.strokeStyle=(s.type==='black')?'#FFFFFF':'#000000'; ctx.lineWidth=11;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      // color
      ctx.strokeStyle=col; ctx.lineWidth=30; ctx.setLineDash(isDashed(s.type)?[12,8]:[]);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); ctx.setLineDash([]);
      // arrow
      const t=0.6, mx=ax+(bx-ax)*t, my=ay+(by-ay)*t;
      drawArrow(mx,my,Math.atan2(by-ay,bx-ax),30,(s.type==='black')?'#FFFFFF':'#000000');
      ctx.fillStyle=col; drawArrow(mx,my,Math.atan2(by-ay,bx-ax),28,null);
    }
    // last highlighted
    if(segs.length){
      const s=segs[segs.length-1]; const A=state.graph.nodes.find(n=>n.id===s.from), B=state.graph.nodes.find(n=>n.id===s.to);
      if(A&&B){
        const {ax,ay,bx,by}=segPoints(A,B,s.type); const col=colFor(s.type);
        ctx.lineCap='round'; ctx.setLineDash([]); ctx.strokeStyle=(s.type==='black')?'#FFFFFF':'#000000'; ctx.lineWidth=13;
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
        ctx.strokeStyle=col; ctx.lineWidth=11; ctx.shadowColor=col; ctx.shadowBlur=8; ctx.setLineDash(isDashed(s.type)?[12,8]:[]);
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur=0;
        const t=0.6, mx=ax+(bx-ax)*t, my=ay+(by-ay)*t;
        drawArrow(mx,my,Math.atan2(by-ay,bx-ax),36,(s.type==='black')?'#FFFFFF':'#000000');
        ctx.fillStyle=col; drawArrow(mx,my,Math.atan2(by-ay,bx-ax),34,null);
      }
    }
  }

  // Detectives paths
  const DETECTIVE_IDS=['D1','D2','D3','D4','D5','D6'];
  if(SHOW_DET_PATHS && window.playersState){
    const COLORS = {D1:'#60A5FA', D2:'#A78BFA', D3:'#34D399', D4:'#FBBF24', D5:'#F87171', D6:'#EC4899'};
    for(const id of DETECTIVE_IDS){
      const col = COLORS[id] || '#9CA3AF';
      for(let step=2; step<playersState[id].length; step++){
        const a = playersState[id][step-1], b = playersState[id][step];
        if(a && b){
          const A = state.graph.nodes.find(n=>n.id===String(a));
          const B = state.graph.nodes.find(n=>n.id===String(b));
          if(!A||!B) continue;
          ctx.lineCap='round'; ctx.setLineDash([]);
          ctx.strokeStyle='#000000'; ctx.lineWidth=25;
          ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke();
          ctx.strokeStyle=col; ctx.lineWidth=20;
          ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke();
        }
      }
    }
  }

  // nodes + labels
  ctx.font=`800 ${state.fontPx}px system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif`;
  for(const n of state.graph.nodes){
    ctx.beginPath(); ctx.arc(n.x,n.y,state.nodeRadius,0,Math.PI*2);
    ctx.fillStyle='#FFFFFF'; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.75)'; ctx.stroke();
    const text=String(n.label ?? n.id), padX=10, padY=5, r=10, tw=ctx.measureText(text).width, th=state.fontPx;
    const bx=n.x, by=n.y - state.nodeRadius - (th*0.6) - 8;
    const x0=bx-(tw/2)-padX, y0=by-(th/2)-padY, x1=bx+(tw/2)+padX, y1=by+(th/2)+padY;
    ctx.beginPath(); ctx.moveTo(x0+r,y0); ctx.lineTo(x1-r,y0); ctx.quadraticCurveTo(x1,y0,x1,y0+r);
    ctx.lineTo(x1,y1-r); ctx.quadraticCurveTo(x1,y1,x1-r,y1); ctx.lineTo(x0+r,y1); ctx.quadraticCurveTo(x0,y1,x0,y1-r);
    ctx.lineTo(x0,y0+r); ctx.quadraticCurveTo(x0,y0,x0+r,y0); ctx.closePath();
    ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='rgba(0,0,0,0.75)'; ctx.stroke();
    ctx.fillStyle='#0b0f14'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,bx,by);
  }
  ctx.restore();
}

// ---------- Mr.X cards (3 columns; double = two lines) ----------
function renderMrXCards(){
  const list=document.getElementById('mrxCards'); if(!list) return;
  list.innerHTML='';
  let step=1;
  for(const turn of commitStack){
    for(const m of turn.moves){
      const li=document.createElement('li'); li.className='mrx-card';
      const left=document.createElement('div');
      left.innerHTML=`<span class="mrx-step">${step}.</span> <span class="mrx-badge ${m.ticket}">${m.ticket}</span>`;
      const right=document.createElement('div');
      if(REVEAL_STEPS.includes(step)) right.innerHTML=`<span class="mrx-reveal">${m.to}</span>`;
      li.appendChild(left); li.appendChild(right); list.appendChild(li);
      step++;
    }
  }
  for(;step<=24;step++){ const li=document.createElement('li'); li.className='mrx-card'; li.innerHTML=`<span class="mrx-step">${step}.</span>`; list.appendChild(li); }
}

// ---------- Players table ----------
const DETECTIVE_IDS=['D1','D2','D3','D4','D5','D6'];
if(!window.playersState){ window.playersState=Object.fromEntries(DETECTIVE_IDS.map(id=>[id, Array(25).fill(null)])); }
function renderPlayersTable(){
  const root=document.getElementById('playersTable'); if(!root) return;
  const table=document.createElement('table');
  const thead=document.createElement('thead'); const trh=document.createElement('tr');
  trh.appendChild(document.createElement('th')).textContent='Tah';
  for(const id of DETECTIVE_IDS){ const th=document.createElement('th'); th.textContent=id; trh.appendChild(th); }
  thead.appendChild(trh); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  for(let step=1; step<=24; step++){
    const tr=document.createElement('tr');
    const th=document.createElement('th'); th.textContent=step; tr.appendChild(th);
    for(const id of DETECTIVE_IDS){
            const td=document.createElement('td');
      \1
      inp.classList.add('num-only');
      inp.setAttribute('inputmode','numeric');
      inp.setAttribute('pattern','[0-9]*');
      inp.autocomplete = 'off';
      inp.enterKeyHint = 'done';
      inp.step = '1';
      inp.min='1'; inp.placeholder='?';
      const cur=playersState[id][step]??''; if(cur!==null) inp.value=cur;
      inp.addEventListener('change',()=>{
        const v=parseInt(inp.value||'',10);
        const val = Number.isFinite(v)?v:null;
        playersState[id][step]=val;
        const prev = playersState[id][step-1];
        td.classList.remove('invalid');
        if(prev && val){
          if(!edgeExistsAny(prev,val)){
            td.classList.add('invalid');
            td.title = 'Neexistuje spojení mezi ' + prev + ' → ' + val;
          } else {
            td.title = '';
          }
        } else {
          td.title = '';
        }
        draw();
      });
      td.appendChild(inp); tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody); root.innerHTML=''; root.appendChild(table);
}


// === iPad numpad ===
(function(){
  const isIpad = /iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
  const pad = document.getElementById('numpad');
  if(!pad) return;
  let target = null;

  function openPadFor(el){
    if(!isIpad) return; // only iPad uses in-app pad
    target = el;
    // prevent native keyboard
    el.readOnly = true;
    pad.classList.add('active');
    pad.setAttribute('aria-hidden','false');
  }
  function closePad(){
    if(target){ target.readOnly = false; target.blur(); }
    target = null;
    pad.classList.remove('active');
    pad.setAttribute('aria-hidden','true');
  }

  // Delegate focus for all .num-only inputs (dynamic too)
  document.addEventListener('focusin', (e)=>{
    const el = e.target;
    if(!(el instanceof HTMLInputElement)) return;
    if(!el.classList.contains('num-only')) return;
    openPadFor(el);
  });

  // Handle clicks
  pad.addEventListener('click', (e)=>{
    const b = e.target.closest('button'); if(!b || !target) return;
    const key = b.getAttribute('data-key');
    const action = b.getAttribute('data-action');
    if(key){
      // append digit
      const maxLen = 3; // typical node numbers; adjust if needed
      if((target.value||'').length < maxLen){
        target.value = (target.value||'') + key;
        target.dispatchEvent(new Event('change', {bubbles:true}));
      }
    } else if(action === 'back'){
      target.value = (target.value||'').slice(0,-1);
      target.dispatchEvent(new Event('change', {bubbles:true}));
    } else if(action === 'done'){
      closePad();
    }
  });

  // Close pad when switching tabs or clicking outside panel
  document.addEventListener('click', (e)=>{
    if(!target) return;
    const panel = document.getElementById('panel');
    if(panel && !panel.contains(e.target) && !pad.contains(e.target)){
      closePad();
    }
  });
})();
