(() => {
  // 스크롤 연동 엔진: 휠·터치 입력량만큼 패널이 실제로 밀려 올라가고, 손을 떼면 가까운 장면으로 스냅.
  // 나가는 패널은 위로 빠지며 커지고(1.29) -7도 기울고 어두워짐, 들어오는 패널은 +7도·1.29에서 바로 섬.
  const S = [...document.querySelectorAll('.scene')], N = S.length;
  const V = S.map(s => [...s.querySelectorAll('video')]);
  const I = S.map(s => { const d = document.createElement('div'); d.className = 'inner'; while (s.firstChild) d.appendChild(s.firstChild); s.appendChild(d); return d; });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mq = matchMedia('(max-width: 819px)');
  const stage = document.querySelector('.stage');
  const SC = 0.29, ROT = 7, LAG = 180, DIM = 0.5;
  let pos = 0, target = 0, base = 0, a = 0, lastDir = 1, idleT, touching = false, ty0 = 0, tp0 = 0, tt0 = 0, menuOpen = false, raf = 0, last = 0, lastWheel = 0, spent = false, peak = 0, prevAb = 0;
  const H = () => stage.clientHeight || innerHeight;
  const wrap = o => { o = ((o % N) + N) % N; return o > N / 2 ? o - N : o; };

  function render() {
    const h = H();
    S.forEach((s, i) => {
      const o = wrap(i - pos), vis = Math.abs(o) < 1;
      s.style.visibility = vis ? 'visible' : 'hidden';
      if (!vis) return;
      const p = Math.max(-1, Math.min(1, o)), q = Math.abs(p);
      if (reduce) { s.style.transform = 'none'; s.style.opacity = 1 - q; I[i].style.transform = 'none'; I[i].style.opacity = 1; return; }
      s.style.opacity = 1;
      s.style.transform = `translate3d(0,${(o * h).toFixed(2)}px,0)`;
      I[i].style.transform = `translate3d(0,${(-LAG * p * h / 900).toFixed(2)}px,0) rotate(${(ROT * p).toFixed(3)}deg) scale(${(1 + SC * q).toFixed(4)})`;
      I[i].style.opacity = (1 - DIM * q).toFixed(3);
    });
    const n = ((Math.round(pos) % N) + N) % N;
    if (n !== a) { a = n; ui(); media(); }
  }

  function tick(t) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    const k = touching ? 1 - Math.exp(-dt / 0.045) : 1 - Math.exp(-dt / 0.22);
    pos += (target - pos) * k;
    if (Math.abs(target - pos) < 0.0005 && !touching) { pos = target; render(); raf = 0; last = 0; settle(); return; }
    render(); raf = requestAnimationFrame(tick);
  }
  const run = () => { if (!raf) raf = requestAnimationFrame(tick); };
  function settle() {
    // 정수 위치로 정착하면 숫자 범위를 0..N-1 로 되돌림(무한 루프)
    const r = ((Math.round(pos) % N) + N) % N; pos = target = base = r; render();
  }

  // 한 번의 제스처는 최대 한 장면. 손을 떼면 진행 방향으로 12% 이상 밀었으면 다음, 아니면 제자리
  function snap(th = 0.12) {
    const d = target - base;
    target = Math.abs(d) > th ? base + Math.sign(d) : base;
    run();
  }

  function go(n) {
    setMenu(false);
    const d = wrap(n - pos);
    if (Math.abs(d) < 0.001) return;
    base = Math.round(pos + d); target = base; lastDir = Math.sign(d); run();
  }
  const step = d => { base = Math.round(target); go(((base + d) % N + N) % N); };

  const fits = v => (v.dataset.only === 'm') === mq.matches;
  function media() {
    V.forEach((vs, i) => {
      const d = Math.min((i - a + N) % N, (a - i + N) % N);
      vs.forEach(v => {
        if (d <= 1 && fits(v)) {
          if (v.preload !== 'auto') v.preload = 'auto';
          if (v.paused && !document.hidden) { const p = v.play(); if (p) p.catch(() => {}); }
        } else if (!v.paused) v.pause();
      });
    });
  }

  const pad = n => String(n).padStart(2, '0');
  const labels = S.map(s => s.dataset.label);
  const navMap = [['Why', 1], ['How', 2], ['Price', 3], ['Speed', 4], ['Start', 5]];
  const rail = document.getElementById('rail'), nav = document.getElementById('nav'), list = document.getElementById('menulist');
  const railB = labels.map((l, i) => {
    const b = document.createElement('button');
    b.title = l; b.style.backgroundImage = `url("${S[i].dataset.thumb}")`;
    b.innerHTML = `<span>${pad(i + 1)}</span><span>${l}</span>`;
    b.onclick = () => go(i); rail.appendChild(b); return b;
  });
  const navB = navMap.map(([l, i]) => { const b = document.createElement('button'); b.textContent = l; b.onclick = () => go(i); nav.appendChild(b); return [b, i]; });
  const menuB = navMap.map(([l, i], k) => { const b = document.createElement('button'); b.innerHTML = `<b>${pad(k + 1)}</b><span>${l}</span>`; b.onclick = () => go(i); list.appendChild(b); return [b, i]; });

  function ui() {
    S.forEach((s, i) => s.classList.toggle('on', i === a));
    document.getElementById('count').textContent = `${pad(a + 1)} / ${pad(N)}`;
    document.getElementById('prog').style.width = `${((a + 1) / N) * 100}%`;
    railB.forEach((b, i) => b.classList.toggle('on', i === a));
    navB.concat(menuB).forEach(([b, i]) => b.classList.toggle('on', i === a));
  }

  function setMenu(open) {
    menuOpen = open;
    document.getElementById('menu').hidden = !open;
    document.getElementById('menulabel').textContent = open ? 'CLOSE' : 'MENU';
    document.getElementById('menubtn').setAttribute('aria-expanded', open);
  }

  window.addEventListener('wheel', e => {
    if (menuOpen) return;
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * H() : e.deltaY;
    const now = performance.now(), gap = now - lastWheel, ab = Math.abs(dy); lastWheel = now;
    // 관성 스트림(점점 약해지는 신호)으로는 한 장면만. 장면이 거의 자리잡은 뒤
    // 입력이 끊겼다 오거나(150ms+) 신호가 다시 세지면(새로 쓸어 올림) 새 제스처로 보고 다음 장면 허용
    const fresh = gap > 150 || ab > peak * 1.15 + 2 || (ab >= 40 && ab >= prevAb && gap > 30);
    if (spent && fresh && Math.abs(pos - target) < 0.2) { spent = false; base = Math.round(target); peak = 0; }
    else if (!spent && gap > 150 && Math.abs(pos - target) < 0.2) base = Math.round(target);
    peak = spent ? Math.max(peak * 0.96, ab) : Math.max(peak, ab); prevAb = ab;
    if (spent) return;
    target = Math.max(base - 1, Math.min(base + 1, target + dy / H() * 0.9));
    if (Math.abs(target - base) >= 0.999) spent = true;
    run(); clearTimeout(idleT); idleT = setTimeout(() => snap(0.05), 140);
  }, { passive: false });
  window.addEventListener('keydown', e => {
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); step(1); }
    if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1); }
    if (e.key === 'Escape' && menuOpen) setMenu(false);
  });
  window.addEventListener('touchstart', e => {
    if (menuOpen) return;
    touching = true; ty0 = e.touches[0].clientY; tt0 = performance.now(); base = Math.round(pos); tp0 = pos; clearTimeout(idleT);
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (!touching) return;
    if (e.cancelable) e.preventDefault();
    const d = (ty0 - e.touches[0].clientY) / H();
    target = Math.max(base - 1, Math.min(base + 1, tp0 + d)); run();
  }, { passive: false });
  window.addEventListener('touchend', e => {
    if (!touching) return;
    touching = false;
    const dy = ty0 - e.changedTouches[0].clientY, v = dy / Math.max(1, performance.now() - tt0);
    if (Math.abs(v) > 0.35 && Math.abs(dy) > 20) target = base + Math.sign(dy); else snap();
    run();
  }, { passive: true });
  addEventListener('resize', render);
  document.getElementById('logo').onclick = e => { e.preventDefault(); go(0); };
  document.getElementById('menubtn').onclick = () => setMenu(!menuOpen);
  document.querySelectorAll('a[href="#"]').forEach(x => x.addEventListener('click', e => e.preventDefault()));
  document.addEventListener('visibilitychange', () => document.hidden ? V.flat().forEach(v => v.pause()) : media());
  if (mq.addEventListener) mq.addEventListener('change', media); else mq.addListener(media);

  a = -1; render(); if (a < 0) { a = 0; ui(); media(); }
})();
