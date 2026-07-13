# yohanes.world — a playable portfolio

A cozy floating-island world built with Three.js — Harvest Moon layout, Roblox
chunkiness. Visitors run (and jump) along the dirt trails between districts,
catch the six bugs that escaped the test suite, file the reports on the PM's
kanban, automate the regression suite at the CI desk, and resolve a hidden
production incident in the server graveyard — leaving knowing exactly what
Yohanes Hutabarat does for a living. Along the way: a farm with harvestable
crops, chickens and a dog, a fishing dock with a bite-timing minigame, a
playable piano by the pond, a jogging NPC, butterflies, birds, fireflies —
and a corner minimap so nobody gets lost.

## Run

```bash
npm install
npm run dev      # http://localhost:5180
npm run build    # production build → dist/
npm test         # end-to-end smoke suite (Playwright — plays the whole portfolio)
```

A generative lo-fi loop and synth SFX are all procedural WebAudio (no audio
files); the 🔊 HUD chip mutes them. Progress (bugs caught, reports filed, CI,
the incident badge) persists in localStorage; add `?reset` to the URL to start
over. `?noassets` forces the
procedural no-GLTF world. `?mode=text` serves the accessible text version
(also the automatic fallback for no-WebGL and reduced-motion visitors).

## Deploy (Vercel)

The site is fully static — `vercel.json` pins the Vite framework preset
(build `npm run build`, output `dist/`), sets long-lived caching for the
hashed bundles and the KayKit models, and skips Playwright's browser
download on Vercel's build machines.

```bash
npm i -g vercel   # once
vercel            # preview deploy
vercel --prod     # production
```

Or import the repo in the Vercel dashboard — zero extra configuration
needed. After the first deploy, point `og:image` at the production URL if
you want absolute social-card links.

## Asset processing

Character GLBs are stripped to the handful of animation clips the game uses
and quantized:

```bash
node scripts/strip-animations.mjs
```

## Credits

- 3D models: [KayKit](https://kaykit.itch.io/) by Kay Lousberg — CC0.
  Packs used: Space Base Bits, City Builder Bits, Halloween Bits,
  Character Pack Adventures.
- Fonts: Silkscreen, Patrick Hand (Google Fonts, OFL).
- Everything else (world, shaders, game code): Yohanes Hutabarat.
