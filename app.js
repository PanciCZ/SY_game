// Scotland Yard – Lite viewer
const state={
  img:null,
  graph:{nodes:[],edges:[]},
  showEdges:true, showNodes:true, showLabels:true,
  scale:1, panX:0, panY:0, dpi:window.devicePixelRatio||1,
  selectedId:null,
  // visual scaling
  nodeRadius:12,
  edgeWidth:5,
  fontPx:24
};

const canvas=document.getElementById('board');
const ctx=canvas.getContext('2d',{alpha:false});

function fitToScreen(){
  const r=canvas.getBoundingClientRect(), d=state.dpi;
  const w=Math.max(1,Math.floor(r.width*d)), h=Math.max(1,Math.floor(r.height*d));
  if(canvas.width!==w||canvas.height!==h){ canvas.width=w; canvas.height=h; }
  draw();
}
window.addEventListener('resize',fitToScreen);

function loadImage(src){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=src; }); }
async function tryImages(){ try { return await loadImage('assets/board.webp'); } catch { return loadImage('assets/board.png'); } }

function normalizeGraph(g){
  const nodes=(g.nodes||[]).map(n=>({id:n.id??n.node??n.name,x:+n.x,y:+n.y,label:String(n.label??n.id??'')}));
  const edges=(g.edges||g.links||[]).map(e=>({from:e.from??e.source,to:e.to??e.target,type:String(e.type??e.transport??'').toLowerCase()}));
  return {nodes,edges};
}

async function boot(){
  const [img, graph]=await Promise.all([
    tryImages(),
    fetch('assets/sy_nodes_edges.json').then(r=>r.json())
  ]);
  state.img=img; state.graph=normalizeGraph(graph);
  centerAndFit(); fitToScreen(); draw();
}
boot().catch(console.error);

// Controls
document.getElementById('toggleEdges').onclick=()=>{state.showEdges=!state.showEdges; draw();};
document.getElementById('toggleNodes').onclick=()=>{state.showNodes=!state.showNodes; draw();};
document.getElementById('toggleLabels').onclick=()=>{state.showLabels=!state.showLabels; draw();};

document.getElementById('fileJson').addEventListener('change', async e=>{
  const f=e.target.files?.[0]; if(!f) return;
  const data=JSON.parse(await f.text()); state.graph=normalizeGraph(data); draw();
});
document.getElementById('fileImg').addEventListener('change', async e=>{
  const f=e.target.files?.[0]; if(!f) return;
  const url=URL.createObjectURL(f); state.img=await loadImage(url); centerAndFit(); draw();
});

// Gentler zoom & pan
canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  const speed = 1.0009; // jemnější zoom
  const rect=canvas.getBoundingClientRect();
  const sx=e.clientX-rect.left, sy=e.clientY-rect.top;
  const before={x:(sx-state.panX)/state.scale,y:(sy-state.panY)/state.scale};
  state.scale *= Math.pow(speed, -e.deltaY);
  state.scale = Math.max(0.2, Math.min(6, state.scale));
  const after={x:(sx-state.panX)/state.scale,y:(sy-state.panY)/state.scale};
  state.panX += (after.x-before.x)*state.scale;
  state.panY += (after.y-before.y)*state.scale;
  draw();
},{passive:false});

// touch pan/zoom
let pointers=new Map(); let lastDist=null, lastCenter=null;
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
  }else if(pts.length===2){
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
  if(n) focusOnNode(n); else zoomAt(e.clientX,e.clientY,1.4);
});

document.getElementById('fit').onclick=()=>{centerAndFit(); draw();};
document.getElementById('zoomIn').onclick=()=>{const r=canvas.getBoundingClientRect(); zoomAt(r.width/2,r.height/2,1.2); draw();};
document.getElementById('zoomOut').onclick=()=>{const r=canvas.getBoundingClientRect(); zoomAt(r.width/2,r.height/2,1/1.2); draw();};

function zoomAt(screenX,screenY,scaleBy){
  const before=screenToBoard(screenX,screenY);
  state.scale*=scaleBy; state.scale=Math.max(0.2,Math.min(6,state.scale));
  const after=screenToBoard(screenX,screenY);
  state.panX += (after.x-before.x)*state.scale;
  state.panY += (after.y-before.y)*state.scale;
}

function screenToBoard(sx,sy){
  const rect=canvas.getBoundingClientRect();
  return {x:(sx-rect.left-state.panX)/state.scale,y:(sy-rect.top-state.panY)/state.scale};
}

function nearestNode(x,y,maxDist=40){
  if(!state.graph.nodes.length) return null;
  let best=null,bd=1e9;
  for(const n of state.graph.nodes){
    const d=Math.hypot(n.x-x,n.y-y);
    if(d<bd){bd=d;best=n;}
  }
  return bd<=maxDist?best:null;
}

function focusOnNode(n){
  const rect=canvas.getBoundingClientRect();
  const targetScale = Math.min(5, Math.max(1.6, Math.min(rect.width,rect.height)/260));
  state.scale=targetScale;
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

function draw(){
  const d=state.dpi;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='#0b0f14'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save(); ctx.scale(d,d);
  ctx.translate(state.panX,state.panY); ctx.scale(state.scale,state.scale);

  // board
  if(state.img) ctx.drawImage(state.img,0,0);

  // edges (bold, high-contrast)
  if(state.showEdges){
    ctx.lineCap='round';
    for(const e of state.graph.edges){
      const a=state.graph.nodes.find(n=>String(n.id)===String(e.from));
      const b=state.graph.nodes.find(n=>String(n.id)===String(e.to));
      if(!a||!b) continue;
      const t=e.type;
      const col = t==='taxi' ? '#FFD54A' : t==='bus' ? '#4CD964' : t==='metro' ? '#FF3B30' : '#9CA3AF';
      ctx.strokeStyle=col;
      ctx.lineWidth=state.edgeWidth;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
  }

  // nodes + labels (bigger, strong halo)
  if(state.showNodes){
    for(const n of state.graph.nodes){
      const r=state.nodeRadius;
      ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2);
      ctx.fillStyle='#FFFFFF'; ctx.fill();
      ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.75)'; ctx.stroke();

      if(state.showLabels){
        const label = String(n.label ?? n.id);
        ctx.font=`bold ${state.fontPx}px system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.lineWidth=6; ctx.strokeStyle='rgba(0,0,0,0.75)';
        ctx.strokeText(label, n.x, n.y);
        ctx.fillStyle='#11161d';
        ctx.fillText(label, n.x, n.y);
      }
    }
  }

  ctx.restore();
}
