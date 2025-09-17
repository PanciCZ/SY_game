// Mister X viewer (v6) – toggles fixed + draw only traversed edges
const state={img:null,graph:{nodes:[],edges:[]},showEdges:true,showNodes:true,showLabels:true,
  scale:1,panX:0,panY:0,dpi:window.devicePixelRatio||1,nodeRadius:12,edgeWidth:5,fontPx:22};
const canvas=document.getElementById('board');const ctx=canvas.getContext('2d',{alpha:false});canvas.style.touchAction='none';

function loadImage(s){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=s;});}
async function imgAuto(){try{return await loadImage('assets/board.webp');}catch{return loadImage('assets/board.png');}}
function norm(g){const n=(g.nodes||[]).map(x=>({id:String(x.id??x.node??x.name),x:+x.x,y:+x.y,label:String(x.label??x.id??'')}));const e=(g.edges||g.links||[]).map(x=>({from:String(x.from??x.source),to:String(x.to??x.target),type:String(x.type??x.transport??'').toLowerCase()}));return{nodes:n,edges:e};}

async function boot(){const [img,graph]=await Promise.all([imgAuto(), fetch('assets/sy_nodes_edges.json').then(r=>r.json())]);state.img=img;state.graph=norm(graph);centerAndFit();fit();draw();refreshTickets();}
boot().catch(console.error);

// viewport
function fit(){const r=canvas.getBoundingClientRect(),d=state.dpi;const w=Math.max(1,Math.floor(r.width*d)),h=Math.max(1,Math.floor(r.height*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}draw();}
window.addEventListener('resize',fit);
function screenToBoard(sx,sy){const r=canvas.getBoundingClientRect();return {x:(sx-r.left-state.panX)/state.scale,y:(sy-r.top-state.panY)/state.scale};}

function centerAndFit(){const r=canvas.getBoundingClientRect();if(!state.img){state.scale=1;state.panX=r.width/2;state.panY=r.height/2;return}const sx=r.width/state.img.width,sy=r.height/state.img.height;state.scale=Math.min(sx,sy)*0.98;state.panX=(r.width-state.img.width*state.scale)/2;state.panY=(r.height-state.img.height*state.scale)/2;}

// zoom
function zoomAt(sx,sy,by){const before=screenToBoard(sx,sy);state.scale*=by;state.scale=Math.max(0.2,Math.min(6,state.scale));const after=screenToBoard(sx,sy);state.panX+=(after.x-before.x)*state.scale;state.panY+=(after.y-before.y)*state.scale;draw();}
document.getElementById('fit').onclick=()=>{centerAndFit();draw();};document.getElementById('zoomIn').onclick=()=>{const r=canvas.getBoundingClientRect();zoomAt(r.width/2,r.height/2,1.2)};document.getElementById('zoomOut').onclick=()=>{const r=canvas.getBoundingClientRect();zoomAt(r.width/2,r.height/2,1/1.2)};
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,Math.pow(1.0010,-e.deltaY));},{passive:false});

// toggles (fixed)
document.getElementById('toggleEdges').onclick=()=>{state.showEdges=!state.showEdges; draw();};
document.getElementById('toggleNodes').onclick=()=>{state.showNodes=!state.showNodes; draw();};
document.getElementById('toggleLabels').onclick=()=>{state.showLabels=!state.showLabels; draw();};

// pan & pinch
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
    const scaleBy=dist/pinch.dist;zoomAt(cx,cy,scaleBy);state.panX+=(cx-pinch.cx);state.panY+=(cy-pinch.cy);pinch={cx,cy,dist};
  }
});

canvas.addEventListener('dblclick',e=>{
  const p=screenToBoard(e.clientX,e.clientY);
  const n=nearestNode(p.x,p.y); if(n) focusOn(n); else zoomAt(e.clientX,e.clientY,1.4);
});

function nearestNode(x,y,max=40){let best=null,bd=1e9;for(const n of state.graph.nodes){const d=Math.hypot(n.x-x,n.y-y);if(d<bd){bd=d;best=n}}return bd<=max?best:null;}
function focusOn(n){const r=canvas.getBoundingClientRect();const s=Math.min(5,Math.max(1.6,Math.min(r.width,r.height)/260));state.scale=s;state.panX=r.width/2-n.x*s;state.panY=r.height/2-n.y*s;draw();}

// ---- Traversed path: build from Mr X moves ----
function traversedEdgeKey(a,b){a=String(a);b=String(b);return a<b?`${a}-${b}`:`${b}-${a}`;}
function buildTraversedSets(){
  const edgesSet=new Set(); const nodesSet=new Set();
  if(!game.moves.length) return {edgesSet, nodesSet};
  nodesSet.add(String(game.moves[0].to)); // first dest
  for(let i=1;i<game.moves.length;i++){
    const prev=game.moves[i-1].to; const cur=game.moves[i].to;
    edgesSet.add(traversedEdgeKey(prev,cur));
    nodesSet.add(String(cur));
  }
  return {edgesSet, nodesSet};
}

// draw
function draw(){
  const d=state.dpi;ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#0b0f14';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();ctx.scale(d,d);ctx.translate(state.panX,state.panY);ctx.scale(state.scale,state.scale);
  if(state.img)ctx.drawImage(state.img,0,0);

  const {edgesSet,nodesSet}=buildTraversedSets();

  if(state.showEdges){
    ctx.lineCap='round';
    for(const e of state.graph.edges){
      // draw only if traversed
      const key=traversedEdgeKey(e.from,e.to);
      if(!edgesSet.has(key)) continue;
      const a=state.graph.nodes.find(n=>n.id===e.from), b=state.graph.nodes.find(n=>n.id===e.to);
      if(!a||!b) continue;
      const col=e.type==='taxi'?'#FFD54A':e.type==='bus'?'#4CD964':e.type==='metro'?'#FF3B30':'#9CA3AF';
      ctx.strokeStyle=col; ctx.lineWidth=state.edgeWidth;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
  }

  if(state.showNodes||state.showLabels){
    ctx.font=`800 ${state.fontPx}px system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif`;
    for(const n of state.graph.nodes){
      // show node only if visited OR always show when no moves yet
      const showVisited = nodesSet.has(n.id) || game.moves.length===0;
      if(state.showNodes && showVisited){
        ctx.beginPath();ctx.arc(n.x,n.y,state.nodeRadius,0,Math.PI*2);
        ctx.fillStyle='#FFFFFF';ctx.fill();
        ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,0.75)';ctx.stroke();
      }
      if(state.showLabels && showVisited){
        const t=String(n.label??n.id),padX=8,padY=4,r=10,tw=ctx.measureText(t).width,th=state.fontPx,bx=n.x,by=n.y-state.nodeRadius-(th*0.6)-6,x0=bx-(tw/2)-padX,y0=by-(th/2)-padY,x1=bx+(tw/2)+padX,y1=by+(th/2)+padY;
        ctx.beginPath();ctx.moveTo(x0+r,y0);ctx.lineTo(x1-r,y0);ctx.quadraticCurveTo(x1,y0,x1,y0+r);ctx.lineTo(x1,y1-r);ctx.quadraticCurveTo(x1,y1,x1-r,y1);ctx.lineTo(x0+r,y1);ctx.quadraticCurveTo(x0,y1,x0,y1-r);ctx.lineTo(x0,y0+r);ctx.quadraticCurveTo(x0,y0,x0+r,y0);ctx.closePath();
        ctx.fillStyle='rgba(255,255,255,0.95)';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='rgba(0,0,0,0.75)';ctx.stroke();
        ctx.fillStyle='#0b0f14';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,bx,by);
      }
    }
  }
  ctx.restore();
}

/// Rules
const RULES={reveal:[3,8,13,18,24],black:5,double:2};const game={moves:[]};
function refreshTickets(){document.getElementById('mrxTicketsLeft').textContent=`Zbývá: Black ${RULES.black}, Double ${RULES.double}`;}
function addLog(m,c=''){const d=document.createElement('div');d.className='entry '+c;d.innerHTML=m;document.getElementById('log').prepend(d);}

function edgeExists(a,b,type){
  a=String(a); b=String(b);
  return state.graph.edges.some(e=>{
    const f=String(e.from),t=String(e.to),tt=String(e.type).toLowerCase();
    return (((f===a&&t===b)||(f===b&&t===a)) && (tt===type || (type==='black'&&(tt==='taxi'||tt==='bus'||tt==='metro'||tt==='ferry'))));
  });
}

document.getElementById('mrxCommit').onclick=()=>{
  const ticket=document.getElementById('mrxTicket').value;
  const to=parseInt(document.getElementById('mrxDest').value,10);
  const dbl=document.getElementById('mrxDouble').checked;
  if(Number.isNaN(to)){addLog('Zadej cílový uzel.','err');return;}
  const last=game.moves.length?game.moves[game.moves.length-1].to:null;
  if(last && ticket!=='black' && !edgeExists(last,to,ticket)){addLog(`Neplatná hrana ${last} → ${to} pro ${ticket}.`,'err');return;}
  if(ticket==='black'){ if(RULES.black<=0){addLog('Došly Black.','err');return;} RULES.black--; }
  game.moves.push({ticket,to});

  if(dbl){
    if(RULES.double<=0){addLog('Došly Double.','err');return;}
    RULES.double--;
    const to2=parseInt(prompt('Druhý cíl:')||'',10);
    const t2=(prompt('Druhá jízdenka (taxi/bus/metro/black):','taxi')||'').toLowerCase();
    if(!to2 || !['taxi','bus','metro','black'].includes(t2)){addLog('Neplatný druhý tah.','err');return;}
    if(t2!=='black' && !edgeExists(to,to2,t2)){addLog('Neplatná druhá hrana.','err');return;}
    if(t2==='black'){ if(RULES.black<=0){addLog('Došly Black pro 2. tah.','err');return;} RULES.black--; }
    game.moves.push({ticket:t2,to:to2});
  }

  const c=game.moves.length;
  if(RULES.reveal.includes(c)){addLog(`Odhalení po ${c}. tahu: <strong>${game.moves[c-1].to}</strong>`,'ok');}
  else{addLog(`Mr X ${ticket} → ?`,'ok');}

  refreshTickets(); draw();
};
