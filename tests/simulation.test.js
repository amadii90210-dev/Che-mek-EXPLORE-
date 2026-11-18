import test from 'node:test';
import assert from 'node:assert/strict';
import { BOUNDS, BUILDINGS, forward, heightAt, LAKE, right, roadCenter, shoreDistance, SPAWN, VEHICLES, WATER_LEVEL } from '../src/game/layout.js';
import { cameraArm, canStand, Simulation } from '../src/game/simulation.js';

const idle = { x: 0, y: 0, sprint: false, brake: false };
const advance = (sim, seconds, input, yaw = 0) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) sim.update(1 / 60, { ...idle, ...input }, yaw);
};

test('the initial spawn and the length of the track are above the shoreline', () => {
  const sim = new Simulation();
  assert.ok(canStand(SPAWN.x, SPAWN.z, sim.vehicles));
  for (let z = BOUNDS.far + 1; z < BOUNDS.near; z += 2) {
    const x = roadCenter(z);
    assert.ok(shoreDistance(x, z) > 4, `track too close to the water at ${x},${z}`);
    assert.ok(heightAt(x, z) > WATER_LEVEL);
  }
});

test('walking follows the camera heading and sprinting increases movement', () => {
  const regular = new Simulation(), sprint = new Simulation();
  advance(regular, .85, { x: .3, y: 1 }, -Math.PI / 2);
  advance(sprint, .85, { x: .3, y: 1, sprint: true }, -Math.PI / 2);
  assert.ok(regular.player.x < SPAWN.x - 1 && regular.player.z < SPAWN.z);
  assert.ok(sprint.player.x < regular.player.x - 1);
  assert.ok(sprint.player.speed > regular.player.speed * 1.8);
});

test('the cabin, lake and boundary are solid to the player', () => {
  const sim = new Simulation(), cabin = BUILDINGS[0];
  assert.equal(canStand(cabin.x, cabin.z), false);
  assert.equal(canStand(LAKE.x, LAKE.z), false);
  assert.equal(canStand(0, BOUNDS.near + 1), false);
  const [fx, fz] = forward(cabin.yaw);
  Object.assign(sim.player, { x: cabin.x - fx * (cabin.halfZ + 1.8), z: cabin.z - fz * (cabin.halfZ + 1.8) });
  advance(sim, 2, { y: 1, sprint: true }, cabin.yaw);
  assert.ok(canStand(sim.player.x,sim.player.z,sim.vehicles));
  assert.ok(Math.hypot(sim.player.x-cabin.x,sim.player.z-cabin.z) > cabin.halfZ);
  Object.assign(sim.player, {x: -10, z: 8});
  advance(sim, 5, { y: 1, sprint: true }, -Math.PI/2);
  assert.ok(canStand(sim.player.x,sim.player.z,sim.vehicles));
  assert.ok(shoreDistance(sim.player.x,sim.player.z) > .4);
});

test('the SUV can be driven, must stop to exit, and gives a valid exit point', () => {
  const sim = new Simulation();
  assert.equal(sim.nearby?.id,'suv');
  assert.equal(sim.interact(),true);
  const vehicle = sim.active;
  advance(sim,1.5,{ y: 1, x: .1 });
  assert.ok(vehicle.speed > 8 && vehicle.z < VEHICLES[0].z - 4);
  assert.ok(vehicle.wheel < -2);
  assert.equal(sim.interact(),false);
  advance(sim,.55,{ brake: true, y: 1 });
  assert.equal(sim.interact(),true);
  assert.equal(sim.active,null);
  assert.equal(vehicle.speed,0);
  assert.ok(canStand(sim.player.x,sim.player.z,sim.vehicles));
});

test('the bicycle can be ridden independently and its pedals follow motion', () => {
  const sim = new Simulation(), [,bike] = sim.vehicles;
  const [rx,rz] = right(bike.yaw);
  Object.assign(sim.player, {x: bike.x + rx*1.52, z: bike.z + rz*1.52});
  assert.equal(sim.nearby,bike);
  assert.equal(sim.interact(),true);
  advance(sim,1.35,{ y: 1, x: -.06 });
  assert.ok(bike.speed > 3 && bike.pedal < -1);
  assert.ok(bike.z < VEHICLES[1].z - 1);
  advance(sim,.55,{ brake: true });
  assert.equal(sim.interact(),true);
  assert.ok(canStand(sim.player.x,sim.player.z,sim.vehicles));
});

test('the camera arm shortens before crossing the visible cabin', () => {
  const b = BUILDINGS[0], [fx,fz] = forward(b.yaw), y = heightAt(b.x,b.z)+2.5;
  const eye = { x: b.x-fx*5.2, y, z: b.z-fz*5.2 };
  assert.ok(cameraArm(eye,{ x:b.x+fx,y,z:b.z+fz }) < .55);
  assert.equal(cameraArm(eye,{ x:b.x-fx*9,y,z:b.z-fz*9 }),1);
});
