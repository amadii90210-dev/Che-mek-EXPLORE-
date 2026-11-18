import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './layout.js';

export const mat = (color, roughness = 0.83, props = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...props });
export const group = (parent, x = 0, y = 0, z = 0) => {
  const g = new THREE.Group(); g.position.set(x, y, z); parent?.add(g); return g;
};
export function mesh(parent, geometry, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true; parent?.add(m); return m;
}
export function box(parent, material, w, h, d, x = 0, y = 0, z = 0, radius = 0) {
  const geo = radius > 0 ? new RoundedBoxGeometry(w, h, d, 1, Math.min(w / 2, h / 2, d / 2, radius)) : new THREE.BoxGeometry(w, h, d);
  return mesh(parent, geo, material, x, y, z);
}
export function ball(parent, material, rx, ry, rz, x, y, z, n = 12) {
  const m = mesh(parent, new THREE.SphereGeometry(1, n, Math.max(6, Math.floor(n * 0.65))), material, x, y, z);
  m.scale.set(rx, ry, rz); return m;
}
export function tube(parent, material, a, b, r1, r2 = r1, sides = 10) {
  const v = new THREE.Vector3(...a), w = new THREE.Vector3(...b), delta = w.sub(v);
  const mid = v.addScaledVector(delta, 0.5);
  const m = mesh(parent, new THREE.CylinderGeometry(r2, r1, delta.length(), sides), material, mid.x, mid.y, mid.z);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return m;
}
export function cord(parent, material, points, radius = 0.01, steps = 13, sides = 5) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(parent, new THREE.TubeGeometry(curve, steps, radius, sides), material);
}
export function face(parent, material, points) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1].slice(0, points.length * 2), 2));
  g.setIndex(points.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]);
  g.computeVertexNormals(); return mesh(parent, g, material);
}
// An elliptical or soft-square loft. Offsets and small seam ripples are
// authored on individual cross sections rather than stacking primitives.
export function loft(parent, material, rings, { sides = 24, power = 1, ripple = 0 } = {}) {
  const pos = [], uv = [], index = [];
  rings.forEach(([y, rx, rz, cx = 0, cz = 0], row) => {
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const r = 1 + ripple * (Math.sin(a * 3 + row * 0.6) * 0.48 + Math.sin(a * 7 - row * 0.9) * 0.3 + Math.cos(a * 11 + row * 0.7) * 0.22);
      pos.push(cx + Math.sign(c) * Math.abs(c) ** power * rx * r, y, cz + Math.sign(s) * Math.abs(s) ** power * rz * r);
      uv.push(j / sides, (y - rings[0][0]) / (rings.at(-1)[0] - rings[0][0]));
      if (row > 0 && j < sides) { const a = (row - 1) * (sides + 1) + j, b = a + sides + 1; index.push(a, b, a + 1, a + 1, b, b + 1); }
    }
  });
  for (let j = 1; j < sides - 1; j++) {
    const top = (rings.length - 1) * (sides + 1);
    index.push(0, j, j + 1, top, top + j + 1, top + j);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(index); geo.computeVertexNormals();
  return mesh(parent, geo, material);
}
export function batch(parent) {
  // Only call on a static subassembly (shell, garment, cabin, etc.). Pivot
  // groups such as elbows, cranks and wheels are kept out of the batch.
  parent.updateWorldMatrix(true, true);
  const inverse = parent.matrixWorld.clone().invert();
  const sets = new Map(), originals = [];
  parent.traverse(m => {
    if (!m.isMesh || Array.isArray(m.material)) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld));
    const id = `${m.material.id}:${m.castShadow}:${m.receiveShadow}:${Object.keys(g.attributes).sort().join(',')}`;
    if (!sets.has(id)) sets.set(id, { list: [], mat: m.material, cast: m.castShadow, receive: m.receiveShadow });
    sets.get(id).list.push(g); originals.push(m);
  });
  for (const { list, mat: material, cast, receive } of sets.values()) {
    const combined = list.length === 1 ? list[0] : mergeGeometries(list);
    if (list.length > 1) list.forEach(g => g.dispose());
    const m = mesh(parent, combined, material, 0, 0, 0, cast); m.receiveShadow = receive;
  }
  for (const m of originals) { m.parent.remove(m); m.geometry.dispose(); }
  return parent;
}
export function textTexture(w, h, paint, colorSpace = THREE.SRGBColorSpace) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = colorSpace;
  return texture;
}
export function textile(seed, kind = 'cloth') {
  const rand = rng(seed);
  const tex = textTexture(256, 256, (ctx, w, h) => {
    const pixels = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      const weave = kind === 'knit' ? 10 * Math.cos(x * Math.PI / 2 + (y % 4) / 3) : 5 * Math.sin(x * Math.PI / 2) + 4 * Math.cos(y * Math.PI / 2);
      const stain = 7 * Math.sin(x / 11 + Math.cos(y / 13)) * Math.sin(y / 9 + Math.sin(x / 31));
      const intensity = 207 + weave + stain + rand() * 31;
      pixels.data[k] = intensity; pixels.data[k + 1] = intensity; pixels.data[k + 2] = intensity; pixels.data[k + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  }, THREE.NoColorSpace);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  return tex;
}
export function createDecalMaterial() {
  const t = textTexture(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, '#100f08ac'); g.addColorStop(.42, '#18150e55'); g.addColorStop(1, '#17150e00');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
}
