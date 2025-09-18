// Mr X viewer v8 – big labels, all moves, offset by transport, arrows, highlight last
const state={
  img:null, graph:{nodes:[],edges:[]},
  scale:1, panX:0, panY:0, dpi:window.devicePixelRatio||1,
  nodeRadius:13, fontPx:28
};
const canvas=document.getElementById('board'); const ctx=canvas.getContext('2d',{alpha:false}); canvas.style.touchAction='none';

function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
async function tryImages(){try{return await loadImage('assets/board.webp');}catch{return loadImage('assets/board.png');}}
function normalize(g){const nodes=(g.nodes||[]).map(n=>({id:String(n.id??n.node??n.name),x:+n.x,y:+n.y,label:String(n.label??n.id??'')}));const edges=(g.edges||g.links||[]).map(e=>({from:String(e.from??e.source),to:String(e.to??e.target),type:String(e.type??e.transport??'').toLowerCase()}));return {nodes,edges};}
async function boot(){const [img,graph]=await Promise.all([tryImages(), fetch('assets/sy_nodes_edges.json').then(r=>r.json())]); state.img=img; state.graph=normalize(graph); centerAndFit(); fit(); draw(); refreshTickets();}
boot().catch(console.error);

// viewport
function fit(){const r=canvas.getBoundingClientRect(),d=state.dpi;const w=Math.max(1,Math.floor(r.width*d)),h=Math.max(1,Math.floor(r.height*d)); if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;} draw();}
window.addEventListener('resize',fit);
function screenToBoard(sx,sy){const r=canvas.getBoundingClientRect();return {x:(sx-r.left-state.panX)/state.scale,y:(sy-r.top-state.panY)/state.scale};}
function centerAndFit(){const r=canvas.getBoundingClientRect(); if(!state.img){state.scale=1;state.panX=r.width/2;state.panY=r.height/2;return;} const sx=r.width/state.img.width, sy=r.height/state.img.height; state.scale=Math.min(sx,sy)*0.98; state.panX=(r.width-state.img.width*state.scale)/2; state.panY=(r.height-state.img.height*state.scale)/2;}

// controls
document.getElementById('fit').onclick=()=>{centerAndFit(); draw();};
document.getElementById('zoomIn').onclick=()=>{const r=canvas.getBoundingClientRect(); zoomAt(r.width/2,r.height/2,1.2)};
document.getElementById('zoomOut').onclick=()=>{const r=canvas.getBoundingClientRect(); zoomAt(r.width/2,r.height/2,1/1.2)};
canvas.addEventListener('wheel', e=>{e.preventDefault(); zoomAt(e.clientX,e.clientY,Math.pow(1.0010,-e.deltaY));}, {passive:false});

// pan & pinch
const pts=new Map(); let pinch=null;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId,{x:e.clientX,y:e.clientY});});
canvas.addEventListener('pointerup',e=>{canvas.releasePointerCapture(e.pointerId); pts.delete(e.pointerId); if(pts.size<2) pinch=null;});
canvas.addEventListener('pointercancel',e=>{pts.delete(e.pointerId); if(pts.size<2) pinch=null;});
canvas.addEventListener('pointermove',e=>{
  if(!pts.has(e.pointerId)) return;
  const prev=pts.get(e.pointerId), cur={x:e.clientX,y:e.clientY}; pts.set(e.pointerId,cur);
  const arr=[...pts.values()];
  if(arr.length===1){ state.panX+=cur.x-prev.x; state.panY+=cur.y-prev.y; draw(); return; }
  if(arr.length===2){
    const [a,b]=arr; const cx=(a.x+b.x)/2, cy=(a.y+b.y)/2; const dist=Math.hypot(b.x-a.x,b.y-a.y);
    if(!pinch){ pinch={cx,cy,dist}; return; }
    const by=dist/pinch.dist; zoomAt(cx,cy,by); state.panX+=(cx-pinch.cx); state.panY+=(cy-pinch.cy); pinch={cx,cy,dist};
  }
});
canvas.addEventListener('dblclick',e=>{
  const p=screenToBoard(e.clientX,e.clientY);
  const n=nearestNode(p.x,p.y); if(n) focusOn(n); else zoomAt(e.clientX,e.clientY,1.4);
});
function zoomAt(sx,sy,by){const before=screenToBoard(sx,sy); state.scale*=by; state.scale=Math.max(0.2,Math.min(6,state.scale)); const after=screenToBoard(sx,sy); state.panX+=(after.x-before.x)*state.scale; state.panY+=(after.y-before.y)*state.scale; draw();}
function nearestNode(x,y,max=40){let best=null,bd=1e9; for(const n of state.graph.nodes){const d=Math.hypot(n.x-x,n.y-y); if(d<bd){bd=d; best=n;}} return bd<=max?best:null;}
function focusOn(n){const r=canvas.getBoundingClientRect(); const s=Math.min(5,Math.max(1.6,Math.min(r.width,r.height)/260)); state.scale=s; state.panX=r.width/2-n.x*s; state.panY=r.height/2-n.y*s; draw();}

// drawing helpers
const colFor = (t)=> t==='taxi' ? '#FFD54A' : t==='bus' ? '#4CD964' : t==='metro' ? '#FF3B30' : t==='lod' ? '#4DA3FF' : '#9CA3AF';
const offsetFor = (t)=> t==='taxi' ? -4 : t==='metro' ? 4 : 0; // bus center
const isDashed = (t)=> t==='black';
function drawArrow(x, y, angle, size){
  ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-size, size*0.6); ctx.lineTo(-size,-size*0.6);
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function segPoints(a,b,type){
  const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy)||1;
  const px=-dy/len, py=dx/len; const off=offsetFor(type);
  return {ax:a.x+px*off, ay:a.y+py*off, bx:b.x+px*off, by:b.y+py*off};
}

// game + rules
const RULES={reveal:[3,8,13,18,24], black:5, double:2};
const game={moves:[]};
function refreshTickets(){document.getElementById('mrxTicketsLeft').textContent=`Zbývá: Black ${RULES.black}, Double ${RULES.double}`;}
function addLog(m,c=''){const d=document.createElement('div');d.className='entry '+c; d.innerHTML=m; document.getElementById('log').prepend(d);}
function edgeExistsTyped(a,b,ptype){
  a=String(a); b=String(b);
  return state.graph.edges.some(e=>{
    const f=String(e.from),t=String(e.to),tt=String(e.type).toLowerCase();
    return (((f===a&&t===b)||(f===b&&t===a)) && tt===ptype);
  });
}
function edgeExistsAny(a,b){
  return edgeExistsTyped(a,b,'taxi')||edgeExistsTyped(a,b,'bus')||edgeExistsTyped(a,b,'metro')||edgeExistsTyped(a,b,'lod');
}

document.getElementById('mrxCommit').onclick=()=>{
  const ticket=document.getElementById('mrxTicket').value;
  const to=parseInt(document.getElementById('mrxDest').value,10);
  const dbl=document.getElementById('mrxDouble').checked;
  if(Number.isNaN(to)){addLog('Zadej cílový uzel.','err');return;}
  const last=game.moves.length?game.moves[game.moves.length-1].to:null;
  if(last){
    if(ticket==='black'){
      if(!edgeExistsAny(last,to)){ addLog(`Black: musí existovat spojení (taxi/bus/metro/lod) mezi ${last} → ${to}.`,'err'); return; }
    } else {
      if(!edgeExistsTyped(last,to,ticket)){ addLog(`Neplatná hrana ${last} → ${to} pro ${ticket}.`,'err'); return; }
    }
  }
  if(ticket==='black'){ if(RULES.black<=0){addLog('Došly Black.','err');return;} RULES.black--; }
  game.moves.push({ticket,to});

  if(dbl){
    if(RULES.double<=0){addLog('Došly Double.','err');return;}
    RULES.double--;
    const to2=parseInt(prompt('Druhý cíl:')||'',10);
    const t2=(prompt('Druhá jízdenka (taxi/bus/metro/black):','taxi')||'').toLowerCase();
    if(!to2 || !['taxi','bus','metro','black'].includes(t2)){addLog('Neplatný druhý tah.','err');return;}
    if(t2==='black'){
      if(!edgeExistsAny(to,to2)){ addLog('Black: Druhý tah nemá platné spojení.','err'); return; }
    } else {
      if(!edgeExistsTyped(to,to2,t2)){ addLog('Neplatná druhá hrana.','err'); return; }
    }
    if(t2==='black'){ if(RULES.black<=0){addLog('Došly Black pro 2. tah.','err');return;} RULES.black--; }
    game.moves.push({ticket:t2,to:to2});
  }

  const c=game.moves.length;
  if(RULES.reveal.includes(c)){addLog(`Odhalení po ${c}. tahu: <strong>${game.moves[c-1].to}</strong>`,'ok');}
  else{addLog(`Mr X ${ticket} → ?`,'ok');}

  refreshTickets(); draw();
};

function traversedEdgeKey(a,b){a=String(a);b=String(b);return a<b?`${a}-${b}`:`${b}-${a}`;}

function draw(){
  const d=state.dpi; ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='#0b0f14'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save(); ctx.scale(d,d); ctx.translate(state.panX,state.panY); ctx.scale(state.scale,state.scale);
  if(state.img) ctx.drawImage(state.img,0,0);

  // Build ordered segments
  const segs=[];
  for(let i=1;i<game.moves.length;i++){ const prev=game.moves[i-1], cur=game.moves[i]; segs.push({from:String(prev.to), to:String(cur.to), type:String(cur.ticket).toLowerCase(), idx:i}); }

  // Draw all but last
  for(const s of segs.slice(0,-1)){
    const a=state.graph.nodes.find(n=>n.id===s.from), b=state.graph.nodes.find(n=>n.id===s.to);
    if(!a||!b) continue;
    const {ax,ay,bx,by}=segPoints(a,b,s.type);
    const col=colFor(s.type);
    ctx.strokeStyle=col; ctx.lineWidth=5; ctx.lineCap='round'; ctx.setLineDash(isDashed(s.type)?[12,8]:[]);
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); ctx.setLineDash([]);
    // arrow
    const t=0.6, mx=ax+(bx-ax)*t, my=ay+(by-ay)*t; ctx.fillStyle=col; drawArrow(mx,my,Math.atan2(by-ay,bx-ax),24);
  }
  // Last highlighted
  if(segs.length){
    const s=segs[segs.length-1];
    const a=state.graph.nodes.find(n=>n.id===s.from), b=state.graph.nodes.find(n=>n.id===s.to);
    if(a&&b){
      const {ax,ay,bx,by}=segPoints(a,b,s.type);
      const col=colFor(s.type);
      ctx.strokeStyle=col; ctx.lineWidth=7; ctx.lineCap='round'; ctx.shadowColor=col; ctx.shadowBlur=8; ctx.setLineDash(isDashed(s.type)?[12,8]:[]);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur=0;
      const t=0.6, mx=ax+(bx-ax)*t, my=ay+(by-ay)*t; ctx.fillStyle=col; drawArrow(mx,my,Math.atan2(by-ay,bx-ax),30);
    }
  }

  // Nodes + labels always
  ctx.font=`800 ${state.fontPx}px system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif`;
  for(const n of state.graph.nodes){
    ctx.beginPath(); ctx.arc(n.x,n.y,state.nodeRadius,0,Math.PI*2);
    ctx.fillStyle='#FFFFFF'; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.75)'; ctx.stroke();
    const text=String(n.label ?? n.id);
    const padX=10, padY=5, r=10;
    const tw=ctx.measureText(text).width, th=state.fontPx;
    const bx=n.x, by=n.y - state.nodeRadius - (th*0.6) - 8;
    const x0=bx-(tw/2)-padX, y0=by-(th/2)-padY, x1=bx+(tw/2)+padX, y1=by+(th/2)+padY;
    ctx.beginPath(); ctx.moveTo(x0+r,y0);
    ctx.lineTo(x1-r,y0); ctx.quadraticCurveTo(x1,y0,x1,y0+r);
    ctx.lineTo(x1,y1-r); ctx.quadraticCurveTo(x1,y1,x1-r,y1);
    ctx.lineTo(x0+r,y1); ctx.quadraticCurveTo(x0,y1,x0,y1-r);
    ctx.lineTo(x0,y0+r); ctx.quadraticCurveTo(x0,y0,x0+r,y0);
    ctx.closePath(); ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.fill();
    ctx.lineWidth=2; ctx.strokeStyle='rgba(0,0,0,0.75)'; ctx.stroke();
    ctx.fillStyle='#0b0f14'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,bx,by);
  }
  ctx.restore();
}
