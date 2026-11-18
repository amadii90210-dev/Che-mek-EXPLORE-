import * as THREE from 'three';
import { ball, batch, box, cord, face, group, mat, mesh, textTexture, tube } from './meshes.js';
import { forward, heightAt, right } from './layout.js';
import { damp } from './simulation.js';

function plate(parent, material, coordinates, depth, x) {
  const shape = new THREE.Shape();
  coordinates.forEach(([z,y],i) => i ? shape.lineTo(-z,y) : shape.moveTo(-z,y)); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 }); geo.rotateY(Math.PI / 2);
  return mesh(parent,geo,material,x,0,0);
}
function carTire(parent, palette, spare = false) {
  const { rubber, treads, alloy, hub, brake, bright } = palette;
  const radius = spare ? .361 : .403, width = spare ? .236 : .249;
  const curve = [[-.50,.72],[-.51,.82],[-.47,.91],[-.36,.975],[-.22,1],[.22,1],[.37,.979],[.49,.898],[.51,.82],[.50,.72],[-.50,.72]]
    .map(([a,b]) => new THREE.Vector2(radius * b, a * width));
  mesh(parent,new THREE.LatheGeometry(curve,32).rotateZ(-Math.PI/2),rubber);
  for (let i = 0; i < 30; i++) {
    const step = 2*Math.PI/30;
    for (const s of [-1,1]) {
      const a = i * step + s*.024;
      const tread = box(parent,treads,width*.45,.014,.044,s*width*.23,Math.cos(a)*radius,Math.sin(a)*radius);
      tread.rotation.order = 'XYZ'; tread.rotation.x = a; tread.rotation.y = s*.41;
    }
    if (i % 2 === 0) {
      const a = i * step + .06;
      const shoulder = box(parent,treads,.039,.016,.043,width*.451,Math.cos(a)*radius*.947,Math.sin(a)*radius*.947);
      shoulder.rotation.x = a;
    }
  }
  tube(parent,hub,[-width*.53,0,0],[width*.53,0,0],radius*.745,radius*.745,28);
  for (const s of [-1,1]) {
    const ring = new THREE.TorusGeometry(radius*.685,.014,6,32).rotateY(Math.PI/2);
    mesh(parent,ring,alloy,s*width*.544);
    tube(parent,brake,[s*width*.551,0,0],[s*width*.561,0,0],radius*.555,radius*.555,24);
    for (let i = 0; i < 6; i++) {
      const a = i/6*Math.PI*2;
      const m = box(parent,alloy,.02,radius*.55,.032,s*width*.6,Math.cos(a)*radius*.35,Math.sin(a)*radius*.35,.008); m.rotation.x = a;
      const y = Math.cos(a)*radius*.18, z = Math.sin(a)*radius*.18;
      tube(parent,bright,[s*width*.597,y,z],[s*width*.665,y,z],.011,.011,6);
    }
    tube(parent,alloy,[s*width*.559,0,0],[s*width*.659,0,0],radius*.218,radius*.205,18);
    tube(parent,hub,[s*width*.652,0,0],[s*width*.688,0,0],radius*.103,radius*.103,12);
  }
  batch(parent);
}

function makeSuv(scene) {
  const root = group(scene), shell = group(root), wheelPivots = [];
  const paint = new THREE.MeshPhysicalMaterial({ color: '#a5a48a', roughness: .47, metalness: .23, clearcoat: .39, clearcoatRoughness: .38 });
  paint.onBeforeCompile = s => {
    s.vertexShader = 'varying vec3 vCar;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCar=position;');
    s.fragmentShader = 'varying vec3 vCar;\n' + s.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat mud=(1.0-smoothstep(.47,1.1,vCar.y))*(.48+.20*sin(vCar.z*7.2+sin(vCar.y*21.0))+.13*sin(vCar.z*28.3+vCar.x*9.1)); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.21,.145,.082),mud);');
  };
  const darkPaint = mat('#686a55', .65, { metalness: .19 }), rubber = mat('#272825', .91), treads = mat('#2d2d28', .97), alloy = mat('#857f6f', .50, { metalness: .71 });
  const hub = mat('#31332d',.61,{metalness:.53}), brake = mat('#646761',.44,{metalness:.70}), bright = mat('#9c9f95',.31,{metalness:.65});
  const trim = mat('#333932',.69,{metalness:.22}), edge = mat('#505647',.61), gasket = mat('#242a26',.86);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#2b3d45', metalness: .52, roughness: .17, clearcoat: .72, clearcoatRoughness: .16, side: THREE.DoubleSide, envMapIntensity: 1.48 });
  glass.onBeforeCompile = s => {
    s.vertexShader = 'varying float vGlassHeight;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlassHeight=position.y;');
    s.fragmentShader = 'varying float vGlassHeight;\n' + s.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb*=mix(.54,1.55,smoothstep(1.27,1.93,vGlassHeight));');
  };
  const panel = mat('#a6a584', .63, { metalness: .2, side: THREE.DoubleSide });
  const red = new THREE.MeshPhysicalMaterial({ color: '#942e26', emissive:'#441209', emissiveIntensity: .17, roughness:.33, clearcoat:.77 });
  const redBright = mat('#cf5945',.38,{emissive:'#60261b',emissiveIntensity:.18});
  const white = new THREE.MeshPhysicalMaterial({ color:'#ecede1', roughness:.24, metalness:.06, clearcoat:.91, emissive:'#717c72', emissiveIntensity:.18 });
  const amber = mat('#be7434',.34,{metalness:.21,emissive:'#734a0b',emissiveIntensity:.19});
  box(shell,trim,1.45,.26,3.79,0,.49,.0,.08);
  box(shell,darkPaint,1.51,.40,4.11,0,.75,-.06,.092);
  box(shell,paint,1.77,.344,4.16,0,1.01,-.045,.079);
  box(shell,paint,1.75,.179,1.09,0,1.207,-1.469,.069).rotation.x = .038;
  box(shell,darkPaint,1.31,.055,.65,0,1.297,-1.40,.026).rotation.x = .038;
  for (const s of [-1,1]) box(shell,paint,.078,.039,.91,s*.558,1.29,-1.46,.016).rotation.x = .038;

  const bodySide = [[-2.075,.71],[-2.095,1.068],[-1.99,1.212],[1.93,1.208],[2.07,1.13],[2.08,.69],[1.74,.585]];
  for (let k = 0; k <= 12; k++) { const a = k * Math.PI / 12; bodySide.push([1.32 + .493 * Math.cos(a),.408 + .478 * Math.sin(a)]); }
  bodySide.push([.827,.561],[-.816,.561]);
  for (let k = 0; k <= 12; k++) { const a = k * Math.PI / 12; bodySide.push([-1.31 + .497 * Math.cos(a),.408 + .479 * Math.sin(a)]); }
  bodySide.push([-1.806,.583],[-2.032,.61]);
  for (const side of [-1,1]) {
    plate(shell,paint,bodySide,.184,side > 0 ? .715 : -.899);
    box(shell,trim,.076,.109,1.58,side*.90,.592,0,.028);
    box(shell,gasket,.053,.062,1.67,side*.913,1.037,.028,.012);
    for (const z of [-1.32,1.32]) {
      const fender = [];
      for (let i = 0; i <= 16; i++) { const a = -.09 + i * (Math.PI+.18)/16; fender.push([z+.568*Math.cos(a),.422+.529*Math.sin(a)]); }
      for (let i = 16; i >= 0; i--) { const a = -.09 + i * (Math.PI+.18)/16; fender.push([z+.483*Math.cos(a),.416+.449*Math.sin(a)]); }
      plate(shell,trim,fender,.084,side > 0 ? .882 : -.966);
      box(shell,rubber,.241,.234,.054,side*.853,.385,z+.485,.023).rotation.x = -.18;
    }
    for (const z of [-.83,.28,1.162]) {
      box(shell,darkPaint,.008,.43,.018,side*.901,.906,z,.003);
      if (z < 1) {
        box(shell,trim,.024,.047,.14,side*.912,1.074,z+.105,.013);
        box(shell,darkPaint,.029,.014,.104,side*.931,1.079,z+.106,.006);
      }
    }
    box(shell,paint,.046,.082,2.5,side*.901,1.254,.525,.021);
    box(shell,trim,.073,.042,2.51,side*.886,1.31,.54,.013).rotation.y = side*.022;
    box(shell,edge,.069,.054,2.41,side*.816,1.929,.602,.018);
    const xBottom = side*.898, xTop = side*.80;
    const posts = [[-.82,-.46], [.285,.36], [1.136,1.13], [1.88,1.769]];
    for (const [base, roof] of posts) tube(shell,paint,[xBottom,1.269,base],[xTop,1.92,roof],.052,.043,8);
    for (let i = 0; i < 3; i++) {
      const a = posts[i], b = posts[i+1], margin = .058;
      face(shell,glass,[[xBottom,1.32,a[0]+margin],[xBottom,1.32,b[0]-margin],[xTop,1.887,b[1]-margin],[xTop,1.887,a[1]+margin]]);
    }
    tube(shell,trim,[side*.875,1.302,-.63],[side*1.094,1.405,-.739],.036,.028,8);
    box(shell, trim,.162,.116,.204,side*1.116,1.428,-.745,.030).rotation.y = side*.045;
    box(shell, bright,.109,.077,.013,side*1.123,1.438,-.644,.009);
    box(shell,amber,.012,.045,.079,side*.885,1.137,-1.732,.007);
  }
  box(shell,paint,1.743,.134,2.51,0,1.943,.634,.062);
  box(shell,panel,1.63,.088,2.42,0,2.003,.612,.039);
  face(shell,glass,[[-.845,1.317,-.843],[.845,1.317,-.843],[.775,1.879,-.485],[-.775,1.879,-.485]]);
  tube(shell,trim,[-.85,1.304,-.853],[.85,1.304,-.853],.032,.032,8);
  tube(shell,trim,[-.80,1.891,-.482],[.80,1.891,-.482],.034,.034,8);
  for (const s of [-1,1]) {
    cord(shell,trim,[[s*.30,1.302,-.891],[s*.29,1.374,-.846],[s*.13,1.406,-.808]],.010,7);
    tube(shell,trim,[s*.125,1.387,-.83],[s*.281,1.448,-.792],.010,.009,6);
  }
  // Angled rear glass, split tailgate, light clusters, and chassis details.
  face(shell,glass,[[.827,1.287,1.873],[-.827,1.287,1.873],[-.750,1.890,1.765],[.750,1.890,1.765]]);
  box(shell,trim,1.64,.055,.059,0,1.894,1.786,.018);
  box(shell,darkPaint,1.60,.154,.081,0,1.266,1.939,.022);
  box(shell,paint,1.364,.554,.087,0,.92,2.057,.059);
  box(shell,trim,1.897,.137,.242,0,.591,2.062,.041);
  box(shell,edge,1.425,.064,.161,0,.655,2.113,.023);
  box(shell,trim,1.79,.160,.193,0,.639,-2.079,.041);
  box(shell,hub,.59,.196,.047,0,1.015,-2.119,.024);
  for (let i = 0; i < 5; i++) box(shell,edge,.543,.012,.047,0,.943+i*.036,-2.145,.004);
  for (const s of [-1,1]) {
    box(shell,gasket,.314,.239,.092,s*.576,1.011,-2.090,.037);
    tube(shell,bright,[s*.585,1.024,-2.148],[s*.585,1.024,-2.175],.109,.108,22);
    tube(shell,white,[s*.585,1.024,-2.167],[s*.585,1.024,-2.194],.087,.086,22);
    box(shell,amber,.275,.043,.036,s*.59,.867,-2.120,.01);
    box(shell,trim,.20,.362,.12,s*.781,.933,2.058,.036);
    box(shell,red,.155,.215,.061,s*.78,.967,2.125,.026);
    box(shell,redBright,.14,.032,.069,s*.78,1.016,2.138,.009);
    box(shell,white,.127,.05,.051,s*.78,.797,2.129,.011);
    for (const dy of [-.044,-.016,.016,.044]) box(shell, redBright,.108,.004,.068,s*.779,.946+dy,2.132,.001);
    box(shell,red,.153,.027,.013,s*.696,.623,2.203,.007);
  }
  box(shell,edge,.151,.081,.075,-.591,1.141,2.119,.017);
  box(shell,trim,.111,.028,.083,-.591,1.149,2.152,.011);
  box(shell, red,.368,.032,.028,0,1.947,1.911,.012);
  const plateMap = textTexture(256,68,(c,w,h) => { c.fillStyle='#d7d7c5'; c.fillRect(0,0,w,h); c.fillStyle='#526d77'; c.fillRect(0,0,26,h); c.fillStyle='#29302b'; c.font='bold 39px monospace'; c.fillText('BZA 041',38,47); });
  box(shell, trim,.352,.116,.021,-.41,.80,2.116,.012);
  mesh(shell,new THREE.PlaneGeometry(.328,.087),mat(0xffffff,.63,{map:plateMap}),-.41,.80,2.133,false);
  for (const x of [-.71,.71]) {
    tube(shell,trim,[x,2.021,-.305],[x,2.137,-.305],.028,.024,8);
    tube(shell,trim,[x,2.021,1.69],[x,2.137,1.69],.028,.024,8);
    tube(shell,trim,[x,2.133,-.336],[x,2.144,1.71],.033,.033,8);
  }
  for (let k=0;k<5;k++) tube(shell,trim,[-.704,2.125,-.22+k*.44],[.704,2.125,-.22+k*.44],.024,.024,8);
  tube(shell,trim,[.71,1.255,-1.87],[.71,1.877,-1.87],.009,.005,6);
  batch(shell);

  const spare = group(root,.199,1.192,2.259); spare.rotation.y = -Math.PI / 2; carTire(spare,{ rubber,treads,alloy,hub,brake,bright },true);
  for (const x of [-.842,.842]) for (const z of [-1.32,1.32]) {
    const pivot = group(root,x,.405,z), tire = group(pivot);
    carTire(tire,{ rubber,treads,alloy,hub,brake,bright }); wheelPivots.push([pivot,tire,z<0]);
  }
  return { root, update(v) {
    for (const [pivot,tire,steers] of wheelPivots) { pivot.rotation.y = steers ? -v.steer*.405 : 0; tire.rotation.x = v.wheel; }
  } };
}

function makeBike(scene) {
  const root = group(scene), frame = group(root), rear = group(root,0,.337,.747), steering = group(root,0,.825,-.532), front = group(steering,0,-.488,-.222), crank = group(root,0,.388,.1);
  const paint = mat('#a76839',.43,{metalness:.38}), trim = mat('#272b26',.74), grips = mat('#434339',.93);
  const metal = mat('#9b9f94',.31,{metalness:.72}), dim = mat('#575b51',.48,{metalness:.58});
  const saddle = mat('#463e34',.92), tire = mat('#2d2e28',.91), sidewall = mat('#70624e',.88), reflector = mat('#c88d47',.42,{emissive:'#49310d',emissiveIntensity:.19});
  const seat = [0,.867,.244], head = [0,.825,-.532], bb = [0,.388,.1];
  tube(frame,paint,seat,head,.028,.033,10); tube(frame,paint,seat,bb,.026,.032,10); tube(frame,paint,[0,.731,-.57],bb,.040,.048,12);
  for (const s of [-1,1]) {
    tube(frame,paint,[s*.049,.347,.722],[s*.022,.805,.276],.011,.018,8);
    tube(frame,paint,[s*.052,.347,.726],[s*.041,.393,.103],.014,.019,8);
  }
  tube(frame,dim,[0,.806,.256],[0,.998,.307],.019,.018,8);
  box(frame,saddle,.176,.044,.277,0,1.003,.294,.019).rotation.x=.055;
  ball(frame,saddle,.046,.024,.082,0,1.006,.137);
  tube(frame,trim,[0,.98,.314],[0,.985,.424],.014,.011,8);
  box(frame,mat('#a6402c',.45),.041,.022,.019,0,.971,.435,.008);
  cord(frame,trim,[[.060,.788,-.50],[.082,.694,-.138],[.067,.553,.144],[.080,.399,.675]],.006,16);
  for (const [a,b] of [[.439,.38],[.351,.315]]) tube(frame,trim,[.063,a,.13],[.058,b,.743],.006,.006,6);
  batch(frame);
  const fork = group(steering);
  tube(fork,trim,[0,-.125,-.042],[0,.206,.066],.024,.018,8);
  cord(fork,dim,[[-.331,.217,.027],[-.2,.175,.002],[0,.164,-.037],[.2,.175,.002],[.331,.217,.027]],.019,21);
  for (const s of [-1,1]) {
    tube(fork,grips,[s*.241,.194,.017],[s*.374,.228,.028],.025,.022,12);
    cord(fork,metal,[[s*.22,.192,.01],[s*.279,.172,-.043],[s*.332,.198,-.053]],.007,8);
    tube(fork,paint,[s*.058,-.087,-.055],[s*.057,-.488,-.222],.021,.014,10);
  }
  batch(fork);
  for (const w of [front,rear]) {
    mesh(w,new THREE.TorusGeometry(.313,.0275,10,48).rotateY(Math.PI/2),tire);
    mesh(w,new THREE.TorusGeometry(.287,.013,8,48).rotateY(Math.PI/2),metal);
    for (const s of [-1,1]) mesh(w,new THREE.TorusGeometry(.319,.006,6,48).rotateY(Math.PI/2),sidewall,s*.022);
    tube(w,dim,[-.062,0,0],[.062,0,0],.035,.035,14);
    for (let i = 0; i < 20; i++) {
      const a = i * Math.PI * 2 / 20, s = i % 2 === 0 ? 1 : -1;
      tube(w,metal,[s*.039,Math.cos(a+.67)*.03,Math.sin(a+.67)*.03],[0,Math.cos(a)*.287,Math.sin(a)*.287],.003,.0025,5);
    }
    box(w,reflector,.012,.094,.032,.004,.191,.04,.005); batch(w);
  }
  tube(crank,dim,[-.092,0,0],[.092,0,0],.027,.027,12);
  tube(crank,dim,[.058,0,0],[.071,0,0],.075,.075,23);
  mesh(crank,new THREE.TorusGeometry(.074,.006,6,24).rotateY(Math.PI/2),metal,.075);
  const pedals=[];
  for (const s of [-1,1]) {
    tube(crank,metal,[s*.075,0,0],[s*.095,s*.131,0],.012,.013,8);
    const pivot = group(crank,s*.137,s*.132,0); box(pivot,trim,.099,.024,.066,0,0,0,.007); pedals.push(pivot);
  }
  return { root, update(v) {
    rear.rotation.x = v.wheel; front.rotation.x = v.wheel; steering.rotation.y = -v.steer*.39;
    crank.rotation.x = v.pedal; pedals.forEach(p => { p.rotation.x = -v.pedal; });
  } };
}

export function makeVehicles(scene) {
  const renderers = { suv: makeSuv(scene), bike: makeBike(scene) };
  return {
    update(vehicles, dt) {
      for (const v of vehicles) {
        const { root, update } = renderers[v.id];
        const [fx,fz] = forward(v.yaw), [rx,rz] = right(v.yaw), f = v.id === 'suv' ? 1.34 : .74, w = v.id === 'suv' ? .84 : .25;
        const yF = heightAt(v.x+fx*f,v.z+fz*f), yB = heightAt(v.x-fx*f,v.z-fz*f);
        const yL = heightAt(v.x-rx*w,v.z-rz*w), yR = heightAt(v.x+rx*w,v.z+rz*w);
        root.position.set(v.x,(yF+yB)*.5,v.z);
        root.rotation.order = 'YXZ'; root.rotation.y = -v.yaw;
        root.rotation.x = Math.atan2(yF-yB,2*f);
        const lean = v.id === 'bike' ? -v.steer * Math.min(.23, Math.abs(v.speed)*.037) - .044 : 0;
        root.rotation.z = damp(root.rotation.z,Math.atan2(yR-yL, 2*w)+lean,dt ? 10 : 0,dt || 1);
        if (!dt) root.rotation.z = Math.atan2(yR-yL,2*w)+lean;
        if (v.id === 'bike') v.renderY = root.position.y;
        update(v);
      }
    },
    getBikeRoot() { return renderers.bike.root; },
  };
}
