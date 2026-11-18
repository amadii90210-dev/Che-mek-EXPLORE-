import { BOUNDS, heightAt, noise, roadCenter, shoreDistance, TREES, BUILDINGS } from './layout.js';

const $ = (id) => document.getElementById(id);
const directions = ['N','NE','E','SE','S','SW','W','NW'];
const mod = (n, q) => ((n % q) + q) % q;
const degrees = (r) => mod(r * 180 / Math.PI, 360);
const vehicleMode = { suv: ['Terenówka', 'car'], bike: ['Rower', 'bike'], walk: ['Pieszo', 'walk'] };

function makeMap(canvas, bounds, large) {
  const { width: w, height: h } = canvas;
  const bg = document.createElement('canvas'); bg.width = w; bg.height = h;
  const c = bg.getContext('2d'), ctx = canvas.getContext('2d');
  const spanX = bounds.right - bounds.left, spanZ = bounds.near - bounds.far;
  const X = x => (x - bounds.left) / spanX * w, Y = z => (z - bounds.far) / spanZ * h;
  const step = large ? 4 : 3;
  for (let j = 0; j < h; j += step) for (let i = 0; i < w; i += step) {
    const x = bounds.left + i / w * spanX, z = bounds.far + j / h * spanZ, d = shoreDistance(x, z);
    if (d < 0) {
      const b = Math.max(0, 1 + d / 14);
      c.fillStyle = `rgb(${30 + 19 * b} ${50 + 21 * b} ${55 + 21 * b})`;
    } else {
      const a = heightAt(x, z, d), m = noise(x * 0.09, z * 0.083) * 22;
      const band = Math.floor((a + 1) / 2.7) % 2 === 0 ? 4 : 0;
      const edge = Math.max(0, 1 - d / 3) * 23;
      c.fillStyle = `rgb(${43 + m + band + edge} ${59 + m + band + edge * 0.74} ${43 + m * 0.61 + band + edge * 0.32})`;
    }
    c.fillRect(i, j, step, step);
  }
  c.lineWidth = 1;
  c.strokeStyle = '#d9e3b520';
  for (let i = X(Math.ceil(bounds.left / 20) * 20); i < w; i += 20 * w / spanX) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); }
  for (let j = Y(Math.ceil(bounds.far / 20) * 20); j < h; j += 20 * h / spanZ) { c.beginPath(); c.moveTo(0, j); c.lineTo(w, j); c.stroke(); }
  for (const tree of TREES) {
    if (tree.x < bounds.left || tree.x > bounds.right || tree.z < bounds.far || tree.z > bounds.near) continue;
    c.beginPath(); c.arc(X(tree.x), Y(tree.z), large ? 2.7 : 2.15, 0, Math.PI * 2); c.fillStyle = '#212e24a0'; c.fill();
  }
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath();
  for (let z = bounds.far; z < bounds.near + 1; z++) {
    if (z === bounds.far) c.moveTo(X(roadCenter(z)), Y(z)); else c.lineTo(X(roadCenter(z)), Y(z));
  }
  c.strokeStyle = '#262c23c9'; c.lineWidth = large ? 10 : 7; c.stroke();
  c.strokeStyle = '#b1a07ae5'; c.lineWidth = large ? 5 : 4.5; c.stroke();
  for (const b of BUILDINGS) {
    c.save(); c.translate(X(b.x), Y(b.z)); c.rotate(b.yaw);
    const bx = b.halfX * w / spanX, bz = b.halfZ * h / spanZ;
    c.fillStyle = '#9d8f70'; c.strokeStyle = '#283326'; c.lineWidth = 2.4;
    c.fillRect(-bx, -bz, bx * 2, bz * 2); c.strokeRect(-bx, -bz, bx * 2, bz * 2); c.restore();
  }
  if (large) {
    c.font = '600 20px Inter Variable, sans-serif'; c.fillStyle = '#d7e3deaa'; c.letterSpacing = '3px';
    c.fillText('JEZIORO', X(-97), Y(-55));
    c.font = '600 15px Inter Variable, sans-serif'; c.letterSpacing = '1px'; c.fillStyle = '#e0d7ba';
    c.fillText('STACJA TERENOWA', X(21), Y(-21));
  }
  return function paint(sim) {
    ctx.clearRect(0, 0, w, h);
    const obj = sim.target;
    // The minimap follows the player but keeps north up. Canvas edges taper into the HUD.
    const offsetX = large ? 0 : w * 0.54 - X(obj.x), offsetZ = large ? 0 : h * 0.66 - Y(obj.z);
    ctx.fillStyle = '#2f3b30'; ctx.fillRect(0, 0, w, h); ctx.drawImage(bg, offsetX, offsetZ);
    for (const v of sim.vehicles) {
      if (v === sim.active) continue;
      const x = X(v.x) + offsetX, z = Y(v.z) + offsetZ;
      ctx.fillStyle = '#e9f0e2'; ctx.strokeStyle = '#242e27'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(x - 4, z - 4, 8, 8, 2); ctx.fill(); ctx.stroke();
    }
    ctx.save(); ctx.translate(X(obj.x) + offsetX, Y(obj.z) + offsetZ); ctx.rotate(obj.yaw);
    ctx.strokeStyle = '#f4bd7880'; ctx.fillStyle = '#f4bd7824'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f8c586'; ctx.strokeStyle = '#242c22'; ctx.lineWidth = 2.3;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7.3, 7); ctx.lineTo(0, 4); ctx.lineTo(-7.3, 7); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  };
}

export function createHud() {
  const speed = $('speed'), speedBar = $('speed-track'), mode = $('mode'), modeIcon = $('mode-icon');
  const map = $('map-dialog'), help = $('help-dialog');
  const int = $('interaction'), intAction = $('interaction-action'), intName = $('interaction-name');
  const touchEnter = $('touch-enter'), touchEnterLabel = touchEnter.querySelector('span');
  const run = $('touch-run'), runLabel = run.querySelector('span');
  const places = [$('location'), $('map-location'), $('mobile-location')];
  const bearingScale = $('bearing-scale'), bearingLabel = $('bearing-label');
  const ticks = Array.from({ length: 29 }, () => {
    const e = document.createElement('span'); e.className = 'tick'; bearingScale.append(e); return e;
  });
  // Keep the cached basemap at the minimap scale over the full playable area.
  const smallView = $('minimap');
  const backgroundMap = document.createElement('canvas');
  // Use a larger backing canvas to follow the player without blank edges.
  let drawMini;
  let drawLarge, inputReset = () => {}, onInteraction = () => {}, previousKey = '', prevDegrees = -1, lastPlace = '', lastVehicle = '', accumulator = 0;
  function scrollingMap(canvas) {
    const info = { left: -211, right: 171, far: -219, near: 156 };
    const w = canvas.width, h = canvas.height;
    backgroundMap.width = Math.round((info.right - info.left) / 80 * w);
    backgroundMap.height = Math.round((info.near - info.far) / 53 * h);
    const ctx = canvas.getContext('2d');
    const wx = (info.right - info.left) / backgroundMap.width, wz = (info.near - info.far) / backgroundMap.height;
    // Rasterize the static map once. The background and overlay use the same projection.
    paintMiniBackground(backgroundMap, info, wx, wz);
    return sim => {
      const o = sim.target, cx = w * 0.53, cy = h * 0.64;
      ctx.drawImage(backgroundMap, (o.x - info.left) / wx - cx, (o.z - info.far) / wz - cy, w, h, 0, 0, w, h);
      for (const v of sim.vehicles) {
        if (o === v) continue;
        const dx = cx + (v.x - o.x) / wx, dz = cy + (v.z - o.z) / wz;
        ctx.fillStyle = '#e1e9d8'; ctx.strokeStyle = '#28362a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(dx - 4, dz - 4, 8, 8, 2); ctx.fill(); ctx.stroke();
      }
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.yaw); ctx.strokeStyle = '#f4bd7886'; ctx.fillStyle = '#f4bd781a'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(8,8); ctx.lineTo(0,4); ctx.lineTo(-8,8); ctx.closePath();
      ctx.fillStyle = '#f4bd78'; ctx.strokeStyle = '#262e22'; ctx.lineWidth = 2.4; ctx.stroke(); ctx.fill(); ctx.restore();
    };
  }
  function toggle(dialog) {
    if (dialog.open) { dialog.close(); return; }
    for (const other of [map, help]) if (other.open) other.close();
    inputReset(); dialog.showModal();
  }
  const showMap = () => toggle(map), showHelp = () => toggle(help);
  for (const id of ['map-open', 'mini-open']) $(id).addEventListener('click', showMap);
  $('help-open').addEventListener('click', showHelp);
  int.addEventListener('click', () => onInteraction());
  for (const dialog of [map, help]) {
    dialog.querySelector('.close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) {
      const b = dialog.getBoundingClientRect();
      if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) dialog.close();
    } });
  }
  return {
    dialogs: [map, help], showMap, showHelp, setHandlers(reset, interact) { inputReset = reset; onInteraction = interact; },
    update(sim, yaw, dt) {
      const km = Math.round(Math.abs(sim.target.speed) * 3.6), number = String(km).padStart(2, '0');
      if (speed.textContent !== number) speed.textContent = number;
      speedBar.style.transform = `scaleX(${Math.min(1, Math.abs(sim.target.speed) / (sim.active?.maxSpeed ?? 5.35))})`;
      const vid = sim.active?.id ?? 'walk';
      if (lastVehicle !== vid) {
        lastVehicle = vid;
        const [label, icon] = vehicleMode[vid]; mode.textContent = label; modeIcon.setAttribute('href', `#i-${icon}`);
        $('sprint-key').textContent = sim.active ? 'Spacja' : 'Shift'; $('sprint-hint').textContent = sim.active ? 'Hamulec' : 'Sprint';
        runLabel.textContent = sim.active ? 'Hamuj' : 'Sprint'; run.setAttribute('aria-label', sim.active ? 'Hamulec' : 'Sprint');
      }
      const place = sim.location;
      if (lastPlace !== place) { lastPlace = place; places.forEach(el => { el.textContent = place; }); }
      const d = degrees(yaw), rounded = Math.round(d) % 360;
      if (rounded !== prevDegrees) {
        prevDegrees = rounded;
        bearingLabel.innerHTML = `${String(rounded).padStart(3, '0')}° <span>${directions[Math.round(d / 45) % 8]}</span>`;
        const center = Math.round(d / 5) * 5;
        ticks.forEach((e, i) => {
          const angle = center + (i - 14) * 5, n = mod(angle, 360), major = n % 15 === 0, cardinal = n % 45 === 0;
          e.style.left = `${50 + (angle - d) * 0.825}%`;
          e.className = `tick${major ? ' major' : ''}${cardinal ? ' cardinal' : ''}`;
          e.textContent = cardinal ? directions[n / 45] : major ? n : '';
        });
      }
      const nearby = sim.nearby, locked = Boolean(sim.active && Math.abs(sim.active.speed) > 1.3);
      const key = `${nearby?.id}:${vid}:${locked}`;
      if (key !== previousKey) {
        previousKey = key;
        int.hidden = !nearby; int.disabled = locked; touchEnter.disabled = !nearby || locked;
        const action = sim.active ? (locked ? 'Zatrzymaj pojazd' : 'Wysiądź') : 'Wsiądź';
        intAction.textContent = action; intName.textContent = nearby?.name ?? '';
        touchEnterLabel.textContent = sim.active ? 'Wysiądź' : 'Wsiądź'; touchEnter.setAttribute('aria-label', action);
      }
      if (map.open) {
        drawLarge ??= makeMap($('large-map'), BOUNDS, true);
        drawLarge(sim);
      }
      accumulator += dt;
      if (accumulator >= 0.056) { accumulator = 0; if (smallView.offsetWidth) { drawMini ??= scrollingMap(smallView); drawMini(sim); } }
    },
  };
}

function paintMiniBackground(canvas, bounds, wx, wz) {
  const { width: w, height: h } = canvas;
  const c = canvas.getContext('2d');
  const X = x => (x - bounds.left) / wx, Y = z => (z - bounds.far) / wz;
  const gap = 9;
  for (let j = 0; j < h; j += gap) for (let i = 0; i < w; i += gap) {
    const x = bounds.left + i * wx, z = bounds.far + j * wz, d = shoreDistance(x, z);
    if (d < 0) {
      const b = Math.max(0, 1 + d / 19), line = Math.abs(d % 7) < 1.4 ? 3 : 0;
      c.fillStyle = `rgb(${34 + 17 * b + line} ${56 + 16 * b + line} ${61 + 16 * b + line})`;
    } else {
      const n = noise(x * 0.087, z * 0.084) * 23, m = heightAt(x, z, d);
      const contour = Math.abs((m + 3.17) % 1.42) < 0.095 ? -8 : 0;
      const edge = Math.max(0, 1 - d / 2.6) * 26;
      c.fillStyle = `rgb(${43 + n + edge + contour} ${58 + n + edge * .68 + contour} ${42 + n * .7 + edge * .29 + contour})`;
    }
    c.fillRect(i, j, gap, gap);
  }
  c.strokeStyle = '#d2e1b820'; c.lineWidth = 1.1;
  for (let x = Math.ceil(bounds.left / 10) * 10; x < bounds.right; x += 10) { c.beginPath(); c.moveTo(X(x), 0); c.lineTo(X(x), h); c.stroke(); }
  for (let z = Math.ceil(bounds.far / 10) * 10; z < bounds.near; z += 10) { c.beginPath(); c.moveTo(0, Y(z)); c.lineTo(w, Y(z)); c.stroke(); }
  c.fillStyle = '#2433299f';
  for (const t of TREES) { c.beginPath(); c.arc(X(t.x), Y(t.z), 2.5, 0, 2 * Math.PI); c.fill(); }
  c.beginPath();
  for (let z = bounds.far; z < bounds.near + 1; z++) { if (z === bounds.far) c.moveTo(X(roadCenter(z)), Y(z)); else c.lineTo(X(roadCenter(z)), Y(z)); }
  c.strokeStyle = '#2a3025'; c.lineWidth = 13; c.stroke(); c.strokeStyle = '#b1a07c'; c.lineWidth = 8.5; c.stroke();
  for (const b of BUILDINGS) {
    c.save(); c.translate(X(b.x), Y(b.z)); c.rotate(b.yaw); const wx2 = b.halfX / wx, wz2 = b.halfZ / wz;
    c.fillStyle = '#ac9b78'; c.strokeStyle = '#283326'; c.lineWidth = 2.4;
    c.fillRect(-wx2, -wz2, wx2 * 2, wz2 * 2); c.strokeRect(-wx2, -wz2, wx2 * 2, wz2 * 2); c.restore();
  }
}
