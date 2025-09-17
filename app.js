// Scotland Yard – Mister X (pan/zoom fixed, solid label badges)
const state={
  img:null, graph:{nodes:[],edges:[]},
  showEdges:true, showNodes:true, showLabels:true,
  scale:1, panX:0, panY:0, dpi:window.devicePixelRatio||1,
  nodeRadius:12, edgeWidth:5, fontPx:22,
};

const canvas=document.getElementById('board');
const ctx=canvas.getContext('2d',{alpha:false});

function loadImage(src){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=rej;img.src=src;});}
async function tryImages(){try{return await loadImage('assets/board.webp');}catch{return loadImage('assets/board.png');}}

function normalizeGraph(g){const nodes=(g.nodes||[]).map(n=>({id:n.id??n.node??n.name,x:+n.x,y:+n.y,label:String(n.label??n.id??'')}));const edges=(g.edges||g.links||[]).map(e=>({from:e.from??e.source,to:e.to??e.target,type:String(e.type??e.transport??'').toLowerCase()}));return{nodes,edges};}

async function boot(){
  const [img, graph]=await Promise.all([ tryImages(), fetch('assets/sy_nodes_edges.json').then(r=>r.json()) ]);
  state.img=img; state.graph=normalizeGraph(graph);
  centerAndFit(); fitToScreen(); draw(); refreshTickets();
}
boot().catch(console.error);

// ---------- Resize / viewport ----------
function fitToScreen(){
  const r=canvas.getBoundingClientRect();
  const d=state.dpi;
  const w=Math.max(1,Math.floor(r.width*d));
  const h=Math.max(1,Math.floor(r.height*d));
  if(canvas.width!==w||canvas.height!==h){ canvas.width=w; canvas.height=h; }
  draw();
}
window.addEventListener('resize',fitToScreen);

function screenToBoard(sx,sy){
  const rect=canvas.getBoundingClientRect();
  return { x:(sx-rect.left - state.panX)/state.scale, y:(sy-rect.top - state.panY)/state.scale };
}
function boardToScreen(x,y){
  const rect=canvas.getBoundingClientRect();
  return { x:x*state.scale + state.panX + rect.left, y:y*state.scale + state.panY + rect.top };
}

// ---------- Pan & Zoom ----------
function zoomAt(screenX,screenY,scaleBy){
  const before=screenToBoard(screenX,screenY);
  state.scale*=scaleBy; state.scale=Math.max(0.2,Math.min(6,state.scale));
  const after=screenToBoard(screenX,screenY);
  state.panX += (after.x-before.x)*state.scale;
  state.panY += (after.y-before.y)*state.scale;
}

canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  const scaleBy = Math.pow(1.0010, -e.deltaY); // jemnější zoom
  zoomAt(e.clientX, e.clientY, scaleBy);
  draw();
},{passive:false});

let pointers=new Map(); let lastDist=null,lastCenter=null;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});});
canvas.addEventListener('pointerup',e=>{canvas.releasePointerCapture(e.pointerId); pointers.delete(e.pointerId); lastDist=null; lastCenter=null;});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId); lastDist=null; lastCenter=null;});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const pts=[...pointers.values()];
  if(pts.length===1){
    state.panX += e.movementX;
    state.panY += e.movementY;
  } else if(pts.length===2){
    const [a,b]=pts; const cx=(a.x+b.x)/2, cy=(a.y+b.y)/2;
    const dist=Math.hypot(b.x-a.x,b.y-a.y);
    if(lastDist!=null){
      const scaleBy = dist/lastDist;
      zoomAt(cx,cy,scaleBy);
      if(lastCenter){ state.panX += (cx-lastCenter.x); state.panY += (cy-lastCenter.y); }
    }
    lastDist=dist; lastCenter={x:cx,y:cy};
  }
  draw();
});

canvas.addEventListener('dblclick', e=>{
  const p=screenToBoard(e.clientX,e.clientY);
  const n=nearestNode(p.x,p.y);
  if(n) focusOnNode(n); else { zoomAt(e.clientX,e.clientY,1.4); draw(); }
});

function nearestNode(x,y,maxDist=40){
  if(!state.graph.nodes.length) return null;
  let best=null,bd=1e9;
  for(const n of state.graph.nodes){ const d=Math.hypot(n.x-x,n.y-y); if(d<bd){bd=d;best=n;} }
  return bd<=maxDist?best:null;
}
function focusOnNode(n){
  const rect=canvas.getBoundingClientRect();
  const targetScale = Math.min(5, Math.max(1.6, Math.min(rect.width,rect.height)/260));
  state.scale = targetScale;
  state.panX = rect.width/2 - n.x*state.scale;
  state.panY = rect.height/2 - n.y*state.scale;
  draw();
}
function centerAndFit(){
  const rect=canvas.getBoundingClientRect();
  if(!state.img){ state.scale=1; state.panX=rect.width/2; state.panY=rect.height/2; return; }
  const sx=rect.width/state.img.width, sy=rect.height/state.img.height;
  state.scale=Math.min(sx,sy)*0.98;
  state.panX=(rect.width-state.img.width*state.scale)/2;
  state.panY=(rect.height-state.img.height*state.scale)/2;
}

// ---------- Drawing with solid label badges ----------
function draw(){
  const d=state.dpi;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='#0b0f14'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save(); ctx.scale(d,d);
  ctx.translate(state.panX, state.panY); ctx.scale(state.scale, state.scale);

  if(state.img) ctx.drawImage(state.img,0,0);

  if(state.showEdges){
    ctx.lineCap='round';
    for(const e of state.graph.edges){
      const a=state.graph.nodes.find(n=>String(n.id)===String(e.from));
      const b=state.graph.nodes.find(n=>String(n.id)===String(e.to));
      if(!a||!b) continue;
      const col = e.type==='taxi' ? '#FFD54A' : e.type==='bus' ? '#4CD964' : e.type==='metro' ? '#FF3B30' : '#9CA3AF';
      ctx.strokeStyle=col; ctx.lineWidth=state.edgeWidth;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
  }

  if(state.showNodes || state.showLabels){
    ctx.font=`800 ${state.fontPx}px system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif`;
    for(const n of state.graph.nodes){
      if(state.showNodes){
        ctx.beginPath(); ctx.arc(n.x,n.y,state.nodeRadius,0,Math.PI*2);
        ctx.fillStyle='#FFFFFF'; ctx.fill();
        ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.75)'; ctx.stroke();
      }
      if(state.showLabels){
        const text=String(n.label ?? n.id);
        const padX=8, padY=4, rads=10;
        const tw=ctx.measureText(text).width;
        const th=state.fontPx;
        const bx=n.x, by=n.y - state.nodeRadius - (th*0.6) - 6; // badge above node
        const x0=bx - (tw/2) - padX, y0=by - (th/2) - padY, x1=bx + (tw/2) + padX, y1=by + (th/2) + padY;
        ctx.beginPath(); const rr=rads;
        ctx.moveTo(x0+rr,y0);
        ctx.lineTo(x1-rr,y0); ctx.quadraticCurveTo(x1,y0,x1,y0+rr);
        ctx.lineTo(x1,y1-rr); ctx.quadraticCurveTo(x1,y1,x1-rr,y1);
        ctx.lineTo(x0+rr,y1); ctx.quadraticCurveTo(x0,y1,x0,y1-rr);
        ctx.lineTo(x0,y0+rr); ctx.quadraticCurveTo(x0,y0,x0+rr,y0);
        ctx.closePath(); ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.fill();
        ctx.lineWidth=2; ctx.strokeStyle='rgba(0,0,0,0.75)'; ctx.stroke();
        ctx.fillStyle='#0b0f14'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text, bx, by);
      }
    }
  }

  ctx.restore();
}

// ---------- Mr X rules & log ----------
const RULES={reveal:[3,8,13,18,24], black:5, double:2};
const game={moves:[]};

function refreshTickets(){ document.getElementById('mrxTicketsLeft').textContent=`Zbývá: Black ${RULES.black}, Double ${RULES.double}`; }
function addLog(msg, cls=''){ const d=document.createElement('div'); d.className='entry '+cls; d.innerHTML=msg; document.getElementById('log').prepend(d); }

function edgeExists(a,b,type){
  return state.graph.edges.some(e=>{
    const from=String(e.from), to=String(e.to), t=String(e.type).toLowerCase();
    const aa=String(a), bb=String(b);
    return ((from===aa && to===bb) || (from===bb && to===aa)) && (t===type || (type==='black' && (t==='taxi'||t==='bus'||t==='metro'||t==='ferry')));
  });
}

document.getElementById('mrxCommit').addEventListener('click', ()=>{
  const ticket=document.getElementById('mrxTicket').value;
  const to=parseInt(document.getElementById('mrxDest').value,10);
  const dbl=document.getElementById('mrxDouble').checked;
  if(Number.isNaN(to)){ addLog('Zadej cílový uzel.','err'); return; }

  const last = game.moves.length ? game.moves[game.moves.length-1].to : null;
  if(last && ticket!=='black' && !edgeExists(last,to,ticket)){ addLog(`Neplatná hrana ${last} → ${to} pro ${ticket}.`,'err'); return; }
  if(ticket==='black'){ if(RULES.black<=0){ addLog('Došly Black.','err'); return; } RULES.black--; }
  game.moves.push({ticket,to});

  if(dbl){
    if(RULES.double<=0){ addLog('Došly Double.','err'); return; }
    RULES.double--;
    const to2 = parseInt(prompt('Druhý cíl:')||'',10);
    const t2  = (prompt('Druhá jízdenka (taxi/bus/metro/black):','taxi')||'').toLowerCase();
    if(!to2 || !['taxi','bus','metro','black'].includes(t2)){ addLog('Neplatný druhý tah.','err'); return; }
    if(t2!=='black' && !edgeExists(to,to2,t2)){ addLog('Neplatná druhá hrana.','err'); return; }
    if(t2==='black'){ if(RULES.black<=0){ addLog('Došly Black pro 2. tah.','err'); return; } RULES.black--; }
    game.moves.push({ticket:t2,to:to2});
  }

  const count=game.moves.length;
  if(RULES.reveal.includes(count)){ addLog(`Odhalení po ${count}. tahu: <strong>${game.moves[count-1].to}</strong>`,'ok'); }
  else { addLog(`Mr X ${ticket} → ?`,'ok'); }

  refreshTickets(); draw();
});
