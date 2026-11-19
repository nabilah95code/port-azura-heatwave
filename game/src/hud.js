// Everything drawn in screen space: the HUD (cash, health, wanted stars, the
// clock), the minimap, mission panel, dialogue and banners, and the full
// screens — title, help, pause, BUSTED and WASTED. Buttons are recorded while
// drawing so main.js can route mouse clicks to the topmost one.
import { BLOCKS, BLOCK_ORIGIN, BLOCK_SIZE, PITCH, ROAD_CENTERS, WATER_Y, WORLD } from './config.js';
import { distance } from './entities.js';

const GOLD = '#ffd94a';
const PANEL = 'rgba(14,16,22,0.74)';
const WHITE = '#f5f2ea';

/** A rounded rectangle path. */
function panel(ctx, x, y, w, h, r = 10) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The in-play HUD: status cluster, mission panel, dialogue, minimap. */
function drawPlayHud(ctx, state, w, h) {
  const player = state.player;
  // Top-right: cash, debt, stars, health, clock.
  ctx.textAlign = 'right';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`$${state.cash.toLocaleString('en-US')}`, w - 22, 40);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(245,242,234,0.85)';
  const clock = state.clock;
  const hh = String(Math.floor(clock / 60)).padStart(2, '0');
  const mm = String(Math.floor(clock % 60)).padStart(2, '0');
  ctx.fillText(state.story.done ? `${hh}:${mm} — debt free` : `${hh}:${mm} — debt $${state.debt.toLocaleString('en-US')}`, w - 22, 62);
  // Wanted stars.
  ctx.font = '22px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.wanted ? GOLD : 'rgba(245,242,234,0.25)';
    ctx.fillText('★', w - 26 - (4 - i) * 24, 92);
  }
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(w - 192, 104, 170, 11);
  ctx.fillStyle = player.health > 30 ? '#7ee787' : '#e5484d';
  ctx.fillRect(w - 190, 106, 166 * Math.max(0, player.health / 100), 7);

  // Top-left: the current job and objective.
  if (state.objective || state.story.active) {
    ctx.fillStyle = PANEL;
    panel(ctx, 16, 16, 342, state.story.timer !== null && state.story.active ? 84 : 64);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 13px system-ui, sans-serif';
    const missionTitle = state.story.active
      ? `JOB ${state.story.index + 1} — ${state.storyTitle ?? ''}`.toUpperCase()
      : state.story.done ? 'FREE ROAM' : 'PORT AZURA';
    ctx.fillText(missionTitle, 30, 38);
    ctx.fillStyle = WHITE;
    ctx.font = '14px system-ui, sans-serif';
    if (state.objective) {
      wrapText(ctx, state.objective.label, 30, 60, 316, 17);
      if (!state.objective.hidden) {
        const d = Math.round(distance(player.x, player.y, state.objective.x, state.objective.y) / 10);
        ctx.fillStyle = 'rgba(245,242,234,0.75)';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${d} m`, 346, 38);
        ctx.textAlign = 'left';
      }
    }
    if (state.story.active && state.story.timer !== null) {
      const left = Math.max(0, Math.ceil(state.story.timer));
      ctx.fillStyle = left < 30 ? '#e5484d' : GOLD;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(`⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, 30, 92);
    }
  }

  // Bottom-left: speed and car health while driving; a hint while on foot.
  ctx.textAlign = 'left';
  if (player.car) {
    const speed = Math.round(Math.hypot(player.car.vx, player.car.vy) * 0.36);
    ctx.fillStyle = PANEL;
    panel(ctx, 16, h - 66, 168, 50);
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`${speed} km/h`, 30, h - 34);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(96, h - 42, 74, 8);
    ctx.fillStyle = player.car.hp > 30 ? '#7ee787' : '#e5484d';
    ctx.fillRect(97, h - 41, 72 * Math.max(0, player.car.hp / 90), 6);
  } else if (state.hint) {
    ctx.fillStyle = PANEL;
    panel(ctx, 16, h - 58, Math.min(430, state.hint.length * 7.6 + 28), 40);
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(state.hint, 30, h - 33);
  }

  drawDialogue(ctx, state, w, h);
  drawBanner(ctx, state, w);
  drawMinimap(ctx, state, w, h);
  drawObjectiveArrow(ctx, state, w, h);
  drawBustMeter(ctx, state, w, h);

  // Low health: a pulsing red edge.
  if (player.health < 32 && !player.dead) {
    ctx.strokeStyle = `rgba(229,72,77,${0.35 + Math.sin(state.time * 5) * 0.15})`;
    ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, w, h);
  }
}

/** Wrap a line of text within `maxWidth`, drawing up to 3 lines. */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let ly = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, ly);
      line = word;
      ly += lineHeight;
    } else {
      line = trial;
    }
  }
  if (line) ctx.fillText(line, x, ly);
}

/** The current dialogue line, phone-call style, at the bottom centre. */
function drawDialogue(ctx, state, w, h) {
  const line = state.dialogue[0];
  if (!line) return;
  const boxW = Math.min(600, w - 340);
  const x = (w - boxW) / 2;
  const y = h - 96;
  ctx.fillStyle = PANEL;
  panel(ctx, x, y, boxW, 62);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(line.who.toUpperCase(), x + 16, y + 20);
  ctx.fillStyle = WHITE;
  ctx.font = '14.5px system-ui, sans-serif';
  wrapText(ctx, line.text, x + 16, y + 41, boxW - 32, 18);
}

/** Big centre banners: job titles, completions, warnings. */
function drawBanner(ctx, state, w) {
  const b = state.banner;
  if (!b || b.t <= 0) return;
  const alpha = Math.min(1, b.t / 0.6);
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.fillText(b.title, w / 2, 128);
  if (b.sub) {
    ctx.fillStyle = WHITE;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(b.sub, w / 2, 156);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

/** The minimap: whole city, roads, water, blips for police and the objective. */
function drawMinimap(ctx, state, w, h) {
  const size = 184;
  const x = w - size - 16;
  const y = h - size - 16;
  const scale = size / WORLD;
  ctx.fillStyle = 'rgba(20,22,28,0.82)';
  panel(ctx, x - 4, y - 4, size + 8, size + 8, 12);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.fillStyle = '#8f8672';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#2e7ea6';
  ctx.fillRect(x, y + WATER_Y * scale, size, size - WATER_Y * scale);
  ctx.fillStyle = '#79a95c';
  for (const g of state.city.grounds) {
    if (g.kind === 'park') ctx.fillRect(x + g.x * scale, y + g.y * scale, g.w * scale, g.h * scale);
  }
  ctx.strokeStyle = '#43464c';
  ctx.lineWidth = 3;
  for (const centre of ROAD_CENTERS) {
    ctx.beginPath();
    ctx.moveTo(x + centre * scale, y);
    ctx.lineTo(x + centre * scale, y + size);
    ctx.moveTo(x, y + centre * scale);
    ctx.lineTo(x + size, y + centre * scale);
    ctx.stroke();
  }
  // Landmarks as pale dots.
  ctx.fillStyle = 'rgba(245,242,234,0.8)';
  for (const lm of Object.values(state.city.landmarks)) {
    ctx.fillRect(x + lm.x * scale - 1.5, y + lm.y * scale - 1.5, 3, 3);
  }
  // Police blips flash red/blue.
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    ctx.fillStyle = Math.sin(state.time * 9) > 0 ? '#ff4040' : '#4d7cff';
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The objective.
  if (state.objective && !state.objective.hidden) {
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x + state.objective.x * scale, y + state.objective.y * scale, 4 + Math.sin(state.time * 4) * 1, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: a white arrow facing his heading.
  const px = x + state.player.x * scale;
  const py = y + state.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = 'rgba(245,242,234,0.8)';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('N', x + size - 2, y + 12);
}

/** An edge arrow pointing at an off-screen objective, with its distance. */
function drawObjectiveArrow(ctx, state, w, h) {
  const objective = state.objective;
  if (!objective || objective.hidden) return;
  const cam = state.camera;
  const sx = objective.x - cam.x + w / 2;
  const sy = objective.y - cam.y + h / 2;
  if (sx > 40 && sx < w - 40 && sy > 40 && sy < h - 40) return;
  const cx = Math.min(w - 44, Math.max(44, sx));
  let cy = Math.min(h - 44, Math.max(44, sy));
  // Keep the arrow clear of the mission panel (top-left) and the status
  // cluster (top-right), whose text it would otherwise print over.
  if (cx < 392 && cy < 112) cy = 112;
  if (cx > w - 392 && cy < 132) cy = 132;
  if (cx < 208 && cy > h - 128) cy = h - 128; // The speedometer owns that corner.
  const angle = Math.atan2(sy - cy, sx - cx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const d = Math.round(distance(state.player.x, state.player.y, objective.x, objective.y) / 10);
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${d} m`, cx, cy + 26);
}

/** The BUSTED progress bar while an officer has the player pinned. */
function drawBustMeter(ctx, state, w, h) {
  const meter = state.player.bustMeter;
  if (meter <= 0.04) return;
  ctx.fillStyle = PANEL;
  panel(ctx, w / 2 - 110, h - 190, 220, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#e5484d';
  ctx.fillRect(w / 2 - 102, h - 182, 204 * Math.min(1, meter / 1.6), 14);
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BUSTED', w / 2, h - 150);
}

/** A menu button; records itself for click routing and reports hover. */
function button(ctx, hud, id, label, x, y, w2, mouse, primary = false) {
  const hover = mouse.x >= x && mouse.x <= x + w2 && mouse.y >= y && mouse.y <= y + 46;
  ctx.fillStyle = primary ? (hover ? '#ffdf6b' : GOLD) : hover ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)';
  panel(ctx, x, y, w2, 46, 9);
  ctx.fill();
  ctx.fillStyle = primary ? '#26221a' : WHITE;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w2 / 2, y + 29);
  hud.buttons.push({ id, x, y, w: w2, h: 46 });
  return hover;
}

/** A dim full-screen wash behind menus. */
function dim(ctx, w, h, alpha) {
  ctx.fillStyle = `rgba(10,12,18,${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

/** The title screen: the game's name over the living city. */
function drawTitle(ctx, state, w, h, hud) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(16,10,24,0.55)');
  grad.addColorStop(0.55, 'rgba(16,10,24,0.25)');
  grad.addColorStop(1, 'rgba(16,10,24,0.66)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb03a';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('P O R T   A Z U R A', w / 2, h * 0.24);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 16;
  ctx.fillText('HEATWAVE', w / 2, h * 0.24 + 82);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(245,242,234,0.92)';
  ctx.font = '16.5px system-ui, sans-serif';
  ctx.fillText('Milo Vane owes fixer Dalia Reyes $2,000. Five jobs stand between him and a clean slate —', w / 2, h * 0.24 + 122);
  ctx.fillText('in a sun-soaked city of stealable cars, watchful police and long afternoon shadows.', w / 2, h * 0.24 + 146);
  const bx = w / 2 - 130;
  let by = h * 0.24 + 178;
  button(ctx, hud, 'new', 'NEW GAME', bx, by, 260, state.mouse, true);
  by += 58;
  if (state.hasSave) {
    button(ctx, hud, 'continue', 'CONTINUE', bx, by, 260, state.mouse);
    by += 58;
  }
  button(ctx, hud, 'help', 'HOW TO PLAY', bx, by, 260, state.mouse);
  ctx.fillStyle = 'rgba(245,242,234,0.6)';
  ctx.font = '12.5px system-ui, sans-serif';
  ctx.fillText('WASD drive · E enter car · mouse aim, click shoot · Esc pause · M mute', w / 2, h - 30);
}

/** The help overlay: controls and how Port Azura works. */
function drawHelp(ctx, state, w, h, hud) {
  dim(ctx, w, h, 0.78);
  ctx.fillStyle = PANEL;
  panel(ctx, w / 2 - 330, h / 2 - 240, 660, 480, 14);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('HOW TO PLAY', w / 2, h / 2 - 196);
  ctx.textAlign = 'left';
  ctx.fillStyle = WHITE;
  ctx.font = '15px system-ui, sans-serif';
  const lines = [
    ['Move / drive', 'W A S D or arrow keys — Shift sprints on foot'],
    ['Enter / exit car', 'E, beside any car. Traffic drivers bail out; parked cars are quieter'],
    ['Combat', 'On foot: aim with the mouse, hold click to fire your pistol'],
    ['Handbrake', 'Space — slide the car, throw dust, break a pursuit line'],
    ['Horn', 'H — purely for joy'],
    ['Wanted ★', 'Crimes witnessed raise your stars. Break line of sight and lie low'],
    ['', 'to shed them, or hold still at Sunset Garage for fresh plates ($150)'],
    ['Busted / wasted', 'Pinned by police or out of health costs cash and a trip across town'],
    ['The work', 'Follow the gold beacon. Five jobs pay off the debt; then deliveries'],
    ['', "and Rusty's $60-a-car chop shop keep the money coming, forever"],
    ['Save', 'The game saves after every job. Pause (Esc) to save by hand'],
  ];
  let ly = h / 2 - 158;
  for (const [key, text] of lines) {
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(key, w / 2 - 296, ly);
    ctx.fillStyle = WHITE;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(text, w / 2 - 168, ly);
    ly += 27;
  }
  button(ctx, hud, 'back', 'BACK', w / 2 - 90, h / 2 + 168, 180, state.mouse, true);
}

/** The pause menu. */
function drawPause(ctx, state, w, h, hud) {
  dim(ctx, w, h, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = WHITE;
  ctx.font = '900 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h / 2 - 170);
  const bx = w / 2 - 130;
  let by = h / 2 - 130;
  button(ctx, hud, 'resume', 'RESUME', bx, by, 260, state.mouse, true);
  by += 58;
  button(ctx, hud, 'save', 'SAVE GAME', bx, by, 260, state.mouse);
  by += 58;
  button(ctx, hud, 'mute', state.audio.isMuted() ? 'SOUND: OFF' : 'SOUND: ON', bx, by, 260, state.mouse);
  by += 58;
  button(ctx, hud, 'restart', 'RESTART STORY', bx, by, 260, state.mouse);
  by += 58;
  button(ctx, hud, 'title', 'QUIT TO TITLE', bx, by, 260, state.mouse);
}

/** The BUSTED and WASTED screens. */
function drawEndScreen(ctx, state, w, h, hud, kind) {
  const isBusted = kind === 'busted';
  const flash = isBusted && Math.sin(state.time * 7) > 0;
  ctx.fillStyle = isBusted
    ? flash ? 'rgba(120,20,20,0.55)' : 'rgba(16,26,80,0.55)'
    : 'rgba(70,10,14,0.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 76px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 14;
  ctx.fillText(isBusted ? 'BUSTED' : 'WASTED', w / 2, h / 2 - 40);
  ctx.shadowBlur = 0;
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(245,242,234,0.92)';
  ctx.fillText(
    isBusted
      ? `The PAPD take $${state.lastFine} for their trouble. You walk out of Port Azura PD with nothing but the sun.`
      : `Azura General patches you up and bills $${state.lastFine}. The city keeps your car.`,
    w / 2, h / 2 + 6,
  );
  button(ctx, hud, 'continue-after-end', 'CONTINUE', w / 2 - 110, h / 2 + 40, 220, state.mouse, true);
}

/**
 * Create the HUD for a canvas. `draw(state)` paints whichever overlay the
 * game's screen calls for and refreshes `buttons` for click routing.
 */
export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  const hud = {
    buttons: [],
    draw(state) {
      hud.buttons = [];
      const w = canvas.width;
      const h = canvas.height;
      if (state.screen === 'title') {
        drawTitle(ctx, state, w, h, hud);
        return;
      }
      if (state.screen === 'help') {
        drawTitle(ctx, state, w, h, hud);
        hud.buttons = [];
        drawHelp(ctx, state, w, h, hud);
        return;
      }
      drawPlayHud(ctx, state, w, h);
      if (state.screen === 'pause') drawPause(ctx, state, w, h, hud);
      if (state.screen === 'busted') drawEndScreen(ctx, state, w, h, hud, 'busted');
      if (state.screen === 'wasted') drawEndScreen(ctx, state, w, h, hud, 'wasted');
    },
  };
  return hud;
}
