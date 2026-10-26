
// constants =====================================================================================================================
const WINDOW = 20;        // seconds visible in the graph
const YMAX = 25;          // degrees, scale of the graph
const L = 10;             // m, length of the arm (fixed)
const PASSENGERS = 12;    // number of passengers (fixed)

// getting the elements from HTML and puting them in const variables =====================================================
const cv = document.getElementById('cv'); // the canvas where the ship and the graph are drawn
const ctx = cv.getContext('2d'); // the context of the canvas, used to draw on it

const sliderTheta = document.getElementById('sTheta'); // the slider to change the maximum angle (amplitude)
const sliderT = document.getElementById('sT'); // the slider to change the period

const playBtn = document.getElementById('play');
const clearBtn = document.getElementById('clear');
const speedSelection = document.getElementById('speed');

const checkboxHelp = document.getElementById('help'); // Checkbox that lets the user decide to show or hide the help lines

let thetaMax = +sliderTheta.value; // maximum angle in degrees, chosen by the slider
let T = +sliderT.value; // period in s, chosen by the slider
let phase = 0;
let t = 0;
let running = true;
let speed = 1;
let hist = [];            // {t, y} with y = angle in degrees

// ============================================================================================================================

// Functions ============================================================================================================================

// function to format numbers with a comma instead of a dot, and with a specified number of decimal places
function fmt(x, d) {
  const tekst = x.toFixed(d);      // 3.14159 -> "3.14"
  return tekst.replace('.', ',');  // "3.14"  -> "3,14"
}

// updating the shown values on the HTML page
function updateLabels(){
  document.getElementById('oTheta').textContent = thetaMax + '°';
  document.getElementById('oT').textContent = fmt(T,1) + ' s';
  document.getElementById('fTheta').textContent = thetaMax;
  document.getElementById('fT').textContent = fmt(T,1);
  document.getElementById('fF').textContent = fmt(1/T,2);
}

// ============================================================================================================================================


sliderTheta.addEventListener('input', e => {
  thetaMax = +e.target.value;
  updateLabels();
  if (!running) draw();
});

sliderT.addEventListener('input', e => {
  T = +e.target.value;
  updateLabels();
  if (!running) draw();
});

speedSelection.addEventListener('change', e => {
  speed = +e.target.value;
});

checkboxHelp.addEventListener('change', e => {
  if (!running) draw();
});

playBtn.addEventListener('click', e => {
  running = !running;
  e.target.textContent = running ? 'Pauze' : 'Start';
  if (running) last = performance.now();
});

clearBtn.addEventListener('click', e => {
  hist = [];
  t = 0;
  phase = 0;
  draw();
});

function css(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function resize(){
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}


window.addEventListener('resize', resize);

// current angle in degrees: θ = θmax·sin(phase)
function curTheta(){
  return thetaMax * Math.sin(phase);
}

function draw(){
  const W = cv.clientWidth;
  const H = cv.clientHeight;
  const c = { frame:css('--frame'), ship:css('--ship'), person:css('--person'), trace:css('--trace'), eq:css('--eq'),
              help:css('--help'), grid:css('--grid'), muted:css('--muted'), line:css('--line') };
  ctx.clearRect(0,0,W,H);

  const devW = Math.max(170, Math.min(320, W*0.34)); // width of the ship area on the left
  const top = 30, bottom = H - 34;
  const midY = (top + bottom) / 2;                     // θ = 0 in the graph
  const scale = (bottom - midY - 10) / YMAX;           // px per degree
  const toPx = y => midY - y * scale;
  const gx0 = devW + 44, gx1 = W - 14;                 // graph area

  // ship area: pivot, ground and arm length in px
  const cx = devW * 0.5;
  const pivotY = top - 6;
  const groundY = H - 16;
  const pxPerM = (groundY - pivotY - 46) / L;
  const armPx = L * pxPerM;

  // ground
  ctx.fillStyle = c.line; ctx.fillRect(8, groundY, devW - 16, 4);

  // frame: two legs from the pivot to the ground
  const spread = Math.min(devW * 0.42, (groundY - pivotY) * 0.45);
  ctx.strokeStyle = c.frame; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - spread, groundY); ctx.lineTo(cx, pivotY); ctx.lineTo(cx + spread, groundY); ctx.stroke();

  // equilibrium position: vertical dashed line under the pivot
  ctx.setLineDash([6,6]); ctx.strokeStyle = c.eq; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(cx, pivotY); ctx.lineTo(cx, groundY); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = c.muted; ctx.font = '12px ' + css('--body'); ctx.textAlign = 'center';
  ctx.fillText('evenwichtsstand', cx, groundY - 6); ctx.textAlign = 'left';

  // help lines at the ship: the two extreme positions and the angle θmax
  if (checkboxHelp.checked) drawHelpShip(c, cx, pivotY, armPx);

  // arm and ship, rotated over the current angle
  const th = curTheta() * Math.PI / 180;
  const ex = cx + armPx * Math.sin(th), ey = pivotY + armPx * Math.cos(th);
  ctx.strokeStyle = c.frame; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx, pivotY); ctx.lineTo(ex, ey); ctx.stroke();
  drawShip(c, ex, ey, th);

  // pivot
  ctx.fillStyle = c.frame; ctx.beginPath(); ctx.arc(cx, pivotY, 6, 0, Math.PI*2); ctx.fill();

  // graph: grid and axes
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
  const tStart = Math.max(0, t - WINDOW);
  const tx = tt => gx0 + (tt - tStart) / WINDOW * (gx1 - gx0);
  const firstS = Math.ceil(tStart / 2) * 2;            // vertical grid line every 2 s
  for (let s=firstS; s<=tStart+WINDOW; s+=2){ const x=tx(s); ctx.beginPath(); ctx.moveTo(x,top); ctx.lineTo(x,bottom); ctx.stroke(); }
  for (let v=-20; v<=20; v+=5){ if(!v) continue; const yy=toPx(v); ctx.beginPath(); ctx.moveTo(gx0,yy); ctx.lineTo(gx1,yy); ctx.stroke(); }
  ctx.setLineDash([6,6]); ctx.strokeStyle = c.eq; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(gx0, midY); ctx.lineTo(gx1, midY); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = c.muted; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(gx0, top); ctx.lineTo(gx0, bottom); ctx.stroke();
  ctx.fillStyle = c.muted; ctx.font = '12px ' + css('--mono'); ctx.textAlign='right';
  for (let v=-20; v<=20; v+=10){ ctx.fillText(String(v), gx0-6, toPx(v)+4); }
  ctx.textAlign='center';
  for (let s=firstS; s<=tStart+WINDOW; s+=2){ ctx.fillText(String(s), tx(s), bottom+16); }
  ctx.textAlign='left';
  ctx.fillText('θ (°)', gx0+6, top-8);
  ctx.textAlign='right'; ctx.fillText('t (s)', gx1, bottom+30); ctx.textAlign='left';

  // trace
  ctx.save(); ctx.beginPath(); ctx.rect(gx0, top-2, gx1-gx0, bottom-top+4); ctx.clip();
  ctx.strokeStyle = c.trace; ctx.lineWidth = 2.6; ctx.beginPath();
  let started=false;
  for (const p of hist){ if (p.t < tStart) continue; const X=tx(p.t), Y=toPx(p.y); if(!started){ctx.moveTo(X,Y);started=true;} else ctx.lineTo(X,Y); }
  ctx.stroke(); ctx.restore();

  // pen: current point of the graph
  ctx.fillStyle = c.ship; ctx.beginPath(); ctx.arc(tx(t), toPx(curTheta()), 5, 0, Math.PI*2); ctx.fill();

  // help line T in the graph
  if (checkboxHelp.checked) drawHelpGraph(c, tx, toPx, gx0, gx1);
}

// draws the ship at the end of the arm (x, y), turned over the angle th (rad)
function drawShip(c, x, y, th){
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-th);                                     // the ship stays perpendicular to the arm

  // passengers: heads in rows of 10 above the deck
  ctx.fillStyle = c.person;
  for (let i=0; i<PASSENGERS; i++){
    const row = Math.floor(i / 10), col = i % 10;
    ctx.beginPath(); ctx.arc(-40 + col * 9 + (row % 2) * 4, -10 - row * 7, 3.2, 0, Math.PI*2); ctx.fill();
  }

  // hull
  ctx.fillStyle = c.ship;
  ctx.beginPath();
  ctx.moveTo(-54,-12); ctx.lineTo(-44,-4); ctx.lineTo(44,-4); ctx.lineTo(54,-12);
  ctx.lineTo(38,22); ctx.lineTo(-38,22); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// help lines at the ship: extreme positions and the angle θmax
function drawHelpShip(c, cx, pivotY, armPx){
  const thm = thetaMax * Math.PI / 180;
  ctx.strokeStyle = c.help; ctx.fillStyle = c.help; ctx.lineWidth = 1.2; ctx.setLineDash([3,4]);
  ctx.beginPath();
  ctx.moveTo(cx, pivotY); ctx.lineTo(cx + armPx*Math.sin(thm), pivotY + armPx*Math.cos(thm));
  ctx.moveTo(cx, pivotY); ctx.lineTo(cx - armPx*Math.sin(thm), pivotY + armPx*Math.cos(thm));
  ctx.stroke(); ctx.setLineDash([]);
  // arc between the equilibrium position and the extreme position on the right
  const r = Math.min(70, armPx * 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, pivotY, r, Math.PI/2 - thm, Math.PI/2); ctx.stroke();
  ctx.font = '700 13px ' + css('--body');
  ctx.fillText('θmax', cx + r*Math.sin(thm) + 10, pivotY + r*Math.cos(thm) + 4);
}

// help line in the graph: T between the last two peaks of the trace
function drawHelpGraph(c, tx, toPx, gx0, gx1){
  ctx.strokeStyle = c.help; ctx.fillStyle = c.help; ctx.lineWidth = 2; ctx.font = '700 13px ' + css('--body');
  const peaks = [];
  for (let i=1;i<hist.length-1;i++){ if (hist[i].y>hist[i-1].y && hist[i].y>=hist[i+1].y && hist[i].y>0.5) peaks.push(hist[i]); }
  if (peaks.length >= 2){
    const p2 = peaks[peaks.length-1], p1 = peaks[peaks.length-2];
    const x1 = tx(p1.t), x2 = tx(p2.t);
    if (x1 > gx0 && x2 < gx1){
      const yy = Math.min(toPx(p1.y), toPx(p2.y)) - 14;
      ctx.setLineDash([2,3]); ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x1,toPx(p1.y)); ctx.lineTo(x1,yy-4); ctx.moveTo(x2,toPx(p2.y)); ctx.lineTo(x2,yy-4); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth=2;
      arrow(x1, yy, x2, yy); arrow(x2, yy, x1, yy);
      ctx.textAlign='center'; ctx.fillText('T = ' + fmt(p2.t-p1.t,1) + ' s', (x1+x2)/2, yy-7); ctx.textAlign='left';
    }
  }
}

function arrow(x1,y1,x2,y2){
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();

  const a = Math.atan2(y2-y1, x2-x1), h = 7;
  ctx.beginPath(); ctx.moveTo(x2,y2);
  ctx.lineTo(x2 - h*Math.cos(a-0.45), y2 - h*Math.sin(a-0.45));
  ctx.lineTo(x2 - h*Math.cos(a+0.45), y2 - h*Math.sin(a+0.45)); ctx.closePath(); ctx.fill();
}

let last = performance.now();
function tick(now){
  const dt = Math.min(0.05, (now - last) / 1000) * speed;
  last = now;

  if (running){
    t += dt; phase += 2*Math.PI*dt/T;
    hist.push({t, y: curTheta()});
    while (hist.length && hist[0].t < t - WINDOW - 1) hist.shift();
    document.getElementById('rt').textContent = fmt(t,2);
    document.getElementById('rTheta').textContent = fmt(curTheta(),1);
  }
  draw();
  requestAnimationFrame(tick);
}


// Functions that are called when the page is loaded
updateLabels();
resize();
requestAnimationFrame(tick);
