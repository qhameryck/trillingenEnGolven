(() => {
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const sA = document.getElementById('sA'), sT = document.getElementById('sT');
  const playBtn = document.getElementById('play'), clearBtn = document.getElementById('clear');
  const speedSel = document.getElementById('speed'), helpBox = document.getElementById('help');
  const fmt = (x, d) => x.toFixed(d).replace('.', ',');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let A = +sA.value, T = +sT.value, phase = 0, t = 0, running = true, speed = 1;
  let hist = [];            // {t, y}
  const WINDOW = 10;        // seconden zichtbaar in de grafiek
  const YMAX = 11;          // cm schaal

  if (reduce) { speed = 0.5; speedSel.value = '0.5'; }

  function updateLabels(){
    document.getElementById('oA').textContent = fmt(A,1) + ' cm';
    document.getElementById('oT').textContent = fmt(T,1) + ' s';
    document.getElementById('fA').textContent = fmt(A,1);
    document.getElementById('fT').textContent = fmt(T,1);
    document.getElementById('fF').textContent = fmt(1/T,2);
  }
  sA.addEventListener('input', () => { A = +sA.value; updateLabels(); if(!running) draw(); });
  sT.addEventListener('input', () => { T = +sT.value; updateLabels(); if(!running) draw(); });
  speedSel.addEventListener('change', () => { speed = +speedSel.value; });
  helpBox.addEventListener('change', () => { if(!running) draw(); });
  playBtn.addEventListener('click', () => {
    running = !running; playBtn.textContent = running ? 'Pauze' : 'Start';
    if (running) { last = performance.now(); }
  });
  clearBtn.addEventListener('click', () => { hist = []; t = 0; phase = 0; draw(); });

  function css(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function resize(){
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    draw();
  }
  window.addEventListener('resize', resize);

  function curY(){ return A * Math.sin(phase); }

  function draw(){
    const W = cv.clientWidth, H = cv.clientHeight;
    const c = { spring:css('--spring'), mass:css('--mass'), trace:css('--trace'), eq:css('--eq'),
                help:css('--help'), grid:css('--grid'), fg:css('--fg'), muted:css('--muted'), line:css('--line') };
    ctx.clearRect(0,0,W,H);

    const devW = Math.max(110, Math.min(220, W*0.24));
    const top = 30, bottom = H - 34;
    const midY = top + (bottom - top) * 0.58;            // evenwichtslijn
    const scale = (bottom - midY - 22) / YMAX;           // px per cm
    const toPx = y => midY - y * scale;
    const gx0 = devW + 44, gx1 = W - 14;                 // grafiekgebied

    // plafond
    const cx = devW * 0.5;
    ctx.fillStyle = c.line; ctx.fillRect(cx-46, top-14, 92, 10);
    ctx.strokeStyle = c.spring; ctx.lineWidth = 2;
    for (let i=-40;i<46;i+=10){ ctx.beginPath(); ctx.moveTo(cx+i, top-14); ctx.lineTo(cx+i-8, top-22); ctx.stroke(); }

    const y = curY(), my = toPx(y);
    const mh = 34, mw = 46;

    // veer: zigzag van plafond tot bovenkant massa
    const s0 = top - 4, s1 = my - mh/2, coils = 12, amp = 14;
    ctx.beginPath(); ctx.moveTo(cx, s0); ctx.lineTo(cx, s0+8);
    const seg = (s1 - s0 - 16) / (coils*2);
    for (let i=0;i<coils*2;i++){ ctx.lineTo(cx + (i%2?-amp:amp), s0 + 8 + seg*(i+0.5)); }
    ctx.lineTo(cx, s1-8); ctx.lineTo(cx, s1);
    ctx.strokeStyle = c.spring; ctx.lineWidth = 2.2; ctx.lineJoin='round'; ctx.stroke();

    // evenwichtslijn over hele breedte
    ctx.setLineDash([6,6]); ctx.strokeStyle = c.eq; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(8, midY); ctx.lineTo(gx1, midY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = c.muted; ctx.font = '12px ' + css('--body');
    ctx.fillText('evenwichtslijn', 8, midY - 6);

    // massa
    ctx.fillStyle = c.mass; roundRect(cx-mw/2, my-mh/2, mw, mh, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 14px ' + css('--body'); ctx.textAlign='center';
    ctx.fillText('m', cx, my+5); ctx.textAlign='left';

    // grafiek: rooster en assen
    ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
    const tStart = Math.max(0, t - WINDOW);
    const tx = tt => gx0 + (tt - tStart) / WINDOW * (gx1 - gx0);
    for (let s=Math.ceil(tStart); s<=tStart+WINDOW; s++){ const x=tx(s); ctx.beginPath(); ctx.moveTo(x,top); ctx.lineTo(x,bottom); ctx.stroke(); }
    for (let v=-10; v<=10; v+=5){ if(!v) continue; const yy=toPx(v); ctx.beginPath(); ctx.moveTo(gx0,yy); ctx.lineTo(gx1,yy); ctx.stroke(); }
    ctx.strokeStyle = c.muted; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(gx0, top); ctx.lineTo(gx0, bottom); ctx.stroke();
    ctx.fillStyle = c.muted; ctx.font = '12px ' + css('--mono'); ctx.textAlign='right';
    for (let v=-10; v<=10; v+=5){ ctx.fillText(String(v), gx0-6, toPx(v)+4); }
    ctx.textAlign='center';
    for (let s=Math.ceil(tStart); s<=tStart+WINDOW; s++){ ctx.fillText(String(s), tx(s), bottom+16); }
    ctx.textAlign='left';
    ctx.fillText('y (cm)', gx0+6, top-8);
    ctx.textAlign='right'; ctx.fillText('t (s)', gx1, bottom+30); ctx.textAlign='left';

    // spoor
    ctx.save(); ctx.beginPath(); ctx.rect(gx0, top-2, gx1-gx0, bottom-top+4); ctx.clip();
    ctx.strokeStyle = c.trace; ctx.lineWidth = 2.6; ctx.beginPath();
    let started=false;
    for (const p of hist){ if (p.t < tStart) continue; const X=tx(p.t), Y=toPx(p.y); if(!started){ctx.moveTo(X,Y);started=true;} else ctx.lineTo(X,Y); }
    ctx.stroke(); ctx.restore();

    // verbindingslijn massa -> pen
    const px = tx(t);
    ctx.setLineDash([3,4]); ctx.strokeStyle = c.mass; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx+mw/2+4, my); ctx.lineTo(px, my); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = c.mass; ctx.beginPath(); ctx.arc(px, my, 5, 0, Math.PI*2); ctx.fill();

    // hulplijnen A en T
    if (helpBox.checked) drawHelp(c, tx, toPx, gx0, gx1, top, cx, mw, midY);
  }

  function drawHelp(c, tx, toPx, gx0, gx1, top, cx, mw, midY){
    ctx.strokeStyle = c.help; ctx.fillStyle = c.help; ctx.lineWidth = 2; ctx.font = '700 13px ' + css('--body');
    // A bij het toestel: van evenwicht naar hoogste stand
    const ax = cx - mw/2 - 16, yTop = toPx(A);
    arrow(ax, midY, ax, yTop); ctx.textAlign='right'; ctx.fillText('A', ax-6, (midY+yTop)/2+4); ctx.textAlign='left';
    // T tussen de laatste twee toppen in het spoor
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
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    const a = Math.atan2(y2-y1, x2-x1), h = 7;
    ctx.beginPath(); ctx.moveTo(x2,y2);
    ctx.lineTo(x2 - h*Math.cos(a-0.45), y2 - h*Math.sin(a-0.45));
    ctx.lineTo(x2 - h*Math.cos(a+0.45), y2 - h*Math.sin(a+0.45)); ctx.closePath(); ctx.fill();
  }
  function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

  let last = performance.now();
  function tick(now){
    const dt = Math.min(0.05, (now - last) / 1000) * speed; last = now;
    if (running){
      t += dt; phase += 2*Math.PI*dt/T;
      hist.push({t, y: curY()});
      while (hist.length && hist[0].t < t - WINDOW - 1) hist.shift();
      document.getElementById('rt').textContent = fmt(t,2);
      document.getElementById('ry').textContent = fmt(curY(),1);
    }
    draw();
    requestAnimationFrame(tick);
  }
  updateLabels(); resize(); requestAnimationFrame(tick);
})();
