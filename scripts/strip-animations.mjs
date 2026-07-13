// Strip KayKit character GLBs down to the few animation clips the game uses.
// Usage: node scripts/strip-animations.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, weld, quantize, dedup } from '@gltf-transform/functions';
import { readdirSync } from 'node:fs';

const DIR = 'public/assets/kaykit/chars';
const KEEP = /^(Idle|Walking_A|Running_A|Wave|Cheer|Interact|Sit_Chair_Idle)$/i;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.glb'))) {
  const path = `${DIR}/${file}`;
  const doc = await io.read(path);
  const anims = doc.getRoot().listAnimations();
  const names = anims.map((a) => a.getName());
  let kept = 0;
  for (const anim of anims) {
    if (KEEP.test(anim.getName())) { kept++; continue; }
    anim.dispose();
  }
  if (kept === 0) {
    console.error(`${file}: nothing matched! available: ${names.join(', ')}`);
    process.exit(1);
  }
  await doc.transform(dedup(), weld(), quantize(), prune());
  await io.write(path, doc);
  console.log(`${file}: kept ${kept}/${anims.length} clips (${names.filter((n) => KEEP.test(n)).join(', ')})`);
}
