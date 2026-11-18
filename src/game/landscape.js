import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { heightAt, LAKE, noise, roadCenter, shoreDistance, smooth, WATER_LEVEL } from './layout.js';

export const SUN = new THREE.Vector3(-0.73, 0.61, 0.315).normalize();
export const FOG_COLOR = '#a6bac3';
const noisetext = /* glsl */ `
float hash21(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float ns(vec2 p) {
  vec2 i = floor(p), u = fract(p); u = u*u*(3.0-2.0*u);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),u.x),mix(hash21(i+vec2(0,1)),hash21(i+1.0),u.x),u.y);
}
float fb(vec2 p) {
  return .54*ns(p) + .25*ns(mat2(.8,.6,-.6,.8)*p*2.11+7.1) + .13*ns(p*4.31-9.3) + .064*ns(p*8.25+19.2) + .034*ns(p*16.71);
}
`;
export function makeSky(scene) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: {
      sun: { value: SUN }, elapsed: { value: 0 }, lowColor: { value: new THREE.Color('#c4cfd0') },
      blue: { value: new THREE.Color('#7ca7c5') }, cloudTint: { value: new THREE.Color('#faf1df') },
    },
    vertexShader: `varying vec3 vSky; void main() { vSky=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sun, lowColor, blue, cloudTint; uniform float elapsed; varying vec3 vSky;
      ${noisetext}
      void main() {
        vec3 d=normalize(vSky); float y=max(0.0,d.y);
        float a=max(0.0,dot(d,sun));
        vec3 c=mix(lowColor,blue,pow(smoothstep(-.05,.75,d.y),.52));
        c += vec3(.32,.22,.103)*pow(a,7.0) + vec3(.17,.118,.063)*pow(a,48.0);
        vec2 p = d.xz/(.25+y)*vec2(2.5,3.38)+vec2(14.82,21.33)+vec2(elapsed*.011,elapsed*.003);
        vec2 flow = vec2(fb(p*.76+8.0),fb(p*.67-15.11))-.5;
        float n = fb(p+flow*1.27);
        float soft = smoothstep(.39,.67,n)*smoothstep(-.035,.20,d.y) * .94;
        float wisps = smoothstep(.53,.74,fb(p*vec2(.88,2.4)+vec2(9.,2.)))*.33*smoothstep(.01,.22,d.y);
        float light = smoothstep(.46,.63,n-fb(p+.15)*.11);
        vec3 cloud = mix(cloudTint*vec3(.58,.67,.75), cloudTint*1.43,light*.77+a*.23);
        c = mix(c,cloud,clamp(soft+wisps,0.,.92));
        c += vec3(.17,.09,.035)*(1.-smoothstep(0.0,.18,y))*pow(a,.9);
        gl_FragColor=vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1250, 40, 24), material);
  sky.renderOrder = -100; sky.frustumCulled = false; sky.layers.enable(1); scene.add(sky);
  return sky;
}

export function makeEnvironment(renderer, scene) {
  // A tiny analytic radiance probe; made locally without a network HDRI.
  const w = 128, h = 64, pixels = new Uint16Array(w * h * 4);
  const horizon = new THREE.Color('#d4e0d9'), zenith = new THREE.Color('#7697ae'), earth = new THREE.Color('#4a4833');
  const c = new THREE.Color();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const phi = y / (h - 1) * Math.PI, theta = x / w * Math.PI * 2;
    const sy = -Math.cos(phi), sx = -Math.cos(theta) * Math.sin(phi), sz = Math.sin(theta) * Math.sin(phi);
    const sun = Math.max(0, sx * SUN.x + sy * SUN.y + sz * SUN.z) ** 42;
    c.copy(horizon).lerp(sy < 0 ? earth : zenith, Math.abs(sy) ** .62);
    const cloud = sy > 0 ? smooth(.53, .76, noise(sx * 8, sz * 7.1)) * .4 : 0;
    c.r += sun * 5.0 + cloud; c.g += sun * 3.8 + cloud; c.b += sun * 2.3 + cloud;
    const k = (y * w + x) * 4;
    pixels[k] = THREE.DataUtils.toHalfFloat(c.r); pixels[k + 1] = THREE.DataUtils.toHalfFloat(c.g); pixels[k + 2] = THREE.DataUtils.toHalfFloat(c.b); pixels[k + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const t = new THREE.DataTexture(pixels, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  t.mapping = THREE.EquirectangularReflectionMapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(t);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.49;
  t.dispose(); pmrem.dispose();
  return environment;
}

function axis(min, low, high, max, dense, base, coarse) {
  const a = [];
  for (let p = low; p < high; p += dense) a.push(p);
  a.unshift(min); a.push(high);
  let p = low, stride = base;
  while ((p -= stride) > min + 3) { a.push(p); stride = Math.min(coarse, stride * 1.114); }
  p = high; stride = base;
  while ((p += stride) < max - 3) { a.push(p); stride = Math.min(coarse, stride * 1.114); }
  a.push(max);
  return a.sort((x, y) => x - y);
}
export function makeGround(scene, maps, small) {
  const X = axis(-730, -32, 65, 798, small ? .96 : .69, 1.37, 10.5);
  const Z = axis(-795, -108, 41, 610, small ? 1.01 : .76, 1.49, 10.3);
  const p = [], uv = [], a = [], indices = [];
  for (let j = 0; j < Z.length; j++) for (let i = 0; i < X.length; i++) {
    const x = X[i], z = Z[j], d = shoreDistance(x, z), y = heightAt(x, z, d);
    const road = x - roadCenter(z);
    const roadWeight = (1 - smooth(126, 174, -z)) * (1 - smooth(80, 107, z));
    const meadow = smooth(1.3, 5.8, d);
    const pat = noise(x * .056 + 5, z * .065 - 8);
    p.push(x, y, z); uv.push(x, z);
    a.push(road, meadow, roadWeight, pat);
    if (j && i) {
      const b = j * X.length + i;
      indices.push(b - X.length - 1, b - 1, b - X.length, b - X.length, b - 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('zone', new THREE.Float32BufferAttribute(a, 4));
  geo.setIndex(indices); geo.computeVertexNormals();
  const ground = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .93 });
  ground.onBeforeCompile = (s) => {
    s.uniforms.meadow = { value: maps.meadow }; s.uniforms.gravel = { value: maps.gravel };
    s.vertexShader = `attribute vec4 zone; varying vec4 vZone; varying vec3 vGround; varying float vSteep;\n` + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vZone=zone; vGround=position; vSteep=1.0-normal.y;`);
    s.fragmentShader = `uniform sampler2D meadow, gravel; varying vec3 vGround; varying vec4 vZone; varying float vSteep;\n${noisetext}\n` + s.fragmentShader.replace('#include <map_fragment>', /* glsl */`
      vec2 st=vGround.xz;
      float nearFade = 1.0 - smoothstep(28.0, 103.0, length(vGround-cameraPosition));
      float n=ns(st*.41+12.2);
      float e=(ns(st*.44)*.71 + ns(st*1.39+9.1)*.29 - .5)*1.19;
      float road=abs(vZone.x+e*.55);
      float dirt = (1.0-smoothstep(1.98+e, 3.56+e*.79,road)) * vZone.z;
      float tracks = max(1.-smoothstep(.29,.74,abs(vZone.x-(1.13+e*.18))),1.-smoothstep(.3,.73,abs(vZone.x+(1.14+e*.23))));
      dirt *= .64+tracks*.36;
      dirt *= 1.-(.54+e*.43)*(1.-smoothstep(.15,.72,road));
      float erosion=ns(st*.11 + 8.0);
      float shore=(1.0-vZone.y) * (.74 + e*.24);
      float path=clamp(max(dirt,shore)+smoothstep(.56,.78,n)*.12,0.,1.);
      vec3 grass = texture2D(meadow,st*.48+vec2(.17,.34)).rgb;
      vec3 stone = texture2D(gravel,st*.64).rgb;
      vec3 g2 = texture2D(meadow, mat2(.59,.81,-.81,.59)*st*.139).rgb;
      vec3 s2 = texture2D(gravel, mat2(.72,-.693,.693,.72)*st*.133 + 1.19).rgb;
      grass=mix(grass,g2,(.2 + (1.-nearFade)*.51));
      stone=mix(stone,s2,(.22 +(1.-nearFade)*.57));
      grass *= mix(vec3(.41,.64,.36), vec3(1.10,1.43,.86),smoothstep(.11,.87,erosion));
      grass *= mix(.62,1.21, smoothstep(.02,.99,vZone.w));
      grass=mix(grass,grass*vec3(.67,.85,.93), smoothstep(3.0,24.0,vGround.y)*.68);
      stone *= mix(vec3(1.03,1.05,.96),vec3(1.42,1.31,1.15),tracks*.65+erosion*.35);
      stone *= mix(vec3(.64,.78,.76), vec3(1.), smoothstep(.01,.26,vZone.y));
      float cliff=smoothstep(.035,.227, vSteep+e*.11)*smoothstep(16.,37.,vGround.y);
      vec3 rock=(s2*.55+.017) * vec3(.69,.91,1.05);
      rock *= .68 + ns(vec2(st.x*.15+st.y*.09,vGround.y*.038))*.88;
      vec3 land=mix(grass,stone,path);
      land=mix(land,rock,cliff*.91);
      float bands = smoothstep(.42,.76,ns(vec2(st.x*.20+st.y*.12,vGround.y*.17+st.y*.036)));
      land=mix(land,rock*1.39,smoothstep(27.,71.,vGround.y)*(.22 + .51*bands));
      diffuseColor.rgb*=land;
      float terrainBump = sqrt(max(.006, dot(mix(grass,stone,path),vec3(.299,.587,.114)))) * .037 * nearFade;
      `).replace('#include <normal_fragment_maps>', /* glsl */`
      #include <normal_fragment_maps>
      vec3 surfX=dFdx(-vViewPosition), surfY=dFdy(-vViewPosition);
      vec3 crossX=cross(surfY, normal), crossY=cross(normal, surfX);
      float det=dot(surfX,crossX);
      normal=normalize(abs(det)*normal-sign(det)*(dFdx(terrainBump)*crossX+dFdy(terrainBump)*crossY));
      `).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor=mix(.94,.64,(1.-smoothstep(.06,.46,vZone.y))*.85);`);
  };
  // Tiles share the typed vertex buffers and continuous normals. Bounding
  // volumes are local to the index ranges, so neither camera transforms the
  // full landscape when looking along the valley.
  const size = 49;
  for (let tz = 0; tz < Z.length - 1; tz += size) for (let tx = 0; tx < X.length - 1; tx += size) {
    const tile = new THREE.BufferGeometry(), tileIndex = [];
    for (const [name, attr] of Object.entries(geo.attributes)) tile.setAttribute(name, attr);
    const endX = Math.min(tx + size, X.length - 1), endZ = Math.min(tz + size, Z.length - 1);
    let loY = Infinity, hiY = -Infinity;
    for (let j = tz; j <= endZ; j++) for (let i = tx; i <= endX; i++) {
      const b = j * X.length + i, height = p[b*3+1];
      loY = Math.min(loY,height); hiY = Math.max(hiY,height);
      if (i > tx && j > tz) tileIndex.push(b-X.length-1,b-1,b-X.length,b-X.length,b-1,b);
    }
    tile.setIndex(tileIndex);
    tile.boundingBox = new THREE.Box3(new THREE.Vector3(X[tx],loY,Z[tz]),new THREE.Vector3(X[endX],hiY,Z[endZ]));
    tile.boundingSphere = tile.boundingBox.getBoundingSphere(new THREE.Sphere());
    const m = new THREE.Mesh(tile,ground); m.receiveShadow = true; m.layers.enable(1); scene.add(m);
  }
}

export function makeWater(scene, small) {
  const fog = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
  const uniforms = { ...fog, tDiffuse: { value: null }, textureMatrix: { value: null }, color: { value: null }, elapsed: { value: 0 }, sun: { value: SUN }, fogColor: { value: new THREE.Color(FOG_COLOR) } };
  const shader = { name: 'Lake', uniforms,
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      varying vec3 vLake; varying vec4 vReflect; uniform mat4 textureMatrix;
      void main() {
        vLake=(modelMatrix*vec4(position,1.)).xyz;
        vReflect=textureMatrix*vec4(position,1.);
        vec4 mvPosition=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      ${noisetext}
      uniform vec3 sun; uniform float elapsed; uniform sampler2D tDiffuse; varying vec3 vLake; varying vec4 vReflect;
      void main() {
        vec2 p=vLake.xz;
        float d=(length((p-vec2(${LAKE.x.toFixed(1)},${LAKE.z.toFixed(1)}))/vec2(${LAKE.rx.toFixed(1)},${LAKE.rz.toFixed(1)}))-1.)*87.;
        float depth=-(d + (ns(p*.087+20.)-.5)*2.0);
        float wave=sin(p.y*3.26+p.x*1.58+elapsed*.84)*.042 + sin(p.x*1.81-p.y*2.87+elapsed*1.05)*.025;
        float crossWave=sin(p.y*1.4-p.x*.95+elapsed*.77)*.046;
        float ripple=(fb(p*vec2(1.27,4.65)+elapsed*.27)-.5)*.12;
        vec3 n=normalize(vec3(crossWave+ripple*.62,1.0,wave+ripple));
        vec3 v=normalize(cameraPosition-vLake), r=reflect(-v,n);
        float fresnel=pow(1.-max(0.,dot(v,n)),4.0);
        float reflectedHills=pow(clamp(1.-max(0.,r.y)*3.2,0.,1.),3.7)*smoothstep(.40,.67,fb(vec2(r.x*7.5+p.x*.015,r.y*7.5+4.6)));
        vec3 sky=mix(vec3(.40,.52,.56),vec3(.19,.32,.41),smoothstep(0.,.44,r.y));
        sky=mix(sky,vec3(.12,.21,.232),reflectedHills*.77);
        vec2 ref=vReflect.xy/vReflect.w+vec2(crossWave*.22,(wave+ripple)*.29);
        float inside=smoothstep(0.,.035,min(min(ref.x,ref.y),min(1.-ref.x,1.-ref.y)));
        vec3 reflection=texture2D(tDiffuse,clamp(ref,vec2(.002),vec2(.998))).rgb;
        sky=mix(sky, reflection*vec3(.81,.97,1.03), inside*.82);
        vec3 lake=mix(vec3(.132,.194,.162),vec3(.032,.101,.119),smoothstep(.0,12.,depth));
        lake*=.81+.31*fb(p*.67+vec2(.12,elapsed*.03));
        lake=mix(lake,sky,clamp(.24+fresnel*.68,0.,.89));
        float glint=pow(max(0.,dot(reflect(-sun,n),v)),44.0)*.35;
        float shiver=ns(p*vec2(.6,3.6) + vec2(-elapsed*.18,elapsed*.33));
        lake += vec3(.21,.195,.13)*glint + vec3(.049,.066,.061)*pow(shiver,4.)*(.34+fresnel);
        lake += vec3(.044,.04,.025)*pow(max(0.,1.-abs(depth-.42)),2.0)*shiver;
        gl_FragColor=vec4(lake,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  };
  const water = new Reflector(new THREE.PlaneGeometry(2 * LAKE.rx + 11, 2 * LAKE.rz + 12), {
    shader, textureWidth: small ? 280 : 496, textureHeight: small ? 176 : 280,
    multisample: 0, clipBias: .003,
  });
  water.material.fog = true; water.camera.layers.set(1);
  water.position.set(LAKE.x, WATER_LEVEL, LAKE.z); water.rotation.x = -Math.PI / 2; scene.add(water);
  const reflect = water.onBeforeRender;
  const oldPosition = new THREE.Vector3(Infinity,0,0), oldRotation = new THREE.Quaternion();
  let lastTime = -1, lastFov = -1, lastAspect = -1;
  water.userData.refreshReflection = () => { lastFov = -1; };
  water.onBeforeRender = function(renderer, scene, camera) {
    const now = water.material.uniforms.elapsed.value;
    const framing = lastFov !== camera.fov || lastAspect !== camera.aspect;
    const moved = oldPosition.distanceToSquared(camera.position) > .037 || oldRotation.angleTo(camera.quaternion) > .013;
    if (!framing && (!(now - lastTime > (small ? .235 : .16)) || !moved)) return;
    lastTime = now; lastFov = camera.fov; lastAspect = camera.aspect;
    oldPosition.copy(camera.position); oldRotation.copy(camera.quaternion);
    reflect.call(water, renderer, scene, camera);
  };
  return water;
}
