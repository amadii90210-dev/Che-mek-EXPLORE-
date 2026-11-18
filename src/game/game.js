import * as THREE from 'three';
import { addBuildings } from './buildings.js';
import { addFlora } from './flora.js';
import { createHud } from './hud.js';
import { bindInput } from './input.js';
import { FOG_COLOR, makeEnvironment, makeGround, makeSky, makeWater, SUN } from './landscape.js';
import { angleDelta, clamp, forward, heightAt, right, SPAWN } from './layout.js';
import { createDecalMaterial } from './meshes.js';
import { cameraArm, damp, Simulation } from './simulation.js';
import { makeSurvivor } from './survivor.js';
import { makeVehicles } from './vehicles.js';

async function loadSurfaceMaps(renderer) {
  const loader = new THREE.TextureLoader();
  const result = await Promise.all(['meadow','gravel','spruce','fir','timber'].map(async key => {
    const t = await loader.loadAsync(`${import.meta.env.BASE_URL}terrain/${key}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    if (key !== 'spruce' && key !== 'fir') t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(key === 'spruce' || key === 'fir' ? 2 : 5, renderer.capabilities.getMaxAnisotropy());
    return [key, t];
  }));
  return Object.fromEntries(result);
}
function makeLight(scene, small) {
  const sun = new THREE.DirectionalLight('#ffeccc', 3.02);
  sun.castShadow = true;
  const span = small ? 18 : 24;
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 3, far: 91 });
  sun.shadow.camera.updateProjectionMatrix();
  const resolution = small ? 1024 : 2048;
  sun.shadow.mapSize.set(resolution, resolution); sun.shadow.normalBias = 0.026; sun.shadow.bias = -0.00014; sun.shadow.radius = 2.15; sun.shadow.intensity = .82;
  const ambient = new THREE.HemisphereLight('#d5e5ed', '#938c69', 1.02);
  sun.layers.enable(1); ambient.layers.enable(1);
  scene.add(sun, sun.target, ambient);
  sun.shadow.autoUpdate = false;
  let x0 = Infinity, z0 = Infinity, previousShadow = -1;
  return (x,z,time,moving) => {
    const recenter = Math.hypot(x0-x, z0-z) > 5;
    if (recenter) {
      x0 = x; z0 = z;
      sun.target.position.set(x, heightAt(x,z), z - 3.4);
      sun.position.copy(sun.target.position).addScaledVector(SUN,50);
    }
    if (recenter || time - previousShadow > (moving ? (small ? .080 : .048) : .38)) {
      previousShadow = time; sun.shadow.needsUpdate = true;
    }
  };
}
function contactShade(scene, material, sx, sz) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 4, 6).rotateX(-Math.PI/2), material);
  m.renderOrder = 2; scene.add(m);
  const attr = m.geometry.getAttribute('position');
  const coords = Array.from(attr.array);
  let prevX, prevZ, prevYaw;
  return (x, z, yaw, visible = true) => {
    m.visible = visible;
    if (!visible || (x === prevX && z === prevZ && yaw === prevYaw)) return;
    prevX = x; prevZ = z; prevYaw = yaw;
    m.position.set(x, heightAt(x,z), z); m.rotation.y = -yaw;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < attr.count; i++) {
      const a = coords[i*3]*sx, b = coords[i*3+2]*sz;
      attr.setXYZ(i,a, heightAt(x+a*c-b*s,z+a*s+b*c)-m.position.y+.019, b);
    }
    attr.needsUpdate = true; m.geometry.computeBoundingSphere();
  };
}

export async function startGame(viewport) {
  const small = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 530;
  const renderer = new THREE.WebGLRenderer({ antialias: !small || devicePixelRatio <= 1.4, powerPreference: 'high-performance', alpha: false, stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.setClearColor(FOG_COLOR);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  viewport.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(FOG_COLOR, .0034);
  const camera = new THREE.PerspectiveCamera(54, 1, .065, 1470);
  const maps = await loadSurfaceMaps(renderer);
  let environment = makeEnvironment(renderer, scene);
  const sky = makeSky(scene);
  const water = makeWater(scene, small);
  makeGround(scene, maps, small);
  const updateFlora = addFlora(scene, maps, small);
  addBuildings(scene,maps);
  const updateLight = makeLight(scene, small);
  const vehicles = makeVehicles(scene), avatar = makeSurvivor(scene);
  const shadows = createDecalMaterial();
  const playerShade = contactShade(scene, shadows, .49,.42), suvShade = contactShade(scene, shadows, 1.65,2.57), bikeShade = contactShade(scene, shadows,.48,1.12);
  const hud = createHud(), sim = new Simulation();

  const cameraFocus = new THREE.Vector3(SPAWN.x,heightAt(SPAWN.x,SPAWN.z),SPAWN.z);
  const aim = new THREE.Vector3(), desired = new THREE.Vector3(), eye = new THREE.Vector3();
  const place = new THREE.Vector3();
  let yaw = SPAWN.yaw, yawGoal = yaw, pitch = 0, pitchGoal = 0, zoom = 4.95, zoomGoal = zoom;
  let lastVehicle, lastVehicleYaw = yaw, arm = 1, portrait = false, elapsed = 0, previous = 0;
  let pixelRatio = Math.min(devicePixelRatio || 1, small ? 1.27 : 1.65), windowFrames = 0, windowTime = 0;
  let frameHandle = 0, contextLost = false, dirtySize = true, wasPaused = false;
  const updateSize = () => {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;
    portrait = w / h < .90; dirtySize = true;
    camera.aspect = w / h;
    const base = w / h < .9 ? 59 : 53;
    camera.fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(24)) / camera.aspect)), base, 88);
    camera.updateProjectionMatrix(); renderer.setPixelRatio(pixelRatio); renderer.setSize(w, h, false);
  };
  window.addEventListener('resize', updateSize);
  updateSize();

  function interact() {
    if (hud.dialogs.some(d => d.open) || !sim.interact()) return;
    if (sim.active) { yawGoal = sim.active.yaw; lastVehicleYaw = sim.active.yaw; }
    viewport.focus({ preventScroll: true });
    hud.update(sim,yaw,0);
  }
  const input = bindInput({ viewport, joystick: document.querySelector('#joystick'), thumb: document.querySelector('#joy-thumb'),
    run: document.querySelector('#touch-run'), enter: document.querySelector('#touch-enter'), dialogs: hud.dialogs,
    controls: { interact, map: hud.showMap, help: hud.showHelp,
      look(dx,dy) { yawGoal += dx*.0042; pitchGoal = clamp(pitchGoal + dy*.007, -1.25,2.85); },
      zoom(amount) { zoomGoal = clamp(zoomGoal + Math.sign(amount)*.39,3.5,8.3); },
    },
  });
  hud.setHandlers(input.reset,interact);

  function render(dt) {
    const paused = hud.dialogs.some(d => d.open);
    if (!paused) { elapsed += dt; sim.update(dt,input.read(),yaw); }
    const t = sim.target, y = heightAt(t.x,t.z);
    if (sim.active && lastVehicle === sim.active) yawGoal += angleDelta(lastVehicleYaw,sim.active.yaw);
    lastVehicle = sim.active;
    if (sim.active) lastVehicleYaw = sim.active.yaw;
    yaw += angleDelta(yaw, yawGoal) * (1 - Math.exp(-10*dt));
    if (Math.abs(yawGoal) > Math.PI * 6) yawGoal = Math.atan2(Math.sin(yawGoal),Math.cos(yawGoal));
    pitch = damp(pitch,pitchGoal,8,dt); zoom = damp(zoom,zoomGoal,7,dt);
    const mode = sim.active?.id;
    const onBike = mode === 'bike', inCar = mode === 'suv';
    const gain = inCar ? 6.6 : 13.9;
    cameraFocus.x = damp(cameraFocus.x,t.x,gain,dt); cameraFocus.y = damp(cameraFocus.y,y,10,dt); cameraFocus.z = damp(cameraFocus.z,t.z,gain,dt);
    const [fx,fz] = forward(yaw), [rx,rz] = right(yaw);
    const h = cameraFocus.y, d = zoom + (inCar ? 1.42 : onBike ? .42 : 0) - (portrait && !inCar ? .39 : 0);
    const shoulder = inCar ? .32 : (portrait ? .29 : .82);
    const eyeY = 2.67 + (inCar ? .61 : onBike ? .29 : 0) + pitch + (zoom-4.75)*.182;
    const aimY = 1.94 + (inCar ? .22 : onBike ? .16 : 0) + (portrait ? .02 : 0) - pitch * .11;
    const composition = inCar ? .25 : (portrait ? 1.15 : 1.06), lookAhead = portrait ? 2.35 : 2.07;
    desired.set(cameraFocus.x - fx*d + rx*shoulder,h+eyeY,cameraFocus.z - fz*d + rz*shoulder);
    aim.set(cameraFocus.x + fx*lookAhead + rx*composition,h+aimY,cameraFocus.z + fz*lookAhead + rz*composition);
    eye.set(cameraFocus.x,h+1.55,cameraFocus.z);
    const safe = cameraArm(eye,desired);
    arm = safe < arm ? safe : damp(arm,safe,9,dt);
    camera.position.copy(eye).lerp(desired,arm);
    camera.lookAt(aim); camera.getWorldDirection(place);
    sky.position.copy(camera.position); sky.material.uniforms.elapsed.value = elapsed;
    water.material.uniforms.elapsed.value = elapsed;
    updateLight(t.x,t.z,elapsed,Math.abs(t.speed) > .09); updateFlora(t,elapsed);

    vehicles.update(sim.vehicles,dt);
    avatar.root.visible = !inCar;
    if (onBike) {
      const b = vehicles.getBikeRoot(); avatar.root.position.copy(b.position); avatar.root.rotation.copy(b.rotation);
    } else {
      avatar.root.position.set(sim.player.x,heightAt(sim.player.x,sim.player.z),sim.player.z); avatar.root.rotation.set(0,-sim.player.yaw,0);
    }
    avatar.pose(dt,elapsed,sim.player.speed,onBike ? sim.active : null);
    playerShade(sim.player.x,sim.player.z,sim.player.yaw,!sim.active);
    suvShade(sim.vehicles[0].x,sim.vehicles[0].z,sim.vehicles[0].yaw);
    bikeShade(sim.vehicles[1].x,sim.vehicles[1].z,sim.vehicles[1].yaw);
    hud.update(sim,Math.atan2(place.x,-place.z),dt);
    renderer.render(scene,camera);
  }
  const loading = document.querySelector('#loading'), loadingMessage = document.querySelector('#loading-message');
  const hudElement = document.querySelector('#hud');
  function frame(now) {
    const time = previous ? (now-previous)*.001 : 0;
    previous = now;
    const paused = hud.dialogs.some(d => d.open);
    if (!paused || !wasPaused || dirtySize) { render(Math.min(.16,time)); dirtySize = false; }
    wasPaused = paused;
    if (!document.hidden && time > 0 && !hud.dialogs.some(d => d.open)) {
      windowTime += Math.min(.18,time); windowFrames++;
      if (windowFrames === 36) {
        if (windowTime/windowFrames > .0315 && pixelRatio > .93) {
          pixelRatio = Math.max(.88, pixelRatio*.86); updateSize();
        }
        windowFrames=0; windowTime=0;
      }
    }
    frameHandle = requestAnimationFrame(frame);
  }
  renderer.domElement.addEventListener('webglcontextlost', evt => {
    evt.preventDefault(); contextLost = true; cancelAnimationFrame(frameHandle); input.reset();
    hudElement.hidden = true; loading.hidden = false; loadingMessage.textContent = 'Oczekiwanie na przywrócenie grafiki…';
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    if (!contextLost) return;
    contextLost = false; previous = 0;
    environment.dispose(); environment = makeEnvironment(renderer, scene);
    water.userData.refreshReflection(); updateSize(); hudElement.hidden = false; loading.hidden = true;
    frameHandle = requestAnimationFrame(frame);
  });
  // Unhide the HUD and paint the first map and frame together.
  hudElement.hidden = false;
  render(.057);
  loading.hidden = true;
  frameHandle = requestAnimationFrame(frame);
}
