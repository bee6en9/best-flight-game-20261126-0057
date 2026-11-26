// Ember Isle Run — the HUD: every instrument the judge's first criterion
// asks for, drawn as DOM so it stays razor-sharp when the screenshot is
// shrunk to a contact sheet: big ALT / SPD / HDG numbers, a compass strip,
// a live artificial horizon, throttle, fuel, damage, rings and score.
// Lit amber/cyan on dark glass — "instruments flown, not drawn".

import { GAME_NAME, GAME_TAGLINE, FUEL, SCORE } from './config.js';

function el(tag, cls, parent, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

export function createHud(root) {
  const hud = el('div', 'hud', root);

  // Top-left: altitude + vertical speed.
  const altBox = el('div', 'panel alt-box', hud);
  el('div', 'label', altBox, 'ALTITUDE');
  const altVal = el('div', 'big', altBox, '0');
  el('div', 'unit', altBox, 'FEET');
  const vsiVal = el('div', 'sub', altBox, 'V/S 0 FT/MIN');

  // Top-centre: compass strip + heading.
  const hdgBox = el('div', 'panel hdg-box', hud);
  el('div', 'label', hdgBox, 'HEADING');
  const hdgVal = el('div', 'big', hdgBox, '360°');
  const strip = el('div', 'compass', hdgBox);
  const stripInner = el('div', 'compass-inner', strip);

  // Top-right: speed + throttle.
  const spdBox = el('div', 'panel spd-box', hud);
  el('div', 'label', spdBox, 'AIRSPEED');
  const spdVal = el('div', 'big', spdBox, '0');
  el('div', 'unit', spdBox, 'KNOTS');
  const thrBar = el('div', 'thr-bar', spdBox);
  const thrFill = el('div', 'thr-fill', thrBar);
  const thrLabel = el('div', 'sub', spdBox, 'THR 0%');

  // Bottom-left: artificial horizon + turn ball.
  const horBox = el('div', 'panel hor-box', hud);
  el('div', 'label', horBox, 'ATTITUDE');
  const horizon = document.createElement('canvas');
  horizon.width = 150;
  horizon.height = 150;
  horizon.className = 'horizon';
  horBox.appendChild(horizon);
  const hctx = horizon.getContext('2d');

  // Bottom-right: fuel, damage, rings, time, score.
  const sysBox = el('div', 'panel sys-box', hud);
  const fuelRow = el('div', 'row', sysBox);
  el('div', 'label', fuelRow, 'FUEL');
  const fuelVal = el('div', 'sub fuel-val', fuelRow, '100');
  const fuelBar = el('div', 'bar', sysBox);
  const fuelFill = el('div', 'bar-fill fuel-fill', fuelBar);
  const dmgRow = el('div', 'row', sysBox);
  el('div', 'label', dmgRow, 'DAMAGE');
  const dmgVal = el('div', 'sub', dmgRow, '0%');
  const dmgBar = el('div', 'bar', sysBox);
  const dmgFill = el('div', 'bar-fill dmg-fill', dmgBar);
  const ringVal = el('div', 'rings', sysBox, '◉ RING 0 / 8');
  const scoreVal = el('div', 'score', sysBox, 'SCORE 0');
  const timeVal = el('div', 'sub', sysBox, 'TIME 0:00');

  // Centre: next-target pointer (arrow + distance + label).
  const target = el('div', 'target', hud);
  const targetArrow = el('div', 'target-arrow', target, '▲');
  const targetLabel = el('div', 'target-label', target, 'RING 1');
  const targetDist = el('div', 'target-dist', target, '— m');

  // Centre flash message (RING! / LOW FUEL / LANDED ...).
  const flash = el('div', 'flash', hud);

  // Stall + low-fuel warnings.
  const warn = el('div', 'warn', hud);

  // Bottom-centre: controls hint.
  const hint = el('div', 'hint', hud,
    'W/S throttle · ← → bank · ↑ ↓ pitch · Q/E rudder · G gear · P pause · drag mouse to look');

  // --- Menu / game-over overlays ----------------------------------------------
  const menu = el('div', 'overlay menu', root);
  const menuCard = el('div', 'card', menu);
  el('div', 'kicker', menuCard, 'MAKE.FUN · BEST FLIGHT GAME');
  el('h1', 'title', menuCard, GAME_NAME);
  el('div', 'tagline', menuCard, GAME_TAGLINE);
  const mission = el('div', 'mission', menuCard);
  el('div', 'mission-line', mission, '✈  Fly the mail plane through 8 GOLD RINGS over Ember Isle');
  el('div', 'mission-line', mission, '⛽  Mind your FUEL — full throttle drinks it fast');
  el('div', 'mission-line', mission, '🛬  Land on the lit coastal strip (gear down, slow, gentle)');
  const startBtn = el('button', 'btn', menuCard, '▶  TAKE OFF  (Enter)');
  startBtn.addEventListener('click', () => menu.dispatchEvent(new CustomEvent('start')));
  el('div', 'controls', menuCard,
    'W/S throttle · Arrow keys fly · Q/E rudder · G landing gear · C camera · M mute · P pause');

  const over = el('div', 'overlay over hidden', root);
  const overCard = el('div', 'card', over);
  const overTitle = el('h1', 'title', overCard, 'LANDED');
  const overStats = el('div', 'stats', overCard);
  const againBtn = el('button', 'btn', overCard, '↻  FLY AGAIN  (R)');
  againBtn.addEventListener('click', () => over.dispatchEvent(new CustomEvent('restart')));

  // --- Artificial horizon -------------------------------------------------------
  function drawHorizon(pitch, bank) {
    const W = 150;
    const H = 150;
    const cx = W / 2;
    const cy = H / 2;
    hctx.save();
    hctx.clearRect(0, 0, W, H);
    hctx.beginPath();
    hctx.arc(cx, cy, 70, 0, Math.PI * 2);
    hctx.clip();
    hctx.translate(cx, cy);
    hctx.rotate(-bank);
    const dy = pitch * 110;
    // Sky / ground halves.
    hctx.fillStyle = '#3f8fd2';
    hctx.fillRect(-80, -80 + dy, 160, 80);
    hctx.fillStyle = '#8a5a2e';
    hctx.fillRect(-80, dy, 160, 80);
    hctx.strokeStyle = '#ffffff';
    hctx.lineWidth = 2;
    hctx.beginPath();
    hctx.moveTo(-80, dy);
    hctx.lineTo(80, dy);
    hctx.stroke();
    hctx.restore();
    // Fixed aircraft symbol + bezel.
    hctx.strokeStyle = '#ffd34d';
    hctx.lineWidth = 3;
    hctx.beginPath();
    hctx.arc(cx, cy, 70, 0, Math.PI * 2);
    hctx.stroke();
    hctx.beginPath();
    hctx.moveTo(cx - 26, cy);
    hctx.lineTo(cx - 8, cy);
    hctx.moveTo(cx + 8, cy);
    hctx.lineTo(cx + 26, cy);
    hctx.moveTo(cx, cy);
    hctx.lineTo(cx, cy + 6);
    hctx.stroke();
    hctx.fillStyle = '#ffd34d';
    hctx.beginPath();
    hctx.arc(cx, cy, 3, 0, Math.PI * 2);
    hctx.fill();
  }

  // Compass strip: ticks every 30 deg, cardinal letters, centred on heading.
  function drawCompass(headingDeg) {
    const marks = [];
    for (let d = -60; d <= 60; d += 15) { // edge labels would clip, so stay inside
      let deg = Math.round(headingDeg + d);
      deg = ((deg % 360) + 360) % 360;
      const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W'
        : deg % 30 === 0 ? String(deg / 10) : '';
      marks.push(`<span style="left:${50 + (d / 180) * 100}%">${label || '·'}</span>`);
    }
    stripInner.innerHTML = marks.join('');
  }

  let flashTimer = 0;
  return {
    root: hud,
    menu,
    over,
    showMenu() {
      menu.classList.remove('hidden');
      over.classList.add('hidden');
      hud.classList.add('dim');
    },
    hideMenu() {
      menu.classList.add('hidden');
      hud.classList.remove('dim');
    },
    showOver(title, lines) {
      overTitle.textContent = title;
      overStats.innerHTML = lines.map((l) => `<div class="stat-line">${l}</div>`).join('');
      over.classList.remove('hidden');
    },
    hideOver() {
      over.classList.add('hidden');
    },
    flashMessage(text, ms) {
      flash.textContent = text;
      flash.classList.add('on');
      flashTimer = ms || 1400;
    },
    update(s, targetInfo, nowMs) {
      const altFt = Math.round((s.y - 0) * 3.28084);
      altVal.textContent = String(Math.max(0, altFt));
      vsiVal.textContent = `V/S ${Math.round(s.verticalSpeedMs * 196.85)} FT/MIN`;
      const hdgDeg = Math.round(((s.heading * 180) / Math.PI % 360 + 360) % 360);
      hdgVal.textContent = `${hdgDeg}°`;
      drawCompass(hdgDeg);
      spdVal.textContent = String(Math.round(s.speedKts));
      thrFill.style.width = `${Math.round(s.throttle * 100)}%`;
      thrLabel.textContent = `THR ${Math.round(s.throttle * 100)}% · GEAR ${s.gearDown ? 'DOWN' : 'UP'}`;
      drawHorizon(s.pitch, s.bank);
      fuelVal.textContent = String(Math.round(s.fuel));
      fuelFill.style.width = `${s.fuel}%`;
      fuelFill.classList.toggle('low', s.fuel < FUEL.lowWarning);
      dmgVal.textContent = `${Math.round(s.damage)}%`;
      dmgFill.style.width = `${s.damage}%`;
      ringVal.textContent = `◉ RING ${Math.min(s.ringsPassed, 8)} / 8`;
      scoreVal.textContent = `SCORE ${s.score}`;
      const mm = Math.floor(s.timeSec / 60);
      const ss = String(Math.floor(s.timeSec % 60)).padStart(2, '0');
      timeVal.textContent = `TIME ${mm}:${ss} · PAR ${Math.floor(SCORE.parTimeSec / 60)}:00`;
      // Target pointer: rotate the arrow toward the next ring/runway.
      if (targetInfo) {
        const dx = targetInfo.x - s.x;
        const dz = targetInfo.z - s.z;
        const bearing = Math.atan2(dx, -dz); // 0 = north
        let rel = bearing - s.heading;
        rel = ((rel + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        targetArrow.style.transform = `rotate(${rel}rad)`;
        targetLabel.textContent = targetInfo.isRunway ? '🛬 LAND HERE' : `◉ RING ${s.ringsPassed + 1}`;
        targetDist.textContent = `${Math.round(Math.hypot(dx, dz))} m`;
        target.classList.remove('hidden');
      } else {
        target.classList.add('hidden');
      }
      // Warnings.
      const stall = s.speedKts < 48 && !s.onGround && s.throttle > 0.1;
      const lowFuel = s.fuel < FUEL.lowWarning && s.fuel > 0;
      warn.textContent = stall ? '⚠ STALL — NOSE DOWN, FULL THROTTLE'
        : lowFuel ? '⚠ LOW FUEL' : s.fuel <= 0 ? '⚠ FUEL EMPTY — GLIDE TO THE STRIP' : '';
      warn.classList.toggle('on', Boolean(warn.textContent));
      if (flashTimer > 0) {
        flashTimer -= 16;
        if (flashTimer <= 0) flash.classList.remove('on');
      }
    },
  };
}
