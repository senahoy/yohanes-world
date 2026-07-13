import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { C, toon, noOutline, makeTextTexture } from './materials.js';
import { createCreatures } from './creatures.js';
import { motionReduced } from '../systems/motion.js';

// A limited, hand-crafted floating island — Harvest Moon valley layout with
// chunky Roblox-style terraces and stepped cliffs. Six districts:
//   plaza (south)      — flat QA campus: spawn pad, lab, satellite dish
//   farm  (south-west) — fenced crop rows, barn, windmill, scarecrow, chickens
//   city  (east)       — paved plateau: main street, buildings, kanban, CI desk
//   hills (west)       — terraced forest, crystals
//   pond  (north-west) — toon water, fishing dock, piano on the shore
//   dark  (north-east) — the server graveyard: PROD racks in the gloom

export const ISLAND_A = 52;   // island half-extent
const EDGE_N = 3;             // superellipse exponent (rounded square)
const WALK_INSET = 2.2;
const FLIMIT = Math.pow((ISLAND_A - WALK_INSET) / ISLAND_A, EDGE_N);
export const WATER_Y = -0.58;

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// island footprint: 1 on the boundary, <1 inside (uniform in scale, so the
// walkable clamp can solve for the exact scale factor)
function footprint(x, z) {
  return Math.pow(Math.abs(x) / ISLAND_A, EDGE_N) + Math.pow(Math.abs(z) / ISLAND_A, EDGE_N);
}

// keep a point on the walkable part of the island (the cliff lip stays out)
export function clampToIsland(p) {
  const f = footprint(p.x, p.z);
  if (f > FLIMIT) {
    const s = Math.cbrt(FLIMIT / f);
    p.x *= s;
    p.z *= s;
  }
  return p;
}

// districts: center + radius + feather (flat core = r - f, skirt = f wide)
const D = {
  plaza: { x: 0, z: 32, r: 12, f: 5 },
  farm: { x: -20, z: 33, r: 10, f: 4 },
  city: { x: 32, z: -6, r: 15, f: 5 },
  hills: { x: -33, z: -6, r: 19, f: 9 },
  pond: { x: -16, z: -32, r: 11, f: 5 },
  dark: { x: 26, z: -34, r: 13, f: 6 },
};
const WATER_R = 8.6;

function mask(x, z, d) {
  const dist = Math.hypot(x - d.x, z - d.z);
  return smooth((d.r - dist) / d.f);
}

// soft height steps — the Harvest Moon ledge / blocky Roblox look
function terrace(h, step) {
  const f = h / step;
  const i = Math.floor(f);
  return (i + smooth((f - i - 0.4) / 0.25)) * step;
}

// ——— path network: one dirt loop links every district gate, plus short
// spurs into the districts themselves. Painted into the terrain colors and
// flattened into the heightfield — Harvest Moon trails, not asphalt. ———
const LOOP = [
  [0, 23],       // plaza gate
  [15, 13],
  [23, 7.5],     // city gate (kept well clear of the building row)
  [16.5, -16],
  [24, -26],     // server graveyard gate
  [7, -30],
  [-8, -24],     // pond gate
  [-22, -16],
  [-30, -2],     // the pass through the hills
  [-26, 12],
  [-18, 21],     // farm gate
  [-8, 25],
];
const SPUR_PTS = [
  [[0, 23], [0, 27], [0, 30.6]],                  // → landing pad
  [[23, 7.5], [27, 5.9], [30.4, 3.8]],            // → main street
  [[24, -26], [25, -29.5], [25.8, -31.8]],        // → PROD rack
  [[-8, -24], [-12, -23.9], [-15.4, -23.6]],      // → fishing dock
  [[-18, 21], [-19.4, 25], [-20, 28.4]],          // → farm gate
];

const LOOP_CURVE = new THREE.CatmullRomCurve3(
  LOOP.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true, 'centripetal', 0.5
);
export const LOOP_LENGTH = LOOP_CURVE.getLength();

// position on the loop trail at arc-length fraction u (used by the jogger)
const loopTmp = new THREE.Vector3();
export function loopPointAt(u, out = new THREE.Vector3()) {
  LOOP_CURVE.getPointAt(((u % 1) + 1) % 1, loopTmp);
  return out.set(loopTmp.x, heightAt(loopTmp.x, loopTmp.z), loopTmp.z);
}

const MAP_PATHS = [];
const PATH_SAMPLES = (() => {
  const pts = [];
  const loopPts = LOOP_CURVE.getSpacedPoints(320).map((p) => [p.x, p.z]);
  MAP_PATHS.push(loopPts);
  for (const p of loopPts) pts.push(p[0], p[1]);
  for (const spur of SPUR_PTS) {
    const curve = new THREE.CatmullRomCurve3(
      spur.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false, 'centripetal', 0.5
    );
    const spurPts = curve.getSpacedPoints(20).map((p) => [p.x, p.z]);
    MAP_PATHS.push(spurPts);
    for (const p of spurPts) pts.push(p[0], p[1]);
  }
  return new Float32Array(pts);
})();

const PATH_HALF = 1.35;
const PATH_EDGE = 2.7;

// 1 on a path, 0 off it — drives terrain color, height, and prop scatter.
// Coarse scan first, then a fine window around the best hit.
export function pathMask(x, z) {
  const n = PATH_SAMPLES.length / 2;
  let best = Infinity;
  let bestI = 0;
  for (let i = 0; i < n; i += 5) {
    const dx = x - PATH_SAMPLES[i * 2];
    const dz = z - PATH_SAMPLES[i * 2 + 1];
    const d2 = dx * dx + dz * dz;
    if (d2 < best) { best = d2; bestI = i; }
  }
  for (let i = Math.max(0, bestI - 6); i < Math.min(n, bestI + 7); i++) {
    const dx = x - PATH_SAMPLES[i * 2];
    const dz = z - PATH_SAMPLES[i * 2 + 1];
    const d2 = dx * dx + dz * dz;
    if (d2 < best) best = d2;
  }
  const d = Math.sqrt(best);
  if (d <= PATH_HALF) return 1;
  return smooth(1 - (d - PATH_HALF) / (PATH_EDGE - PATH_HALF));
}

// full terrain sample — height + every mask (the mesh builder colors from
// the same numbers the gameplay height uses)
function sampleTerrain(x, z) {
  const mHills = mask(x, z, D.hills);
  const mCity = mask(x, z, D.city);
  const mPlaza = mask(x, z, D.plaza);
  const mFarm = mask(x, z, D.farm);
  const mPond = mask(x, z, D.pond);
  const mDark = mask(x, z, D.dark);

  // gentle meadow undulation
  let h = 0.32 * Math.sin(x * 0.22 + 1.3) * Math.cos(z * 0.19)
    + 0.2 * Math.sin((x + z) * 0.11);
  // hills: raised and bumpy
  h += mHills * (1.7 + 1.1 * Math.sin(x * 0.42 + 2) * Math.cos(z * 0.38) + 0.5 * Math.sin(z * 0.7));
  // dark corner: low rocky shelf
  h = lerp(h, 0.45 + 0.25 * Math.sin(x * 1.1) * Math.sin(z * 0.9), mDark);
  // step everything into ledges
  h = terrace(h, 0.8);
  // pond bowl first (the dock spur keeps its level across the shore)
  h = lerp(h, -1.7, mPond);
  // paths carve flat…
  const rm = pathMask(x, z);
  h = lerp(h, 0.06, rm);
  // …then district floors lift their spur pavement with the ground, so
  // trails ramp UP onto the plateaus instead of trenching through them
  h = lerp(h, 0.9, mCity);   // raised paved plateau
  h = lerp(h, 0.12, mPlaza); // flat campus
  h = lerp(h, 0.1, mFarm);   // flat field
  // island edge: chunky stepped cliffs down into space
  const f = footprint(x, z);
  const edge = smooth((f - 0.86) / 0.55);
  h -= terrace(edge * 16, 4);
  if (f > 1.35) h -= (f - 1.35) * 30; // far skirt plunges under the base rock

  return { h, mHills, mCity, mPlaza, mFarm, mPond, mDark, rm, f };
}

export function heightAt(x, z) {
  return sampleTerrain(x, z).h;
}

export function groundPoint(x, z, out = new THREE.Vector3()) {
  return out.set(x, heightAt(x, z), z);
}

// walkable wooden surfaces above the terrain (the fishing dock)
export const PLATFORMS = [
  { x0: -17.1, x1: -14.9, z0: -27.7, z1: -23.3, y: -0.1 },
];

const FARM_RECT = { x0: -26, x1: -14, z0: 29, z1: 37.5 };

// static world geometry for the minimap
export function getMapData() {
  return {
    A: ISLAND_A,
    n: EDGE_N,
    districts: D,
    water: { x: D.pond.x, z: D.pond.z, r: WATER_R },
    farm: FARM_RECT,
    paths: MAP_PATHS,
  };
}

function faceted(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.computeVertexNormals();
  if (g !== geometry) geometry.dispose();
  return g;
}

export function createIsland(assets = null) {
  const group = new THREE.Group();
  // { pos, r } blocks at any height; `water` marks pond barriers (the dock
  // overrides them); `h` marks low obstacles the player can jump over
  const colliders = [];

  const place = (obj, x, z, rotY = 0, collideR = 0, collideH = 0) => {
    obj.position.set(x, heightAt(x, z), z);
    if (rotY) obj.rotation.y = rotY;
    group.add(obj);
    if (collideR) colliders.push({ pos: obj.position.clone(), r: collideR, ...(collideH ? { h: collideH } : {}) });
    return obj;
  };
  // place a prop so its front (+z) faces a ground target, standing upright
  const placeFacing = (obj, x, z, tx, tz, collideR = 0) => {
    obj.position.set(x, heightAt(x, z), z);
    obj.lookAt(tx, obj.position.y, tz);
    group.add(obj);
    if (collideR) colliders.push({ pos: obj.position.clone(), r: collideR });
    return obj;
  };

  // ——— terrain heightfield with vertex-colored zones + painted paths ———
  const EXTENT = 66; // mesh reaches past the boundary so the cliffs read
  const SEG = 256;
  const geo = new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  const roadCol = new THREE.Color();
  const cGrass = new THREE.Color(C.grass);
  const cGrassAlt = new THREE.Color(C.grass).multiplyScalar(0.92);
  const cHill = new THREE.Color(C.grassDark);
  const cPaved = new THREE.Color('#9ea3bd');
  const cPlaza = new THREE.Color('#7fcf8e');
  const cFarm = new THREE.Color('#8ecf72');
  const cDark = new THREE.Color('#3c3450');
  const cPath = new THREE.Color(C.sand);
  const cPathDark = new THREE.Color('#6e6383');
  const cShore = new THREE.Color(C.sand).lerp(new THREE.Color('#d8c290'), 0.5);
  const cBed = new THREE.Color('#41648f'); // underwater pond bed
  const cDirt = new THREE.Color(C.dirt);
  const cCliff = new THREE.Color(C.cliff);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const s = sampleTerrain(x, z);
    pos.setY(i, s.h);

    // Harvest Moon tile checker on the meadow
    const checker = (Math.floor(x / 2) + Math.floor(z / 2)) & 1;
    col.copy(checker ? cGrassAlt : cGrass);
    col.lerp(cHill, s.mHills * 0.5);
    col.lerp(cPlaza, s.mPlaza * 0.5);
    col.lerp(cFarm, s.mFarm * 0.45);
    col.lerp(cPaved, s.mCity * 0.95);
    col.lerp(cDark, s.mDark * 0.9);
    if (s.mPond > 0.02) {
      col.lerp(cShore, smooth((s.mPond - 0.15) / 0.25) * 0.85);
      if (s.h < WATER_Y + 0.15) col.lerp(cBed, 0.8);
    }
    if (s.rm > 0.01) {
      roadCol.copy(cPath).lerp(cPathDark, s.mDark);
      col.lerp(roadCol, Math.pow(s.rm, 0.7) * 0.9);
    }
    // cliffs: grass lip → dirt → deep rock
    if (s.h < -0.4 && s.mPond < 0.05) {
      col.lerp(cDirt, smooth((-s.h - 0.4) / 2.5) * 0.9);
      col.lerp(cCliff, smooth((-s.h - 4) / 6));
    }
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, noOutline(toon('#ffffff', { vertexColors: true })));
  group.add(terrain);

  // the floating island's rocky underside
  const under = new THREE.Mesh(
    faceted(new THREE.CylinderGeometry(58, 6, 26, 9, 3)),
    noOutline(toon(C.cliff))
  );
  under.position.y = -27;
  group.add(under);

  // ——— shared materials ———
  const trunkMat = toon(C.trunk);
  const treeMat = toon(C.tree);
  const treeDarkMat = toon(C.treeDark);
  const rockMat = toon(C.rock);
  const rockLightMat = toon(C.rockLight);
  const metalMat = toon(C.metal);
  const suitMat = toon(C.suit);
  const paperMat = toon(C.paper);
  const inkMat = toon(C.ink);
  const soilMat = toon(C.soil);

  function makeTree(scale = 1) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.4, 7), trunkMat);
    trunk.position.y = 0.7;
    tree.add(trunk);
    const blobs = [[0, 1.9, 0, 0.85], [0.45, 1.55, 0.15, 0.55], [-0.4, 1.6, -0.1, 0.5], [0, 2.5, 0, 0.55]];
    blobs.forEach(([x, y, z, r], i) => {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), i % 2 ? treeDarkMat : treeMat);
      blob.position.set(x, y, z);
      tree.add(blob);
    });
    tree.scale.setScalar(scale);
    return tree;
  }

  function makeRock(scale = 1, mat = null) {
    const rock = new THREE.Mesh(
      faceted(new THREE.DodecahedronGeometry(0.55 * scale, 0)),
      mat || (Math.random() > 0.5 ? rockMat : rockLightMat)
    );
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.position.y = 0.28 * scale;
    const holder = new THREE.Group();
    holder.add(rock);
    return holder;
  }

  // ——— picket fences (Harvest Moon staple) ———
  // Every post and rail is baked into ONE merged mesh (they all share the
  // trunk material) — a fence costs one draw call, not two hundred. The
  // posts are low obstacles: colliders carry `h` so the player can hop them.
  const fenceGeos = [];
  function addFence(x0, z0, x1, z1, gate = null) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const n = Math.max(1, Math.round(len / 1.7));
    const rotY = Math.atan2(dz, dx);
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * len;
      const inGate = gate && t > gate[0] && t < gate[1];
      const x = x0 + ux * t;
      const z = z0 + uz * t;
      const y = heightAt(x, z);
      if (!inGate) {
        const post = new THREE.BoxGeometry(0.14, 0.9, 0.14);
        post.translate(x, y + 0.45, z);
        fenceGeos.push(post);
        colliders.push({ pos: new THREE.Vector3(x, y, z), r: 0.55, h: 1.0 });
      }
      if (prev && !inGate && !prev.inGate) {
        const railLen = Math.hypot(x - prev.x, z - prev.z) + 0.1;
        for (const ry of [0.32, 0.66]) {
          const rail = new THREE.BoxGeometry(railLen, 0.08, 0.05);
          rail.rotateY(-rotY);
          rail.translate((x + prev.x) / 2, (y + prev.y) / 2 + ry, (z + prev.z) / 2);
          fenceGeos.push(rail);
        }
      }
      prev = { x, y, z, inGate };
    }
  }

  // ——— global scatter: trees, rocks, tufts, flowers (skip districts/paths) ———
  const tuftMat = toon(C.grassDark);
  const petals = [C.accent, C.bugGlitch, C.paper, C.brandBright];
  const inFarm = (x, z, pad = 0) =>
    x > FARM_RECT.x0 - pad && x < FARM_RECT.x1 + pad && z > FARM_RECT.z0 - pad && z < FARM_RECT.z1 + pad;
  const distTo = (x, z, d) => Math.hypot(x - d.x, z - d.z);
  const scatterPts = [];
  const flowerPts = [];
  for (let i = 0; i < 600 && scatterPts.length < 150; i++) {
    const x = (Math.random() * 2 - 1) * (ISLAND_A - 3);
    const z = (Math.random() * 2 - 1) * (ISLAND_A - 3);
    if (footprint(x, z) > 0.76) continue;
    if (distTo(x, z, D.city) < 15 || distTo(x, z, D.dark) < 15) continue;
    if (distTo(x, z, D.plaza) < 13 || distTo(x, z, D.pond) < 12) continue;
    if (inFarm(x, z, 1.5)) continue;
    if (pathMask(x, z) > 0.04) continue;
    scatterPts.push([x, z]);
  }
  scatterPts.forEach(([x, z], i) => {
    if (i % 5 === 0) {
      place(makeTree(1.2 + Math.random() * 0.5), x, z, Math.random() * 6, 0.6);
    } else if (i % 5 === 1) {
      place(makeRock(0.7 + Math.random() * 0.7), x, z, 0, 0.6, 1.0); // hoppable
    } else if (i % 5 === 2) {
      const flower = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), tuftMat);
      stem.position.y = 0.15;
      flower.add(stem);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), toon(petals[i % petals.length]));
      head.position.y = 0.34;
      flower.add(head);
      place(flower, x, z);
      flowerPts.push(flower.position.clone());
    } else {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 4), tuftMat);
      tuft.position.y = 0.15;
      const holder = new THREE.Group();
      holder.add(tuft);
      place(holder, x, z);
    }
  });

  // hills get denser forest + crystals
  const crystals = [];
  const hillTrees = [[-8, 5], [7, -6], [1, 10], [-10, -5], [9, 8], [-5, -11], [4, 15], [-14, 4], [12, 2], [-6, 14]];
  for (const [dx, dz] of hillTrees) {
    const x = D.hills.x + dx;
    const z = D.hills.z + dz;
    if (pathMask(x, z) > 0.3 || footprint(x, z) > 0.8) continue;
    place(makeTree(1.4 + Math.random() * 0.45), x, z, Math.random() * 6, 0.65);
  }
  const crystalSpots = [[5, 5], [-7, -8], [10, -3], [-3, -14]];
  for (const [dx, dz] of crystalSpots) {
    const cluster = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const mat = toon(C.crystal, { emissive: C.crystal, emissiveIntensity: 0.25 });
      const cr = new THREE.Mesh(
        faceted(new THREE.ConeGeometry(0.24 + Math.random() * 0.12, 0.9 + Math.random() * 0.7, 5)),
        mat
      );
      cr.position.set((i - 1) * 0.34, 0.45 + i * 0.08, (Math.random() - 0.5) * 0.3);
      cr.rotation.z = (Math.random() - 0.5) * 0.5;
      cluster.add(cr);
      crystals.push(cr);
    }
    place(cluster, D.hills.x + dx, D.hills.z + dz, 0, 0.8);
  }

  // landmark rock mesas stand as off-path landmarks
  if (assets) {
    placeFacing(assets.prop('terrainTall', 7.5, 'y'), -42, -10, D.hills.x, D.hills.z, 3.0);
    place(assets.prop('terrainLow', 3.6, 'y'), -36, 9, 1.2, 2.4);
    place(assets.prop('terrainSlope', 3.2, 'y'), -26, -26, 0.6, 2.2);
    placeFacing(assets.prop('terrainMining', 5.0, 'y'), 31, -40, D.dark.x, D.dark.z, 2.6);
  }

  // ——— PLAZA: spawn pad, QA lab, satellite dish ———
  const plazaC = D.plaza;
  if (assets) {
    place(assets.prop('landingpad', 4.6), 0, 31.5);
    const lab = placeFacing(assets.prop('basemodule', 3.6, 'y'), -8, 29, plazaC.x, plazaC.z, 3.6);
    lab.position.y -= 0.15; // settle onto the ground
    placeFacing(assets.prop('solarpanel', 2.8), -6, 34.6, plazaC.x, plazaC.z, 1.2);
    placeFacing(assets.prop('solarpanel', 2.8), -8.8, 33.2, plazaC.x, plazaC.z, 1.2);
    const tower = placeFacing(assets.prop('structureTall', 6.2, 'y'), -4, 27.5, plazaC.x, plazaC.z, 1.8);
    tower.position.y -= 0.2;
  } else {
    const pad = new THREE.Group();
    const padBase = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.16, 20), rockLightMat);
    padBase.position.y = 0.08;
    pad.add(padBase);
    const padRing = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.08, 8, 24), toon(C.accent));
    padRing.rotation.x = Math.PI / 2;
    padRing.position.y = 0.18;
    pad.add(padRing);
    place(pad, 0, 31.5);

    const lab = new THREE.Group();
    const labBase = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 1.3, 18), suitMat);
    labBase.position.y = 0.65;
    lab.add(labBase);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(C.brandBright));
    dome.position.y = 1.3;
    lab.add(dome);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.15, 0.12), toon(C.visor));
    door.position.set(0.4, 0.58, 2.36);
    lab.add(door);
    placeFacing(lab, -8, 29, plazaC.x, plazaC.z, 3.0);
  }

  // satellite dish (contact transmitter)
  const dishGroup = new THREE.Group();
  const dishBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.5, 10), metalMat);
  dishBase.position.y = 0.25;
  dishGroup.add(dishBase);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8), metalMat);
  pole.position.y = 1.1;
  dishGroup.add(pole);
  const bowlMat = suitMat.clone();
  bowlMat.side = THREE.DoubleSide;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 0.25, 0.8, 20, 1, true), bowlMat);
  bowl.position.y = 2.3;
  bowl.rotation.z = -0.7;
  dishGroup.add(bowl);
  const feed = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), toon(C.accent, { emissive: C.accent, emissiveIntensity: 0.6 }));
  feed.position.set(0.75, 2.85, 0);
  dishGroup.add(feed);
  const dishObj = place(dishGroup, 8.5, 27.5, -0.6, 1.5);

  // mailbox by the spawn (every farm has one)
  const mailbox = new THREE.Group();
  const mbPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), trunkMat);
  mbPost.position.y = 0.5;
  mailbox.add(mbPost);
  const mbBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.55), toon(C.barn));
  mbBox.position.y = 1.1;
  mailbox.add(mbBox);
  const mbFlag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.08), toon(C.accent, { emissive: C.accent, emissiveIntensity: 0.3 }));
  mbFlag.position.set(0.24, 1.28, 0.12);
  mailbox.add(mbFlag);
  const mailboxObj = placeFacing(mailbox, 2.6, 35.8, 0, 31.5, 0.4);

  // cliff-lookout rail behind the spawn
  addFence(-5, 41.5, 5, 41.5);

  // ——— FARM: fenced crop rows, barn, windmill, scarecrow ———
  const { x0: FX0, x1: FX1, z0: FZ0, z1: FZ1 } = FARM_RECT;
  addFence(FX0, FZ0, FX1, FZ0, [4.8, 7.2]); // north run, gate in the middle
  addFence(FX1, FZ0, FX1, FZ1);
  addFence(FX1, FZ1, FX0, FZ1);
  addFence(FX0, FZ1, FX0, FZ0);
  group.add(new THREE.Mesh(mergeGeometries(fenceGeos), trunkMat));
  fenceGeos.length = 0;

  // tilled soil: bed + every mound merged into one mesh
  const soilGeos = [];
  const bedY = heightAt(-20, 33.75) + 0.05;
  const bed = new THREE.BoxGeometry(11.4, 0.1, 6.4);
  bed.translate(-20, bedY + 0.05, 33.75);
  soilGeos.push(bed);

  // crop rows: sprouts, leafy rows, and ripe amber gourds (harvestable)
  const sproutMat = toon(C.tree);
  const leafMat = toon(C.treeDark);
  const gourdMat = toon(C.accent, { emissive: C.accent, emissiveIntensity: 0.15 });
  const gourds = [];
  const cropRows = [31.5, 33, 34.5, 36];
  cropRows.forEach((rz, row) => {
    for (let i = 0; i < 7; i++) {
      const cx = -24.5 + i * 1.5;
      const crop = new THREE.Group();
      const mound = new THREE.BoxGeometry(1.0, 0.24, 0.9);
      mound.translate(cx, heightAt(cx, rz) + 0.12, rz);
      soilGeos.push(mound);
      if (row === 0 || row === 2) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5), sproutMat);
        stem.position.y = 0.35;
        crop.add(stem);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 5), sproutMat);
        leaf.position.y = 0.55;
        crop.add(leaf);
      } else if (row === 1) {
        for (const s of [-0.16, 0.14]) {
          const bush = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), leafMat);
          bush.position.set(s, 0.32, s * 0.5);
          crop.add(bush);
        }
      } else {
        const fruit = new THREE.Group();
        const gourd = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), gourdMat);
        gourd.position.y = 0.3;
        gourd.scale.y = 0.85;
        fruit.add(gourd);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 5), leafMat);
        stem.position.y = 0.46;
        fruit.add(stem);
        crop.add(fruit);
        const placed = place(crop, cx, rz);
        gourds.push({ fruit, pos: placed.position.clone() });
        continue;
      }
      place(crop, cx, rz);
    }
  });
  group.add(new THREE.Mesh(mergeGeometries(soilGeos), soilMat));

  // scarecrow watching the regression beds
  const scarecrow = new THREE.Group();
  const scPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 7), trunkMat);
  scPole.position.y = 0.9;
  scarecrow.add(scPole);
  const scArms = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 7), trunkMat);
  scArms.rotation.z = Math.PI / 2;
  scArms.position.y = 1.45;
  scarecrow.add(scArms);
  const scHead = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), toon(C.wheat));
  scHead.position.y = 1.95;
  scarecrow.add(scHead);
  const scHat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 8), trunkMat);
  scHat.position.y = 2.2;
  scarecrow.add(scHat);
  const scScarf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), toon(C.accentHot));
  scScarf.position.y = 1.72;
  scarecrow.add(scScarf);
  placeFacing(scarecrow, -18, 32.2, -20, 28, 0.5);

  // windmill west of the field
  const windmill = new THREE.Group();
  const wmTower = new THREE.Mesh(faceted(new THREE.CylinderGeometry(0.9, 1.5, 5.4, 8)), suitMat);
  wmTower.position.y = 2.7;
  windmill.add(wmTower);
  const wmRoof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.2, 8), toon(C.barn));
  wmRoof.position.y = 6.0;
  windmill.add(wmRoof);
  const wmDoor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.1), trunkMat);
  wmDoor.position.set(0, 0.55, 1.42);
  windmill.add(wmDoor);
  const wmHub = new THREE.Group();
  wmHub.position.set(0, 5.1, 1.15);
  const hubBall = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), trunkMat);
  wmHub.add(hubBall);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.6, 0.05), paperMat);
    blade.position.y = 1.55;
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(blade);
    wmHub.add(arm);
  }
  windmill.add(wmHub);
  placeFacing(windmill, -28.6, 31, -20, 33, 1.6);

  // little barn by the farm gate
  const barn = new THREE.Group();
  const barnBody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 2.9), toon(C.barn));
  barnBody.position.y = 1.1;
  barn.add(barnBody);
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.14, 3.2), trunkMat);
    slab.position.set(side * 0.83, 2.75, 0);
    slab.rotation.z = -side * 0.72;
    barn.add(slab);
  }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 3.24), trunkMat);
  ridge.position.y = 3.42;
  barn.add(ridge);
  const barnDoor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.1), paperMat);
  barnDoor.position.set(0, 0.75, 1.5);
  barn.add(barnDoor);
  for (const d of [-1, 1]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.04), trunkMat);
    brace.position.set(0, 0.75, 1.56);
    brace.rotation.z = d * 0.68;
    barn.add(brace);
  }
  const loft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 10), paperMat);
  loft.rotation.x = Math.PI / 2;
  loft.position.set(0, 1.95, 1.48);
  barn.add(loft);
  placeFacing(barn, -11, 29.2, -8, 25, 2.3);

  // ——— CITY: the paved main street district ———
  if (assets) {
    // main street: flat-laid road tiles, a crossing at the gate end.
    // Everything stays inside the plateau's flat core so the tarmac never
    // steps or floats on the rim slope.
    const streetZ = [1.8, -1.6, -5, -8.4, -11.8];
    streetZ.forEach((z, i) => {
      const tile = assets.prop(i === 0 ? 'roadCrossing' : 'roadStraight', 3.4);
      place(tile, 32, z); // the tile's road axis already runs along z
      tile.position.y += 0.03;
    });
    // buildings flank the street, doors facing the tarmac.
    // Heights anchored to the 1.6u character: one story ≈ 1.7× them.
    const west = [['buildingA', 6.5, 0.4], ['buildingC', 5.5, -5.5], ['buildingE', 5.0, -11]];
    const east = [['buildingB', 8.0, -1.5], ['buildingD', 7.0, -7], ['buildingF', 6.0, -12.2]];
    for (const [name, size, z] of west) {
      const b = placeFacing(assets.prop(name, size, 'y'), 26.0, z, 32, z, 2.2);
      b.position.y -= 0.35;
    }
    for (const [name, size, z] of east) {
      const b = placeFacing(assets.prop(name, size, 'y'), 38.4, z, 32, z, 2.2);
      b.position.y -= 0.35;
    }
    for (const [x, z] of [[30, 0.8], [34, -2.6], [30, -6], [34, -9.4]]) {
      placeFacing(assets.prop('streetlight', 4.0, 'y'), x, z, 32, z, 0.3);
    }
    placeFacing(assets.prop('bench', 1.6), 30.7, -10.6, 32, -10.6, 0.6);
    placeFacing(assets.prop('trash', 0.9, 'y'), 30.7, -11.7, 32, -11.7, 0.4);
    placeFacing(assets.prop('hydrant', 0.75, 'y'), 33.9, -0.2, 32, -0.2, 0.35);
  } else {
    function makeBuilding(w, h, d, bodyColor) {
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(bodyColor));
      body.position.y = h / 2;
      b.add(body);
      const winMat = toon(C.accent, { emissive: C.accent, emissiveIntensity: 0.4 });
      for (let yy = 1; yy < h - 0.6; yy += 1.1) {
        for (let xx = -w / 2 + 0.7; xx < w / 2 - 0.4; xx += 1.0) {
          if (Math.random() < 0.35) continue;
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.06), winMat);
          win.position.set(xx, yy, d / 2 + 0.02);
          b.add(win);
        }
      }
      const doorB = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.08), inkMat);
      doorB.position.set(0, 0.5, d / 2 + 0.03);
      b.add(doorB);
      return b;
    }
    // same main street as the asset build, in flat-color slabs
    const slabMat = toon('#4a4e5c');
    const dashMat = toon(C.paper);
    for (const z of [1.8, -1.6, -5, -8.4, -11.8]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 3.4), slabMat);
      place(slab, 32, z);
      slab.position.y += 0.03;
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 1.2), dashMat);
      dash.position.set(32, slab.position.y + 0.04, z);
      group.add(dash);
    }
    placeFacing(makeBuilding(3.4, 5.2, 2.6, '#c9cde0'), 26.0, 0.4, 32, 0.4, 2.4);
    placeFacing(makeBuilding(2.8, 6.4, 2.4, '#b9bed6'), 38.4, -1.5, 32, -1.5, 2.2);
    placeFacing(makeBuilding(3.0, 4.6, 2.2, '#d4d8e8'), 26.0, -11, 32, -11, 2.2);
    for (const [x, z] of [[30, 0.8], [34, -2.6], [30, -6]]) {
      const lamp = new THREE.Group();
      const lpole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 6), metalMat);
      lpole.position.y = 1.1;
      lamp.add(lpole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), toon(C.paper, { emissive: C.paper, emissiveIntensity: 0.7 }));
      bulb.position.y = 2.3;
      lamp.add(bulb);
      place(lamp, x, z, 0, 0.3);
    }
  }

  // kanban board with sticky notes (PM quest: file your bug reports)
  const kanban = new THREE.Group();
  const kbLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 6), metalMat);
  kbLegL.position.set(-0.72, 0.42, 0);
  kanban.add(kbLegL);
  const kbLegR = kbLegL.clone();
  kbLegR.position.x = 0.72;
  kanban.add(kbLegR);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.95, 0.08), paperMat);
  board.position.y = 1.15;
  kanban.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.06), inkMat);
  frame.position.set(0, 1.15, -0.02);
  kanban.add(frame);
  for (const x of [-0.29, 0.29]) {
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.85, 0.03), inkMat);
    div.position.set(x, 1.15, 0.05);
    kanban.add(div);
  }
  const todoStickies = [];
  const doneStickies = [];
  const stickyTodoMat = toon(C.bugGlitch, { emissive: C.bugGlitch, emissiveIntensity: 0.15 });
  const stickyDoneMat = toon(C.screenGreen, { emissive: C.screenGreen, emissiveIntensity: 0.15 });
  for (let i = 0; i < 6; i++) {
    const todo = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.025), stickyTodoMat);
    todo.position.set(-0.58 + (i % 2) * 0.19, 1.4 - Math.floor(i / 2) * 0.21, 0.06);
    todo.rotation.z = (Math.random() - 0.5) * 0.3;
    kanban.add(todo);
    todoStickies.push(todo);
    const done = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.025), stickyDoneMat);
    done.position.set(0.39 + (i % 2) * 0.19, 1.4 - Math.floor(i / 2) * 0.21, 0.06);
    done.rotation.z = (Math.random() - 0.5) * 0.3;
    done.visible = false;
    kanban.add(done);
    doneStickies.push(done);
  }
  const kanbanObj = placeFacing(kanban, 29.4, -2.8, 31.6, -3.4, 1.2);

  // CI desk: desk + monitor that goes green when the suite is automated
  const ciDesk = new THREE.Group();
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.9), trunkMat);
  deskTop.position.y = 0.85;
  ciDesk.add(deskTop);
  for (const [lx, lz] of [[-0.8, 0.35], [0.8, 0.35], [-0.8, -0.35], [0.8, -0.35]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 6), metalMat);
    leg.position.set(lx, 0.42, lz);
    ciDesk.add(leg);
  }
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.08), metalMat);
  monitor.position.set(0, 1.45, -0.15);
  monitor.rotation.x = -0.08;
  ciDesk.add(monitor);
  const ciScreenMat = toon(C.visor, { emissive: C.visor, emissiveIntensity: 0.4 });
  const ciScreen = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.58, 0.04), ciScreenMat);
  ciScreen.position.set(0, 1.45, -0.1);
  ciScreen.rotation.x = -0.08;
  ciDesk.add(ciScreen);
  const ciDeskObj = placeFacing(ciDesk, 34.8, 0.4, 33, -0.6, 1.2);

  // designer's easel
  const easel = new THREE.Group();
  for (const side of [-1, 1]) {
    const legE = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), trunkMat);
    legE.position.set(side * 0.4, 0.9, 0);
    legE.rotation.z = side * 0.22;
    easel.add(legE);
  }
  const canvasBoard = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.06), paperMat);
  canvasBoard.position.set(0, 1.35, 0.05);
  canvasBoard.rotation.x = -0.1;
  easel.add(canvasBoard);
  const swatches = [C.accent, C.bugGlitch, C.brand, C.screenGreen];
  swatches.forEach((sw, i) => {
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.03), toon(sw));
    chip.position.set(-0.35 + i * 0.24, 1.45 - (i % 2) * 0.24, 0.1);
    chip.rotation.x = -0.1;
    easel.add(chip);
  });
  const easelObj = placeFacing(easel, 29.4, -8.8, 31.4, -8.2, 0.6);

  // coffee machine (essential QA infrastructure)
  const coffee = new THREE.Group();
  const coffeeBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.45), toon(C.accentHot));
  coffeeBody.position.y = 0.45;
  coffee.add(coffeeBody);
  const coffeeBtn = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), toon(C.paper, { emissive: C.paper, emissiveIntensity: 0.4 }));
  coffeeBtn.position.set(0, 0.7, 0.25);
  coffee.add(coffeeBtn);
  const coffeeObj = placeFacing(coffee, 35.1, -9.8, 33, -9.8, 0.5);

  // logs terminal (by the CI desk)
  const terminal = new THREE.Group();
  const termPole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.1, 8), metalMat);
  termPole.position.y = 0.55;
  terminal.add(termPole);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.1), metalMat);
  screen.position.y = 1.35;
  screen.rotation.x = -0.25;
  terminal.add(screen);
  const screenFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.56, 0.04),
    toon(C.screenGreen, { emissive: C.screenGreen, emissiveIntensity: 0.6 })
  );
  screenFace.position.set(0, 1.36, 0.06);
  screenFace.rotation.x = -0.25;
  terminal.add(screenFace);
  const terminalObj = placeFacing(terminal, 35.2, -4, 33.2, -4, 0.8);

  // ——— signposts at the path junctions ———
  const signTextures = new Map();
  function makeSignpost(text) {
    const sign = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 7), trunkMat);
    post.position.y = 1.1;
    sign.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.42, 0.07), trunkMat);
    board.position.y = 1.85;
    sign.add(board);
    if (!signTextures.has(text)) signTextures.set(text, makeTextTexture(text));
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(1.46, 0.38),
      noOutline(new THREE.MeshBasicMaterial({ map: signTextures.get(text), transparent: true }))
    );
    label.position.set(0, 1.85, 0.05);
    sign.add(label);
    return sign;
  }
  const SIGNS = [
    ['QA CAMPUS', 2.4, 21.5, 0, 30],
    ['THE FARM', -15.8, 21.8, -20, 33],
    ['CITY DISTRICT', 22.2, 9.2, 32, -6],
    ['⚠ SERVERS · KEEP OUT', 21.2, -24.2, 26, -34],
    ['PIANO POND ♪', -6.2, -21.6, -16, -32],
    ['THE HILLS', -20.4, -13.6, -33, -6],
  ];
  for (const [label, x, z, tx, tz] of SIGNS) {
    placeFacing(makeSignpost(label), x, z, tx, tz, 0.4);
  }

  // ——— POND: toon water, fishing dock, the piano ———
  const pondC = D.pond;
  const waterMat = noOutline(toon(C.water, {
    emissive: C.water,
    emissiveIntensity: 0.18,
    transparent: true,
    opacity: 0.92,
  }));
  const water = new THREE.Mesh(new THREE.CircleGeometry(WATER_R, 32), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(pondC.x, WATER_Y, pondC.z);
  group.add(water);
  // ripple rings loop outward
  const ripples = [];
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.08, 26),
      noOutline(new THREE.MeshBasicMaterial({ color: C.paper, transparent: true, opacity: 0.3, depthWrite: false }))
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pondC.x, WATER_Y + 0.02, pondC.z);
    group.add(ring);
    ripples.push(ring);
  }
  // the water itself is off-limits (the shoreline stops you ankle-deep) —
  // except under the dock, where the rails do the guarding
  colliders.push({ pos: new THREE.Vector3(pondC.x, WATER_Y, pondC.z), r: 3, water: true });
  for (let i = 0; i < 8; i++) {
    if (i === 2) continue; // the dock slot (north)
    const a = (i / 8) * Math.PI * 2;
    colliders.push({
      pos: new THREE.Vector3(pondC.x + Math.cos(a) * 4.8, WATER_Y, pondC.z + Math.sin(a) * 4.8),
      r: 3.4,
      water: true,
    });
  }
  // lily pads + shore reeds
  const lilyMat = toon(C.treeDark);
  for (const [lx, lz] of [[-3, -1.4], [2.2, -2.8], [0.6, 2.4], [-1.8, 3.4]]) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 10), lilyMat);
    pad.position.set(pondC.x + lx, WATER_Y + 0.05, pondC.z + lz);
    group.add(pad);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.3;
    const rx = pondC.x + Math.cos(a) * 9.4;
    const rz = pondC.z + Math.sin(a) * 9.4;
    if (pathMask(rx, rz) > 0.3) continue;
    const reed = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.7 + Math.random() * 0.4, 4), tuftMat);
    const holder = new THREE.Group();
    reed.position.y = 0.3;
    holder.add(reed);
    place(holder, rx, rz);
  }

  // the fishing dock: wooden planks running out over the water
  const dock = PLATFORMS[0];
  const dockCx = (dock.x0 + dock.x1) / 2;
  const plankMat = toon(C.trunk);
  const nPlanks = 9;
  for (let i = 0; i < nPlanks; i++) {
    const z = dock.z1 - 0.25 - i * ((dock.z1 - dock.z0 - 0.4) / (nPlanks - 1));
    const plank = new THREE.Mesh(new THREE.BoxGeometry(dock.x1 - dock.x0, 0.09, 0.42), plankMat);
    plank.position.set(dockCx, dock.y - 0.05, z);
    plank.rotation.y = (Math.random() - 0.5) * 0.02;
    group.add(plank);
  }
  for (const [px, pz] of [[dock.x0 + 0.15, dock.z0 + 0.3], [dock.x1 - 0.15, dock.z0 + 0.3], [dock.x0 + 0.15, dock.z1 - 1.6], [dock.x1 - 0.15, dock.z1 - 1.6]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.6, 7), plankMat);
    post.position.set(px, dock.y - 0.75, pz);
    group.add(post);
  }
  // side rails (visual + they keep you from stepping off into the water)
  for (const side of [dock.x0 - 0.12, dock.x1 + 0.12]) {
    for (let i = 0; i < 3; i++) {
      const z = dock.z0 + 0.4 + i * 1.4;
      const rp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.1), plankMat);
      rp.position.set(side, dock.y + 0.31, z);
      group.add(rp);
      colliders.push({ pos: new THREE.Vector3(side, dock.y, z), r: 0.5 });
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, dock.z1 - dock.z0 - 0.8), plankMat);
    bar.position.set(side, dock.y + 0.58, (dock.z0 + dock.z1) / 2 - 0.2);
    group.add(bar);
  }
  // the end of the dock is a fishing spot, not a diving board
  colliders.push({ pos: new THREE.Vector3(dockCx, dock.y, dock.z0 - 1.1), r: 0.9 });
  const fishingSpot = new THREE.Vector3(dockCx, dock.y, dock.z0 + 0.5);

  // bobber for the fishing minigame (quests drives it)
  const bobber = new THREE.Group();
  const bobTop = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), toon(C.accentHot, { emissive: C.accentHot, emissiveIntensity: 0.3 }));
  bobTop.position.y = 0.05;
  bobber.add(bobTop);
  const bobBase = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), paperMat);
  bobBase.position.y = -0.06;
  bobber.add(bobBase);
  bobber.position.set(dockCx, WATER_Y + 0.06, dock.z0 - 2.2);
  bobber.visible = false;
  group.add(bobber);

  // stone patio + piano at the west shore
  const patio = new THREE.Mesh(faceted(new THREE.CylinderGeometry(2.1, 2.3, 0.16, 9)), rockLightMat);
  place(patio, -23.2, -25.2);
  patio.position.y += 0.05;

  const piano = new THREE.Group();
  const pBody = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.9), inkMat);
  pBody.position.y = 1.0;
  piano.add(pBody);
  const pLid = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.06, 0.85), inkMat);
  pLid.position.set(0, 1.32, -0.12);
  pLid.rotation.x = 0.5;
  piano.add(pLid);
  const whiteKeys = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.34), paperMat);
  whiteKeys.position.set(0, 1.28, 0.32);
  piano.add(whiteKeys);
  for (let i = 0; i < 5; i++) {
    const bk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.16), inkMat);
    bk.position.set(-0.62 + i * 0.3 + (i > 1 ? 0.14 : 0), 1.34, 0.26);
    piano.add(bk);
  }
  for (const side of [-1, 1]) {
    const legP = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 1.0, 6), inkMat);
    legP.position.set(side * 0.8, 0.5, 0.25);
    piano.add(legP);
  }
  const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.55, 10), toon(C.accent));
  stool.position.set(0, 0.28, 1.15);
  piano.add(stool);
  const pianoObj = placeFacing(piano, -23.2, -25.4, pondC.x, pondC.z, 1.4);
  pianoObj.position.y = patio.position.y + 0.08; // stands on the patio

  // floating notes over the water (billboard sprites)
  const noteSprites = [];
  {
    const noteCanvas = document.createElement('canvas');
    noteCanvas.width = noteCanvas.height = 64;
    const nctx = noteCanvas.getContext('2d');
    nctx.font = '48px serif';
    nctx.textAlign = 'center';
    nctx.textBaseline = 'middle';
    nctx.fillStyle = C.paper;
    nctx.fillText('♪', 32, 34);
    const noteTex = new THREE.CanvasTexture(noteCanvas);
    for (const [dx, dz] of [[-3.2, 2], [3, -1.4], [1.8, 3.4], [-2.4, -3]]) {
      const sp = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({ map: noteTex, transparent: true, depthWrite: false, opacity: 0.9 })));
      sp.scale.set(0.5, 0.5, 1);
      const holder = new THREE.Group();
      holder.position.set(pondC.x + dx, WATER_Y, pondC.z + dz);
      sp.position.y = 1.4;
      holder.add(sp);
      group.add(holder);
      noteSprites.push(sp);
    }
  }

  // ——— DARK CORNER: the server graveyard ———
  const darkC = D.dark;
  const rack = new THREE.Group();
  const rackBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.7, 0.75), metalMat);
  rackBody.position.y = 0.85;
  rack.add(rackBody);
  const rackLights = [];
  for (let i = 0; i < 3; i++) {
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.09, 0.06),
      toon(C.screenGreen, { emissive: C.screenGreen, emissiveIntensity: 0.8 })
    );
    light.position.set(0, 1.3 - i * 0.28, 0.41);
    rack.add(light);
    rackLights.push(light);
  }
  const rackLabel = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.3, 0.05), toon(C.accentHot));
  rackLabel.position.set(0, 0.35, 0.41);
  rack.add(rackLabel);
  const beacon = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.3, 10),
    noOutline(new THREE.MeshBasicMaterial({ color: C.accentHot, transparent: true, opacity: 0 }))
  );
  beacon.position.y = 1.9;
  rack.add(beacon);
  const rackObj = placeFacing(rack, 26, -34, 23, -29, 1.0);

  const rack2 = new THREE.Group();
  const rack2Body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.7), metalMat);
  rack2Body.position.y = 0.6;
  rack2.add(rack2Body);
  const blinker = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.05), toon(C.accent, { emissive: C.accent, emissiveIntensity: 0.7 }));
  blinker.position.set(0, 0.9, 0.38);
  rack2.add(blinker);
  place(rack2, 28.6, -31.8, 0.4, 0.8);
  for (const [x, z] of [[23.5, -32.5], [29.5, -37], [24.5, -37.5], [27, -30]]) {
    place(makeRock(1.1 + Math.random(), rockMat), x, z, 0, 0.8, 1.4);
  }

  if (assets) {
    // the server yard: cargo, containers, a parked space truck
    placeFacing(assets.prop('containersA', 2.1, 'y'), 22, -31, darkC.x, darkC.z, 1.4);
    placeFacing(assets.prop('containersD', 2.0, 'y'), 30, -36, darkC.x, darkC.z, 1.3);
    placeFacing(assets.prop('cargoStack', 2.7, 'y'), 24, -37.5, darkC.x, darkC.z, 1.2);
    placeFacing(assets.prop('spacetruck', 4.6), 20, -35, darkC.x, darkC.z, 2.0);
    // graveyard of dead deploys, lit by lanterns at the gate
    placeFacing(assets.prop('gravestone', 1.1, 'y'), 31.5, -33.5, darkC.x, darkC.z, 0.5);
    placeFacing(assets.prop('graveA', 1.0, 'y'), 32.3, -32, darkC.x, darkC.z, 0.5);
    placeFacing(assets.prop('gravemarker', 0.9, 'y'), 31.9, -35.4, darkC.x, darkC.z, 0.4);
    for (const [x, z] of [[21, -30], [30, -28.5], [22, -38.5], [32, -37.6]]) {
      place(assets.prop('treeDeadL', 4.2, 'y'), x, z, Math.random() * 6, 0.7);
    }
    place(assets.prop('treeDeadM', 3.0, 'y'), 27, -39.5, Math.random() * 6, 0.6);
    placeFacing(assets.prop('postLantern', 3.0, 'y'), 24.2, -27, darkC.x, darkC.z, 0.4);
    placeFacing(assets.prop('postLantern', 3.0, 'y'), 27.8, -26.2, darkC.x, darkC.z, 0.4);
  }

  // ——— little floating islets drift around the big one (pure scenery) ———
  const islets = [];
  const isletDefs = [[-68, 10, -34, 3.6], [64, 6, -52, 2.8], [58, 12, 40, 2.4], [-60, 2, 44, 2.2]];
  for (const [x, y, z, r] of isletDefs) {
    const islet = new THREE.Group();
    const top = new THREE.Mesh(faceted(new THREE.CylinderGeometry(r, r * 0.85, 0.8, 7)), toon(C.grass));
    islet.add(top);
    const bottom = new THREE.Mesh(faceted(new THREE.CylinderGeometry(r * 0.85, 0.3, r * 1.3, 7)), noOutline(toon(C.cliff)));
    bottom.position.y = -r * 0.65 - 0.4;
    islet.add(bottom);
    if (r > 2.4) {
      const t = makeTree(0.9);
      t.position.y = 0.4;
      islet.add(t);
    } else {
      const rk = makeRock(0.8);
      rk.position.y = 0.4;
      islet.add(rk);
    }
    islet.position.set(x, y, z);
    islet.rotation.y = Math.random() * 6;
    group.add(islet);
    islets.push({ group: islet, baseY: y, phase: Math.random() * 6 });
  }

  // dev guard: no large prop may sit on (or overhang) the walking trail —
  // the jogger runs it blind and the painted path must stay clear
  if (import.meta.env && import.meta.env.DEV) {
    for (const c of colliders) {
      if (c.water || c.r < 1.5) continue;
      if (pathMask(c.pos.x, c.pos.z) > 0.05) {
        console.warn(
          `[island] large prop overlaps the trail at (${c.pos.x.toFixed(1)}, ${c.pos.z.toFixed(1)}) — move it or reroute the loop`
        );
      }
    }
  }

  // ——— living things: chickens, dog, butterflies, birds, fish, fireflies ———
  const creatures = createCreatures({
    group,
    heightAt,
    colliders,
    yard: { x: -9, z: 31, r: 3 }, // clear of the barn and the farm fence
    dogHome: { x: -9.5, z: 23 },
    pond: { x: pondC.x, z: pondC.z, r: WATER_R, y: WATER_Y },
    dark: { x: darkC.x, z: darkC.z, r: 10 },
    flowerPts,
  });

  // ——— named spots for quests/NPCs (all on the ground) ———
  const spots = {
    spawn: groundPoint(0, 36),
    pad: groundPoint(0, 31.5),
    dish: dishObj.position.clone(),
    mailbox: mailboxObj.position.clone(),
    opsBot: groundPoint(6, 30.5),
    rack: rackObj.position.clone(),
    terminal: terminalObj.position.clone(),
    kanban: kanbanObj.position.clone(),
    pm: groundPoint(30.3, -3.6),
    pmPatrol: [groundPoint(30.3, -3.6), groundPoint(30.2, -6.8)],
    ciDesk: ciDeskObj.position.clone(),
    engineer: groundPoint(34.2, -1.6),
    easel: easelObj.position.clone(),
    designer: groundPoint(30.4, -7.9),
    coffee: coffeeObj.position.clone(),
    piano: pianoObj.position.clone(),
    fishing: fishingSpot,
    bugs: {
      nullpointer: groundPoint(6, 26.5),
      offbyone: groundPoint(-26, 4),
      racecondition: groundPoint(25.5, -14),
      heisenbug: groundPoint(-40, -14),
      regression: groundPoint(39.5, -9),
      flakytest: groundPoint(-8, -26),
    },
  };

  return {
    group,
    colliders,
    spots,
    rackLights,
    beacon,
    crystals,
    todoStickies,
    doneStickies,
    ciScreen: { mesh: ciScreen, mat: ciScreenMat },
    noteSprites,
    gourds,
    bobber,
    dog: creatures.dog,
    loopPointAt,
    loopLength: LOOP_LENGTH,
    update(t, dt = 0.016, playerPos = null) {
      // ambient motion parks under reduced motion (live — the 🍃 chip
      // flips it back without a reload)
      if (!motionReduced()) {
        for (let i = 0; i < crystals.length; i++) {
          crystals[i].material.emissiveIntensity = 0.2 + Math.sin(t * 1.4 + i) * 0.12;
        }
        for (let i = 0; i < noteSprites.length; i++) {
          noteSprites[i].position.y = 1.4 + Math.sin(t * 1.2 + i * 1.7) * 0.25;
        }
        wmHub.rotation.z = t * 0.5;
        for (const islet of islets) {
          islet.group.position.y = islet.baseY + Math.sin(t * 0.4 + islet.phase) * 0.6;
        }
        for (let i = 0; i < ripples.length; i++) {
          const k = ((t * 0.24 + i * 0.5) % 1);
          ripples[i].scale.setScalar(1.2 + k * 5);
          ripples[i].material.opacity = 0.28 * (1 - k);
        }
      } else {
        for (const r of ripples) r.material.opacity = 0; // still water
      }
      creatures.update(t, dt, playerPos);
    },
  };
}
