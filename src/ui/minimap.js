import { getMapData } from '../world/island.js';

// Hand-drawn corner minimap: the island silhouette, districts, trails and
// pond are baked once; the player arrow and quest dots draw live on top.
export function createMinimap() {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const data = getMapData();
  const S = canvas.width;
  const SPAN = (data.A + 8) * 2; // world units covered edge-to-edge
  const sx = (x) => (x / SPAN + 0.5) * S;
  const sz = (z) => (z / SPAN + 0.5) * S;
  const sr = (r) => (r / SPAN) * S;

  // ——— static base layer ———
  const base = document.createElement('canvas');
  base.width = base.height = S;
  const b = base.getContext('2d');

  // island silhouette (superellipse)
  b.beginPath();
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const px = data.A * Math.sign(c) * Math.pow(Math.abs(c), 2 / data.n);
    const pz = data.A * Math.sign(s) * Math.pow(Math.abs(s), 2 / data.n);
    if (i === 0) b.moveTo(sx(px), sz(pz));
    else b.lineTo(sx(px), sz(pz));
  }
  b.closePath();
  b.fillStyle = '#4b9a5f';
  b.fill();
  b.lineWidth = 3;
  b.strokeStyle = '#161929';
  b.stroke();

  // district tints
  b.save();
  b.clip(); // stay inside the island
  const zones = [
    [data.districts.plaza, '#79c489'],
    [data.districts.farm, '#8ec06c'],
    [data.districts.city, '#9ea3bd'],
    [data.districts.hills, '#3e8153'],
    [data.districts.dark, '#3c3450'],
  ];
  for (const [d, color] of zones) {
    const grad = b.createRadialGradient(sx(d.x), sz(d.z), 1, sx(d.x), sz(d.z), sr(d.r));
    grad.addColorStop(0, color);
    grad.addColorStop(1, `${color}00`);
    b.fillStyle = grad;
    b.beginPath();
    b.arc(sx(d.x), sz(d.z), sr(d.r), 0, Math.PI * 2);
    b.fill();
  }
  // farm plot
  b.fillStyle = '#6f4c30';
  b.fillRect(sx(data.farm.x0), sz(data.farm.z0), sr(data.farm.x1 - data.farm.x0), sr(data.farm.z1 - data.farm.z0));
  // trails
  b.lineWidth = 2.5;
  b.strokeStyle = '#b9a17a';
  b.lineJoin = 'round';
  for (const path of data.paths) {
    b.beginPath();
    path.forEach(([x, z], i) => (i === 0 ? b.moveTo(sx(x), sz(z)) : b.lineTo(sx(x), sz(z))));
    b.stroke();
  }
  // pond
  b.fillStyle = '#4fb2e3';
  b.beginPath();
  b.arc(sx(data.water.x), sz(data.water.z), sr(data.water.r), 0, Math.PI * 2);
  b.fill();
  b.lineWidth = 1.5;
  b.strokeStyle = '#161929';
  b.stroke();
  b.restore();

  let lastDraw = -1;
  return {
    update(t, player, markers = []) {
      if (t - lastDraw < 1 / 15) return; // 15Hz is plenty for a 150px map
      lastDraw = t;
      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(base, 0, 0);

      // quest / bug dots
      const pulse = 0.65 + 0.35 * Math.sin(t * 4);
      for (const m of markers) {
        ctx.beginPath();
        ctx.arc(sx(m.x), sz(m.z), m.big ? 4.5 : 3.2, 0, Math.PI * 2);
        ctx.fillStyle = m.color;
        ctx.globalAlpha = m.pulse ? pulse : 1;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = '#161929';
        ctx.stroke();
      }

      // player arrow
      const px = sx(player.position.x);
      const pz = sz(player.position.z);
      const ang = Math.atan2(player.facing.z, player.facing.x);
      ctx.save();
      ctx.translate(px, pz);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-4.5, 4.5);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4.5, -4.5);
      ctx.closePath();
      ctx.fillStyle = '#f49335';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#161929';
      ctx.stroke();
      ctx.restore();
    },
  };
}
