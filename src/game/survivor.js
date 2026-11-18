import * as THREE from 'three';
import { ball, batch, box, cord, group, loft, mat, textile, tube } from './meshes.js';
import { clamp, lerp, smooth } from './layout.js';
import { damp } from './simulation.js';

const UPPER = .443, LOWER = .414;
function solveLeg(leg, dy, dz, pitch = 0) {
  const d = clamp(Math.hypot(dy, dz), .25, UPPER + LOWER - .001);
  const a = Math.acos(clamp((UPPER * UPPER + d * d - LOWER * LOWER) / (2 * UPPER * d), -1, 1));
  const b = Math.acos(clamp((UPPER * UPPER + LOWER * LOWER - d * d) / (2 * UPPER * LOWER), -1, 1));
  leg.hip.rotation.x = Math.atan2(-dz, -dy) + a;
  leg.knee.rotation.x = b - Math.PI;
  leg.ankle.rotation.x = -leg.hip.rotation.x - leg.knee.rotation.x + pitch;
}
export function makeSurvivor(scene) {
  const root = group(scene), pelvis = group(root, 0, .948, 0), spine = group(pelvis);
  root.scale.x = 1.06;
  const cloth = textile(1123), canvas = textile(3138), knit = textile(5547, 'knit');
  const rug = (color, map = cloth, roughness = .93, bumpScale = .006) => mat(color, roughness, { map, bumpMap: map, bumpScale });
  const jacket = rug('#536047'), jacketHi = rug('#627052'), jacketDark = rug('#374237');
  const trousers = rug('#41453d'), pantEdge = rug('#535649'), kneePad = rug('#383c33');
  const sole = mat('#23241f'), leather = rug('#514335', cloth, .79), toe = rug('#423e31', cloth, .86);
  const skin = mat('#aa7a57', .76), hair = rug('#382e23', knit), cap = rug('#52574c', knit), capHem = rug('#3a453d', knit);
  const backpack = rug('#96764d', canvas, .97, .016), flap = rug('#b09568', canvas, .91, .014);
  const trim = rug('#534838', canvas, .96), edge = rug('#9b875e', canvas), web = rug('#675939', knit);
  const buckle = mat('#282c26', .62), hardware = mat('#a5a99a', .39, { metalness: .63 });

  const hips = group(pelvis);
  loft(hips, trousers, [[-.102,.137,.098],[-.066,.172,.118],[-.01,.177,.122],[.036,.168,.108],[.066,.147,.098]], { power: .76, ripple: .061 });
  loft(hips, jacketDark, [[.045,.160,.111],[.065,.175,.119],[.104,.169,.113]], { power: .79, ripple: .062 });
  batch(hips);
  const coat = group(spine);
  loft(coat, jacket, [[.057,.161,.108],[.098,.182,.118,0,.006],[.172,.174,.118,0,.012],[.243,.194,.13,0,.006],
    [.329,.207,.136,0,-.003],[.403,.221,.13,0,-.014],[.471,.21,.114,0,-.018],[.518,.156,.101,0,-.019],[.543,.093,.077,0,-.025]], { power: .76, ripple: .051 });
  loft(coat, jacketDark, [[.501,.115,.082,0,-.022],[.556,.091,.079,0,-.027],[.587,.080,.066,0,-.025]], { power: .78, ripple: .032 });
  tube(coat, buckle, [0,.123,-.122], [0,.505,-.128], .005, .003, 5);
  box(coat, hardware, .013, .023, .011, 0,.437,-.142,.003);
  for (const s of [-1,1]) {
    cord(coat, jacketDark, [[s*.17,.104,.028],[s*.175,.187,.034],[s*.192,.295,.041],[s*.207,.402,.006],[s*.175,.497,-.01]], .0033, 14);
    cord(coat, jacketHi, [[s*.122,.372,-.114],[s*.164,.443,-.10],[s*.193,.46,-.068]], .005, 10);
    const pocket = box(coat, jacketHi, .091,.072,.015,s*.109,.283,-.118,.012); pocket.rotation.y = -s*.25;
    box(coat, jacketDark, .082,.013,.018,s*.109,.313,-.131,.003).rotation.y = -s*.24;
    const strap = [[s*.118,.347,-.133],[s*.139,.462,-.13],[s*.139,.514,-.057],[s*.144,.511,.055],[s*.159,.454,.16],[s*.153,.372,.191]];
    cord(coat, web, strap, .019, 22, 7);
    cord(coat, trim, [[s*.116,.14,-.114],[s*.132,.266,-.137],[s*.117,.381,-.144]], .015, 10, 6);
    box(coat, buckle, .027,.048,.019,s*.127,.298,-.151,.004);
  }
  batch(coat);

  const head = group(spine, 0, .566, -.027), headGeo = group(head);
  tube(headGeo, skin, [0,-.034,0],[0,.135,-.016],.056,.063,16);
  loft(headGeo, skin, [[.044,.044,.05,0,-.018],[.068,.068,.065,0,-.013],[.109,.078,.074,0,-.01],[.158,.083,.082,0,.001],[.207,.075,.076,0,.007],[.237,.054,.056,0,.007]], { sides: 26, power: .84 });
  ball(headGeo, skin, .022,.027,.018,0,.119,-.081);
  ball(headGeo, hair, .079,.074,.076,0,.157,.015);
  for (const s of [-1,1]) ball(headGeo, skin, .016,.023,.015,s*.076,.124,.006);
  loft(headGeo, cap, [[.143,.085,.084,0,.01],[.164,.090,.087,0,.006],[.218,.089,.088,0,.0],[.252,.065,.063,0,.005],[.269,.030,.033,0,.006],[.273,.005,.007,0,.006]], { sides: 31, power: .86, ripple: .026 });
  loft(headGeo, capHem, [[.140,.085,.084,0,.009],[.150,.091,.09,0,.007],[.174,.093,.092,0,.004],[.181,.091,.09,0,.004]], { sides: 28, power: .87, ripple: .02 });
  box(headGeo, trim, .026,.018,.006,.036,.162,.087,.002).rotation.y = .27;
  batch(headGeo);

  const pack = group(spine, 0,.277,.155), packGeo = group(pack);
  loft(packGeo, backpack, [[-.182,.137,.073,0,.016],[-.16,.164,.087,0,.025],[-.096,.174,.102,0,.032],[.028,.179,.105,0,.037],[.12,.17,.103,0,.027],[.18,.15,.098,0,.024],[.223,.102,.065,0,.014],[.229,.079,.047,0,.003]], { sides: 32, power: .58, ripple: .051 });
  loft(packGeo, trim, [[-.184,.129,.071,0,.017],[-.164,.163,.09,0,.023],[-.139,.166,.092,0,.029]], { power: .66, sides: 26, ripple: .03 });
  const front = box(packGeo, flap, .287,.178,.069,0,-.051,.117,.035); front.rotation.x = -.058;
  box(packGeo, trim, .261,.015,.008,0,.01,.155,.003).rotation.z = -.039;
  box(packGeo, hardware, .027,.01,.008,.082,.010,.16,.003);
  tube(packGeo, buckle, [.086,.012,.155],[.096,-.022,.161],.003,.004,5);
  const top = box(packGeo, flap, .294,.086,.167,0,.164,.047,.034); top.rotation.x = -.29;
  const patch = box(packGeo, trim, .066,.035,.005,-.006,.115,.140,.007); patch.rotation.x = -.35;
  tube(packGeo, edge, [-.024,.109,.145],[-.010,.122,.142],.0022,.0022,5);
  tube(packGeo, edge, [-.010,.122,.142],[.009,.109,.145],.0022,.0022,5);
  tube(packGeo, edge, [-.025,.105,.146],[.011,.105,.146],.0014,.0014,5);
  for (const s of [-1,1]) {
    cord(packGeo, edge, [[s*.141,-.151,.1],[s*.154,-.075,.124],[s*.154,.034,.126],[s*.15,.096,.109],[s*.126,.183,.089]], .0036, 17);
    cord(packGeo, web, [[s*.106,.185,.085],[s*.105,.139,.134],[s*.098,.085,.145],[s*.099,.032,.154],[s*.097,-.037,.162],[s*.105,-.075,.151]], .0115, 17, 6);
    box(packGeo, buckle, .03,.024,.014,s*.097,.049,.158,.005);
    box(packGeo, web, .025,.138,.007,s*.16,-.074,.075,.004).rotation.z = s*.09;
    for (let i = 0; i < 8; i++) box(packGeo, edge, .007,.0016,.0017,s*(.084 + .0061*i), -.12,.151 - i * .0008,.0002);
  }
  cord(packGeo, web, [[-.048,.198,.002],[-.03,.246,-.003],[.025,.245,-.005],[.050,.202,.001]], .009, 15);
  const bottle = group(packGeo, -.177,-.080,.022); bottle.rotation.z = -.09;
  loft(bottle, mat('#5c6854', .48, { metalness: .34 }), [[-.061,.038,.038],[-.045,.043,.042],[.066,.042,.042],[.091,.032,.032],[.104,.023,.023]], { sides: 14 });
  tube(bottle, buckle, [0,.099,0],[0,.123,0],.025,.025,14);
  box(bottle, web,.082,.046,.075,.004,-.04,.001,.019);
  cord(packGeo, hardware, [[.164,.077,.047],[.182,.065,.057],[.184,.039,.052],[.165,.031,.045],[.155,.05,.041],[.164,.077,.047]], .0046, 18);
  const roll = group(packGeo, .025,-.146,.124); roll.rotation.z = .065;
  tube(roll, rug('#69654b', canvas), [-.148,-.008,0],[.156,-.008,0],.047,.042,16);
  for (const s of [-1,1]) {
    tube(roll, trim, [s*.103,-.008,0],[s*.118,-.008,0],.050,.050,12);
    const wrap = group(roll,s*.156,-.008,0); wrap.rotation.y = Math.PI / 2;
    cord(wrap, web, [[-.007,.004,0],[.009,.016,0],[.025,-.007,0],[0,-.03,0],[-.032,-.019,0]], .0027, 13);
  }
  batch(packGeo);

  const arms = [];
  for (const s of [-1,1]) {
    const pivot = group(spine, s*.205,.426,-.005), shoulder = group(pivot);
    loft(shoulder, jacket, [[-.228,.058,.058,s*.014,0],[-.193,.064,.062,s*.020,.002],[-.160,.065,.068,s*.024,.005],[-.107,.071,.069,s*.016,.006],[-.057,.080,.077,s*.007,.005],[.014,.087,.083,0,-.005],[.052,.068,.064,-s*.013,-.008],[.08,.042,.041,-s*.027,-.008]], { power: .85, ripple: .083 });
    if (s === -1) {
      box(shoulder, trim,.005,.047,.045,-.089,-.043,.008,.006).rotation.x = -.08;
      box(shoulder, edge,.006,.012,.028,-.092,-.043,.011,.002);
    }
    batch(shoulder);
    const elbow = group(pivot, s*.008,-.223,.002), arm = group(elbow);
    loft(arm, jacketHi, [[-.205,.039,.042,0,-.003],[-.179,.044,.046,0,-.005],[-.143,.047,.049,0,-.002],[-.110,.044,.053,0,-.002],[-.073,.051,.055,0,.001],[-.033,.055,.05,0,.003],[.011,.057,.055,0,.005],[.034,.05,.05,0,.005]], { power: .89, ripple: .083 });
    loft(arm, jacketDark, [[-.219,.032,.035,0,-.006],[-.197,.04,.043,0,-.003],[-.178,.042,.043,0,-.004]], { power: .87, ripple: .05 });
    loft(arm, trim, [[-.295,.019,.017,s*.001,-.016],[-.280,.029,.022,s*.001,-.011],[-.246,.034,.026,s*.002,-.01],[-.216,.027,.026,0,-.005]], { sides: 15, power: .73, ripple: .03 });
    ball(arm, leather,.014,.033,.013,-s*.027,-.253,-.023);
    for (let i = 0; i < 3; i++) cord(arm, jacketDark, [[-.02+.015*i,-.258,.014],[-.019+.015*i,-.279,.012],[-.017+.015*i,-.291,.002]], .0014, 5, 4);
    batch(arm); arms.push({ pivot, elbow, s });
  }
  const legs = [];
  for (const s of [-1,1]) {
    const hip = group(pelvis,s*.102,0,0), thigh = group(hip);
    loft(thigh, trousers, [[-.45,.065,.064,0,-.004],[-.413,.073,.071,0,-.003],[-.371,.074,.076,0,.001],[-.318,.083,.077,0,.006],[-.247,.089,.087,0,.009],[-.182,.098,.091,0,.004],[-.107,.105,.105,-s*.005,0],[-.054,.099,.106,-s*.008,0],[.005,.087,.084,-s*.008,0],[.036,.078,.077,-s*.01,0]], { sides: 23, power: .82, ripple: .056 });
    const cargo = box(thigh, pantEdge,.047,.138,.103,s*.08,-.206,.019,.024); cargo.rotation.z = -s*.11;
    box(thigh, kneePad,.035,.021,.103,s*.099,-.151,.015,.007).rotation.z = -s*.11;
    cord(thigh, kneePad, [[s*.089,-.44,.008],[s*.088,-.299,-.028],[s*.109,-.187,-.028],[s*.107,-.061,-.031]], .0038, 18);
    batch(thigh);
    const knee = group(hip,0,-UPPER,0), shin = group(knee);
    loft(shin, trousers, [[-.389,.051,.052,0,.005],[-.351,.053,.056,0,.008],[-.312,.057,.057,0,.003],[-.277,.059,.060,0,.011],[-.230,.064,.064,0,.011],[-.172,.068,.070,0,.014],[-.121,.071,.072,0,.010],[-.075,.073,.074,0,.007],[-.025,.072,.074,0,-.004],[.034,.064,.062,0,-.009]], { sides: 22, power: .83, ripple: .081 });
    const padding = box(shin,kneePad,.087,.113,.027,0,-.016,-.065,.015); padding.rotation.x = .08;
    box(shin,pantEdge,.078,.015,.022,0,-.058,-.075,.004);
    batch(shin);
    const ankle = group(knee,0,-LOWER,0), shoe = group(ankle);
    loft(shoe, sole, [[-.123,.059,.123,0,-.052],[-.116,.061,.125,0,-.052],[-.094,.061,.125,0,-.051],[-.087,.059,.12,0,-.049]], { power: .62, sides: 26 });
    loft(shoe, leather, [[-.089,.057,.119,0,-.049],[-.064,.057,.112,0,-.052],[-.039,.056,.093,0,-.039],[-.016,.051,.071,0,-.019],[.022,.049,.06,0,-.004],[.067,.053,.054,0,.005],[.081,.050,.051,0,.008]], { power: .68, sides: 24, ripple: .021 });
    ball(shoe,toe,.055,.023,.044,0,-.065,-.129);
    for (let j = 0; j < 4; j++) {
      tube(shoe, trim, [-.026,.024-j*.018,-.057-j*.016],[.026,.022-j*.018,-.063-j*.016],.0023,.0023,5);
      for (const a of [-1,1]) box(shoe, sole,.008,.012,.023,a*.056,-.117,-.12 + j * .051,.002);
    }
    box(shoe,pantEdge,.029,.014,.009,0,.018,.051,.003); batch(shoe);
    legs.push({ hip, knee, ankle,s });
  }

  let phase = 0, gait = 0;
  return {
    root,
    pose(dt, time, speed, bike) {
      if (bike) {
        const pedal = bike.pedal;
        pelvis.position.set(0,1.078,.257); spine.position.z = -.051; spine.rotation.set(-.69,0,0); pack.rotation.x = -.06; head.rotation.x = .47;
        arms.forEach(({ pivot, elbow, s }) => { pivot.rotation.set(1.54,s*.04,s*.17); elbow.rotation.set(.28,0,0); });
        legs.forEach(leg => { const p = pedal + (leg.s < 0 ? Math.PI : 0); leg.hip.rotation.z=leg.s*.046; solveLeg(leg, .385 + Math.cos(p) * .132 - 1.078 + .083, .1 + Math.sin(p) * .132 - .257, -.09 + .19 * Math.sin(p)); });
        return;
      }
      const targetGait = smooth(.13,1.2,speed); gait = damp(gait,targetGait,11,dt);
      if (gait > .006) phase += dt * (1.24 + speed * .24);
      const wave = phase * 2 * Math.PI, fast = smooth(2.5,5.3,speed);
      const travel = lerp(.63, .89, fast) * gait;
      const y = .951 + Math.cos(wave * 2) * (.017 + fast * .011) * gait - fast * .024;
      pelvis.position.set(Math.sin(wave) * .015 * gait + .025 * (1-gait), y - .005*(1-gait), 0);
      spine.position.z = 0;
      spine.rotation.set(-.055 - fast * .126 + Math.sin(time * 1.9) * .011, Math.sin(wave) * .135 * gait, Math.cos(wave) * .028 * gait + .033 * (1-gait));
      pack.rotation.x = Math.cos(wave*2+.94) * .042 * gait;
      head.rotation.set(.035 + fast*.10 - Math.sin(time*1.9)*.008,-spine.rotation.y*.7+.073*Math.sin(time*.81)*(1-gait),-spine.rotation.z*.57);
      legs.forEach((leg, i) => {
        const p = (phase + i * .5) % 1, stride = lerp(.62,.54,fast);
        const swing = p < stride ? 0 : (p - stride) / (1 - stride);
        const z = p < stride ? lerp(-travel*.49,travel*.51,p/stride) : lerp(travel*.51,-travel*.49,smooth(0,1,swing));
        const lift = (Math.sin(swing * Math.PI) ** 1.2) * (.108 + fast * .14) * gait;
        leg.hip.rotation.z = leg.s * (.091 - gait * .067);
        solveLeg(leg,.131 + lift - y,z + (i === 0 ? -.111 : .095) * (1-gait),gait * (p < stride ? -.08*Math.sin(Math.PI*p/stride) : .21*Math.sin(swing*Math.PI*2)));
      });
      arms.forEach(({ pivot, elbow, s }, i) => {
        const walking = Math.cos(wave + i * Math.PI + .09);
        pivot.rotation.set(-.059-walking*(.34+fast*.25)*gait + s*.070*(1-gait), s*.027, s*(.121+Math.cos(wave+.12)*.035*gait));
        elbow.rotation.set(.15 + (walking*.14+.185+fast*.52)*gait,0,-s*.043);
      });
    },
  };
}
