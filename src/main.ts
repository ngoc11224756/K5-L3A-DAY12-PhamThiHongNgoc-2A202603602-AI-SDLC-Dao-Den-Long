import './style.css';
import { defaultInputState, distXZ, DT, TICK_RATE, TUNING } from './core/config.ts';
import { GameSimulation } from './core/simulation.ts';
import { SoundEffects } from './render/audio.ts';
import { GameSceneRenderer } from './render/scene.ts';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const valFlames = document.getElementById('val-flames')!;
const valMotes = document.getElementById('val-motes')!;
const valLanterns = document.getElementById('val-lanterns')!;
const valTime = document.getElementById('val-time')!;
const valScore = document.getElementById('val-score')!;
const valPulse = document.getElementById('val-pulse')!;
const valAudio = document.getElementById('val-audio')!;
const hudPrompt = document.getElementById('hud-prompt')!;
const overlay = document.getElementById('overlay')!;
const overlayTitle = document.getElementById('overlay-title')!;
const overlaySubtitle = document.getElementById('overlay-subtitle')!;
const overlayStats = document.getElementById('overlay-stats')!;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;

const renderer = new GameSceneRenderer(canvas);
const sfx = new SoundEffects();

let seedCounter = 101;
let sim = new GameSimulation(seedCounter, 1);
let camYawDeg = 0;

const keys = new Set<string>();
let isDragging = false;
let lastMouseX = 0;

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
  if (code === 'KeyM') {
    sfx.muted = !sfx.muted;
    valAudio.textContent = sfx.muted ? 'Âm thanh: Tắt' : 'Âm thanh: Bật';
    return;
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
  if (!isDragging) return;
  const dx = e.clientX - lastMouseX;
  lastMouseX = e.clientX;
  camYawDeg = (camYawDeg - dx * 0.35 + 360) % 360;
});

function restartGame(): void {
  seedCounter += 1;
  sim = new GameSimulation(seedCounter, 1);
  camYawDeg = 0;
  renderer.resetDynamicVisuals();
  overlay.classList.add('hidden');
}

btnRestart.addEventListener('click', restartGame);

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function updateHud(): void {
  valFlames.textContent = sim.player.flames > 0 ? '🔥'.repeat(sim.player.flames) : '💨';
  valMotes.textContent = `${sim.player.carried} / ${TUNING.carry_capacity}`;
  const litCount = sim.lanterns.filter((l) => l.lit).length;
  valLanterns.textContent = `${litCount} / ${sim.lanterns.length}`;
  valTime.textContent = formatTime(sim.timeLeftS);
  valScore.textContent = String(sim.score);

  if (sim.pulseCooldownTicks > 0) {
    valPulse.textContent = `${(sim.pulseCooldownTicks / TICK_RATE).toFixed(1)}s`;
  } else if (sim.player.carried < TUNING.pulse_cost) {
    valPulse.textContent = 'Cần 1 đom đóm';
  } else {
    valPulse.textContent = 'Sẵn sàng';
  }

  // Contextual prompt
  const nearUnlit = sim.lanterns.find(
    (l) => !l.lit && distXZ(sim.player.pos, l.pos) <= TUNING.interact_radius
  );
  if (sim.state === 'playing' && nearUnlit && sim.player.carried > 0) {
    hudPrompt.textContent = `Nhấn [E] để nạp ánh sáng vào ${nearUnlit.id} (${nearUnlit.deposited}/${TUNING.lantern_cost})`;
    hudPrompt.classList.remove('hidden');
  } else if (sim.state === 'playing' && nearUnlit && sim.player.carried === 0) {
    hudPrompt.textContent = `${nearUnlit.id} cần thêm ${TUNING.lantern_cost - nearUnlit.deposited} đom đóm để thắp sáng`;
    hudPrompt.classList.remove('hidden');
  } else {
    hudPrompt.classList.add('hidden');
  }
}

function showGameOver(result: string, reason: string): void {
  overlay.classList.remove('hidden');
  if (result === 'won') {
    overlayTitle.textContent = 'Đảo Bến Đã Sáng Trở Lại!';
    overlaySubtitle.textContent =
      'Mây đã thắp sáng toàn bộ 5 Đèn Lồng Lớn và đẩy lùi sương đen khỏi đảo.';
    sfx.playWin();
  } else {
    overlayTitle.textContent = 'Ánh Sáng Đã Tắt...';
    overlaySubtitle.textContent =
      reason === 'dawn'
        ? 'Đêm đã tàn trước khi tất cả Đèn Lồng Lớn được thắp sáng.'
        : 'Bóng Mực đã dập tắt hết ngọn lửa của Mây.';
    sfx.playLose();
  }
  const litCount = sim.lanterns.filter((l) => l.lit).length;
  overlayStats.innerHTML = `
    <div>Điểm số: <b>${sim.score}</b></div>
    <div>Đèn đã thắp: <b>${litCount} / ${sim.lanterns.length}</b></div>
    <div>Thời gian còn lại: <b>${formatTime(sim.timeLeftS)}</b></div>
  `;
}

let lastTime = performance.now();
let accumulator = 0;

function animate(now: number): void {
  const frameDt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (keys.has('KeyZ')) camYawDeg = (camYawDeg + 135 * frameDt) % 360;
  if (keys.has('KeyC')) camYawDeg = (camYawDeg - 135 * frameDt + 360) % 360;

  if (sim.state === 'playing') {
    accumulator += frameDt;
    while (accumulator >= DT && sim.state === 'playing') {
      const input = defaultInputState();
      // Camera looks along (+sin(yaw), +cos(yaw)), left is (+cos(yaw), -sin(yaw))
      let moveZ = 0;
      let moveX = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX += 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) moveX -= 1;

      input.move = [moveX, moveZ];
      input.cam_yaw_deg = camYawDeg;
      input.jump = keys.has('Space');
      input.interact = keys.has('KeyE');
      input.pulse = keys.has('KeyQ') || keys.has('KeyF');

      const events = sim.step(input);
      for (const ev of events) {
        if (ev.name === 'mote_picked') {
          sfx.playPickup(Number(ev.data.carried ?? 1));
        } else if (ev.name === 'deposit') {
          sfx.playDeposit();
        } else if (ev.name === 'lantern_lit') {
          sfx.playLanternLit();
          const lit = sim.lanterns.find((l) => l.id === ev.data.lantern_id);
          if (lit) {
            renderer.spawnSkyLantern(lit.pos);
            renderer.spawnSkyLantern([lit.pos[0] + 0.6, 0, lit.pos[2] - 0.5]);
          }
        } else if (ev.name === 'pulse') {
          sfx.playPulse();
          renderer.triggerPulseVfx(sim.player.pos);
        } else if (ev.name === 'player_hit') {
          sfx.playHit();
        } else if (ev.name === 'game_over') {
          showGameOver(String(ev.data.result), String(ev.data.reason));
        }
      }

      accumulator -= DT;
    }
  }

  updateHud();
  renderer.render(sim, camYawDeg, frameDt);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
