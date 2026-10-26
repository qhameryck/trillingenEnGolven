
// Shared script for all steps of the learning path.
// The HTML of each step decides WHAT happens through data-attributes:
//   <canvas class="mini" data-highlight="amplitude">   -> animated mass-spring with one concept highlighted
//   <canvas class="graph" data-a="4" data-t="2">        -> static graph for an exercise
//   <div class="question" data-type="choice|number|click"> -> exercise with direct feedback

// constants =====================================================================================================================
const WINDOW = 6;         // seconds visible in a graph
const YMAX = 11;          // cm, scale of a graph

// ============================================================================================================================

// Helper functions ===============================================================================================================

// function to format numbers with a comma instead of a dot, and with a specified number of decimal places
function fmt(x, d) {
  const tekst = x.toFixed(d);      // 3.14159 -> "3.14"
  return tekst.replace('.', ',');  // "3.14"  -> "3,14"
}

// read a CSS variable from :root
function css(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// all colours used on the canvases
function colours(){
  return { spring:css('--spring'), mass:css('--mass'), trace:css('--trace'), eq:css('--eq'),
           help:css('--help'), grid:css('--grid'), muted:css('--muted'), line:css('--line') };
}

// give a canvas a sharp pixel buffer (see resize() in the simulations) and return its context
function setupCanvas(canvas){
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return ctx;
}

function arrow(ctx, x1, y1, x2, y2){
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();

  const a = Math.atan2(y2-y1, x2-x1), h = 7;
  ctx.beginPath(); ctx.moveTo(x2,y2);
  ctx.lineTo(x2 - h*Math.cos(a-0.45), y2 - h*Math.sin(a-0.45));
  ctx.lineTo(x2 - h*Math.cos(a+0.45), y2 - h*Math.sin(a+0.45)); ctx.closePath(); ctx.fill();
}

// draws grid, axes and labels of a y(t) graph between x0 and x1, starting at time tStart; returns the conversion functions
function drawAxes(ctx, c, x0, x1, top, bottom, tStart = 0){
  const midY = (top + bottom) / 2;
  const scale = (bottom - midY - 4) / YMAX;            // px per cm
  const toPx = y => midY - y * scale;
  const tx = t => x0 + (t - tStart) / WINDOW * (x1 - x0);
  const firstS = Math.ceil(tStart);

  ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
  for (let s=firstS; s<=tStart+WINDOW; s++){ ctx.beginPath(); ctx.moveTo(tx(s),top); ctx.lineTo(tx(s),bottom); ctx.stroke(); }
  for (let v=-10; v<=10; v+=5){ if(!v) continue; ctx.beginPath(); ctx.moveTo(x0,toPx(v)); ctx.lineTo(x1,toPx(v)); ctx.stroke(); }

  // equilibrium line
  ctx.setLineDash([6,6]); ctx.strokeStyle = c.eq; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x0, midY); ctx.lineTo(x1, midY); ctx.stroke(); ctx.setLineDash([]);

  // y-axis and labels
  ctx.strokeStyle = c.muted;
  ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bottom); ctx.stroke();
  ctx.fillStyle = c.muted; ctx.font = '12px ' + css('--mono'); ctx.textAlign = 'right';
  for (let v=-10; v<=10; v+=5){ ctx.fillText(String(v), x0-6, toPx(v)+4); }
  ctx.textAlign = 'center';
  for (let s=firstS; s<=tStart+WINDOW; s++){ ctx.fillText(String(s), tx(s), bottom+16); }
  ctx.textAlign = 'left'; ctx.fillText('y (cm)', x0+6, top-6);
  ctx.textAlign = 'right'; ctx.fillText('t (s)', x1, bottom+30); ctx.textAlign = 'left';

  return { midY, toPx, tx };
}

// ============================================================================================================================================


// Progress bar =================================================================================================================

const step = +document.body.dataset.step;
const steps = +document.body.dataset.steps;
const progressBar = document.querySelector('.progress-bar');
if (progressBar) progressBar.style.width = (step / steps * 100) + '%';

// ============================================================================================================================================


// Mini simulation: mass-spring with one concept highlighted =====================================================================

const mini = document.querySelector('canvas.mini');
if (mini) startMini(mini);

function startMini(canvas){
  const highlight = canvas.dataset.highlight;           // which concept lights up: evenwicht, uitwijking, amplitude, periode, frequentie
  const sliderA = document.getElementById('sA');        // optional sliders: only present on some steps
  const sliderT = document.getElementById('sT');
  const playBtn = document.getElementById('play');

  let A = sliderA ? +sliderA.value : +(canvas.dataset.a || 5);
  let T = sliderT ? +sliderT.value : +(canvas.dataset.t || 2);
  let phase = 0, t = 0, running = true, hist = [];
  let ctx = setupCanvas(canvas);

  function updateLabels(){
    const oA = document.getElementById('oA'), oT = document.getElementById('oT');
    if (oA) oA.textContent = fmt(A,1) + ' cm';
    if (oT) oT.textContent = fmt(T,1) + ' s';
  }

  if (sliderA) sliderA.addEventListener('input', e => { A = +e.target.value; updateLabels(); if (!running) draw(); });
  if (sliderT) sliderT.addEventListener('input', e => { T = +e.target.value; updateLabels(); if (!running) draw(); });
  if (playBtn) playBtn.addEventListener('click', e => {
    running = !running;
    e.target.textContent = running ? 'Pauze' : 'Start';
    if (running) last = performance.now();
  });
  window.addEventListener('resize', () => { ctx = setupCanvas(canvas); draw(); });

  function draw(){
    const W = canvas.clientWidth, H = canvas.clientHeight, c = colours();
    ctx.clearRect(0,0,W,H);

    const devW = Math.max(100, Math.min(180, W*0.24));
    const top = 26, bottom = H - 34;
    const gx0 = devW + 40, gx1 = W - 14;
    const tStart = Math.max(0, t - WINDOW);

    // graph (the time window shifts along when t passes WINDOW)
    const g = drawAxes(ctx, c, gx0, gx1, top, bottom, tStart);
    const tx = g.tx;

    // spring and mass on the left
    const cx = devW * 0.5, y = A * Math.sin(phase), my = g.toPx(y), mh = 30, mw = 42;
    ctx.fillStyle = c.line; ctx.fillRect(cx-40, top-16, 80, 8);
    const s0 = top - 8, s1 = my - mh/2, coils = 10, amp = 12;
    const seg = (s1 - s0 - 16) / (coils*2);
    ctx.beginPath(); ctx.moveTo(cx, s0); ctx.lineTo(cx, s0+8);
    for (let i=0;i<coils*2;i++){ ctx.lineTo(cx + (i%2?-amp:amp), s0 + 8 + seg*(i+0.5)); }
    ctx.lineTo(cx, s1);
    ctx.strokeStyle = c.spring; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.setLineDash([6,6]); ctx.strokeStyle = c.eq; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(8, g.midY); ctx.lineTo(gx0, g.midY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = c.mass; ctx.fillRect(cx-mw/2, my-mh/2, mw, mh);

    // trace
    ctx.save(); ctx.beginPath(); ctx.rect(gx0, top-2, gx1-gx0, bottom-top+4); ctx.clip();
    ctx.strokeStyle = c.trace; ctx.lineWidth = 2.6; ctx.beginPath();
    let started = false;
    for (const p of hist){ if (p.t < tStart) continue; const X=tx(p.t), Y=g.toPx(p.y); if(!started){ctx.moveTo(X,Y);started=true;} else ctx.lineTo(X,Y); }
    ctx.stroke(); ctx.restore();

    // connection line mass -> pen
    const px = tx(t);
    ctx.setLineDash([3,4]); ctx.strokeStyle = c.mass; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx+mw/2+4, my); ctx.lineTo(px, my); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = c.mass; ctx.beginPath(); ctx.arc(px, my, 5, 0, Math.PI*2); ctx.fill();

    // the concept of this step
    ctx.strokeStyle = c.help; ctx.fillStyle = c.help; ctx.lineWidth = 2; ctx.font = '700 13px ' + css('--body');
    if (highlight === 'amplitude') highlightAmplitude(c, g, cx, mw, gx0, gx1);
    // other steps: add highlightEvenwicht(), highlightUitwijking(), ... here
  }

  // amplitude: dashed lines at +A and -A in the graph, arrow from equilibrium to +A at the mass
  function highlightAmplitude(c, g, cx, mw, gx0, gx1){
    const yTop = g.toPx(A), yBottom = g.toPx(-A);
    ctx.setLineDash([4,4]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(gx0, yTop); ctx.lineTo(gx1, yTop); ctx.moveTo(gx0, yBottom); ctx.lineTo(gx1, yBottom); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 2;
    ctx.textAlign = 'right'; ctx.fillText('+A = ' + fmt(A,1) + ' cm', gx1 - 4, yTop - 6); ctx.textAlign = 'left';
    ctx.textAlign = 'right'; ctx.fillText('−A', gx1 - 4, yBottom + 16); ctx.textAlign = 'left';
    const ax = cx - mw/2 - 14;
    arrow(ctx, ax, g.midY, ax, yTop);
    ctx.textAlign = 'right'; ctx.fillText('A', ax - 5, (g.midY + yTop)/2 + 4); ctx.textAlign = 'left';
  }

  let last = performance.now();
  function tick(now){
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (running){
      t += dt; phase += 2*Math.PI*dt/T;
      hist.push({t, y: A * Math.sin(phase)});
      while (hist.length && hist[0].t < t - WINDOW - 1) hist.shift();
    }
    draw();
    requestAnimationFrame(tick);
  }

  updateLabels();
  requestAnimationFrame(tick);
}

// ============================================================================================================================================


// Static graphs for the exercises ================================================================================================

// draws y = A·sin(2πt/T) from 0 to WINDOW s, with an optional marker (clicked point); returns the layout
function drawGraph(canvas, marker){
  const ctx = setupCanvas(canvas);
  const W = canvas.clientWidth, H = canvas.clientHeight, c = colours();
  const A = +canvas.dataset.a, T = +canvas.dataset.t;
  ctx.clearRect(0,0,W,H);

  const x0 = 44, x1 = W - 14, top = 22, bottom = H - 34;
  const g = drawAxes(ctx, c, x0, x1, top, bottom);

  ctx.strokeStyle = c.trace; ctx.lineWidth = 2.6; ctx.beginPath();
  for (let i=0; i<=400; i++){
    const tt = i / 400 * WINDOW, X = g.tx(tt), Y = g.toPx(A * Math.sin(2*Math.PI*tt/T));
    if (i === 0) ctx.moveTo(X,Y); else ctx.lineTo(X,Y);
  }
  ctx.stroke();

  if (marker){
    ctx.fillStyle = marker.ok ? css('--ok') : css('--bad');
    ctx.beginPath(); ctx.arc(g.tx(marker.t), g.toPx(marker.y), 6, 0, Math.PI*2); ctx.fill();
  }
  return { x0, x1, A, T };
}

const graphs = document.querySelectorAll('canvas.graph');
graphs.forEach(canvas => drawGraph(canvas));
window.addEventListener('resize', () => graphs.forEach(canvas => drawGraph(canvas, canvas.marker)));

// ============================================================================================================================================


// Exercises with direct feedback ===============================================================================================

const questions = document.querySelectorAll('.question');
questions.forEach(q => {
  if (q.dataset.type === 'choice') setupChoice(q);
  if (q.dataset.type === 'number') setupNumber(q);
  if (q.dataset.type === 'click') setupClick(q);
});

// show feedback under a question and remember whether it was answered correctly
function giveFeedback(q, ok, text){
  const fb = q.querySelector('.feedback');
  fb.textContent = text;
  fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
  if (ok) q.dataset.solved = 'true';
  checkAllSolved();
}

// multiple choice: every button has its own feedback in data-feedback
function setupChoice(q){
  q.querySelectorAll('.options button').forEach(btn => {
    btn.addEventListener('click', e => {
      const ok = e.currentTarget.dataset.value === q.dataset.correct;
      q.querySelectorAll('.options button').forEach(b => b.classList.remove('right', 'wrong'));
      e.currentTarget.classList.add(ok ? 'right' : 'wrong');
      giveFeedback(q, ok, e.currentTarget.dataset.feedback);
    });
  });
}

// number: answer within a tolerance, with extra feedback for a known mistake
function setupNumber(q){
  const input = q.querySelector('input');
  const answer = +q.dataset.answer, tol = +q.dataset.tolerance;

  function check(){
    const value = parseFloat(input.value.replace(',', '.'));
    if (isNaN(value)) { giveFeedback(q, false, 'Vul een getal in.'); return; }
    if (Math.abs(value - answer) <= tol) { giveFeedback(q, true, 'Juist!'); return; }
    if (q.dataset.mistake && Math.abs(value - +q.dataset.mistake) <= tol) { giveFeedback(q, false, q.dataset.mistakeFeedback); return; }
    giveFeedback(q, false, 'Niet juist. Kijk nog eens goed naar de grafiek en probeer opnieuw.');
  }

  q.querySelector('.check').addEventListener('click', check);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
}

// click: the student clicks a moment on the graph; "extreme" = a point where |y| = A
function setupClick(q){
  const canvas = q.querySelector('canvas.graph');
  canvas.addEventListener('click', e => {
    const layout = drawGraph(canvas);
    const r = canvas.getBoundingClientRect();
    const tClick = (e.clientX - r.left - layout.x0) / (layout.x1 - layout.x0) * WINDOW;
    if (tClick < 0 || tClick > WINDOW) return;
    const y = layout.A * Math.sin(2*Math.PI*tClick/layout.T);
    const ok = Math.abs(y) >= 0.9 * layout.A;

    canvas.marker = { t: tClick, y, ok };
    drawGraph(canvas, canvas.marker);
    if (ok) giveFeedback(q, true, 'Juist! Hier is de uitwijking ' + fmt(y,1) + ' cm: dat is een top (+A) of een dal (−A). In beide gevallen is het voorwerp zo ver mogelijk van de evenwichtsstand.');
    else giveFeedback(q, false, 'Hier is de uitwijking maar ' + fmt(y,1) + ' cm. Zoek een moment waarop het voorwerp zo ver mogelijk van de evenwichtslijn is.');
  });
}

// when every question is solved: show "Stap voltooid" and remember it in this browser
function checkAllSolved(){
  const allSolved = [...questions].every(q => q.dataset.solved === 'true');
  if (!allSolved) return;
  document.querySelector('.done').hidden = false;
  try { localStorage.setItem('leerpad-stap-' + step, 'done'); } catch (e) { /* storage not available: no problem */ }
}
