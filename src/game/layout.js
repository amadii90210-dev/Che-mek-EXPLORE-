// Shared by the terrain mesh, navigation map and physics. Coordinates are metres;
// the camera and the vehicles initially face north (negative Z).
export const WATER_LEVEL = -1.12;
export const LAKE = { x: -92, z: -55, rx: 87, rz: 105 };
export const BOUNDS = { left: -135, right: 117, near: 79, far: -158 };
export const SPAWN = { x: -1.55, z: 6.35, yaw: -0.085 };
export const VEHICLES = [
  { id: 'suv', name: 'Terenówka', x: 2.52, z: -1.88, yaw: -0.25, radius: 0.94, halfLength: 1.32, maxSpeed: 18, reverse: 6.4, enterRadius: 8.4 },
  { id: 'bike', name: 'Rower', x: -6.45, z: -13.45, yaw: 1.08, radius: 0.38, halfLength: 0.53, maxSpeed: 9, reverse: 2.1, enterRadius: 2.4 },
];
export const BUILDINGS = [
  { id: 'station', x: 12.87, z: -20.7, yaw: -0.16, halfX: 4.16, halfZ: 3.28, height: 5.1 },
  { id: 'shed', x: 24.8, z: -27.8, yaw: -0.03, halfX: 1.86, halfZ: 1.56, height: 2.75 },
];
const TRACK = [
  [-178, 39], [-151, 30], [-124, 29], [-102, 23], [-76, 11], [-54, 5.6],
  [-34, 0.55], [-13, -1.8], [5, 0.14], [23, 4], [43, 7.8], [66, 3.45], [106, 13],
];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const forward = (yaw) => [Math.sin(yaw), -Math.cos(yaw)];
export const right = (yaw) => [Math.cos(yaw), Math.sin(yaw)];

export function rng(seed) {
  let n = seed >>> 0;
  return () => {
    n = (n + 0x6D2B79F5) | 0;
    let q = Math.imul(n ^ (n >>> 15), n | 1);
    q ^= q + Math.imul(q ^ (q >>> 7), q | 61);
    return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(x, z) {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const tx = fx * fx * (3 - 2 * fx), tz = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), tx), lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), tx), tz);
}
export function roadCenter(z) {
  if (z <= TRACK[0][0]) return TRACK[0][1];
  if (z >= TRACK.at(-1)[0]) return TRACK.at(-1)[1];
  let i = 0;
  while (z > TRACK[i + 1][0]) i++;
  const a = TRACK[i], b = TRACK[i + 1], p = TRACK[Math.max(0, i - 1)], q = TRACK[Math.min(TRACK.length - 1, i + 2)];
  const width = b[0] - a[0], t = (z - a[0]) / width, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * a[1] + (t3 - 2 * t2 + t) * width * (b[1] - p[1]) / (b[0] - p[0])
    + (-2 * t3 + 3 * t2) * b[1] + (t3 - t2) * width * (q[1] - a[1]) / (q[0] - a[0]);
}
export function shoreDistance(x, z) {
  const d = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
  return (d - 1) * 87 + (noise(x * 0.084 + 20, z * 0.079) - 0.5) * 3.7 + Math.sin(z * 0.122) * 0.75;
}
const peaks = [
  [-251, -237, 48, 150, 86], [-150, -242, 47, 126, 85], [-58, -254, 24, 78, 73],
  [99, -194, 29, 93, 76], [158, -217, 46, 110, 80], [224, -238, 48, 92, 94],
  [-304, -423, 105, 171, 115], [-225, -378, 89, 116, 93], [-111, -401, 109, 123, 103],
  [-38, -384, 83, 105, 95], [51, -425, 98, 106, 83], [144, -472, 112, 109, 106],
  [305, -475, 105, 134, 121], [-308, 23, 47, 119, 129], [-231, -97, 31, 71, 128],
  [141, -69, 23, 64, 91], [181, 29, 24, 74, 89],
];
function organicRelief(x, z) {
  const fringe = Math.max(1 - smooth(-105, -67, x), smooth(37, 78, x), 1 - smooth(-149, -104, z));
  if (fringe < .001) return 0;
  let h = 0;
  for (const [px, pz, height, rx, rz] of peaks) {
    if (Math.abs(x - px) > rx * 2 || Math.abs(z - pz) > rz * 2) continue;
    const r = Math.hypot((x - px) / rx, (z - pz) / rz);
    const shape = Math.exp(-r * r * 1.56) * Math.max(0, 1 - r * 0.32);
    h = Math.max(h, shape * height - 4.4);
  }
  const ridge = 1 - Math.abs(2 * noise(x * 0.039 - 4, z * 0.038) - 1);
  const erosion = noise(x * 0.020 + 11, z * 0.035) * 0.22 + ridge * 0.16 + noise(x * 0.092, z * 0.077) * 0.047;
  return fringe * (h * (0.72 + erosion) + Math.min(h * .13, 8) * (noise(x * .101, z * .080 + 23) - .42));
}
export function heightAt(x, z, dist = shoreDistance(x, z)) {
  if (dist < 0) return WATER_LEVEL + clamp(dist * 0.24, -9, 0);
  const under = Math.min(dist, 11) * 0.12;
  const m = noise(x * 0.035 + 6, z * 0.039) * 0.82 + noise(x * 0.110 - 4, z * 0.11) * 0.29;
  const waves = Math.sin((x + z) * 0.11) * 0.37 + Math.sin(z * 0.148 - x * 0.031) * 0.22;
  const hills = smooth(12, 56, x) * (3.7 + Math.sin(z * 0.039 + 6) * 2.6);
  const roadBlend = (1 - smooth(1.8, 5.1, Math.abs(x - roadCenter(z)))) * (1 - smooth(126, 162, -z));
  const wornTrack = Math.sin(z * 0.145 + 0.3) * 0.32 + noise(8.2, z * 0.085) * 0.49;
  const ground = WATER_LEVEL + under + smooth(0, 10.5, dist) * (lerp(m + waves + hills, wornTrack, roadBlend) + organicRelief(x, z));
  const parking = (1 - smooth(2.0, 6.4, Math.hypot((x - 3.18) * 1.02, (z + 1.38) * .72))) * smooth(.75, 2.36, x);
  return lerp(ground, .68 + Math.sin(z * .21) * .065, parking * .88);
}

// Sparse young trees near the track, dense forest on the lower slopes.
export function treeLayout() {
  const rand = rng(807242), result = [];
  const planted = [
    [11.75,-31.2,6.35], [17.5,-13.2,8.1], [19.65,-16.5,11.6], [22.5,-17.9,8.2], [11.4,-29,12.7],
    [21.7,-29.6,12], [25.3,-22.75,10.5], [26.3,-12,8.5], [18.7,-37.4,9.8],
    [-8.9,17,8.2], [-7.4,22.7,6.7], [9.6,22.3,10.3], [-5.4,-27.1,4.5], [6.2,-38,6],
    [4.8,-51.5,6.2], [3.0,-58.3,7.8], [6.5,-62.4,8.9], [-1.5,-79,7], [9,-36,5.8],
  ];
  for (const [x,z,h] of planted) result.push({ x, z, h, yaw: rand() * 6.28, variant: Math.floor(rand() * 3) });
  for (let i = 0; i < 5500; i++) {
    const x = -308 + rand() * 566, z = -235 + rand() * 302;
    if (shoreDistance(x, z) < 3.2 || Math.abs(x - roadCenter(z)) < 5.6) continue;
    if (x > -22 && x < 27 && z > -39 && z < 25) continue;
    const y = heightAt(x, z);
    if (y > 82 || rand() > lerp(0.035, 0.76, smooth(0.25, 0.69, noise(x * 0.022 + 40, z * 0.031)))) continue;
    const h = (4.9 + rand() ** 0.78 * 8.7) * (1 - smooth(41, 89, y) * 0.43);
    result.push({ x, z, h, yaw: rand() * 6.28, variant: i % 3 });
  }
  return result;
}
export const TREES = treeLayout();

export function locationAt(x, z) {
  if (Math.hypot(x - BUILDINGS[0].x, z - BUILDINGS[0].z) < 15.5) return 'Stacja terenowa';
  if (shoreDistance(x, z) < 21 && z > -87) return 'Brzeg jeziora';
  if (Math.abs(x - roadCenter(z)) < 12 || z < -82) return 'Leśny trakt';
  return 'Dolina Brzeziny';
}
