import './style.css';
import {
  defaultInputState,
  distXZ,
  DT,
  LOW_FUEL_UNITS,
  MAX_FUEL_UNITS,
  TICK_RATE,
  TUNING
} from './core/config.ts';
import {
  formatIsoWithTimezone,
  insertLeaderboardEntry,
  isValidPlayerName,
  sortAndTrimLeaderboard,
  type LeaderboardEntry
} from './core/leaderboard.ts';
import { GameSimulation } from './core/simulation.ts';
import type { NightId, Vec3 } from './core/types.ts';
import { SoundEffects } from './render/audio.ts';
import { GameSceneRenderer } from './render/scene.ts';

type ActionKey =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'jump'
  | 'dash'
  | 'interact'
  | 'pulse'
  | 'pause';

type KeyBindings = Record<ActionKey, string>;

const DEFAULT_KEYS: KeyBindings = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pulse: 'KeyQ',
  pause: 'Escape'
};

const ACTION_LABELS: Record<ActionKey, string> = {
  moveUp: 'Tiến lên',
  moveDown: 'Lùi xuống',
  moveLeft: 'Sang trái',
  moveRight: 'Sang phải',
  jump: 'Nhảy',
  dash: 'Lướt',
  interact: 'Tương tác / Nạp đèn',
  pulse: 'Tỏa Sáng',
  pause: 'Tạm dừng'
};

interface Settings {
  volume: number;
  sensitivity: number;
  colorblind: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  keybinds: KeyBindings;
}

const SETTINGS_KEY = 'dao-den-long-settings-v2';
const LB_LOCAL_KEY = 'dao-den-long-leaderboard-v1';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>;
      return {
        volume: typeof p.volume === 'number' ? Math.max(0, Math.min(1, p.volume)) : 0.6,
        sensitivity:
          typeof p.sensitivity === 'number' ? Math.max(0.1, Math.min(1, p.sensitivity)) : 0.35,
        colorblind: Boolean(p.colorblind),
        reducedMotion: Boolean(p.reducedMotion),
        largeText: Boolean(p.largeText),
        keybinds: { ...DEFAULT_KEYS, ...(p.keybinds ?? {}) }
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    volume: 0.6,
    sensitivity: 0.35,
    colorblind: false,
    reducedMotion: false,
    largeText: false,
    keybinds: { ...DEFAULT_KEYS }
  };
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch('/api/leaderboard');
    if (res.ok) {
      const data = (await res.json()) as { entries?: LeaderboardEntry[] };
      if (Array.isArray(data.entries)) {
        const sorted = sortAndTrimLeaderboard(data.entries);
        localStorage.setItem(LB_LOCAL_KEY, JSON.stringify(sorted));
        return sorted;
      }
    }
  } catch {
    // fallback to localStorage
  }
  try {
    const raw = localStorage.getItem(LB_LOCAL_KEY);
    if (raw) return sortAndTrimLeaderboard(JSON.parse(raw) as LeaderboardEntry[]);
  } catch {
    // ignore
  }
  return [];
}

async function saveLeaderboardScore(entry: LeaderboardEntry): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (res.ok) {
      const data = (await res.json()) as { entries?: LeaderboardEntry[] };
      if (Array.isArray(data.entries)) {
        localStorage.setItem(LB_LOCAL_KEY, JSON.stringify(data.entries));
        return data.entries;
      }
    }
  } catch {
    // fallback to localStorage
  }
  const current = await fetchLeaderboard();
  const updated = insertLeaderboardEntry(current, entry);
  localStorage.setItem(LB_LOCAL_KEY, JSON.stringify(updated));
  return updated;
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new GameSceneRenderer(canvas);

// ============================================================================
// BENCHMARK MODE (?bench=1&seed=42&duration=30)
// ============================================================================
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('bench') === '1') {
  const seed = Number(urlParams.get('seed') ?? '42');
  const durationS = Number(urlParams.get('duration') ?? '30');
  document.getElementById('menu-overlay')!.classList.add('hidden');
  document.getElementById('hud')!.classList.add('hidden');

  const benchSim = GameSimulation.createBenchmark(seed);
  const pageStartMs = performance.now();
  let firstFrameDone = false;
  let loadMs = 0;
  let benchStartMs = 0;
  let lastFrameMs = 0;
  let simAcc = 0;
  const frameDts: number[] = [];
  const WARMUP_MS = 3000;
  const MEASURE_MS = durationS * 1000;

  const tickBench = (now: number): void => {
    if (!firstFrameDone) {
      firstFrameDone = true;
      loadMs = Math.round(now - pageStartMs);
      benchStartMs = now;
      lastFrameMs = now;
      benchSim.stepBenchmark();
      renderer.renderBenchmark(benchSim, 0, DT);
      requestAnimationFrame(tickBench);
      return;
    }

    const dtMs = Math.max(0.01, now - lastFrameMs);
    lastFrameMs = now;
    const elapsedMs = now - benchStartMs;

    simAcc += Math.min(0.1, dtMs / 1000);
    while (simAcc >= DT) {
      benchSim.stepBenchmark();
      simAcc -= DT;
    }
    renderer.renderBenchmark(benchSim, elapsedMs / 1000, dtMs / 1000);

    if (elapsedMs >= WARMUP_MS && elapsedMs < WARMUP_MS + MEASURE_MS) {
      frameDts.push(dtMs);
    }

    if (elapsedMs >= WARMUP_MS + MEASURE_MS) {
      const n = frameDts.length;
      const sumDt = frameDts.reduce((a, b) => a + b, 0);
      const avgFps = n > 0 ? Math.round((1000 * n) / sumDt * 10) / 10 : 0;

      const sortedDesc = [...frameDts].sort((a, b) => b - a);
      const k = Math.max(1, Math.ceil(0.01 * n));
      const worstMean = sortedDesc.slice(0, k).reduce((a, b) => a + b, 0) / k;
      const p1LowFps = worstMean > 0 ? Math.round((1000 / worstMean) * 10) / 10 : 0;

      const sortedAsc = [...frameDts].sort((a, b) => a - b);
      const p95Idx = Math.min(n - 1, Math.max(0, Math.ceil(0.95 * n) - 1));
      const frameMsP95 = n > 0 ? Math.round(sortedAsc[p95Idx] * 10) / 10 : 0;

      void fetch('/bench-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avg_fps: avgFps,
          p1_low_fps: p1LowFps,
          frame_ms_p95: frameMsP95,
          frames: n,
          load_ms: loadMs,
          renderer: renderer.getRendererInfo()
        })
      });
      return;
    }

    requestAnimationFrame(tickBench);
  };

  requestAnimationFrame(tickBench);
} else {
  // ============================================================================
  // NORMAL PLAY MODE
  // ============================================================================
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
  const lblKeyDash = document.getElementById('lbl-key-dash')!;
  const lblKeyPulse = document.getElementById('lbl-key-pulse')!;
  const moteBar = document.getElementById('mote-bar')!;
  const valMoteCount = document.getElementById('val-mote-count')!;
  const hudCaption = document.getElementById('hud-caption')!;
  const hudPrompt = document.getElementById('hud-prompt')!;
  const hudToast = document.getElementById('hud-toast')!;
  const offscreenArrow = document.getElementById('offscreen-arrow')!;
  const shadeArrow = document.getElementById('shade-arrow')!;

  const menuOverlay = document.getElementById('menu-overlay')!;
  const leaderboardOverlay = document.getElementById('leaderboard-overlay')!;
  const leaderboardTableWrap = document.getElementById('leaderboard-table-wrap')!;
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
  const lbSaveBox = document.getElementById('lb-save-box')!;
  const inputPlayerName = document.getElementById('input-player-name') as HTMLInputElement;
  const btnSaveScore = document.getElementById('btn-save-score') as HTMLButtonElement;
  const lbSaveMsg = document.getElementById('lb-save-msg')!;

  const inputVolume = document.getElementById('input-volume') as HTMLInputElement;
  const lblVolume = document.getElementById('lbl-volume')!;
  const inputSens = document.getElementById('input-sens') as HTMLInputElement;
  const lblSens = document.getElementById('lbl-sens')!;
  const inputColorblind = document.getElementById('input-colorblind') as HTMLInputElement;
  const inputReducedMotion = document.getElementById('input-reduced-motion') as HTMLInputElement;
  const inputLargeText = document.getElementById('input-large-text') as HTMLInputElement;
  const keybindList = document.getElementById('keybind-list')!;
  const keybindWarning = document.getElementById('keybind-warning')!;

  const moteSlots: HTMLDivElement[] = [];
  for (let i = 0; i < TUNING.capacity_max; i++) {
    const slot = document.createElement('div');
    slot.className = 'mote-slot';
    moteBar.appendChild(slot);
    moteSlots.push(slot);
  }

  const sfx = new SoundEffects();
  let settings = loadSettings();
  sfx.volume = settings.volume;
  let listeningAction: ActionKey | null = null;

  function applyAccessibility(): void {
    renderer.colorblindMode = settings.colorblind;
    renderer.reducedMotion = settings.reducedMotion;
    document.body.classList.toggle('colorblind', settings.colorblind);
    document.body.classList.toggle('reduced-motion', settings.reducedMotion);
    document.body.classList.toggle('large-text', settings.largeText);
    lblKeyDash.textContent = settings.keybinds.dash.replace('Key', '').replace('Left', '');
    lblKeyPulse.textContent = settings.keybinds.pulse.replace('Key', '');
  }

  function renderKeybindsUI(): void {
    keybindList.innerHTML = '';
    const actions = Object.keys(ACTION_LABELS) as ActionKey[];
    for (const act of actions) {
      const row = document.createElement('div');
      row.className = 'keybind-item';
      const span = document.createElement('span');
      span.textContent = ACTION_LABELS[act];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'keybind-btn';
      btn.textContent = listeningAction === act ? 'Nhấn phím...' : settings.keybinds[act];
      btn.addEventListener('click', () => {
        listeningAction = act;
        keybindWarning.classList.add('hidden');
        renderKeybindsUI();
      });
      row.append(span, btn);
      keybindList.appendChild(row);
    }
  }

  function syncSettingsUI(): void {
    inputVolume.value = String(Math.round(settings.volume * 100));
    lblVolume.textContent = `${Math.round(settings.volume * 100)}%`;
    inputSens.value = String(Math.round(settings.sensitivity * 100));
    lblSens.textContent = settings.sensitivity.toFixed(2);
    inputColorblind.checked = settings.colorblind;
    inputReducedMotion.checked = settings.reducedMotion;
    inputLargeText.checked = settings.largeText;
    applyAccessibility();
    renderKeybindsUI();
  }
  syncSettingsUI();

  type ScreenMode = 'menu' | 'intro' | 'playing' | 'paused' | 'result';
  let screenMode: ScreenMode = 'menu';
  let settingsReturnTo: 'menu' | 'paused' = 'menu';

  let currentNight: NightId = 1;
  let nightsWonCount = 0;
  let totalCampaignScore = 0;
  let campaignSeed = 2026;
  let sim = new GameSimulation(campaignSeed, 1);
  let camYawDeg = 0;
  let lastCountdownSec = 11;
  let wasWindWarn = false;
  let lastShadeSpawnPos: Vec3 | null = null;
  let shadeArrowUntilMs = 0;

  const keys = new Set<string>();
  let pendingPauseToggle = false;
  let queuedJump = false;
  let queuedInteract = false;
  let queuedPulse = false;
  let queuedDash = false;
  let toastTimer: number | null = null;
  let captionTimer: number | null = null;
  let isDragging = false;
  let lastMouseX = 0;

  function showToast(msg: string): void {
    hudToast.textContent = msg;
    hudToast.classList.remove('hidden');
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => hudToast.classList.add('hidden'), 2400);
  }

  function showCaption(msg: string): void {
    const prefix = settings.colorblind ? '⚠ ' : '';
    hudCaption.textContent = `${prefix}${msg}`;
    hudCaption.classList.remove('hidden');
    if (captionTimer !== null) clearTimeout(captionTimer);
    captionTimer = window.setTimeout(() => hudCaption.classList.add('hidden'), 3000);
  }

  function showOnlyOverlay(target: HTMLElement | null): void {
    [menuOverlay, leaderboardOverlay, introOverlay, pauseOverlay, settingsOverlay, resultOverlay].forEach(
      (el) => el.classList.add('hidden')
    );
    if (target) target.classList.remove('hidden');
  }

  function openNightIntro(night: NightId, resetCampaign = false): void {
    if (resetCampaign) {
      totalCampaignScore = 0;
      nightsWonCount = 0;
      campaignSeed += 1;
    }
    currentNight = night;
    sim = new GameSimulation(campaignSeed + night - 1, currentNight);
    camYawDeg = 0;
    lastCountdownSec = 11;
    wasWindWarn = false;
    lastShadeSpawnPos = null;
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
    listeningAction = null;
    keybindWarning.classList.add('hidden');
    syncSettingsUI();
    showOnlyOverlay(settingsOverlay);
  }

  function openMainMenu(): void {
    sfx.stopAmbient();
    hud.classList.add('hidden');
    screenMode = 'menu';
    showOnlyOverlay(menuOverlay);
  }

  async function openLeaderboard(): Promise<void> {
    const entries = await fetchLeaderboard();
    if (entries.length === 0) {
      leaderboardTableWrap.innerHTML = '<p>Chưa có bản ghi nào. Hãy hoàn thành hoặc kết thúc một Đêm để lưu điểm!</p>';
    } else {
      const rows = entries
        .map(
          (e, idx) => `
        <tr>
          <td>#${idx + 1}</td>
          <td><b>${e.name}</b></td>
          <td class="gold"><b>${e.score}</b></td>
          <td>${e.nights_won}/3</td>
          <td>${e.seed}</td>
        </tr>`
        )
        .join('');
      leaderboardTableWrap.innerHTML = `
        <table class="lb-table">
          <thead><tr><th>Hạng</th><th>Tên</th><th>Điểm</th><th>Đêm</th><th>Seed</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }
    showOnlyOverlay(leaderboardOverlay);
  }

  function showResultScreen(result: string, reason: string): void {
    screenMode = 'result';
    showOnlyOverlay(resultOverlay);
    const litCount = sim.lanterns.filter((l) => l.lit).length;
    lbSaveMsg.textContent = '';
    btnSaveScore.disabled = false;

    const showLeaderboardInput = result === 'lost' || (result === 'won' && currentNight === 3);
    lbSaveBox.classList.toggle('hidden', !showLeaderboardInput);

    if (result === 'won') {
      totalCampaignScore += sim.score;
      nightsWonCount = Math.min(3, nightsWonCount + 1);
      sfx.playWin();
      if (currentNight < 3) {
        resultTitle.textContent = `${sim.map.name} — Đón Bình Minh!`;
        resultSubtitle.textContent = 'Đảo đã giữ sáng tới bình minh. Sẵn sàng sang hòn đảo tiếp theo!';
        btnResultPrimary.textContent = `Sang Đêm ${currentNight + 1}`;
        btnResultPrimary.onclick = () => openNightIntro((currentNight + 1) as NightId, false);
      } else {
        resultTitle.textContent = 'Bình Minh Trên Quần Đảo!';
        resultSubtitle.textContent =
          'Mây đã giữ ánh đèn qua cả 3 hòn đảo và gọi Bình Minh trở về!';
        btnResultPrimary.textContent = 'Chơi lại từ Đêm 1';
        btnResultPrimary.onclick = () => openNightIntro(1, true);
      }
    } else {
      sfx.playLose();
      resultTitle.textContent = 'Ánh Sáng Đã Tắt...';
      resultSubtitle.textContent =
        reason === 'dawn'
          ? 'Trời đã sáng nhưng số đèn sáng chưa đủ ngưỡng giữ đảo.'
          : 'Mây đã mất hết Ngọn Lửa.';
      btnResultPrimary.textContent = `Chơi lại Đêm ${currentNight}`;
      btnResultPrimary.onclick = () => openNightIntro(currentNight, false);
    }

    resultStats.innerHTML = `
      <div>Điểm Đêm ${currentNight}: <b>${sim.score}</b></div>
      <div>Tổng điểm hành trình: <b>${totalCampaignScore}</b> (${nightsWonCount}/3 Đêm thắng)</div>
      <div>Đèn đang sáng: <b>${litCount} / ${sim.lanterns.length}</b></div>
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
  document.getElementById('btn-menu-leaderboard')!.addEventListener('click', () => void openLeaderboard());
  document.getElementById('btn-leaderboard-close')!.addEventListener('click', openMainMenu);
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

  btnSaveScore.addEventListener('click', async () => {
    const name = inputPlayerName.value.trim();
    if (!isValidPlayerName(name)) {
      lbSaveMsg.textContent = 'Tên phải dài 3–12 ký tự (chữ, số hoặc _).';
      return;
    }
    btnSaveScore.disabled = true;
    await saveLeaderboardScore({
      name,
      score: totalCampaignScore,
      nights_won: nightsWonCount,
      achieved_at: formatIsoWithTimezone(),
      seed: campaignSeed
    });
    lbSaveMsg.textContent = 'Đã lưu điểm vào Bảng Xếp Hạng!';
  });

  inputVolume.addEventListener('input', () => {
    settings.volume = Number(inputVolume.value) / 100;
    sfx.volume = settings.volume;
    lblVolume.textContent = `${inputVolume.value}%`;
  });
  inputSens.addEventListener('input', () => {
    settings.sensitivity = Number(inputSens.value) / 100;
    lblSens.textContent = settings.sensitivity.toFixed(2);
  });
  inputColorblind.addEventListener('change', () => {
    settings.colorblind = inputColorblind.checked;
    applyAccessibility();
  });
  inputReducedMotion.addEventListener('change', () => {
    settings.reducedMotion = inputReducedMotion.checked;
    applyAccessibility();
  });
  inputLargeText.addEventListener('change', () => {
    settings.largeText = inputLargeText.checked;
    applyAccessibility();
  });
  document.getElementById('btn-reset-keys')!.addEventListener('click', () => {
    settings.keybinds = { ...DEFAULT_KEYS };
    listeningAction = null;
    keybindWarning.classList.add('hidden');
    applyAccessibility();
    renderKeybindsUI();
  });
  document.getElementById('btn-settings-close')!.addEventListener('click', () => {
    listeningAction = null;
    saveSettings(settings);
    if (settingsReturnTo === 'menu') showOnlyOverlay(menuOverlay);
    else showOnlyOverlay(pauseOverlay);
  });

  // Keyboard & mouse controls
  window.addEventListener('keydown', (e) => {
    // Do not intercept typing in leaderboard input
    if (document.activeElement === inputPlayerName) return;

    // Key rebinding capture
    if (listeningAction !== null) {
      e.preventDefault();
      const newCode = e.code;
      const duplicate = (Object.keys(settings.keybinds) as ActionKey[]).find(
        (k) => k !== listeningAction && settings.keybinds[k] === newCode
      );
      if (duplicate) {
        keybindWarning.textContent = `⚠ Phím ${newCode} đang được gán cho "${ACTION_LABELS[duplicate]}". Hãy chọn phím khác!`;
        keybindWarning.classList.remove('hidden');
        return;
      }
      settings.keybinds[listeningAction] = newCode;
      listeningAction = null;
      keybindWarning.classList.add('hidden');
      applyAccessibility();
      renderKeybindsUI();
      return;
    }

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

    const isPauseKey = code === settings.keybinds.pause || code === 'KeyP';
    if (isPauseKey && !e.repeat) {
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
      if (code === settings.keybinds.jump) queuedJump = true;
      if (code === settings.keybinds.interact) queuedInteract = true;
      if (code === settings.keybinds.pulse || code === 'KeyF') queuedPulse = true;
      if (code === settings.keybinds.dash || code === 'ShiftRight') queuedDash = true;
    }
    keys.add(code);
  });

  window.addEventListener('keyup', (e) => keys.delete(e.code));

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
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function positionEdgeArrow(el: HTMLElement, worldPos: Vec3): void {
    const proj = renderer.projectToScreen(worldPos);
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
      el.style.left = `${px}px`;
      el.style.top = `${py}px`;
      el.style.transform = `translate(-50%, -50%) rotate(${90 - (angle * 180) / Math.PI}deg)`;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  let warnedLowFuelIds = new Set<string>();

  function updateHud(now: number): void {
    valFlames.textContent = sim.player.flames > 0 ? '🔥'.repeat(sim.player.flames) : '💨';
    valNightName.textContent = sim.map.name;
    const isDangerTime = sim.timeLeftS <= 30;
    valTime.textContent = `${isDangerTime && settings.colorblind ? '⚠ ' : ''}${formatTime(sim.timeLeftS)}`;
    valTime.classList.toggle('timer-danger', isDangerTime);

    const litCount = sim.lanterns.filter((l) => l.lit).length;
    const neededLit = Math.ceil(TUNING.win_ratio * sim.lanterns.length);
    valLanterns.textContent = `${litCount}/${sim.lanterns.length} (cần ${neededLit})`;
    valScore.textContent = String(sim.score);

    const cap = sim.getCapacity();
    valMoteCount.textContent = `${sim.player.carried} / ${cap}`;
    for (let i = 0; i < moteSlots.length; i++) {
      moteSlots[i].style.display = i < cap ? 'block' : 'none';
      moteSlots[i].classList.toggle('filled', i < sim.player.carried);
    }

    // Low fuel caption alert
    for (const l of sim.lanterns) {
      if (l.lit && l.fuelUnits < LOW_FUEL_UNITS && !warnedLowFuelIds.has(l.id)) {
        warnedLowFuelIds.add(l.id);
        showCaption(`Đèn ${l.id} sắp hết dầu (< 30)!`);
      } else if (!l.lit || l.fuelUnits >= LOW_FUEL_UNITS) {
        warnedLowFuelIds.delete(l.id);
      }
    }

    if (sim.wind.active) {
      valWind.textContent = `Gió mạnh (${Math.round(sim.wind.dir_deg)}°)`;
      valWind.classList.remove('hidden');
    } else if (sim.wind.warning) {
      valWind.textContent = `${settings.colorblind ? '⚠ ' : ''}Sắp có gió mạnh!`;
      valWind.classList.remove('hidden');
    } else {
      valWind.classList.add('hidden');
    }

    if (sim.charmTicks > 0) {
      valCharm.textContent = `Bùa Gió: ${(sim.charmTicks / TICK_RATE).toFixed(1)}s`;
      valCharm.classList.remove('hidden');
    } else {
      valCharm.classList.add('hidden');
    }

    if (sim.charmTicks > 0) valDash.textContent = 'Không hồi chiêu';
    else if (sim.dashCdTicks > 0) valDash.textContent = `${(sim.dashCdTicks / TICK_RATE).toFixed(1)}s`;
    else valDash.textContent = 'Sẵn sàng';

    if (sim.pulseCdTicks > 0) valPulse.textContent = `${(sim.pulseCdTicks / TICK_RATE).toFixed(1)}s`;
    else if (sim.player.carried < TUNING.pulse_cost) valPulse.textContent = `Cần ${TUNING.pulse_cost}`;
    else valPulse.textContent = 'Sẵn sàng';

    const nearLantern = sim.lanterns.find(
      (l) =>
        (!l.lit || l.fuelUnits < MAX_FUEL_UNITS) &&
        distXZ(sim.player.pos, l.pos) <= TUNING.interact_radius
    );
    if (sim.state === 'playing' && nearLantern) {
      const k = settings.keybinds.interact.replace('Key', '');
      if (!nearLantern.lit) {
        const cost = nearLantern.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
        hudPrompt.textContent = `${k} — ${nearLantern.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${nearLantern.deposited}/${cost})`;
      } else {
        const fuel = Math.round((nearLantern.fuelUnits / TICK_RATE) * 10) / 10;
        hudPrompt.textContent = `${k} — Châm dầu ${nearLantern.id} (${fuel}/100)`;
      }
      hudPrompt.classList.remove('hidden');
    } else {
      hudPrompt.classList.add('hidden');
    }

    // Off-screen arrow to nearest unlit lantern
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
      positionEdgeArrow(offscreenArrow, nearestUnlit.pos);
    } else {
      offscreenArrow.classList.add('hidden');
    }

    // Edge arrow to newly spawned shade (for 3 seconds)
    if (sim.state === 'playing' && lastShadeSpawnPos && now < shadeArrowUntilMs) {
      positionEdgeArrow(shadeArrow, lastShadeSpawnPos);
    } else {
      shadeArrow.classList.add('hidden');
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
        if (keys.has(settings.keybinds.moveUp) || keys.has('ArrowUp')) moveZ += 1;
        if (keys.has(settings.keybinds.moveDown) || keys.has('ArrowDown')) moveZ -= 1;
        if (keys.has(settings.keybinds.moveLeft) || keys.has('ArrowLeft')) moveX += 1;
        if (keys.has(settings.keybinds.moveRight) || keys.has('ArrowRight')) moveX -= 1;

        const wasGrounded = sim.player.grounded;
        input.move = [moveX, moveZ];
        input.cam_yaw_deg = camYawDeg;
        input.jump = keys.has(settings.keybinds.jump) || queuedJump;
        input.interact = keys.has(settings.keybinds.interact) || queuedInteract;
        input.pulse = keys.has(settings.keybinds.pulse) || keys.has('KeyF') || queuedPulse;
        input.dash = keys.has(settings.keybinds.dash) || keys.has('ShiftRight') || queuedDash;
        queuedJump = false;
        queuedInteract = false;
        queuedPulse = false;
        queuedDash = false;
        input.pause = pendingPauseToggle;
        pendingPauseToggle = false;

        const events = sim.step(input);
        if (wasGrounded && !sim.player.grounded && sim.player.vel[1] > 0) sfx.playJump();

        if (sim.wind.warning && !wasWindWarn) {
          sfx.playWindWarning();
          showCaption('Gió mạnh sắp thổi!');
        }
        wasWindWarn = sim.wind.warning;

        const secLeft = Math.ceil(sim.timeLeftS);
        if (secLeft <= 10 && secLeft > 0 && secLeft < lastCountdownSec) {
          lastCountdownSec = secLeft;
          sfx.playCountdownTick();
          if (secLeft === 10) showCaption('10 giây cuối trước Bình Minh!');
        }

        for (const ev of events) {
          if (ev.name === 'mote_picked') sfx.playPickup(Number(ev.data.carried ?? 1));
          else if (ev.name === 'deposit') {
            sfx.playDeposit();
            const dep = Number(ev.data.deposited ?? 0);
            const amt = Number(ev.data.amount ?? 0);
            showToast(`Đã nạp +${amt} vào ${String(ev.data.lantern_id)} (${dep}) · +${amt * TUNING.score.per_mote}đ`);
          } else if (ev.name === 'refuel') {
            sfx.playDeposit();
            showToast(`Châm dầu ${String(ev.data.lantern_id)} → ${String(ev.data.fuel)}/100`);
          } else if (ev.name === 'lantern_out') {
            sfx.playHit();
            showCaption(`Đèn ${String(ev.data.lantern_id)} đã cạn dầu và tắt!`);
          } else if (ev.name === 'lantern_lit') {
            sfx.playLanternLit();
            const isRelight = Boolean(ev.data.relight);
            showToast(`✨ ${String(ev.data.lantern_id)} ${isRelight ? 'ĐÃ THẮP LẠI (+40đ)' : 'ĐÃ THẮP SÁNG (+100đ)'}!`);
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
            showCaption(`Gió Lạc vừa cướp ${String(ev.data.amount)} đom đóm!`);
          } else if (ev.name === 'shade_spawned') {
            sfx.playShadeSpawn();
            const s = sim.shades.find((sh) => sh.id === ev.data.id);
            if (s) {
              lastShadeSpawnPos = [...s.pos];
              shadeArrowUntilMs = now + 3000;
            }
            showCaption('Bóng Mực vừa xuất hiện!');
          } else if (ev.name === 'player_hit') sfx.playHit();
          else if (ev.name === 'game_over') {
            showResultScreen(String(ev.data.result), String(ev.data.reason));
          }
        }

        accumulator -= DT;
      }

      updateHud(now);
    } else if (pendingPauseToggle) {
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
}
