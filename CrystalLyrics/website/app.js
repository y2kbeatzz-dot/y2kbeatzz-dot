'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const menu = document.querySelector('.menu-toggle');
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    $('navigation').classList.toggle('open', open);
  });
  document.querySelectorAll('#navigation a').forEach(a => a.addEventListener('click', () => {
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Open navigation');
    $('navigation').classList.remove('open');
  }));
  const stage = $('music-stage');
  if (!stage) return;
  document.querySelectorAll('button[data-palette]').forEach(button => button.addEventListener('click', () => {
    stage.dataset.palette = button.dataset.palette;
    document.querySelectorAll('button[data-palette]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    $('palette-name').textContent = button.dataset.palette[0].toUpperCase() + button.dataset.palette.slice(1);
  }));
  $('font-select').addEventListener('change', event => {
    $('demo-lyrics').style.fontFamily = '"' + event.target.value + '", sans-serif';
  });
  $('box-opacity').addEventListener('input', event => {
    $('demo-lyrics').style.setProperty('--box-opacity', Number(event.target.value) / 100);
    $('opacity-value').textContent = event.target.value + '%';
  });
  $('glow-toggle').addEventListener('click', () => {
    const glow = $('glow-toggle').getAttribute('aria-pressed') !== 'true';
    $('glow-toggle').setAttribute('aria-pressed', String(glow));
    stage.classList.toggle('glow-off', !glow);
  });

  const phrases = [
    'Let the night find its color',
    'Every word, a little brighter',
    'Keep this little moment with you',
    'Let the music feel like home'
  ];
  let time = 8, playing = false, previousStamp = 0, frame = 0, lastDraw = 0;
  let renderedLine = -1, wordNodes = [];
  const progress = $('demo-progress');
  function render() {
    const line = Math.min(3, Math.floor(time / 6));
    const words = phrases[line].split(' ');
    if (renderedLine !== line) {
      $('previous-line').textContent = phrases[(line + 3) % phrases.length];
      $('next-line').textContent = phrases[(line + 1) % phrases.length];
      const current = $('current-line'); current.replaceChildren();
      wordNodes = words.map((word, index) => {
        const span = document.createElement('span'); span.className = 'word'; span.textContent = word; current.append(span);
        if (index === 1 && line === 1) current.append(document.createElement('br'));
        else if (index < words.length - 1) current.append(document.createTextNode(' '));
        return span;
      });
      renderedLine = line;
    }
    const position = ((time % 6) / 6) * words.length;
    wordNodes.forEach((span, index) => {
      span.className = 'word' + (index < Math.floor(position) ? ' done' : index === Math.floor(position) ? ' active' : '');
      span.style.setProperty('--fill', (Math.min(1, Math.max(0, position - index)) * 100).toFixed(1) + '%');
    });
    progress.value = String(time);
    $('demo-time').textContent = '0:' + String(Math.floor(time)).padStart(2, '0');
    progress.setAttribute('aria-valuetext', Math.floor(time) + ' seconds of the 24 second visual demo');
  }
  function tick(stamp) {
    if (!playing) return;
    if (previousStamp) time = (time + Math.min(.15, (stamp - previousStamp) / 1000)) % 24;
    previousStamp = stamp;
    if (stamp - lastDraw >= 50) { render(); lastDraw = stamp; }
    frame = requestAnimationFrame(tick);
  }
  function setPlaying(value) {
    playing = value; previousStamp = 0; cancelAnimationFrame(frame);
    $('play-demo').setAttribute('aria-pressed', String(value));
    $('play-demo').setAttribute('aria-label', value ? 'Pause visual demo' : 'Play visual demo');
    $('play-symbol').textContent = value ? 'Ⅱ' : '▶';
    if (value) frame = requestAnimationFrame(tick);
  }
  $('play-demo').addEventListener('click', () => setPlaying(!playing));
  progress.addEventListener('input', event => { time = Math.min(23.999, Number(event.target.value)); previousStamp = 0; render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting && playing) setPlaying(false);
  }, { threshold: .05 }).observe(stage);
  render();

  const box = $('demo-lyrics'), handle = $('drag-handle');
  let drag = null;
  function move(left, top) {
    box.style.left = Math.max(0, Math.min(stage.clientWidth - box.offsetWidth, left)) + 'px';
    box.style.top = Math.max(50, Math.min(stage.clientHeight - box.offsetHeight - 54, top)) + 'px';
  }
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = {x:event.clientX, y:event.clientY, left:box.offsetLeft, top:box.offsetTop};
    handle.setPointerCapture(event.pointerId); box.classList.add('dragging'); event.preventDefault();
  });
  handle.addEventListener('pointermove', event => { if (drag) move(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y); });
  function stopDrag() { drag = null; box.classList.remove('dragging'); }
  handle.addEventListener('pointerup', stopDrag); handle.addEventListener('pointercancel', stopDrag); handle.addEventListener('lostpointercapture', stopDrag);
  box.addEventListener('keydown', event => {
    const directions = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if (!directions[event.key] || event.target !== box) return;
    event.preventDefault(); const step = event.shiftKey ? 16 : 5, d = directions[event.key];
    move(box.offsetLeft + d[0]*step, box.offsetTop + d[1]*step);
  });
  function resetPosition() { box.style.removeProperty('left'); box.style.removeProperty('top'); }
  $('reset-position').addEventListener('click', resetPosition);
  window.addEventListener('resize', resetPosition, { passive:true });

  document.querySelectorAll('button[data-browser]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('button[data-browser]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    $('extensions-address').textContent = button.dataset.browser + '://extensions';
    $('copy-feedback').textContent = '';
  }));
  let feedbackTimer;
  $('copy-address').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('extensions-address').textContent);
      $('copy-feedback').textContent = 'Copied. Paste into your browser address bar.';
    } catch (_) {
      const selection = window.getSelection(), range = document.createRange();
      range.selectNodeContents($('extensions-address')); selection.removeAllRanges(); selection.addRange(range);
      $('copy-feedback').textContent = 'Address selected. Press Ctrl+C to copy.';
    }
    clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => { $('copy-feedback').textContent = ''; }, 7000);
  });
})();
