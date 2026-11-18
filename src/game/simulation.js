import { angleDelta, BOUNDS, BUILDINGS, clamp, forward, heightAt, locationAt, right, shoreDistance, SPAWN, TREES, VEHICLES } from './layout.js';

const BODY_RADIUS = 0.29;
const LOCAL_TREES = TREES.filter(({ x, z }) => x > BOUNDS.left - 3 && x < BOUNDS.right + 3 && z > BOUNDS.far - 3 && z < BOUNDS.near + 3);
const treeCells = new Map();
const cellSize = 10;
for (const tree of LOCAL_TREES) {
  const key = `${Math.floor(tree.x / cellSize)},${Math.floor(tree.z / cellSize)}`;
  if (!treeCells.has(key)) treeCells.set(key, []);
  treeCells.get(key).push(tree);
}
export const damp = (from, to, lambda, dt) => to + (from - to) * Math.exp(-lambda * dt);

function overlapsBox(x, z, r, box) {
  const dx = x - box.x, dz = z - box.z;
  const ax = Math.abs(dx * Math.cos(box.yaw) + dz * Math.sin(box.yaw));
  const az = Math.abs(-dx * Math.sin(box.yaw) + dz * Math.cos(box.yaw));
  return Math.hypot(Math.max(0, ax - box.halfX), Math.max(0, az - box.halfZ)) < r;
}
function axleDistance(x, z, obj) {
  const [fx, fz] = forward(obj.yaw);
  const dx = x - obj.x, dz = z - obj.z;
  const t = clamp(dx * fx + dz * fz, -obj.halfLength, obj.halfLength);
  return Math.hypot(dx - fx * t, dz - fz * t);
}
function terrainClear(x, z, r) {
  if (x < BOUNDS.left + r || x > BOUNDS.right - r || z < BOUNDS.far + r || z > BOUNDS.near - r) return false;
  if (shoreDistance(x, z) < r + 0.15) return false;
  for (const box of BUILDINGS) if (overlapsBox(x, z, r, box)) return false;
  const tx = Math.floor(x / cellSize), tz = Math.floor(z / cellSize);
  for (let iz = tz - 1; iz <= tz + 1; iz++) for (let ix = tx - 1; ix <= tx + 1; ix++) {
    const trees = treeCells.get(`${ix},${iz}`);
    if (!trees) continue;
    for (const tree of trees) if (Math.hypot(tree.x - x, tree.z - z) < r + tree.h * 0.024) return false;
  }
  return true;
}
export function canStand(x, z, vehicles = []) {
  return terrainClear(x, z, BODY_RADIUS) && !vehicles.some(v => axleDistance(x, z, v) < BODY_RADIUS + v.radius);
}
function vehicleClear(x, z, yaw, vehicle, all) {
  const [fx, fz] = forward(yaw);
  for (const offset of [-vehicle.halfLength, 0, vehicle.halfLength]) {
    const px = x + fx * offset, pz = z + fz * offset;
    if (!terrainClear(px, pz, vehicle.radius)) return false;
    if (all.some(other => vehicle !== other && axleDistance(px, pz, other) < other.radius + vehicle.radius)) return false;
  }
  return true;
}

export class Simulation {
  constructor() {
    this.player = { ...SPAWN, speed: 0 };
    this.vehicles = VEHICLES.map(v => ({ ...v, speed: 0, wheel: 0, steer: 0, pedal: 0 }));
    this.active = null;
  }
  get target() { return this.active ?? this.player; }
  get location() { return locationAt(this.target.x, this.target.z); }
  get nearby() {
    if (this.active) return this.active;
    let closest = null, distance = Infinity;
    for (const v of this.vehicles) {
      const d = axleDistance(this.player.x, this.player.z, v) - v.radius;
      if (d < distance && d < v.enterRadius) { closest = v; distance = d; }
    }
    return closest;
  }
  interact() {
    if (this.active) {
      const v = this.active;
      if (Math.abs(v.speed) > 1.3) return false;
      const [rx, rz] = right(v.yaw), [fx, fz] = forward(v.yaw);
      const gap = v.radius + 0.7;
      const exits = [[-rx * gap, -rz * gap], [rx * gap, rz * gap], [-fx * (v.halfLength + gap), -fz * (v.halfLength + gap)]];
      for (const [dx, dz] of exits) {
        const x = v.x + dx, z = v.z + dz;
        if (!canStand(x, z, this.vehicles)) continue;
        Object.assign(this.player, { x, z, yaw: v.yaw, speed: 0 });
        v.speed = 0;
        this.active = null;
        return true;
      }
      return false;
    }
    const nearby = this.nearby;
    if (!nearby) return false;
    this.player.speed = 0;
    this.active = nearby;
    return true;
  }
  update(dt, input, cameraYaw) {
    if (dt <= 0) return;
    const substeps = Math.ceil(dt / (1 / 60)), step = dt / substeps;
    for (let i = 0; i < substeps; i++) {
      if (this.active) this.drive(step, input);
      else this.walk(step, input, cameraYaw);
    }
  }
  walk(dt, { x: ix, y: iy, sprint }, cameraYaw) {
    const p = this.player;
    const magnitude = Math.min(1, Math.hypot(ix, iy));
    if (magnitude < 0.012) { p.speed = damp(p.speed, 0, 20, dt); return; }
    const [fx, fz] = forward(cameraYaw), [rx, rz] = right(cameraYaw);
    const dx = fx * iy + rx * ix, dz = fz * iy + rz * ix;
    const heading = Math.atan2(dx, -dz);
    p.yaw += angleDelta(p.yaw, heading) * (1 - Math.exp(-14 * dt));
    const distance = (sprint ? 5.35 : 2.65) * magnitude * dt;
    const nx = p.x + Math.sin(heading) * distance, nz = p.z - Math.cos(heading) * distance;
    const px = p.x, pz = p.z;
    if (canStand(nx, nz, this.vehicles)) { p.x = nx; p.z = nz; }
    else {
      if (canStand(nx, p.z, this.vehicles)) p.x = nx;
      if (canStand(p.x, nz, this.vehicles)) p.z = nz;
    }
    p.speed = damp(p.speed, Math.hypot(p.x - px, p.z - pz) / dt, 17, dt);
  }
  drive(dt, { x, y, brake }) {
    const v = this.active, bike = v.id === 'bike';
    const goal = y < 0 ? v.reverse * y : v.maxSpeed * y;
    v.steer = damp(v.steer, x, 8, dt);
    const driveRate = brake ? 9.5 : Math.sign(v.speed) !== Math.sign(goal) && Math.abs(v.speed) > 0.2 && Math.abs(y) > 0.02 ? 4.3 : Math.abs(y) > 0.02 ? (bike ? 1.25 : 0.83) : 1.9;
    v.speed = damp(v.speed, brake ? 0 : goal, driveRate, dt);
    if (Math.abs(v.speed) < 0.012 && Math.abs(y) < 0.02) v.speed = 0;
    const turnGrip = clamp(Math.abs(v.speed) / (bike ? 2.6 : 3.9), 0, 1) / (1 + Math.abs(v.speed) * (bike ? 0.057 : 0.088));
    const yaw = v.yaw + v.steer * dt * turnGrip * (bike ? 2.1 : 1.7) * Math.sign(v.speed);
    const [fx, fz] = forward(yaw);
    const nx = v.x + fx * v.speed * dt, nz = v.z + fz * v.speed * dt;
    if (vehicleClear(nx, nz, yaw, v, this.vehicles)) {
      v.x = nx; v.z = nz; v.yaw = yaw;
      v.wheel -= v.speed * dt / (bike ? 0.34 : 0.405);
      if (bike && y > 0.05) v.pedal -= v.speed * dt * 1.27;
    } else v.speed *= Math.exp(-22 * dt);
  }
}

// The camera is not a gameplay collider, but shorten its arm before it goes
// through a roof or a hillside. Calculations remain independent of rendering.
export function cameraArm(eye, desired) {
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    const x = eye.x + t * (desired.x - eye.x), z = eye.z + t * (desired.z - eye.z);
    const y = eye.y + t * (desired.y - eye.y);
    if (y < heightAt(x, z) + 0.32 || BUILDINGS.some(b => y < heightAt(b.x, b.z) + b.height + 0.18 && overlapsBox(x, z, 0.28, b))) {
      return Math.max(0.2, (i - 1.4) / 16);
    }
  }
  return 1;
}
