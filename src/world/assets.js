import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { getGradientMap } from './materials.js';

// KayKit asset packs (kaykit.dev) — CC0, credited in the README and the
// text-version footer. Every model is re-materialed with our shared toon
// gradient so imported props and procedural props read as one world.

const FILES = {
  // space base (plaza + dark side)
  basemodule: './assets/kaykit/space/basemodule_A.gltf',
  landingpad: './assets/kaykit/space/landingpad_small.gltf',
  solarpanel: './assets/kaykit/space/solarpanel.gltf',
  containersA: './assets/kaykit/space/containers_A.gltf',
  containersD: './assets/kaykit/space/containers_D.gltf',
  cargoStack: './assets/kaykit/space/cargo_A_stacked.gltf',
  spacetruck: './assets/kaykit/space/spacetruck.gltf',
  structureTall: './assets/kaykit/space/structure_tall.gltf',
  // city district
  buildingA: './assets/kaykit/city/building_A_withoutBase.gltf',
  buildingB: './assets/kaykit/city/building_B_withoutBase.gltf',
  buildingC: './assets/kaykit/city/building_C_withoutBase.gltf',
  buildingD: './assets/kaykit/city/building_D_withoutBase.gltf',
  buildingE: './assets/kaykit/city/building_E_withoutBase.gltf',
  buildingF: './assets/kaykit/city/building_F_withoutBase.gltf',
  streetlight: './assets/kaykit/city/streetlight.gltf',
  bench: './assets/kaykit/city/bench.gltf',
  trash: './assets/kaykit/city/trash_A.gltf',
  hydrant: './assets/kaykit/city/firehydrant.gltf',
  roadStraight: './assets/kaykit/city/road_straight.gltf',
  roadCrossing: './assets/kaykit/city/road_straight_crossing.gltf',
  // landmark rock formations
  terrainLow: './assets/kaykit/space/terrain_low.gltf',
  terrainTall: './assets/kaykit/space/terrain_tall.gltf',
  terrainSlope: './assets/kaykit/space/terrain_slope.gltf',
  terrainMining: './assets/kaykit/space/terrain_mining.gltf',
  // dark side dressing (graveyard of dead deploys)
  treeDeadL: './assets/kaykit/halloween/tree_dead_large.gltf',
  treeDeadM: './assets/kaykit/halloween/tree_dead_medium.gltf',
  gravestone: './assets/kaykit/halloween/gravestone.gltf',
  graveA: './assets/kaykit/halloween/grave_A.gltf',
  gravemarker: './assets/kaykit/halloween/gravemarker_A.gltf',
  postLantern: './assets/kaykit/halloween/post_lantern.gltf',
  // animated characters (the city QA cast)
  charKnight: './assets/kaykit/chars/Knight.glb',
  charBarbarian: './assets/kaykit/chars/Barbarian.glb',
  charMage: './assets/kaykit/chars/Mage.glb',
  charHooded: './assets/kaykit/chars/Rogue_Hooded.glb',
};

function toonify(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const src = obj.material;
    obj.material = new THREE.MeshToonMaterial({
      color: src.color ? src.color.clone() : new THREE.Color('#ffffff'),
      map: src.map || null,
      gradientMap: getGradientMap(),
    });
  });
}

export async function loadAssets(onProgress) {
  const manager = new THREE.LoadingManager();
  if (onProgress) {
    manager.onProgress = (url, loaded, total) => onProgress(loaded / Math.max(total, 1));
  }
  const loader = new GLTFLoader(manager);
  const entries = Object.entries(FILES);
  const results = await Promise.all(entries.map(([, url]) => loader.loadAsync(url)));
  const templates = new Map();
  entries.forEach(([key], i) => {
    toonify(results[i].scene);
    templates.set(key, results[i]);
  });

  // Static prop instance, uniformly scaled so the chosen dimension equals
  // `size` ('max' or 'y' — height-based for anything a character stands
  // next to), feet planted at local y=0, centered on x/z.
  function prop(name, size = 2, axis = 'max') {
    const inst = templates.get(name).scene.clone(true);
    const holder = new THREE.Group();
    holder.add(inst);
    const box = new THREE.Box3().setFromObject(inst);
    const dims = box.getSize(new THREE.Vector3());
    const ref = axis === 'y' ? dims.y : Math.max(dims.x, dims.y, dims.z);
    inst.scale.setScalar(size / ref);
    const grounded = new THREE.Box3().setFromObject(inst);
    const center = grounded.getCenter(new THREE.Vector3());
    inst.position.set(-center.x, -grounded.min.y, -center.z);
    return holder;
  }

  // Animated character instance with its own mixer. `play(name)` crossfades.
  function character(name, height = 1.6) {
    const tpl = templates.get(name);
    const scene = skeletonClone(tpl.scene);
    const holder = new THREE.Group();
    holder.add(scene);
    const box = new THREE.Box3().setFromObject(scene);
    const dims = box.getSize(new THREE.Vector3());
    scene.scale.setScalar(height / dims.y);
    const grounded = new THREE.Box3().setFromObject(scene);
    scene.position.y -= grounded.min.y;

    const mixer = new THREE.AnimationMixer(scene);
    let active = null;
    function play(clipName, fade = 0.25) {
      const clip = tpl.animations.find((a) => a.name === clipName);
      if (!clip) return;
      const action = mixer.clipAction(clip);
      if (active === action) return;
      action.reset().fadeIn(fade).play();
      if (active) active.fadeOut(fade);
      active = action;
    }
    return { root: holder, mixer, play };
  }

  return { prop, character };
}
