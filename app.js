let SHOW_X_PATHS=true, SHOW_DET_PATHS=false;
const tabs=document.querySelectorAll('.tab');const views={map:document.getElementById('view-map'),mrx:document.getElementById('view-mrx'),players:document.getElementById('view-players')};
tabs.forEach(t=>t.addEventListener('click',()=>{tabs.forEach(tt=>tt.classList.remove('active'));t.classList.add('active');Object.values(views).forEach(v=>v.classList.remove('active'));views[t.dataset.tab].classList.add('active');}));
document.getElementById('toggleXPaths').onclick=()=>{SHOW_X_PATHS=!SHOW_X_PATHS;draw();}
document.getElementById('toggleDetPaths').onclick=()=>{SHOW_DET_PATHS=!SHOW_DET_PATHS;draw();}
function draw(){/* TODO: draw map, paths, etc. */}