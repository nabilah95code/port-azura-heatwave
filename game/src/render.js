// The painter: Port Azura drawn in clean flat vector style — warm pavements,
// pastel roofs with long afternoon shadows, palm trees, lane markings and
// crosswalks — then every vehicle and person, then effects. The camera follows
// the player; anything outside the view is culled before it is drawn.
import {
  BEACH_Y, BLOCK_SIZE, BLOCK_ORIGIN, BLOCKS, PITCH, ROAD_CENTERS, ROAD_HALF,
  SIDEWALK_OUT, WATER_Y, WORLD,
} from './config.js';

/** The visible world rectangle for a camera centred at (camX, camY). */
function viewRect(camX, camY, w, h) {
  return { x0: camX - w / 2 - 90, y0: camY - h / 2 - 90, x1: camX + w / 2 + 90, y1: camY + h / 2 + 90 };
}

/** Is a point inside the view rectangle (with margin)? */
function inView(view, x, y, margin = 0) {
  return x > view.x0 - margin && x < view.x1 + margin && y > view.y0 - margin && y < view.y1 + margin;
}

/** Draw the ground: base pavement, beach, sea, block grounds, roads, markings. */
function drawGround(ctx, state, view) {
  const { city, time } = state;
  // Base: warm city pavement.
  ctx.fillStyle = '#c9bda6';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);

  // The sea: a gradient band with slow wave lines along the shore.
  if (view.y1 > BEACH_Y) {
    ctx.fillStyle = '#ecd9a0';
    ctx.fillRect(view.x0, BEACH_Y, view.x1 - view.x0, WATER_Y - BEACH_Y + 4);
    const sea = ctx.createLinearGradient(0, WATER_Y, 0, WORLD);
    sea.addColorStop(0, '#57b6cf');
    sea.addColorStop(1, '#2e7ea6');
    ctx.fillStyle = sea;
    ctx.fillRect(view.x0, WATER_Y, view.x1 - view.x0, WORLD - WATER_Y);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = Math.floor(view.x0 / 90) * 90; x < view.x1; x += 90) {
      const wave = Math.sin(time * 1.4 + x * 0.05) * 3;
      ctx.moveTo(x, WATER_Y + 6 + wave);
      ctx.lineTo(x + 44, WATER_Y + 6 + wave);
    }
    ctx.stroke();
  }

  // Block grounds: parks, parking lots and landmark plazas.
  for (const g of city.grounds) {
    if (!inView(view, g.x + g.w / 2, g.y + g.h / 2, 260)) continue;
    ctx.fillStyle = g.kind === 'park' ? '#79a95c' : g.kind === 'parking' ? '#8f9296' : '#d8cdb4';
    ctx.fillRect(g.x, g.y, g.w, g.h);
    if (g.kind === 'park') {
      ctx.strokeStyle = 'rgba(240,230,200,0.55)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y + g.h / 2);
      ctx.quadraticCurveTo(g.x + g.w / 2, g.y + g.h * 0.2, g.x + g.w, g.y + g.h / 2);
      ctx.stroke();
    }
    if (g.kind === 'parking') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          ctx.strokeRect(g.x + 12 + col * 74, g.y + 24 + row * 104, 56, 82);
        }
      }
    }
  }

  // Sidewalk strips under every road, then the asphalt on top. North-south
  // roads stop at the beach; east-west roads run the whole width.
  const roadEnd = Math.min(view.y1, BEACH_Y + 6);
  ctx.fillStyle = '#b3a893';
  for (const centre of ROAD_CENTERS) {
    if (centre + SIDEWALK_OUT > view.x0 && centre - SIDEWALK_OUT < view.x1 && view.y0 < roadEnd) ctx.fillRect(centre - SIDEWALK_OUT, view.y0, SIDEWALK_OUT * 2, roadEnd - view.y0);
    if (centre + SIDEWALK_OUT > view.y0 && centre - SIDEWALK_OUT < view.y1) ctx.fillRect(view.x0, centre - SIDEWALK_OUT, view.x1 - view.x0, SIDEWALK_OUT * 2);
  }
  ctx.fillStyle = '#43464c';
  for (const centre of ROAD_CENTERS) {
    if (centre + ROAD_HALF > view.x0 && centre - ROAD_HALF < view.x1 && view.y0 < roadEnd) ctx.fillRect(centre - ROAD_HALF, view.y0, ROAD_HALF * 2, roadEnd - view.y0);
    if (centre + ROAD_HALF > view.y0 && centre - ROAD_HALF < view.y1) ctx.fillRect(view.x0, centre - ROAD_HALF, view.x1 - view.x0, ROAD_HALF * 2);
  }

  // Lane dashes, skipped inside intersections.
  ctx.fillStyle = '#e8c85a';
  for (const centre of ROAD_CENTERS) {
    for (let at = Math.floor(view.y0 / 46) * 46; at < Math.min(view.y1, BEACH_Y); at += 46) {
      let inIntersection = false;
      for (const cross of ROAD_CENTERS) if (Math.abs(at + 14 - cross) < ROAD_HALF + 8) inIntersection = true;
      if (!inIntersection && centre > view.x0 && centre < view.x1) ctx.fillRect(centre - 2, at, 4, 26);
    }
    for (let at = Math.floor(view.x0 / 46) * 46; at < view.x1; at += 46) {
      let inIntersection = false;
      for (const cross of ROAD_CENTERS) if (Math.abs(at + 14 - cross) < ROAD_HALF + 8) inIntersection = true;
      if (!inIntersection && centre > view.y0 && centre < view.y1) ctx.fillRect(at, centre - 2, 26, 4);
    }
  }

  // Crosswalks at every visible intersection.
  ctx.fillStyle = 'rgba(240,240,240,0.75)';
  for (const cx of ROAD_CENTERS) {
    for (const cy of ROAD_CENTERS) {
      if (!inView(view, cx, cy, 40)) continue;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(cx + i * 22 - 7, cy - ROAD_HALF - 12, 14, 9);
        ctx.fillRect(cx + i * 22 - 7, cy + ROAD_HALF + 3, 14, 9);
        ctx.fillRect(cx - ROAD_HALF - 12, cy + i * 22 - 7, 9, 14);
        ctx.fillRect(cx + ROAD_HALF + 3, cy + i * 22 - 7, 9, 14);
      }
    }
  }
}

/** Draw the buildings: long shadows, pastel roofs, clutter, landmark signs. */
function drawBuildings(ctx, state, view) {
  for (const b of state.city.buildings) {
    if (!inView(view, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    ctx.fillStyle = 'rgba(60,40,20,0.20)';
    ctx.fillRect(b.x + 13, b.y + 17, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(90,60,30,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Roof inset and air-conditioning clutter.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x + 9, b.y + 9, b.w - 18, b.h - 18);
    ctx.fillStyle = 'rgba(90,80,70,0.5)';
    for (let i = 0; i < b.clutter; i++) {
      const cx = b.x + 16 + ((i * 67) % Math.max(20, b.w - 44));
      const cy = b.y + 14 + ((i * 41) % Math.max(16, b.h - 40));
      ctx.fillRect(cx, cy, 15, 11);
    }
    if (b.sign) {
      const labelW = Math.min(b.w - 16, b.sign.length * 9.4 + 22);
      ctx.fillStyle = '#2d2a26';
      ctx.fillRect(b.x + (b.w - labelW) / 2, b.y + b.h - 30, labelW, 21);
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h - 19);
    }
  }
}

/** Draw one palm: a short trunk and a star of fronds. */
function drawPalm(ctx, palm) {
  ctx.strokeStyle = '#7a5c38';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(palm.x, palm.y);
  ctx.lineTo(palm.x + 3, palm.y - 4);
  ctx.stroke();
  ctx.strokeStyle = '#3e8e4f';
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + palm.x * 0.01;
    ctx.beginPath();
    ctx.moveTo(palm.x + 3, palm.y - 4);
    ctx.quadraticCurveTo(
      palm.x + 3 + Math.cos(a) * 11 * palm.s,
      palm.y - 4 + Math.sin(a) * 11 * palm.s - 3,
      palm.x + 3 + Math.cos(a) * 17 * palm.s,
      palm.y - 4 + Math.sin(a) * 17 * palm.s + 4,
    );
    ctx.stroke();
  }
}

/** Draw the golden objective beacon: a pulsing ring and a pillar of light. */
function drawObjective(ctx, state) {
  const objective = state.objective;
  if (!objective || objective.hidden) return;
  const pulse = 1 + Math.sin(state.time * 4) * 0.12;
  const grad = ctx.createLinearGradient(0, objective.y - 190, 0, objective.y);
  grad.addColorStop(0, 'rgba(255,217,74,0)');
  grad.addColorStop(1, 'rgba(255,217,74,0.30)');
  ctx.fillStyle = grad;
  ctx.fillRect(objective.x - 13, objective.y - 190, 26, 190);
  ctx.strokeStyle = '#ffd94a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(objective.x, objective.y, 30 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath();
  const bob = Math.sin(state.time * 3.2) * 5;
  ctx.moveTo(objective.x, objective.y - 52 + bob);
  ctx.lineTo(objective.x - 10, objective.y - 68 + bob);
  ctx.lineTo(objective.x + 10, objective.y - 68 + bob);
  ctx.closePath();
  ctx.fill();
}

/** Draw one car: shadow, body, roof, glass and kind-specific details. */
function drawCar(ctx, state, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.fillStyle = 'rgba(30,25,20,0.28)';
  ctx.beginPath();
  ctx.ellipse(4, 6, car.radius + 7, car.radius - 1, car.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);
  const L = car.radius * 2 + 12;
  const W = car.radius * 2 - 6;
  // Wheels.
  ctx.fillStyle = '#1c1c1e';
  for (const [wx, wy] of [[-L / 4, -W / 2], [L / 4, -W / 2], [-L / 4, W / 2 - 4], [L / 4, W / 2 - 4]]) {
    ctx.fillRect(wx - 6, wy, 13, 5);
  }
  // Body.
  ctx.fillStyle = car.disabled ? '#6d6d6d' : car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 9);
  ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#23262b';
    ctx.fillRect(-L / 6, -W / 2, L / 3, W);
    ctx.fillStyle = '#f4f6f8';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('POLICE', 0, 0);
  }
  // Roof and glass.
  ctx.fillStyle = 'rgba(30,40,55,0.85)';
  roundRect(ctx, -L * 0.16, -W * 0.36, L * 0.3, W * 0.72, 5);
  ctx.fill();
  ctx.fillStyle = car.disabled ? '#555b60' : shade(car.color, -28);
  roundRect(ctx, -L * 0.05, -W * 0.33, L * 0.2, W * 0.66, 4);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(L / 2 - 3, -W / 2 + 4, 3, 6);
  ctx.fillRect(L / 2 - 3, W / 2 - 10, 3, 6);
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#2d2a26';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 1);
  }
  if (car.kind === 'coupe') {
    ctx.fillStyle = 'rgba(20,20,25,0.8)';
    ctx.fillRect(-L / 2 + 1, -W / 2 + 3, 4, W - 6);
  }
  if (car.kind === 'police') {
    const flash = Math.sin(state.time * 11 + car.lightPhase) > 0;
    ctx.fillStyle = flash ? '#ff4040' : '#7a1616';
    ctx.fillRect(-9, -8, 8, 6);
    ctx.fillStyle = flash ? '#16307a' : '#4d7cff';
    ctx.fillRect(1, -8, 8, 6);
    ctx.fillStyle = flash ? 'rgba(255,64,64,0.25)' : 'rgba(77,124,255,0.25)';
    ctx.beginPath();
    ctx.arc(0, -5, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (car.missionCar) {
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ TARGET', car.x, car.y - car.radius - 16 + Math.sin(state.time * 3) * 3);
  }
}

/** Draw one pedestrian (or the player, with `isPlayer` styling). */
function drawPerson(ctx, person, isPlayer) {
  ctx.fillStyle = 'rgba(30,25,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(person.x + 2, person.y + 4, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (person.state === 'down') {
    ctx.save();
    ctx.translate(person.x, person.y);
    ctx.rotate(person.angle);
    ctx.fillStyle = person.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = person.skin;
    ctx.beginPath();
    ctx.arc(13, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(person.x, person.y);
  ctx.rotate(person.angle);
  ctx.fillStyle = person.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
  ctx.fill();
  // Shoulders point the way the person faces.
  ctx.fillStyle = shade(person.shirt, -30);
  ctx.fillRect(2, -9.5, 5, 19);
  ctx.restore();
  ctx.fillStyle = person.skin;
  ctx.beginPath();
  ctx.arc(person.x, person.y, 5.2, 0, Math.PI * 2);
  ctx.fill();
  if (isPlayer) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(person.x, person.y, 13.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#123c3f';
    ctx.beginPath();
    ctx.arc(person.x, person.y, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(person.x, person.y, 5.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A rounded rectangle path (car bodies and roofs). */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Lighten (positive) or darken (negative) a #rrggbb colour. */
export function shade(hex, amount) {
  const n = Number.parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.min(255, Math.max(0, v));
  const r = clamp((n >> 16) + amount);
  const g = clamp(((n >> 8) & 0xff) + amount);
  const b = clamp((n & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

/**
 * Create the renderer for a canvas. `draw(state)` paints the whole world view;
 * HUD and menus are hud.js's job, drawn afterwards in screen space.
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    draw(state) {
      const cam = state.camera;
      const w = canvas.width;
      const h = canvas.height;
      const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
      const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
      const view = viewRect(cam.x, cam.y, w, h);
      ctx.save();
      ctx.translate(w / 2 - cam.x + shakeX, h / 2 - cam.y + shakeY);
      drawGround(ctx, state, view);
      drawBuildings(ctx, state, view);
      for (const palm of state.city.palms) if (inView(view, palm.x, palm.y, 30)) drawPalm(ctx, palm);
      drawObjective(ctx, state);
      for (const ped of state.peds) if (inView(view, ped.x, ped.y)) drawPerson(ctx, ped, false);
      for (const car of state.cars) if (inView(view, car.x, car.y, 60)) drawCar(ctx, state, car);
      if (!state.player.car) drawPerson(ctx, state.player, true);

      // Tracers, particles and floating text.
      for (const t of state.tracers) {
        ctx.strokeStyle = t.color;
        ctx.globalAlpha = Math.min(1, t.life / 0.06);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      for (const p of state.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const f of state.floaters) {
        ctx.globalAlpha = Math.min(1, f.life);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Warm afternoon light: a soft golden vignette over everything.
      const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
      vignette.addColorStop(0, 'rgba(255,180,80,0)');
      vignette.addColorStop(1, 'rgba(120,50,10,0.16)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    },
  };
}
