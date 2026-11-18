import * as THREE from 'three';
import { BUILDINGS, heightAt, rng } from './layout.js';
import { batch, box, face, group, mat, textTexture, tube } from './meshes.js';

function cabinMaterials(maps) {
  const { timber, gravel } = maps;
  const wood = ['#b8ae94','#aa9c82','#aa9d88','#bfb29b','#938775'].map((c,i) => mat(c,.94,{map:timber,bumpMap:timber,bumpScale:.015-i*.002}));
  const beam = mat('#877662',.90,{map:timber,bumpMap:timber,bumpScale:.024});
  const cut = mat('#b7a58b',.91,{map:timber});
  const iron = mat('#535b54',.73,{metalness:.39,side:THREE.DoubleSide});
  const trim = mat('#757e70',.73,{metalness:.32});
  const shadow = mat('#333a32',.98);
  const rock = mat('#a0a093',.97,{map:gravel,bumpMap:gravel,bumpScale:.05});
  const window = new THREE.MeshPhysicalMaterial({color:'#496068',roughness:.28,metalness:.29,clearcoat:.67,clearcoatRoughness:.22,envMapIntensity:1.31});
  return { wood,beam,cut,iron,trim,shadow,rock,window };
}
function paintBoards(m, rand, scaleX = 3.1) {
  const a = m.geometry.getAttribute('uv'), u = rand(), v = rand() * .82;
  for (let i = 0; i < a.count; i++) a.setXY(i,a.getX(i)*scaleX+u,a.getY(i)*.133+v);
  return m;
}
function makeCabin(scene, spec, p) {
  const rand = rng(spec.id === 'station' ? 21942 : 4565);
  const station = spec.id === 'station', root = group(scene,spec.x,heightAt(spec.x,spec.z),spec.z);
  root.rotation.y = -spec.yaw;
  const w = spec.halfX*2 - .48, d = station ? 4.81 : spec.halfZ*2-.41;
  const wallH = station ? 2.77 : 1.86, floor = station ? .34 : .18;
  const eave = floor + wallH, ridge = eave + (station ? 1.31 : .65), front = station ? 2.0 : d*.5;
  const back = front - d, center = (front+back)/2;
  const { wood,beam,cut,iron,trim,shadow,rock,window } = p;
  box(root,rock,w+.055,floor+.34,d+.02,0,(floor-.34)/2,center,.03);
  box(root,shadow,w-.055,wallH,d-.03,0,floor+wallH/2,center);
  const rows = Math.round(wallH/.202);
  for (let i=0;i<rows;i++) {
    const y = floor+(i+.5)*wallH/rows, h = wallH/rows-.012;
    for (const z of [front,back]) paintBoards(box(root,wood[Math.floor(rand()*wood.length)],w+.036,h,.056,0,y,z,.005),rand, w*.57);
    for (const x of [-w*.5,w*.5]) paintBoards(box(root,wood[Math.floor(rand()*wood.length)],.056,h,d, x,y,center,.006),rand,d*.58);
  }
  for (const x of [-w*.5,w*.5]) for (const z of [front,back]) {
    paintBoards(box(root,beam,.112,wallH+.052,.118,x,floor+wallH*.5,z,.012),rand,1.48);
    for (let y = floor+.2; y < eave-.12; y+=.39) box(root,trim,.017,.016,.008,x,y,z+(z===front?.063:-.063),.002);
  }
  const ax = w*.5+.34, dz = d*.5+.35;
  for (const s of [-1,1]) {
    const end = [center+s*dz,eave-.104];
    face(root,iron,[[-ax,end[1],end[0]],[ax,end[1],end[0]],[ax,ridge,center],[-ax,ridge,center]]);
    for (let x=-ax+.03;x<ax;x+=.23) tube(root,trim,[x,eave-.098,center+s*dz],[x,ridge+.016,center+s*.021],.009,.012,5);
    tube(root,trim,[-ax-.05,eave-.131,center+s*dz],[ax+.05,eave-.131,center+s*dz],.036,.036,8);
    for(const x of [-ax,ax]) tube(root,beam,[x,eave-.15,center+s*dz],[x,ridge+.028,center],.047,.056,7);
  }
  tube(root,trim,[-ax-.049,ridge+.016,center],[ax+.049,ridge+.016,center],.041,.041,9);
  for (const s of [-1,1]) {
    const x = s * w*.499;
    for (let y = eave; y < ridge-.045; y += .147) {
      const span = d * (1-(y-eave+.025)/(ridge-eave));
      paintBoards(box(root,wood[Math.floor(rand()*wood.length)],.051,.153,span,x,y,center,.005),rand,Math.max(.2,span*.37));
    }
  }
  function casement(x,y,z,angle,wide = 1.18, height=.91) {
    const g = group(root,x,y,z); g.rotation.y = angle;
    box(g,beam,wide+.22,height+.21,.116,0,0,0,.016);
    box(g,shadow,wide+.038,height+.038,.05,0,0,.069,.009);
    box(g,window,wide-.019,height-.018,.041,0,0,.10,.009);
    for (const s of [-1,1]) {
      box(g,cut,wide+.091,.054,.048,0,s*height*.5,.124,.008);
      box(g,cut,.045,height+.058,.051,s*wide*.5,0,.124,.007);
    }
    box(g,cut,.034,height,.048,-wide*.025,0,.130,.004);
    box(g,cut,wide,.034,.047,0,height*.098,.132,.004);
    box(g,beam,wide+.271,.066,.212,0,-height*.5-.082,.092,.011);
    for (const s of [-1,1]) box(g,trim,.028,.038,.014,s*(wide*.5+.051),height*.213,.067,.005);
  }
  function door(x,y,z,w1,h1) {
    const m = group(root,x,y,z);
    box(m,beam,w1+.173,h1+.143,.11,0,0,0,.015); box(m,shadow,w1+.021,h1+.019,.078,0,0,.061,.009);
    for (let k=0;k<7;k++) paintBoards(box(m,wood[k%wood.length],w1/7-.011,h1-.035,.05,(k-3)*w1/7,0,.103,.004),rand,1.7);
    box(m,beam,w1,.081,.032,0,h1*.28,.135,.009); box(m,beam,w1,.072,.033,0,-h1*.28,.135,.008);
    box(m,trim,.11,.028,.07,w1*.31,-.044,.152,.007); box(m,shadow,.029,.056,.011,w1*.37,-.05,.128,.004);
    for (const s of [-1,1]) box(m,iron,.10,.055,.03,-w1*.43,h1*.33*s,.135,.007);
  }
  if (station) {
    door(-.32,floor+1.08,front,1.01,2.08);
    casement(-2.27,floor+1.51,front,0,1.26,.97); casement(1.98,floor+1.59,front,0,1.29,1.0);
    casement(-w*.5,floor+1.61,-.20,-Math.PI/2,1.05,.85);
    casement(w*.5,floor+1.6,-.57,Math.PI/2,1.2,.98);
    casement(1.65,floor+1.56,back,Math.PI,1.23,.84);
    const porch = group(root,0,floor-.071,front+.52);
    for (let k=0;k<8;k++) paintBoards(box(porch,wood[k%wood.length],w-.43,.096,.138,0,0,(k-4)*.14,.007),rand,4.6);
    for (let k=0;k<2;k++) paintBoards(box(porch,beam,1.9,.124,.268,-.26,-.113-k*.115,.666+k*.177,.019),rand,1.5);
    for (const x of [-3.55,3.34]) {
      box(root,beam,.13,1.3,.13,x,floor+.631,front+.93,.01);
      box(root,rock,.237,.15,.237,x,.082,front+.93,.026);
    }
    for (const s of [-1,1]) {
      box(root,beam,2.76,.104,.102,s*2.28,floor+.809,front+1,.017);
      for (let k=0;k<5;k++) box(root,cut,.051,.69,.053,s*(1.19+k*.52),floor+.425,front+1,.006);
    }
    // Small enamel station plate and a rain gutter/downpipe.
    const sign = textTexture(256,80,(c,wd,ht) => { c.fillStyle='#cec3a7'; c.fillRect(0,0,wd,ht); c.strokeStyle='#514a3b'; c.lineWidth=4; c.strokeRect(7,7,wd-14,ht-14); c.fillStyle='#37382e'; c.font='bold 20px sans-serif'; c.textAlign='center'; c.fillText('STACJA TERENOWA',128,48); });
    box(root,mat(0xffffff,.73,{map:sign}),.774,.241,.02,-.31,eave-.418,front+.048,.0);
    for (const x of [-w*.5+.015,w*.5-.015]) tube(root,iron,[x,floor-.08,front+.11],[x,eave-.099,front+.135],.025,.025,9);
    const chimney = group(root,2.27,ridge-.41,center-.737);
    box(chimney,rock,.518,.988,.42,0,.30,0,.04);
    box(chimney,iron,.62,.086,.507,0,.79,0,.019);
    box(chimney,shadow,.415,.047,.310,0,.84,0,.009);
    const bracketX = -2.59, mz = center-.27;
    tube(root,iron,[bracketX,ridge-.9,mz],[bracketX,ridge+2.47,mz],.023,.014,7);
    for (let k=0;k<4;k++) tube(root,trim,[bracketX-.67+k*.09,ridge+2.29-k*.21,mz+.026],[bracketX+.67-k*.09,ridge+2.29-k*.21,mz-.023],.011,.011,6);
  } else {
    door(-.64,floor+.784,front,.807,1.51);
    casement(.69,floor+1.15,front,0,.61,.58);
  }
  batch(root);
}
export function addBuildings(scene, maps) {
  const palette = cabinMaterials(maps);
  for (const b of BUILDINGS) makeCabin(scene,b,palette);
}
