# Product

## Register

brand

## Users

Recruiters, hiring managers, and fellow engineers landing on Yohanes Hutabarat's personal site. They arrive from a resume link, LinkedIn, or word of mouth, usually on a laptop but often on a phone. Their job: figure out in under two minutes who Yohanes is, what he's done (QA leadership / AI-native automation / security operations), and how to reach him — while ideally leaving with a "wait, that was cool" memory that makes him stand out from a stack of PDF resumes.

## Product Purpose

An interactive 3D mini-world portfolio (Three.js). Visitors control a small cel-shaded character exploring a cozy Harvest-Moon-style valley island floating in space — farm, village, pond, hills — hunting down glitchy "bugs" hiding in the world. Each caught bug reveals a portfolio chapter (about, journey, skills, achievements, projects, contact). The metaphor IS the resume: Yohanes is a testathon-winning QA lead, and the visitor literally does his job — finding bugs — to learn about him. A hidden easter egg (a tucked-away PROD server rack) triggers a second mission: a "production incident" the visitor resolves together with an NPC — investigate, find root cause, roll back — showcasing the security-operations/incident-response side of his work. Success = visitors reach the content on any device, and the experience is memorable enough to be shared.

## Brand Personality

Playful, crafted, quality-obsessed. "Saturday-morning space cartoon built by an engineer who tests everything." The playfulness never comes at the cost of reachability: every piece of content is accessible without skill, patience, or a GPU (full HTML fallback).

## Anti-references

- The generic dark "developer portfolio" with terminal cosplay and matrix-green text everywhere (the current site leans this way; keep pixel-type nostalgia, drop the CRT clutter).
- Bruno-Simon-clone physics playgrounds with no content payoff — driving a car over 3D text but learning nothing about the person.
- Heavy loading walls: no 20MB GLB downloads, no "please wait 30 seconds" experiences.
- Corporate template portfolios (identical card grids, stock icons, "I'm passionate about..." boilerplate).

## Design Principles

1. **The game is the resume.** Every playful mechanic must deliver real portfolio content. No decoration-only interactions.
2. **Practice what you preach.** A QA engineer's site must be bug-free, fast, and resilient: graceful fallbacks, no console errors, works without WebGL.
3. **Toon world, engineered core.** Bright cel-shaded charm on the surface, deliberate performance and accessibility underneath.
4. **Two minutes to everything.** All content reachable in a couple of minutes of play — and instantly via the fallback/skip path.
5. **Keep the universe.** The blackhole identity from the previous site survives as the night sky's eclipse-moon, trading places with a toon sun in the day/night loop; brand continuity, new register.

## Accessibility & Inclusion

- Full non-WebGL HTML fallback with identical content; "skip the game" affordance on load.
- `prefers-reduced-motion` → fallback page by default (with opt-in to the 3D world).
- Keyboard-only playable (WASD/arrows + E/Enter); touch joystick + action button on mobile.
- Dialog text meets ≥4.5:1 contrast; HUD text readable over the sky at all times.
- No flashing/strobe effects; glitch animations stay small-amplitude and local.
