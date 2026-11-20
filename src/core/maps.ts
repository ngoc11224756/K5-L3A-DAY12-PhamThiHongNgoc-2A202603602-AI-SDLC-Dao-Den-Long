import { round3, TUNING } from './config.ts';
import type { CharmState, JumpPadSpec, LanternState, NightId, Vec3 } from './types.ts';

export interface NightMapConfig {
  night: NightId;
  name: string;
  introQuote: string;
  durationS: number;
  spawnPos: Vec3;
  lanterns: LanternState[];
  moteSpawns: Vec3[];
  shadeSpawns: Vec3[];
  shadeSpeed: number;
  shadeIntervalTicks: number;
  maxShades: number;
  driftersEnabled: boolean;
  windEnabled: boolean;
  jumpPads: JumpPadSpec[];
  charms: CharmState[];
}

function ringPoints(
  cx: number,
  cz: number,
  y: number,
  radius: number,
  count: number,
  startDeg = 0
): Vec3[] {
  const pts: Vec3[] = [];
  const step = 360 / count;
  for (let i = 0; i < count; i++) {
    const rad = ((startDeg + i * step) * Math.PI) / 180;
    pts.push([round3(cx + Math.cos(rad) * radius), y, round3(cz + Math.sin(rad) * radius)]);
  }
  return pts;
}

function makeLanterns(coords: Vec3[]): LanternState[] {
  return coords.map((pos, idx) => ({
    id: `L${idx + 1}`,
    pos: [pos[0], pos[1], pos[2]],
    lit: false,
    deposited: 0
  }));
}

export function getNightMap(night: NightId): NightMapConfig {
  if (night === 1) {
    return {
      night: 1,
      name: 'Đêm 1 — Đảo Bến',
      introQuote:
        '“Mây à, sương đen đã nuốt lấy bến thuyền rồi. Hãy gom đom đóm thắp lại 5 Đèn Lồng Lớn trước khi trời sáng!” — Ông Đăng',
      durationS: TUNING.night1_duration_s,
      spawnPos: [0, 0, 0],
      lanterns: makeLanterns([
        [0, 0, 25],
        [23.8, 0, 7.7],
        [14.7, 0, -20.2],
        [-14.7, 0, -20.2],
        [-23.8, 0, 7.7]
      ]),
      moteSpawns: [
        ...ringPoints(0, 0, 0, 12, 8, 0),
        ...ringPoints(0, 0, 0, 33, 16, 0)
      ],
      shadeSpawns: ringPoints(0, 0, 0, 37, 12, 15),
      shadeSpeed: 4.0,
      shadeIntervalTicks: 480, // 8s
      maxShades: 6,
      driftersEnabled: false,
      windEnabled: false,
      jumpPads: [],
      charms: []
    };
  }

  if (night === 2) {
    // Launch directions toward opposite island centers
    const d1x = 70 - 20;
    const d1z = 0 - 18;
    const l1 = Math.hypot(d1x, d1z);
    const d2x = 0 - 50;
    const d2z = 0 - -18;
    const l2 = Math.hypot(d2x, d2z);

    return {
      night: 2,
      name: 'Đêm 2 — Đảo Cau',
      introQuote:
        '“Cầu tre nối hai bờ đảo rất hẹp, còn Gió Lạc lại hay rình cướp ánh sáng. Dùng bục nhảy và Bùa Gió cho khéo nhé!” — Ông Đăng',
      durationS: TUNING.night2_duration_s,
      spawnPos: [0, 0, 0],
      lanterns: makeLanterns([
        [0, 0, 20],
        [17, 0, -10],
        [-17, 0, -10],
        [70, 0, 20],
        [87, 0, -10],
        [53, 0, -10]
      ]),
      moteSpawns: [
        ...ringPoints(0, 0, 0, 10, 4, 0),
        ...ringPoints(0, 0, 0, 22, 8, 0),
        ...ringPoints(70, 0, 0, 10, 4, 0),
        ...ringPoints(70, 0, 0, 22, 8, 0)
      ],
      shadeSpawns: [
        ...ringPoints(0, 0, 0, 26, 8, 22.5),
        ...ringPoints(70, 0, 0, 26, 8, 22.5)
      ],
      shadeSpeed: 4.0,
      shadeIntervalTicks: 420, // 7s
      maxShades: 8,
      driftersEnabled: true,
      windEnabled: false,
      jumpPads: [
        {
          pos: [20, 0, 18],
          radius: 1.0,
          vy: 14.0,
          horizSpeed: 24.0,
          dirXZ: [d1x / l1, d1z / l1]
        },
        {
          pos: [50, 0, -18],
          radius: 1.0,
          vy: 14.0,
          horizSpeed: 24.0,
          dirXZ: [d2x / l2, d2z / l2]
        }
      ],
      charms: [{ id: 'C1', pos: [35, 0, 0], available: true, respawnTicks: 0 }]
    };
  }

  // Night 3 — Đảo Chuông
  const tier1Motes: Vec3[] = [];
  for (let deg = 20; deg <= 160; deg += 20) {
    const rad = (deg * Math.PI) / 180;
    tier1Motes.push([round3(Math.cos(rad) * 18), 3, round3(Math.sin(rad) * 18)]);
  }
  const tier2Motes: Vec3[] = [45, 135, 225, 315].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return [round3(Math.cos(rad) * 5), 6, round3(Math.sin(rad) * 5)];
  });

  return {
    night: 3,
    name: 'Đêm 3 — Đảo Chuông',
    introQuote:
      '“Đỉnh Đảo Chuông gió rất lớn và Bóng Mực nhanh hơn trước. Thắp sáng 7 ngọn đèn để gọi bình minh về!” — Ông Đăng',
    durationS: TUNING.night3_duration_s,
    spawnPos: [0, 0, 0],
    lanterns: makeLanterns([
      [0, 6, 6],
      [18, 3, 10],
      [-18, 3, 10],
      [35, 0, -10],
      [-35, 0, -10],
      [20, 0, -35],
      [-20, 0, -35]
    ]),
    moteSpawns: [
      ...ringPoints(0, 0, 0, 34, 18, 0),
      ...tier1Motes,
      ...tier2Motes
    ],
    shadeSpawns: ringPoints(0, 0, 0, 43, 16, 0),
    shadeSpeed: 4.5,
    shadeIntervalTicks: 360, // 6s
    maxShades: 10,
    driftersEnabled: true,
    windEnabled: true,
    jumpPads: [
      {
        pos: [0, 3, 13],
        radius: 1.0,
        vy: 12.0,
        horizSpeed: 8.0,
        dirXZ: [0, -1]
      }
    ],
    charms: [
      { id: 'C1', pos: [30, 0, 25], available: true, respawnTicks: 0 },
      { id: 'C2', pos: [-30, 0, 25], available: true, respawnTicks: 0 }
    ]
  };
}

/**
 * Checks if (x, z) is on one of Night 3's two ramps (30° and 150°, width 3 m, r in [24, 30]).
 * Returns ramp elevation in [0, 3], or null if not on a ramp.
 */
function getNight3RampHeight(x: number, z: number): number | null {
  for (const deg of [30, 150]) {
    const rad = (deg * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uz = Math.sin(rad);
    const along = x * ux + z * uz;
    const perp = Math.abs(-x * uz + z * ux);
    if (along >= 24 && along <= 30 && perp <= 1.5) {
      return 3 * ((30 - along) / 6);
    }
  }
  return null;
}

/**
 * Returns the highest valid walkable surface Y <= (currentY + stepTolerance) at (x, z),
 * or null if (x, z) is over the cloud sea (void).
 */
export function getSupportHeight(
  night: NightId,
  x: number,
  z: number,
  currentY: number,
  stepTolerance = 0.55
): number | null {
  if (night === 1) {
    return Math.hypot(x, z) <= 40 ? 0 : null;
  }

  if (night === 2) {
    const onA = Math.hypot(x, z) <= 28;
    const onB = Math.hypot(x - 70, z) <= 28;
    const onBridge = x >= 26 && x <= 44 && z >= -2 && z <= 2;
    return onA || onB || onBridge ? 0 : null;
  }

  // Night 3: multi-tier island radius 45
  const r = Math.hypot(x, z);
  if (r > 45) return null;

  const candidates: number[] = [0];

  // Ramp height
  const rampH = getNight3RampHeight(x, z);
  if (rampH !== null) {
    candidates.push(rampH);
  }

  // Tier 1: annulus r in [12, 24] with z > 0 at Y = 3
  if (r >= 12 && r <= 24 && z > 0) {
    candidates.push(3);
  }

  // Tier 2: disk r <= 8 at Y = 6 (excluding bell tower cylinder r < 2)
  if (r <= 8 && r >= 2) {
    candidates.push(6);
  }

  // Pick the highest surface reachable from currentY
  let best: number | null = null;
  for (const h of candidates) {
    if (h <= currentY + stepTolerance) {
      if (best === null || h > best) best = h;
    }
  }
  return best;
}

/**
 * Checks if horizontal movement from (px, pz) to (nx, nz) at height `y` hits a solid vertical wall
 * (Night 3 tier cliffs or bell tower). Returns corrected [x, z] and whether blocked.
 */
export function resolveHorizontalObstacles(
  night: NightId,
  px: number,
  pz: number,
  nx: number,
  nz: number,
  y: number
): { x: number; z: number; blocked: boolean } {
  if (night !== 3) {
    return { x: nx, z: nz, blocked: false };
  }

  let x = nx;
  let z = nz;
  let blocked = false;

  // Bell tower cylinder at (0, 0), radius 2 m, height 8 m above tier 2 (Y in [6, 14])
  if (y >= 5.5 && y < 14) {
    const r = Math.hypot(x, z);
    if (r < 2.0) {
      blocked = true;
      if (r < 1e-6) {
        x = 2.0;
        z = 0;
      } else {
        x = (x / r) * 2.0;
        z = (z / r) * 2.0;
      }
    }
  }

  // Vertical cliff blocking: cannot walk horizontally into Tier 1 (Y=3) or Tier 2 (Y=6) from below
  // unless on a ramp!
  const rampH = getNight3RampHeight(x, z);
  const r = Math.hypot(x, z);
  const inTier1 = r >= 12 && r <= 24 && z > 0;
  const inTier2 = r <= 8;

  if (inTier2 && y < 5.5) {
    // Tier 2 cliff is solid vertical wall from below
    const pr = Math.hypot(px, pz);
    if (pr > 8) {
      x = px;
      z = pz;
      blocked = true;
    }
  } else if (inTier1 && y < 2.45 && rampH === null) {
    // Tier 1 cliff is solid from below unless climbing via ramp
    const pr = Math.hypot(px, pz);
    const prevInTier1 = pr >= 12 && pr <= 24 && pz > 0;
    if (!prevInTier1) {
      x = px;
      z = pz;
      blocked = true;
    }
  }

  return { x, z, blocked };
}
