import type { InputState, LanternState, TuningConfig, Vec3 } from './types.ts';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const ISLAND_RADIUS = 45.0;
export const LANTERN_RING_RADIUS = 26.0;

export const JUMP_VELOCITY = 8.0;
export const GRAVITY = -20.0;

export const INITIAL_MOTE_COUNT = 18;
export const MOTE_RESPAWN_TICKS = 180; // 3 seconds
export const INITIAL_SHADE_COUNT = 2;
export const SHADE_SPAWN_INTERVAL_TICKS = 2700; // 45 seconds
export const MAX_RANDOM_SHADES = 5;

export const TUNING: TuningConfig = {
  player_speed: 9.5,
  carry_capacity: 5,
  lantern_cost: 4,
  lantern_count_night1: 5,
  pickup_radius: 2.0,
  interact_radius: 3.5,
  pulse_cost: 1,
  pulse_radius: 8.0,
  night1_duration_s: 240,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3.0,
  pulse_push_m: 6.0,
  pulse_cooldown_s: 2.0,
  safe_radius: 6.0,
  shade_speed: 4.2,
  shade_hit_radius: 1.2,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 200,
    per_stun: 25,
    per_second_left: 2,
    per_flame_left: 100
  }
};

export function round3(value: number): number {
  const r = Math.round(value * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

export function roundVec3(v: Vec3): Vec3 {
  return [round3(v[0]), round3(v[1]), round3(v[2])];
}

export function distXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function defaultInputState(): InputState {
  return {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false
  };
}

export function createDefaultLanterns(): LanternState[] {
  const lanterns: LanternState[] = [];
  const count = TUNING.lantern_count_night1;
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count;
    const x = round3(Math.sin(angle) * LANTERN_RING_RADIUS);
    const z = round3(Math.cos(angle) * LANTERN_RING_RADIUS);
    lanterns.push({
      id: `L${i + 1}`,
      pos: [x, 0, z],
      lit: false,
      deposited: 0
    });
  }
  return lanterns;
}
