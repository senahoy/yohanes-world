# Design

## Theme

**"Saturday-morning space cartoon meets Harvest Moon."** A cozy cel-shaded valley island floats in a deep violet-indigo cosmos — fenced farm plots, dirt trails, a fishing pond, terraced hills, all in chunky Roblox-blocky shapes. The old site's blackhole survives as this world's sun: a warm amber accretion ring hanging in the toon sky. Bright, hand-crafted, stepped toon shading with dark ink outlines — the world reads like a playable illustration, not a tech demo.

## Color

Space is indigo, never pure black. Warm amber is the "interact with me" color everywhere (blackhole ring, bug markers, quest highlights). Dialogs are paper: near-white boxes with ink text, like a comic panel laid over the world.

```css
:root {
  /* cosmos */
  --space-deep:   oklch(0.16 0.055 275);  /* sky zenith, fallback page bg */
  --space-mid:    oklch(0.30 0.080 285);  /* sky horizon glow */
  --brand:        oklch(0.40 0.150 270);  /* violet-indigo — UI chrome, buttons */
  --brand-bright: oklch(0.72 0.130 280);  /* links, highlights on dark */

  /* the sun (blackhole) + interaction accent */
  --accent:       oklch(0.75 0.155 60);   /* amber — interactables, markers, ring */
  --accent-hot:   oklch(0.65 0.190 40);   /* orange-red — ring core, danger/glitch */

  /* paper dialogs */
  --paper:        oklch(0.97 0.010 275);  /* dialog bg (UI panel, not page bg) */
  --ink:          oklch(0.22 0.030 275);  /* dialog text — ≥7:1 on paper */
  --ink-soft:     oklch(0.45 0.030 275);  /* secondary dialog text */

  /* world materials (3D, toon-stepped) */
  --grass:        oklch(0.75 0.150 150);
  --grass-dark:   oklch(0.55 0.120 155);
  --rock:         oklch(0.45 0.040 290);
  --tree:         oklch(0.65 0.140 145);
  --bug-glitch:   oklch(0.70 0.200 330);  /* magenta glitch critters */
}
```

Strategy: **Committed.** The indigo cosmos carries 60% of every frame; amber is reserved for "you can touch this" meaning; magenta appears only on bugs (the anomaly color — it exists nowhere else in the world).

## Typography

- **Display / HUD / name-tags:** `Silkscreen` (pixel face) — continuity with the old site's pixel title, used sparingly: game title, HUD counter, dialog name chips.
- **Dialog & body:** `Patrick Hand` — hand-drawn comic lettering, large (18–20px+), high contrast on paper. All long-form portfolio copy lives here.
- **Fallback page:** same pair; Patrick Hand for prose at ≥18px, Silkscreen for headings.
- No third face. Weight and size carry hierarchy.

## Components

- **Dialog panel:** paper box, 3px ink border, hard offset shadow (no blur), slightly rotated name chip in brand violet with paper text. Typewriter text reveal (instant under reduced motion). Pixel continue button with `▶`.
- **HUD:** top-left world title chip; top-right bug counter `🐛 n/6`, ⛶ fullscreen chip (F key; hidden where the API is unsupported), 🍃/✨ motion chip (only when reduce-motion is active or overridden), 🔊 mute chip and TXT switch on translucent indigo; bottom-center key hints that fade after first movement.
- **Quest markers:** amber `!` sprite bobbing above undiscovered bugs; amber ring pulse on the ground when in interaction range.
- **Touch controls (coarse pointers):** always landscape — in portrait the page CSS-rotates 90° and plays immediately (renderer dimensions swap, joystick coordinates remap), with a transient 3.5s rotate hint; Android additionally gets fullscreen + orientation lock on entry. Left virtual joystick; right thumb gets pixel-labeled `JUMP` and `ACT` buttons (≥64px, no emoji glyphs) that respond on touchstart so a second finger works mid-run.
- **Fallback page:** single-column comic-panel layout — each portfolio chapter is one paper panel on indigo, same copy the bugs deliver.

## 3D Art Direction

- **The world is a limited floating island** — a Harvest-Moon valley with Roblox blockiness. A rounded-square heightfield (half-extent 52) floats in the indigo cosmos on a chunky rock underside; stepped cliff terraces ring the edge, small scenery islets bob in the void around it. Height is quantized into soft ledges (0.8u terraces) and the meadow carries a subtle 2×2 checker tile tint — the world reads like a hand-tiled SNES valley extruded into toon 3D.
- **One dirt loop trail guides the tour.** A closed Catmull-Rom loop links every district gate, with short spurs into each district (landing pad, main street, PROD rack, fishing dock, farm gate). Trails are painted sand vertex colors and flatten the heightfield — Harvest Moon paths, not asphalt; the city plateau alone gets a real paved main street of KayKit road tiles with a crossing at its gate. Hand-lettered signposts stand at each junction — the graveyard spur reads "⚠ SERVERS · KEEP OUT", which is an invitation. KayKit terrain mesas stand as off-path landmarks.
- **Scale is anchored to the 1.6u character.** One building story ≈ 1.7× character (buildings 5–8u by height-based scaling), streetlights 4u, kanban board top at eye level, signboards below shoulder. Props that a character stands beside are always scaled by height, never by widest dimension.
- **The player is the Guardian** — an animated KayKit Knight (Idle/Run crossfade) who can **jump** (Space / `JUMP` touch button — fences and small rocks are hoppable; their colliders carry a height), **sprint** (Shift, or full joystick tilt via analog speed), and **look around** (mouse drag orbits the follow camera). The city cast: hooded Oracle (PM, paces between kanban and easel), Barbarian (engineer — plus a second Barbarian jogging endless laps of the loop trail), Mage (designer); NPCs cheer a greeting when the visitor first comes close. Ops Bot stays the procedural robot.
- **Six districts** via radial masks + vertex-colored terrain: **plaza** (flat QA campus: spawn pad, lab, satellite dish, mailbox, Ops Bot), **farm** (fenced crop rows on tilled soil, harvestable amber gourds that regrow, scarecrow, windmill, barn, chickens + Bug the dog), **city** (raised paved plateau: main street, buildings, kanban board, CI desk, easel, coffee machine, logs terminal), **hills** (terraced forest, crystals), **piano pond** (toon water, lily pads, reeds, a walkable fishing dock with a bite-timing minigame, piano on a stone patio), **server graveyard** (north-east gloom: dead trees, gravestones, fireflies, the PROD rack easter egg).
- **The world never holds still:** chickens peck around the farmyard, the dog wanders and runs to greet the player (creatures respect colliders and stop at the water's edge), butterflies orbit the flowers, two bird flocks bank overhead, fish shadows circle the pond and occasionally leap, fireflies pulse in the graveyard, ripples loop across the water, the windmill turns, meteors arc across the sky. Under `prefers-reduced-motion` the fliers are omitted and every ambient loop parks: steady fireflies, still water, stopped windmill.
- **Minimap:** a corner canvas — baked island silhouette, district tints, trails and pond, with live magenta bug dots, amber quest markers, and the player arrow. Ink border, paper-comic styling, north-up.
- **Toon shading:** `MeshToonMaterial` with a 3-step gradient map on every world mesh; `OutlineEffect` (inverted hull) for ink outlines; terrain/cliff excluded from outlines (hull pokes through concave dips).
- **Geometry language:** low-poly primitives, chunky proportions, nothing photoreal. Slight irregularity (rotated/scaled instances) so the world feels hand-placed. Props sit flat on the heightfield and face their district center (`placeFacing`).
- **Sky & day/night cycle:** a 5-minute loop. A stepped-disc toon sun and the brand blackhole — redrawn as an eclipse moon (thin amber accretion ring around the void, violet corona) — trade places on a great east–west arc; both are billboard canvas art, so neither ever shows a side profile. The gradient dome crossfades night indigo → bright indigo-lavender day with a warm horizon band at dawn/dusk; stars fade out for the day; meteors belong to the night. The key light tracks whichever body is up (shading direction, color and intensity follow — warm bright noon, cool dim midnight, amber dusk), and hemisphere/ambient light breathe with it. Clouds are drifting flat-bottomed cartoon billboards that tint from white (day) to dusky lavender (night). Emissives — windows, lanterns, screens, crystals, fireflies — carry the night.
- **Character:** procedural mini astronaut-engineer (~1.2u tall, big head, small body, backpack antenna) remains the no-asset fallback. Procedural walk cycle: limb swing + body bob + lean into turns.
- **Bugs:** small magenta critters with antennae; idle jitter + occasional position "glitch" snap (small amplitude). Caught = squash-pop + confetti burst.
- **Piano:** interacting opens an overlay instrument — one octave, WebAudio triangle+sine voices, keys A–K / W E T Y U or pointer.
- **NPC (Ops Bot):** same procedural character rig, distinct palette (rock-grey suit, amber visor), idle sway. Speech-bubble `…` sprite above head until first talked to.
- **Incident mode (easter egg):** the PROD server rack in the graveyard. Trigger flips the world to alert state: sky tints toward `--accent-hot`, warning light strobe-free pulse on the rack. Mission = 3 beats (Ops Bot briefing → logs terminal investigation → rollback at the rack). Resolution eases the sky back over 2s and awards an "Incident Commander" HUD badge. Alert tint is a gentle 3s crossfade — no flashing.
- **Camera:** street-level third-person follow — low (2.6u) and close (6.4u back), nearly level with the character so the world towers around them (the character fills ~⅓ of frame height, like the reference game). Smoothed exp damping, slight look-ahead, terrain-clearance clamp so ledges never swallow the camera. FOV 48.

## Audio

- **All procedural WebAudio — zero audio files.** A generative lo-fi loop underscores the world: warm triangle-pad chords (Am–F–C–G), a soft sine bass, and a sparse plucked A-minor-pentatonic melody that never repeats exactly. Quiet by design (music bus ≈ −15dB) — company for the walk, not a soundtrack.
- **Synth SFX** for jump, cast/bite/catch/miss, harvest pop, dog pet, bug squash. Short, soft, sine/triangle voices.
- The loop ducks to near-silence while the piano overlay is open (the player's music wins), and the whole context suspends in background tabs.
- **🔊 HUD chip mutes everything**; the choice persists in localStorage. Context unlocks on the ENTER click or first key press (autoplay-safe on Safari too).

## Motion

- Ease-out-quart/quint everywhere in UI; no bounce, no elastic.
- World idle motion is continuous but calm: ring rotation, cloud drift, bug jitter, marker bob.
- `prefers-reduced-motion`: boot to fallback page (opt-in link to enter the world); inside the world, the typewriter is instant, ambient loops park (butterflies/birds hidden, still water, stopped windmill, steady fireflies) and the fishing bite window nearly doubles. Because Android battery saver also raises this signal, a 🍃 HUD chip appears whenever it's active: an entry toast names the mode, and the chip toggles full animation live — the explicit choice persists and outranks the OS default.
- Dialog open: 180ms scale+fade from 0.96; close: 120ms fade.

## Layout (UI overlays & fallback)

- Overlay UI uses a 16px spacing base; dialog max-width 560px, anchored lower-center like the reference site.
- Fallback page: max 68ch prose, generous vertical rhythm, panels separated by starfield gaps.
- z-scale: world canvas < HUD < dialog < loading/title screen.
