const state={img:null,graph:{nodes:[],edges:[]},showEdges:true,showNodes:true,showLabels:true,
  scale:1,panX:0,panY:0,dpi:window.devicePixelRatio||1,nodeRadius:12,edgeWidth:4,fontPx:20};
const canvas=document.getElementById('board');const ctx=canvas.getContext('2d');
function loadImage(s){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=s;});}
async function boot(){const img=await loadImage('assets/board.webp').catch(()=>loadImage('assets/board.png'));
 const graph=await fetch('assets/sy_nodes_edges.json').then(r=>r.json());state.img=img;state.graph=graph;centerAndFit();fitToScreen();draw();refreshTickets();}
boot();
function fitToScreen(){const r=canvas.getBoundingClientRect(),d=state.dpi;canvas.width=r.width*d;canvas.height=r.height*d;draw();}
window.addEventListener('resize',fitToScreen);
document.getElementById('fit').onclick=()=>{centerAndFit();draw();};document.getElementById('zoomIn').onclick=()=>{zoomAt(canvas.width/2,state.scale*1.2);};
document.getElementById('zoomOut').onclick=()=>{zoomAt(canvas.width/2,state.scale/1.2);};
function centerAndFit(){const r=canvas.getBoundingClientRect();state.scale=Math.min(r.width/state.img.width,r.height/state.img.height)*0.95;state.panX=(r.width-state.img.width*state.scale)/2;state.panY=(r.height-state.img.height*state.scale)/2;}
function zoomAt(x,scaleBy){state.scale=scaleBy;}
function draw(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.scale(state.dpi,state.dpi);ctx.translate(state.panX,state.panY);ctx.scale(state.scale,state.scale);if(state.img)ctx.drawImage(state.img,0,0);if(state.showEdges){ctx.lineWidth=state.edgeWidth;for(const e of state.graph.edges){const a=state.graph.nodes.find(n=>n.id==e.from),b=state.graph.nodes.find(n=>n.id==e.to);if(!a||!b)continue;ctx.strokeStyle=e.type==='taxi'?'#FFD54A':e.type==='bus'?'#4CD964':e.type==='metro'?'#FF3B30':'#aaa';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}if(state.showNodes){for(const n of state.graph.nodes){ctx.beginPath();ctx.arc(n.x,n.y,state.nodeRadius,0,2*Math.PI);ctx.fillStyle='#fff';ctx.fill();ctx.stroke();if(state.showLabels){ctx.font=`bold ${state.fontPx}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#000';ctx.fillText(n.label||n.id,n.x,n.y-state.nodeRadius-12);}}}ctx.restore();}
// Rules Mister X
const RULES={black:5,double:2,reveal:[3,8,13,18,24]};const game={moves:[]};
function refreshTickets(){document.getElementById('mrxTicketsLeft').textContent=`Black: ${RULES.black}, Double: ${RULES.double}`;}
function addLog(m){const d=document.createElement('div');d.className='entry';d.innerHTML=m;document.getElementById('log').prepend(d);}
document.getElementById('mrxCommit').onclick=()=>{const t=document.getElementById('mrxTicket').value;const to=parseInt(document.getElementById('mrxDest').value,10);if(!to){addLog('Zadej cíl');return;}if(t==='black'&&RULES.black<=0){addLog('Došly Black');return;}if(t!=='black'){const last=game.moves.length?game.moves[game.moves.length-1].to:null;if(last&&!state.graph.edges.some(e=>(e.from==last&&e.to==to)||(e.to==last&&e.from==to))){addLog('Neplatná hrana');return;}}if(t==='black')RULES.black--;game.moves.push({t,to});if(RULES.reveal.includes(game.moves.length)){addLog(`Odhalení po ${game.moves.length}: ${to}`);}else{addLog(`MrX ${t} → ?`);}refreshTickets();};
