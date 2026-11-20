import './style.css';
import { defaultInputState, distXZ, DT, TICK_RATE, TUNING } from './core/config.ts';
import { GameSimulation } from './core/simulation.ts';
import type { NightId } from './core/types.ts';
import { SoundEffects } from './render/audio.ts';
import { GameSceneRenderer } from './render/scene.ts';

interface Settings {
  volume: number; // 0..1
  sensitivity: number; // 0.1..1.0
}

const SETTINGS_KEY = 'dao-den-long-settings-v1';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.6,
        sensitivity:
          typeof parsed.sensitivity === 'number'
            ? Math.max(0.1, Math.min(1, parsed.sensitivity))
            : 0.35
      };
    }
  } catch {
    // ignore storage errors
  }
  return { volume: 0.6, sensitivity: 0.35 };
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore storage errors
  }
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hud = document.getElementById('hud')!;
const valFlames = document.getElementById('val-flames')!;
const valNightName = document.getElementById('val-night-name')!;
const valTime = document.getElementById('val-time')!;
const valWind = document.getElementById('val-wind')!;
const valLanterns = document.getElementById('val-lanterns')!;
const valScore = document.getElementById('val-score')!;
const valCharm = document.getElementById('val-charm')!;
const valDash = document.getElementById('val-dash')!;
const valPulse = document.getElementById('val-pulse')!;
const moteBar = document.getElementById('mote-bar')!;
const hudPrompt = document.getElementById('hud-prompt')!;
const hudToast = document.getElementById('hud-toast')!;
const offscreenArrow = document.getElementById('offscreen-arrow')!;

const menuOverlay = document.getElementById('menu-overlay')!;
const introOverlay = document.getElementById('intro-overlay')!;
const introTitle = document.getElementById('intro-title')!;
const introQuote = document.getElementById('intro-quote')!;
const pauseOverlay = document.getElementById('pause-overlay')!;
const settingsOverlay = document.getElementById('settings-overlay')!;
const resultOverlay = document.getElementById('result-overlay')!;
const resultTitle = document.getElementById('result-title')!;
const resultSubtitle = document.getElementById('result-subtitle')!;
const resultStats = document.getElementById('result-stats')!;
const btnResultPrimary = document.getElementById('btn-result-primary') as HTMLButtonElement;

const inputVolume = document.getElementById('input-volume') as HTMLInputElement;
const lblVolume = document.getElementById('lbl-volume')!;
const inputSens = document.getElementById('input-sens') as HTMLInputElement;
const lblSens = document.getElementById('lbl-sens')!;

// Build 10 mote slots
const moteSlots: HTMLDivElement[] = [];
for (let i = 0; i < TUNING.carry_capacity; i++) {
  const slot = document.createElement('div');
  slot.className = 'mote-slot';
  moteBar.appendChild(slot);
  moteSlots.push(slot);
}

const renderer = new GameSceneRenderer(canvas);
const sfx = new SoundEffects();
let settings = loadSettings();
sfx.volume = settings.volume;

function syncSettingsUI(): void {
  inputVolume.value = String(Math.round(settings.volume * 100));
  lblVolume.textContent = `${Math.round(settings.volume * 100)}%`;
  inputSens.value = String(Math.round(settings.sensitivity * 100));
  lblSens.textContent = settings.sensitivity.toFixed(2);
}
syncSettingsUI();

type ScreenMode = 'menu' | 'intro' | 'playing' | 'paused' | 'result';
let screenMode: ScreenMode = 'menu';
let settingsReturnTo: 'menu' | 'paused' = 'menu';

let currentNight: NightId = 1;
let totalCampaignScore = 0;
let seedCounter = 2026;
let sim = new GameSimulation(seedCounter, 1);
let camYawDeg = 0;
let lastCountdownSec = 11;
let wasWindWarn = false;

const keys = new Set<string>();
let pendingPauseToggle = false;
let queuedJump = false;
let queuedInteract = false;
let queuedPulse = false;
let queuedDash = false;
let toastTimer: number | null = null;
let isDragging = false;
let lastMouseX = 0;

function showToast(msg: string): void {
  hudToast.textContent = msg;
  hudToast.classList.remove('hidden');
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    hudToast.classList.add('hidden');
  }, 2400);
}

function showOnlyOverlay(target: HTMLElement | null): void {
  [menuOverlay, introOverlay, pauseOverlay, settingsOverlay, resultOverlay].forEach((el) =>
    el.classList.add('hidden')
  );
  if (target) target.classList.remove('hidden');
}

function openNightIntro(night: NightId, resetCampaign = false): void {
  if (resetCampaign) totalCampaignScore = 0;
  currentNight = night;
  seedCounter += 1;
  sim = new GameSimulation(seedCounter, currentNight);
  camYawDeg = 0;
  lastCountdownSec = 11;
  wasWindWarn = false;
  renderer.resetDynamicVisuals();

  introTitle.textContent = sim.map.name;
  introQuote.textContent = sim.map.introQuote;
  hud.classList.add('hidden');
  screenMode = 'intro';
  showOnlyOverlay(introOverlay);
}

function startPlayingNight(): void {
  screenMode = 'playing';
  showOnlyOverlay(null);
  hud.classList.remove('hidden');
  sfx.startAmbient();
}

function openPauseMenu(): void {
  screenMode = 'paused';
  showOnlyOverlay(pauseOverlay);
}

function resumeFromPause(): void {
  screenMode = 'playing';
  showOnlyOverlay(null);
}

function openSettings(from: 'menu' | 'paused'): void {
  settingsReturnTo = from;
  syncSettingsUI();
  showOnlyOverlay(settingsOverlay);
}

function openMainMenu(): void {
  sfx.stopAmbient();
  hud.classList.add('hidden');
  screenMode = 'menu';
  showOnlyOverlay(menuOverlay);
}

function showResultScreen(result: string, reason: string): void {
  screenMode = 'result';
  showOnlyOverlay(resultOverlay);
  const litCount = sim.lanterns.filter((l) => l.lit).length;

  if (result === 'won') {
    totalCampaignScore += sim.score;
    sfx.playWin();
    if (currentNight < 3) {
      resultTitle.textContent = `${sim.map.name} — Hoàn Thành!`;
      resultSubtitle.textContent = 'Ánh đèn đã xua tan sương đen trên đảo. Sẵn sàng sang hòn đảo tiếp theo!';
      btnResultPrimary.textContent = `Sang Đêm ${currentNight + 1}`;
      btnResultPrimary.onclick = () => openNightIntro((currentNight + 1) as NightId, false);
    } else {
      resultTitle.textContent = 'Bình Minh Trên Quần Đảo!';
      resultSubtitle.textContent =
        'Mây đã thắp sáng cả 3 hòn đảo và gọi Bình Minh trở về. Chúc mừng bạn hoàn thành hành trình!';
      btnResultPrimary.textContent = 'Chơi lại từ Đêm 1';
      btnResultPrimary.onclick = () => openNightIntro(1, true);
    }
  } else {
    sfx.playLose();
    resultTitle.textContent = 'Ánh Sáng Đã Tắt...';
    resultSubtitle.textContent =
      reason === 'dawn'
        ? 'Trời đã sáng trước khi tất cả Đèn Lồng Lớn được thắp.'
        : 'Mây đã mất hết Ngọn Lửa.';
    btnResultPrimary.textContent = `Chơi lại Đêm ${currentNight}`;
    btnResultPrimary.onclick = () => openNightIntro(currentNight, false);
  }

  resultStats.innerHTML = `
    <div>Điểm Đêm ${currentNight}: <b>${sim.score}</b></div>
    <div>Tổng điểm hành trình: <b>${totalCampaignScore}</b></div>
    <div>Đèn đã thắp: <b>${litCount} / ${sim.lanterns.length}</b></div>
    <div>Thời gian còn lại: <b>${formatTime(sim.timeLeftS)}</b></div>
  `;
}

// UI bindings
document.getElementById('btn-start-campaign')!.addEventListener('click', () => openNightIntro(1, true));
document.querySelectorAll('.night-pick').forEach((btn) => {
  btn.addEventListener('click', () => {
    const n = Number((btn as HTMLElement).dataset.night) as NightId;
    openNightIntro(n, true);
  });
});
document.getElementById('btn-menu-settings')!.addEventListener('click', () => openSettings('menu'));
document.getElementById('btn-intro-go')!.addEventListener('click', startPlayingNight);
document.getElementById('btn-resume')!.addEventListener('click', () => {
  pendingPauseToggle = true;
  resumeFromPause();
});
document.getElementById('btn-pause-restart')!.addEventListener('click', () => openNightIntro(currentNight, false));
document.getElementById('btn-pause-settings')!.addEventListener('click', () => openSettings('paused'));
document.getElementById('btn-pause-menu')!.addEventListener('click', openMainMenu);
document.getElementById('btn-result-menu')!.addEventListener('click', openMainMenu);

inputVolume.addEventListener('input', () => {
  settings.volume = Number(inputVolume.value) / 100;
  sfx.volume = settings.volume;
  lblVolume.textContent = `${inputVolume.value}%`;
});
inputSens.addEventListener('input', () => {
  settings.sensitivity = Number(inputSens.value) / 100;
  lblSens.textContent = settings.sensitivity.toFixed(2);
});
document.getElementById('btn-settings-close')!.addEventListener('click', () => {
  saveSettings(settings);
  if (settingsReturnTo === 'menu') showOnlyOverlay(menuOverlay);
  else showOnlyOverlay(pauseOverlay);
});

// Keyboard & mouse controls
window.addEventListener('keydown', (e) => {
  const code = e.code;
  if (
    code === 'ArrowUp' ||
    code === 'ArrowDown' ||
    code === 'ArrowLeft' ||
    code === 'ArrowRight' ||
    code === 'Space'
  ) {
    e.preventDefault();
  }
  if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
    if (screenMode === 'playing') {
      pendingPauseToggle = true;
      openPauseMenu();
      return;
    }
    if (screenMode === 'paused' && settingsOverlay.classList.contains('hidden')) {
      pendingPauseToggle = true;
      resumeFromPause();
      return;
    }
  }
  if (!e.repeat && screenMode === 'playing') {
    if (code === 'Space') queuedJump = true;
    if (code === 'KeyE') queuedInteract = true;
    if (code === 'KeyQ' || code === 'KeyF') queuedPulse = true;
    if (code === 'ShiftLeft' || code === 'ShiftRight') queuedDash = true;
  }
  keys.add(code);
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  lastMouseX = e.clientX;
});
window.addEventListener('mouseup', () => {
  isDragging = false;
});
window.addEventListener('mousemove', (e) => {
  if (!isDragging || screenMode !== 'playing') return;
  const dx = e.clientX - lastMouseX;
  lastMouseX = e.clientX;
  camYawDeg = (camYawDeg - dx * settings.sensitivity + 360) % 360;
});

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function updateHud(): void {
  valFlames.textContent = sim.player.flames > 0 ? '🔥'.repeat(sim.player.flames) : '💨';
  valNightName.textContent = sim.map.name;
  valTime.textContent = formatTime(sim.timeLeftS);
  valTime.classList.toggle('timer-danger', sim.timeLeftS <= 30);

  const litCount = sim.lanterns.filter((l) => l.lit).length;
  valLanterns.textContent = `${litCount}/${sim.lanterns.length}`;
  valScore.textContent = String(sim.score);

  // 10-slot mote bar
  for (let i = 0; i < moteSlots.length; i++) {
    moteSlots[i].classList.toggle('filled', i < sim.player.carried);
  }

  // Wind badge
  if (sim.wind.active) {
    valWind.textContent = `Gió mạnh (${Math.round(sim.wind.dir_deg)}°)`;
    valWind.classList.remove('hidden');
  } else if (sim.wind.warning) {
    valWind.textContent = 'Sắp có gió mạnh!';
    valWind.classList.remove('hidden');
  } else {
    valWind.classList.add('hidden');
  }

  // Charm badge
  if (sim.charmTicks > 0) {
    valCharm.textContent = `Bùa Gió: ${(sim.charmTicks / TICK_RATE).toFixed(1)}s`;
    valCharm.classList.remove('hidden');
  } else {
    valCharm.classList.add('hidden');
  }

  // Dash & Pulse cooldowns
  if (sim.charmTicks > 0) {
    valDash.textContent = 'Không hồi chiêu';
  } else if (sim.dashCdTicks > 0) {
    valDash.textContent = `${(sim.dashCdTicks / TICK_RATE).toFixed(1)}s`;
  } else {
    valDash.textContent = 'Sẵn sàng';
  }

  if (sim.pulseCdTicks > 0) {
    valPulse.textContent = `${(sim.pulseCdTicks / TICK_RATE).toFixed(1)}s`;
  } else if (sim.player.carried < TUNING.pulse_cost) {
    valPulse.textContent = `Cần ${TUNING.pulse_cost}`;
  } else {
    valPulse.textContent = 'Sẵn sàng';
  }

  // Contextual prompt
  const nearUnlit = sim.lanterns.find(
    (l) => !l.lit && distXZ(sim.player.pos, l.pos) <= TUNING.interact_radius
  );
  if (sim.state === 'playing' && nearUnlit) {
    hudPrompt.textContent = `E — Nạp ánh sáng (${nearUnlit.deposited}/${TUNING.lantern_cost})`;
    hudPrompt.classList.remove('hidden');
  } else {
    hudPrompt.classList.add('hidden');
  }

  // Off-screen arrow pointing to nearest unlit lantern
  let nearestUnlit = null;
  let bestD = Infinity;
  for (const l of sim.lanterns) {
    if (l.lit) continue;
    const d = distXZ(sim.player.pos, l.pos);
    if (d < bestD) {
      bestD = d;
      nearestUnlit = l;
    }
  }
  if (sim.state === 'playing' && nearestUnlit) {
    const proj = renderer.projectToScreen(nearestUnlit.pos);
    if (!proj.onScreen) {
      let sx = proj.x;
      let sy = proj.y;
      if (!proj.inFront) {
        sx = -sx;
        sy = -sy;
      }
      const angle = Math.atan2(sy, sx);
      const px = (0.5 + Math.cos(angle) * 0.43) * window.innerWidth;
      const py = (0.5 - Math.sin(angle) * 0.38) * window.innerHeight;
      offscreenArrow.style.left = `${px}px`;
      offscreenArrow.style.top = `${py}px`;
      offscreenArrow.style.transform = `translate(-50%, -50%) rotate(${90 - (angle * 180) / Math.PI}deg)`;
      offscreenArrow.classList.remove('hidden');
    } else {
      offscreenArrow.classList.add('hidden');
    }
  } else {
    offscreenArrow.classList.add('hidden');
  }
}

let lastTime = performance.now();
let accumulator = 0;

function animate(now: number): void {
  const frameDt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (screenMode === 'playing') {
    if (keys.has('KeyZ')) camYawDeg = (camYawDeg + 135 * frameDt) % 360;
    if (keys.has('KeyC')) camYawDeg = (camYawDeg - 135 * frameDt + 360) % 360;

    accumulator += frameDt;
    while (accumulator >= DT && screenMode === 'playing') {
      const input = defaultInputState();
      let moveZ = 0;
      let moveX = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX += 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) moveX -= 1;

      const wasGrounded = sim.player.grounded;
      input.move = [moveX, moveZ];
      input.cam_yaw_deg = camYawDeg;
      input.jump = keys.has('Space') || queuedJump;
      input.interact = keys.has('KeyE') || queuedInteract;
      input.pulse = keys.has('KeyQ') || keys.has('KeyF') || queuedPulse;
      input.dash = keys.has('ShiftLeft') || keys.has('ShiftRight') || queuedDash;
      queuedJump = false;
      queuedInteract = false;
      queuedPulse = false;
      queuedDash = false;
      input.pause = pendingPauseToggle;
      pendingPauseToggle = false;

      const events = sim.step(input);
      if (wasGrounded && !sim.player.grounded && sim.player.vel[1] > 0) {
        sfx.playJump();
      }

      if (sim.wind.warning && !wasWindWarn) {
        sfx.playWindWarning();
      }
      wasWindWarn = sim.wind.warning;

      const secLeft = Math.ceil(sim.timeLeftS);
      if (secLeft <= 10 && secLeft > 0 && secLeft < lastCountdownSec) {
        lastCountdownSec = secLeft;
        sfx.playCountdownTick();
      }

      for (const ev of events) {
        if (ev.name === 'mote_picked') sfx.playPickup(Number(ev.data.carried ?? 1));
        else if (ev.name === 'deposit') {
          sfx.playDeposit();
          const dep = Number(ev.data.deposited ?? 0);
          const amt = Number(ev.data.amount ?? 0);
          if (dep < TUNING.lantern_cost) {
            showToast(
              `Đã nạp +${amt} vào ${String(ev.data.lantern_id)} (${dep}/${TUNING.lantern_cost}) · +${amt * TUNING.score.per_mote} điểm`
            );
          }
        } else if (ev.name === 'lantern_lit') {
          sfx.playLanternLit();
          showToast(`✨ ${String(ev.data.lantern_id)} ĐÃ THẮP SÁNG! (+${TUNING.score.per_lantern} điểm)`);
          const lit = sim.lanterns.find((l) => l.id === ev.data.lantern_id);
          if (lit) {
            renderer.spawnSkyLantern(lit.pos);
            renderer.spawnSkyLantern([lit.pos[0] + 0.6, lit.pos[1], lit.pos[2] - 0.5]);
          }
        } else if (ev.name === 'pulse') {
          sfx.playPulse();
          renderer.triggerPulseVfx(sim.player.pos);
        } else if (ev.name === 'dash') sfx.playDash();
        else if (ev.name === 'charm_picked') {
          sfx.playCharm();
          showToast('Bùa Gió kích hoạt! Tốc độ 7.2 m/s & Lướt không hồi chiêu');
        } else if (ev.name === 'drifter_steal') {
          sfx.playDrifterSteal();
          showToast(`Gió Lạc vừa cướp ${String(ev.data.amount)} đom đóm!`);
        } else if (ev.name === 'shade_spawned') sfx.playShadeSpawn();
        else if (ev.name === 'player_hit') sfx.playHit();
        else if (ev.name === 'game_over') {
          showResultScreen(String(ev.data.result), String(ev.data.reason));
        }
      }

      accumulator -= DT;
    }

    updateHud();
  } else if (pendingPauseToggle) {
    // Sync pause state into simulation and release pause edge so Resume works cleanly
    const input = defaultInputState();
    input.pause = true;
    pendingPauseToggle = false;
    sim.step(input);
    sim.step(defaultInputState());
  }

  renderer.render(sim, camYawDeg, frameDt);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
