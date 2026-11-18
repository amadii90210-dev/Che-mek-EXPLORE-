const KEYS = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight','Space']);

export function bindInput({ viewport, joystick, thumb, run, enter, controls, dialogs }) {
  const held = new Set();
  const joy = { x: 0, y: 0 };
  let joyId = null, runId = null, lookId = null, lastX = 0, lastY = 0;
  const pressed = (a, b) => Number(held.has(a) || held.has(b));
  const blocked = () => dialogs.some(d => d.open);
  const releaseJoy = () => { joyId = null; joy.x = joy.y = 0; thumb.style.transform = ''; };
  const releaseRun = () => { runId = null; run.classList.remove('held'); };
  function reset() { held.clear(); releaseJoy(); releaseRun(); lookId = null; }
  function steer(e) {
    const box = joystick.getBoundingClientRect(), radius = box.width * 0.34;
    const dx = e.clientX - box.left - box.width / 2, dy = e.clientY - box.top - box.height / 2;
    const scale = Math.max(radius, Math.hypot(dx, dy));
    joy.x = dx / scale; joy.y = -dy / scale;
    thumb.style.transform = `translate(${joy.x * radius}px, ${-joy.y * radius}px)`;
  }
  joystick.addEventListener('pointerdown', e => {
    if (joyId !== null || blocked()) return;
    e.preventDefault(); joyId = e.pointerId; joystick.setPointerCapture(joyId); steer(e);
  });
  joystick.addEventListener('pointermove', e => { if (e.pointerId === joyId) steer(e); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(event, e => { if (e.pointerId === joyId) releaseJoy(); });
  run.addEventListener('pointerdown', e => {
    if (runId !== null || blocked()) return;
    e.preventDefault(); runId = e.pointerId; run.setPointerCapture(runId); run.classList.add('held');
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) run.addEventListener(event, e => { if (e.pointerId === runId) releaseRun(); });
  enter.addEventListener('click', controls.interact);
  viewport.addEventListener('pointerdown', e => {
    if (lookId !== null || e.button !== 0 || blocked()) return;
    e.preventDefault(); lookId = e.pointerId; lastX = e.clientX; lastY = e.clientY; viewport.setPointerCapture(lookId);
  });
  viewport.addEventListener('pointermove', e => {
    if (e.pointerId !== lookId) return;
    controls.look(e.clientX - lastX, e.clientY - lastY); lastX = e.clientX; lastY = e.clientY;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(event, e => { if (e.pointerId === lookId) lookId = null; });
  viewport.addEventListener('wheel', e => { if (!blocked()) { e.preventDefault(); controls.zoom(e.deltaY); } }, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey || blocked()) return;
    if (e.code === 'Space' && e.target instanceof HTMLButtonElement) return;
    if (KEYS.has(e.code)) { e.preventDefault(); held.add(e.code); }
    if (e.repeat) return;
    if (e.code === 'KeyE') controls.interact();
    if (e.code === 'KeyM') controls.map();
    if (e.code === 'KeyH') controls.help();
  });
  window.addEventListener('keyup', e => held.delete(e.code));
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  return {
    reset,
    read() {
      const x = pressed('KeyD','ArrowRight') - pressed('KeyA','ArrowLeft') + joy.x;
      const y = pressed('KeyW','ArrowUp') - pressed('KeyS','ArrowDown') + joy.y;
      const n = Math.max(1, Math.hypot(x, y));
      return { x: x / n, y: y / n, sprint: Boolean(runId !== null || pressed('ShiftLeft', 'ShiftRight')), brake: runId !== null || held.has('Space') };
    },
  };
}
