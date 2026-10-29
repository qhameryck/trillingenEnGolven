// constants =====================================================================================================================
const WINDOW = 20;        // ms (real time) visible in the graph
const YMAX = 7;           // mm, scale of the graph
const A_MAX = 5;          // mm, maximum of the volume slider
const SLOWDOWN = 500;     // the motion is shown 500x slower than in reality
const GAIN_MAX = 0.25;    // loudness of the sound at A_MAX (0..1), keep it low for headphones

// getting the elements from HTML and puting them in const variables =====================================================
const cv = document.getElementById('cv'); // the canvas where the speaker and the graph are drawn
const ctx = cv.getContext('2d'); // the context of the canvas, used to draw on it

const sliderT = document.getElementById('sT'); // the slider to change the period (pitch)
const sliderA = document.getElementById('sA'); // the slider to change the amplitude (volume)

const playBtn = document.getElementById('play');
const soundBtn = document.getElementById('sound');
const photoBtn = document.getElementById('photoBtn');
const photo = document.getElementById('photo');         // figure with the photo of a real speaker, hidden at the start
const photoImg = document.getElementById('photoImg');
const clearBtn = document.getElementById('clear');
const speedSelection = document.getElementById('speed');

const checkboxHelp = document.getElementById('help'); // Checkbox that lets the user decide to show or hide the help lines

let T = +sliderT.value; // period in ms, chosen by the slider
let A = +sliderA.value; // amplitude in mm, chosen by the slider
let phase = 0;
let t = 0;                // real time in ms
let running = true;
let speed = 1;
let hist = [];            // {t, y} with t in ms and y = displacement in mm

// sound (Web Audio API): created on the first click, browsers block sound without a user action
let audioCtx = null;
let osc = null;           // oscillator: generates the sine wave
let gain = null;          // gain node: sets the loudness
let soundOn = false;

// ============================================================================================================================

// Functions ============================================================================================================================

// function to format numbers with a comma instead of a dot, and with a specified number of decimal places
function fmt(x, d) {
  const tekst = x.toFixed(d);      // 3.14159 -> "3.14"
  return tekst.replace('.', ',');  // "3.14"  -> "3,14"
}

// updating the shown values on the HTML page
function updateLabels(){
  document.getElementById('oT').textContent = fmt(T,1) + ' ms';
  document.getElementById('oA').textContent = fmt(A,1) + ' mm';
  document.getElementById('fA').textContent = fmt(A,1);
  document.getElementById('fT').textContent = fmt(T,1);
  document.getElementById('fF').textContent = fmt(freq(),0);
}

// frequency in Hz: f = 1/T, with T in ms -> 1000/T
function freq(){
  return 1000 / T;
}

// creates the sound chain once: oscillator -> gain -> speakers
function startSound(){
  if (!audioCtx){
    audioCtx = new AudioContext();
    osc = audioCtx.createOscillator();
    osc.type = 'sine';
    gain = audioCtx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
  }
  audioCtx.resume();
}

// sets the pitch and loudness of the sound to the current T and A
function updateSound(){
  if (!audioCtx) return;
  const loudness = (soundOn && running) ? GAIN_MAX * A / A_MAX : 0;
  // setTargetAtTime changes the value smoothly, otherwise you hear a click
  gain.gain.setTargetAtTime(loudness, audioCtx.currentTime, 0.03);
  osc.frequency.setTargetAtTime(freq(), audioCtx.currentTime, 0.02);
}

// ============================================================================================================================================


sliderT.addEventListener('input', e => {
  T = +e.target.value;
  updateLabels();
  updateSound();
  if (!running) draw();
});

sliderA.addEventListener('input', e => {
  A = +e.target.value;
  updateLabels();
  updateSound();
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
  updateSound();
});

soundBtn.addEventListener('click', e => {
  soundOn = !soundOn;
  if (soundOn) startSound();
  e.target.textContent = soundOn ? 'Geluid uit' : 'Geluid aan';
  e.target.classList.toggle('sound-on', soundOn);
  updateSound();
});

photoBtn.addEventListener('click', e => {
  photo.hidden = !photo.hidden;
  e.target.textContent = photo.hidden ? 'Toon echte luidspreker' : 'Verberg foto';
});

// if the photo file is missing, show a message instead of a broken image
function photoMissing(){
  photoImg.hidden = true;
  document.getElementById('photoCaption').textContent = 'Foto niet gevonden: zet een foto in de map img met de naam luidspreker.jpg.';
}

photoImg.addEventListener('error', photoMissing);
// the image can already have failed before this script runs (defer), then the error event is missed
if (photoImg.complete && photoImg.naturalWidth === 0) photoMissing();

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

// current displacement in mm: y = A·sin(phase)
function curY(){
  return A * Math.sin(phase);
}

function draw(){
  const W = cv.clientWidth;
  const H = cv.clientHeight;
  const c = { frame:css('--frame'), cone:css('--cone'), trace:css('--trace'), eq:css('--eq'),
              help:css('--help'), grid:css('--grid'), muted:css('--muted'), line:css('--line'), bg:css('--bg') };
  ctx.clearRect(0,0,W,H);

  const devW = Math.max(170, Math.min(320, W*0.34)); // width of the speaker area on the left
  const top = 30, bottom = H - 34;
  const midY = (top + bottom) / 2;                     // y = 0: top of the dust cap at rest
  const scale = (bottom - midY - 10) / YMAX;           // px per mm (the same in the speaker and in the graph)
  const toPx = y => midY - y * scale;
  const gx0 = devW + 44, gx1 = W - 14;                 // graph area

  // speaker area
  const cx = devW * 0.5;
  const groundY = H - 16;
  const rimY = midY - 30;                              // height of the fixed rim
  const rRim = Math.min(devW * 0.36, 100);             // half width of the opening

  // label: slow motion
  ctx.fillStyle = c.muted; ctx.font = '12px ' + css('--body'); ctx.textAlign = 'left';
  ctx.fillText('500× vertraagd', 8, 16);

  // cabinet: two walls and a bottom, open at the top, with a ledge to the rim
  ctx.strokeStyle = c.frame; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const wallL = cx - rRim - 14, wallR = cx + rRim + 14;
  ctx.beginPath();
  ctx.moveTo(cx - rRim, rimY); ctx.lineTo(wallL, rimY); ctx.lineTo(wallL, groundY);
  ctx.lineTo(wallR, groundY); ctx.lineTo(wallR, rimY); ctx.lineTo(cx + rRim, rimY);
  ctx.stroke();

  // magnet at the bottom of the cabinet
  ctx.fillStyle = c.frame;
  ctx.fillRect(cx - 34, groundY - 26, 68, 26);
  ctx.fillStyle = '#fff'; ctx.font = '700 11px ' + css('--body'); ctx.textAlign = 'center';
  ctx.fillText('magneet', cx, groundY - 9); ctx.textAlign = 'left';

  // equilibrium position: dashed line through the top of the dust cap at rest
  ctx.setLineDash([6,6]); ctx.strokeStyle = c.eq; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(8, midY); ctx.lineTo(gx1, midY); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = c.muted; ctx.font = '12px ' + css('--body'); ctx.textAlign = 'right';
  ctx.fillText('evenwichtsstand', gx1 - 4, midY - 6); ctx.textAlign = 'left';

  // help line at the speaker: amplitude A
  if (checkboxHelp.checked) drawHelpSpeaker(c, cx, rRim, toPx, midY);

  // membrane (cone + dust cap), shifted over the current displacement
  drawMembrane(c, cx, rRim, rimY, midY, curY() * scale);

  // graph: grid and axes
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
  const tStart = Math.max(0, t - WINDOW);
  const tx = tt => gx0 + (tt - tStart) / WINDOW * (gx1 - gx0);
  const step = (gx1 - gx0) < 300 ? 4 : 2;              // ms between grid lines (fewer on a small screen)
  const firstMs = Math.ceil(tStart / step) * step;
  for (let s=firstMs; s<=tStart+WINDOW; s+=step){ const x=tx(s); ctx.beginPath(); ctx.moveTo(x,top); ctx.lineTo(x,bottom); ctx.stroke(); }
  for (let v=-6; v<=6; v+=1){ if(!v) continue; const yy=toPx(v); ctx.beginPath(); ctx.moveTo(gx0,yy); ctx.lineTo(gx1,yy); ctx.stroke(); }
  ctx.strokeStyle = c.muted; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(gx0, top); ctx.lineTo(gx0, bottom); ctx.stroke();
  ctx.fillStyle = c.muted; ctx.font = '12px ' + css('--mono'); ctx.textAlign='right';
  for (let v=-6; v<=6; v+=2){ ctx.fillText(String(v), gx0-6, toPx(v)+4); }
  ctx.textAlign='center';
  for (let s=firstMs; s<=tStart+WINDOW; s+=step){ ctx.fillText(String(s), tx(s), bottom+16); }
  ctx.textAlign='left';
  ctx.fillText('y (mm)', gx0+6, top-8);
  ctx.textAlign='right'; ctx.fillText('t (ms)', gx1, bottom+30); ctx.textAlign='left';

  // trace
  ctx.save(); ctx.beginPath(); ctx.rect(gx0, top-2, gx1-gx0, bottom-top+4); ctx.clip();
  ctx.strokeStyle = c.trace; ctx.lineWidth = 2.6; ctx.beginPath();
  let started=false;
  for (const p of hist){ if (p.t < tStart) continue; const X=tx(p.t), Y=toPx(p.y); if(!started){ctx.moveTo(X,Y);started=true;} else ctx.lineTo(X,Y); }
  ctx.stroke(); ctx.restore();

  // connection line: top of the dust cap -> pen, so you see that the graph IS the motion of the membrane
  const yPen = toPx(curY());
  ctx.setLineDash([3,4]); ctx.strokeStyle = c.cone; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(cx + 6, yPen); ctx.lineTo(tx(t), yPen); ctx.stroke(); ctx.setLineDash([]);

  // pen: current point of the graph
  ctx.fillStyle = c.cone; ctx.beginPath(); ctx.arc(tx(t), yPen, 5, 0, Math.PI*2); ctx.fill();

  // help line T in the graph
  if (checkboxHelp.checked) drawHelpGraph(c, tx, toPx, gx0, gx1);
}

// draws the moving part: cone, dust cap and the rubber edge that holds it (dy in px, up = positive)
function drawMembrane(c, cx, rRim, rimY, midY, dy){
  const rCone = rRim - 18;                             // half width of the cone at the top
  const rCap = 20;                                     // radius of the dust cap
  const edgeY = rimY - dy;                             // top edge of the cone
  const neckY = midY + rCap - dy;                      // bottom of the cone, where the dust cap sits

  // rubber edge: fixed at the rim, moves along with the cone (works as the spring)
  ctx.strokeStyle = c.frame; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - rRim, rimY); ctx.quadraticCurveTo(cx - (rRim + rCone)/2, edgeY - 10, cx - rCone, edgeY);
  ctx.moveTo(cx + rRim, rimY); ctx.quadraticCurveTo(cx + (rRim + rCone)/2, edgeY - 10, cx + rCone, edgeY);
  ctx.stroke();

  // cone: light filling + thick sides
  ctx.beginPath();
  ctx.moveTo(cx - rCone, edgeY); ctx.lineTo(cx - rCap, neckY); ctx.lineTo(cx + rCap, neckY); ctx.lineTo(cx + rCone, edgeY);
  ctx.closePath();
  ctx.globalAlpha = 0.18; ctx.fillStyle = c.cone; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = c.cone; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - rCone, edgeY); ctx.lineTo(cx - rCap, neckY);
  ctx.moveTo(cx + rCone, edgeY); ctx.lineTo(cx + rCap, neckY);
  ctx.stroke();

  // dust cap: half circle on the bottom of the cone, its top is the point we follow
  ctx.fillStyle = c.cone;
  ctx.beginPath(); ctx.arc(cx, neckY, rCap, Math.PI, 2*Math.PI); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx, neckY - rCap, 3.5, 0, Math.PI*2); ctx.fill();
}

// help line at the speaker: arrow A from the equilibrium position to the highest position
function drawHelpSpeaker(c, cx, rRim, toPx, midY){
  const x = cx + rRim + 32;
  ctx.strokeStyle = c.help; ctx.fillStyle = c.help; ctx.lineWidth = 1.2; ctx.setLineDash([3,4]);
  ctx.beginPath(); ctx.moveTo(cx, toPx(A)); ctx.lineTo(x + 6, toPx(A)); ctx.stroke(); ctx.setLineDash([]);
  ctx.lineWidth = 2;
  arrow(x, midY, x, toPx(A));
  ctx.font = '700 13px ' + css('--body');
  ctx.fillText('A', x + 6, (midY + toPx(A)) / 2 + 4);
}

// help line in the graph: T between the last two peaks of the trace
function drawHelpGraph(c, tx, toPx, gx0, gx1){
  ctx.strokeStyle = c.help; ctx.fillStyle = c.help; ctx.lineWidth = 2; ctx.font = '700 13px ' + css('--body');
  const peaks = [];
  for (let i=1;i<hist.length-1;i++){ if (hist[i].y>hist[i-1].y && hist[i].y>=hist[i+1].y && hist[i].y>0.2) peaks.push(hist[i]); }
  if (peaks.length >= 2){
    const p2 = peaks[peaks.length-1], p1 = peaks[peaks.length-2];
    const x1 = tx(p1.t), x2 = tx(p2.t);
    if (x1 > gx0 && x2 < gx1){
      const yy = Math.min(toPx(p1.y), toPx(p2.y)) - 14;
      ctx.setLineDash([2,3]); ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x1,toPx(p1.y)); ctx.lineTo(x1,yy-4); ctx.moveTo(x2,toPx(p2.y)); ctx.lineTo(x2,yy-4); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth=2;
      arrow(x1, yy, x2, yy); arrow(x2, yy, x1, yy);
      ctx.textAlign='center'; ctx.fillText('T = ' + fmt(p2.t-p1.t,2) + ' ms', (x1+x2)/2, yy-7); ctx.textAlign='left';
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
  // dt on the screen in s, divided by SLOWDOWN = real time that passes in the simulation
  const dt = Math.min(0.05, (now - last) / 1000) * speed / SLOWDOWN;
  last = now;

  if (running){
    t += dt * 1000; phase += 2*Math.PI*freq()*dt;
    hist.push({t, y: curY()});
    while (hist.length && hist[0].t < t - WINDOW - 1) hist.shift();
    document.getElementById('rt').textContent = fmt(t,2);
    document.getElementById('rY').textContent = fmt(curY(),1);
  }
  draw();
  requestAnimationFrame(tick);
}


// Functions that are called when the page is loaded
updateLabels();
resize();
requestAnimationFrame(tick);
