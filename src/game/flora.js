import * as THREE from 'three';
import { BUILDINGS, heightAt, noise, rng, roadCenter, shoreDistance, smooth, TREES } from './layout.js';
import { mat } from './meshes.js';

const transform = new THREE.Object3D();
const colors = new THREE.Color();
const windClock = { value: 0 };
function sapling(seed, fine) {
  const rand = rng(seed), pos = [], uv = [], rgb = [], indices = [];
  function bough(y, length, angle, lift, shade, twist) {
    const ca = Math.cos(angle), sa = Math.sin(angle), k = pos.length / 3;
    for (let i = 0; i < 4; i++) {
      const u = i / 3, at = u * length;
      const curvature = Math.sin(u * Math.PI) * -length * .11;
      const wiggle = Math.sin(u * 2.0) * length * .072;
      for (const j of [-1, 1]) {
        const v = j * length * .315 * (i === 0 ? .82 : 1);
        pos.push(ca * at - sa * (v * Math.cos(twist) + wiggle), y + lift * u + curvature + v * Math.sin(twist), sa * at + ca * (v * Math.cos(twist) + wiggle));
        uv.push(u, (j + 1) / 2);
        const t = shade * (.67 + u * .3);
        rgb.push(t, t * 1.055, t * .94);
      }
      if (i !== 3) indices.push(k + 2 * i, k + 2 * i + 1, k + 2 * i + 2, k + 2 * i + 2, k + 2 * i + 1, k + 2 * i + 3);
    }
  }
  const layers = fine ? 13 : 8;
  const gap = fine ? .715 : .73;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const y = .24 + t * gap + (rand() - .5) * .035;
    const spokes = i < 3 ? (fine ? 8 : 5) : (fine ? 6 : 4);
    const start = rand() * Math.PI * 2;
    const r = (.202 * Math.pow(1 - t, .9) + .018) * (.8 + .29 * rand());
    for (let j = 0; j < spokes; j++) {
      const yaw = start + j * 2 * Math.PI / spokes + (rand() - .5) * .63;
      const len = r * (.65 + rand() * .62), slant = len * (.01 + .37 * t - rand() * .3);
      bough(y + (.5 - rand()) * .045, len, yaw, slant, .86 + rand() * .42, (rand() - .5) * 1.57);
      if (fine || i < 3) bough(y + .019, len * .88, yaw + .09, slant + len * .2, .89 + rand() * .34, .68 - rand() * 1.3);
    }
  }
  bough(.942, .076, 0, .074, 1.20, .13);
  bough(.942, .077, 1.4, .075, 1.30, -.23);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}
function instances(parent, geometry, material, rows, shadow = false) {
  if (!rows.length) return;
  const m = new THREE.InstancedMesh(geometry, material, rows.length);
  for (let i = 0; i < rows.length; i++) {
    const [x, y, z, sx, sy, sz, yaw, tint, lean = 0] = rows[i];
    transform.position.set(x, y, z); transform.rotation.set(0, yaw, lean); transform.scale.set(sx, sy, sz); transform.updateMatrix();
    m.setMatrixAt(i, transform.matrix); if (tint) m.setColorAt(i, colors.setRGB(...tint));
  }
  m.castShadow = shadow; m.receiveShadow = true; m.computeBoundingSphere(); parent.add(m);
  return m;
}
function makeTrees(scene, maps, small) {
  const foliage = mat('#a6b392', .96, { map: maps.spruce, alphaTest: .35, side: THREE.DoubleSide, vertexColors: true, shadowSide: THREE.DoubleSide });
  const silhouettes = mat('#a3b394', .94, { map: maps.fir, alphaTest: .38, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide });
  silhouettes.onBeforeCompile = s => {
    s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      normal=normalize(mix(normal,normalize(mat3(viewMatrix)*vec3(.13,1.,.11)),.62));`);
  };
  const bark = mat('#443b2d', 1);
  const trunk = new THREE.CylinderGeometry(.0036, .020, .92, 7, 2).translate(0, .453, 0);
  const fine = Array.from({ length: 3 }, (_, i) => sapling(2583 + i * 812, true));
  function crossed(tight) {
    const p = [], uv = [], ix = [], width = tight ? .41 : .56;
    for (const yaw of [0, Math.PI * .5]) {
      const x = Math.cos(yaw) * width * .5, z = Math.sin(yaw) * width * .5, i = p.length / 3;
      p.push(-x,0,-z,x,0,z,x,1,z,-x,1,-z); uv.push(0,0,1,0,1,1,0,1);
      ix.push(i,i+1,i+2,i,i+2,i+3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(p,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(ix); g.computeVertexNormals(); return g;
  }
  const middle = crossed(true), far = crossed(false);
  const cells = new Map(), rand = rng(14988);
  for (const tree of TREES) {
    const { x, z, h, yaw, variant } = tree;
    const high = x > -18 && x < 43 && z > -53 && z < 34;
    const key = `${Math.floor(x / 54)}:${Math.floor(z / 54)}:${Number(high)}`;
    if (!cells.has(key)) cells.set(key, { rows: [[], [], []], silhouettes: [], trunks: [], high });
    const cell = cells.get(key), v = .64 + rand() * .49;
    const size = h * (.81 + rand() * .36), y = heightAt(x, z) - .035;
    const orientation = (rand() - .5) * .056;
    const tint = [v * (.84 + rand() * .18), v, v * (.86 + rand() * .19)];
    if (high && (!small || Math.hypot(x, z) < 42)) {
      cell.rows[variant].push([x, y, z, size, h, size, yaw, tint, orientation]);
      cell.trunks.push([x, y, z, size, h, size, yaw, [.61 + rand() * .35, .68 + rand() * .22, .71 + rand() * .21], orientation]);
    }
    cell.silhouettes.push([x, y, z, size, h, size, yaw, tint, orientation]);
  }
  for (const cell of cells.values()) {
    const { rows, silhouettes: trees, trunks, high } = cell;
    instances(scene, high ? middle : far, silhouettes, trees, high).layers.enable(1);
    rows.forEach((r, i) => instances(scene, fine[i], foliage, r, high));
    instances(scene, trunk, bark, trunks, high);
  }
}
function tuft(seed, type) {
  const rand = rng(seed), points = [], colors = [], uv = [], ix = [];
  const bladeCount = type === 'reeds' ? 7 : 6;
  for (let j = 0; j < bladeCount; j++) {
    const yaw = rand() * Math.PI * 2, d = .025 + rand() * .123;
    const x = Math.cos(yaw) * d, z = Math.sin(yaw) * d;
    const h = (type === 'reeds' ? .42 : .155) + rand() * (type === 'reeds' ? .68 : .29);
    const lean = (.12 + rand() * .47) * h;
    const w = .0105 + rand() * .016 + (type === 'reeds' ? .01 : 0);
    const tone = rand();
    const low = new THREE.Color(type === 'reeds' ? '#555c27' : '#39421b');
    const high = new THREE.Color(tone < .28 ? '#9d8a4c' : tone < .59 ? '#657842' : '#596e36');
    const l = points.length / 3;
    for (let i = 0; i < 4; i++) {
      const t = i / 3, width = w * (1 - .975 * t) * (i === 0 ? .62 : 1);
      const midX = x + Math.cos(yaw) * lean * t ** 1.57, midZ = z + Math.sin(yaw) * lean * t ** 1.57;
      const c = low.clone().lerp(high, t ** .49);
      for (const s of [-1, 1]) {
        points.push(midX + s * Math.sin(yaw) * width, h * t, midZ - s * Math.cos(yaw) * width);
        uv.push((s + 1) / 2, t); colors.push(c.r, c.g, c.b);
      }
      if (i < 3) ix.push(l + i * 2, l + i * 2 + 1, l + i * 2 + 2, l + i * 2 + 1, l + i * 2 + 3, l + i * 2 + 2);
    }
    if ((type === 'seeds' && j < 3) || (type === 'reeds' && j < 2)) {
      const dz = z + Math.sin(yaw) * lean * .71, dx = x + Math.cos(yaw) * lean * .71;
      const warm = new THREE.Color(type === 'reeds' ? '#876540' : '#bc9d59');
      const seed = points.length / 3;
      points.push(dx - w * .72,h * .80,dz, dx,h * 1.2,dz, dx + w * .46,h * .82,dz);
      points.push(dx,h * .80,dz - w * .72, dx,h * 1.2,dz, dx,h * .82,dz + w * .51);
      for (let i = 0; i < 6; i++) { uv.push(i % 3 / 2, i % 3 === 1 ? 1 : .8); colors.push(warm.r, warm.g, warm.b); }
      ix.push(seed, seed + 1, seed + 2, seed + 3, seed + 4, seed + 5);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(ix); geo.computeVertexNormals();
  return geo;
}
function makeGrass(scene, small) {
  const g = [tuft(819, 'grass'), tuft(1001, 'seeds'), tuft(555, 'reeds')];
  const nearDist = small ? 34 : 57;
  const stems = mat('#e6eccb', 1, { side: THREE.DoubleSide, vertexColors: true });
  stems.onBeforeCompile = s => {
    s.uniforms.windClock = windClock;
    s.vertexShader = 'uniform float windClock;\n' + s.vertexShader.replace('#include <begin_vertex>', /* glsl */`
      #include <begin_vertex>
      vec3 anchor=(modelMatrix*instanceMatrix*vec4(0,0,0,1)).xyz;
      float breeze=sin(anchor.x*.54+anchor.z*.36+windClock*1.55)*.64+sin(anchor.x*.17-anchor.z*.13+windClock*2.15)*.36;
      float fade=1.-smoothstep(${(nearDist - 8).toFixed(1)},${(nearDist + 10).toFixed(1)},distance(cameraPosition,anchor));
      transformed.y*=fade;
      transformed.x+=breeze*position.y*position.y*.33;
      transformed.z+=breeze*position.y*position.y*.25;
    `);
    s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      // Blend toward a softer, foliage-like upward normal rather than showing each card's outline.
      normal=normalize(mix(normal,normalize(mat3(viewMatrix)*vec3(0.,1.,0.)),.62));`);
  };
  const rand = rng(981253), cells = [];
  const step = 19;
  for (let cz = -142; cz < 70; cz += step) for (let cx = -115; cx < 113; cx += step) {
    const high = cx > -36 && cx < 42 && cz > -53 && cz < 25;
    const samples = high ? (small ? 918 : 1530) : (small ? 186 : 365);
    const rows = [[], [], []];
    for (let i = 0; i < samples; i++) {
      const x = cx + rand() * step, z = cz + rand() * step, d = shoreDistance(x, z);
      if (d < .25) continue;
      const road = Math.abs(x - roadCenter(z));
      const bays = noise(x * .142 + .7, z * .148 + 4.4);
      const patch = noise(x * .31 + 51.0,z * .22);
      if (BUILDINGS.some(b => Math.abs(x - b.x) < b.halfX + .74 && Math.abs(z - b.z) < b.halfZ + .92)) continue;
      if (road < 2.45 + bays * .48 && z > -132 && !(road < .62 && rand() < .24 * bays)) continue;
      if (rand() > (.29 + .48 * smooth(.14,.84,patch) + .29 * bays)) continue;
      const reed = d < 2.35 && rand() > .55 && noise(x * .14, z * .165) > .48;
      const y = heightAt(x, z, d);
      if (y > 34) continue;
      let size = (.38 + rand() ** 1.41 * 1.09) * (.71 + bays * .57);
      if (road < .65) size *= .48;
      const variation = .61 + rand() * .52;
      rows[reed ? 2 : rand() < .23 ? 1 : 0].push([x, y - .016, z, size, size, size, rand() * Math.PI * 2, [variation * (1 + rand() * .19), variation, variation * (.68 + rand() * .30)]]);
    }
    const meshes = rows.map((list, i) => instances(scene, g[i], stems, list)).filter(Boolean);
    if (meshes.length) cells.push([cx + step / 2, cz + step / 2, meshes]);
  }
  return (target, time) => {
    windClock.value = time;
    for (const [x,z,meshes] of cells) {
      const visible = Math.hypot(target.x - x, target.z - z) < nearDist + 11;
      for (const m of meshes) m.visible = visible;
    }
  };
}
function stones(scene, maps, small) {
  const rand = rng(9872);
  const rockMat = mat('#c0b8aa', .94, { map: maps.gravel });
  const geometries = Array.from({ length: 3 }, () => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = .81 + noise(x * 4.4 + 5, z * 7 + y * 13) * .35;
      p.setXYZ(i, x * n, Math.max(-.58, y * n), z * n);
    }
    g.computeVertexNormals(); return g;
  });
  const cells = new Map();
  for (let i = 0; i < (small ? 1350 : 2150); i++) {
    const z = -83 + rand() * 115, x = rand() > .25 ? roadCenter(z) + (rand() - .5) * 10 : -18 + rand() * 43;
    const shore = shoreDistance(x,z);
    if (shore < -.1 || (shore > 2 && Math.abs(x - roadCenter(z)) > 4.1 && rand() > .33)) continue;
    const r = .019 + rand() ** 5.3 * (shore < 2.1 ? .32 : .114), tint = .47 + rand() * .85;
    const key = `${Math.floor(x / 19)},${Math.floor(z / 19)}`;
    if (!cells.has(key)) cells.set(key, [[], [], []]);
    cells.get(key)[i % 3].push([x, heightAt(x,z,shore) + r * .10, z, r * (1 + rand() * .29), r * (.40 + rand() * .42), r, rand() * 6.28, [tint,tint * .96,tint * (.83 + rand() * .3)]]);
  }
  for (const c of cells.values()) c.forEach((list, i) => instances(scene, geometries[i], rockMat, list));
}
function shoreDetails(scene, maps, small) {
  const rand = rng(42725), samples = small ? 1050 : 1600;
  const p = [], i = [], rgb = [];
  function triangle(a,b,c,color) {
    const m=p.length/3; p.push(...a,...b,...c); i.push(m,m+1,m+2);
    for (let j=0;j<3;j++) rgb.push(color.r,color.g,color.b);
  }
  const wild = new THREE.Color('#d5cab0'), core = new THREE.Color('#c09149');
  const leafA = new THREE.Color('#4c5630'), leafB = new THREE.Color('#698345');
  for (let j=0;j<6;j++) {
    const a=j*Math.PI/3+rand()*.45, L=.044+rand()*.061, width=.013+rand()*.014;
    const x=Math.cos(a), z=Math.sin(a), y=.039+rand()*.10;
    const t=[x*L*1.55,y,z*L*1.55], m=[x*L*.86,y*.85,z*L*.86];
    const l=[x*L-z*width,y*.62,z*L+x*width], r=[x*L+z*width,y*.65,z*L-x*width];
    triangle([0,.018,0],m,l,leafA); triangle([0,.018,0],r,m,leafB);
    triangle(m,t,l,leafA); triangle(m,r,t,leafB);
  }
  for (let j=0;j<3;j++) {
    const x=(rand()-.5)*.12, z=(rand()-.5)*.13, h=.14+rand()*.155, radius=.013+rand()*.013;
    triangle([x-.003,0,z],[x+.004,0,z],[x,h,z],leafA);
    triangle([x,0,z-.003],[x,h,z],[x,0,z+.004],leafB);
    for (let k=0;k<7;k++) {
      const a=k*Math.PI*2/7, e=a+.48, m=a+.27;
      const top=[x+radius*Math.cos(m),h+.003+rand()*.007,z+radius*Math.sin(m)];
      const left=[x+radius*.63*Math.cos(a),h,z+radius*.63*Math.sin(a)];
      const right=[x+radius*.63*Math.cos(e),h,z+radius*.63*Math.sin(e)];
      triangle([x,h+.001,z],left,right,core); triangle(left,top,right,wild);
    }
  }
  const flowers = new THREE.BufferGeometry();
  flowers.setAttribute('position',new THREE.Float32BufferAttribute(p,3)); flowers.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3)); flowers.setIndex(i); flowers.computeVertexNormals();
  const blooms = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide });
  const outcrop = new THREE.IcosahedronGeometry(1,1);
  const coords=outcrop.getAttribute('position');
  for(let v=0;v<coords.count;v++) {
    const x=coords.getX(v),y=coords.getY(v),z=coords.getZ(v), r=.79+noise(x*5+11,z*4+y*3)*.37;
    coords.setXYZ(v,x*r,Math.max(-.5,y*r),z*r);
  }
  outcrop.computeVertexNormals();
  const stones = mat('#a5a294', .93, { map: maps.gravel, bumpMap: maps.gravel, bumpScale: .031 });
  const plantRows=[], stoneRows=[];
  for (let j=0;j<samples;j++) {
    const z=-43+rand()*63, x=-24+rand()*53, distance=shoreDistance(x,z), road=Math.abs(x-roadCenter(z));
    const patch=noise(x*.21+65,z*.23+3);
    if (distance>.51 && road>2.5 && road<10 && patch>.54 && rand()<.58 && !BUILDINGS.some(b=>Math.hypot(b.x-x,b.z-z)<5.5)) {
      const s=.52+rand()**1.39*.93;
      plantRows.push([x,heightAt(x,z,distance)-.009,z,s,s,s,rand()*6.28,[.76+rand()*.29,.80+rand()*.23,.75+rand()*.23]]);
    }
    if (distance<.34 && distance>-.72 && patch>.42 && rand()<.89) {
      const s=.16+rand()**1.7*.66, shade=.79+rand()*.43;
      stoneRows.push([x,heightAt(x,z,distance)-.065,z,s,s*(.34+rand()*.24),s*(.54+rand()*.36),rand()*6.28,[shade,shade*.99,shade*.93],(rand()-.5)*.3]);
    }
  }
  instances(scene,flowers,blooms,plantRows);
  instances(scene,outcrop,stones,stoneRows,true);
}
export function addFlora(scene, maps, small) {
  makeTrees(scene, maps, small);
  stones(scene, maps, small);
  shoreDetails(scene, maps, small);
  return makeGrass(scene, small);
}
