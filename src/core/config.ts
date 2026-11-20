import type { InputState, TuningConfig, Vec3 } from './types.ts';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const JUMP_VELOCITY = 7.0;
export const GRAVITY = -20.0;
export const CHARM_SPEED = 7.2;
export const CHARM_DURATION_TICKS = 600;
export const CHARM_RESPAWN_TICKS = 2700;

export const INITIAL_MOTE_COUNT = 20;
export const MAX_MOTE_COUNT = 30;
export const MOTE_SPAWN_INTERVAL_TICKS = 240;
export const DROPPED_MOTE_TTL_TICKS = 480;

// Integer fuel precision (1/60th of a fuel unit)
export const MAX_FUEL_UNITS = 100 * TICK_RATE; // 6000
export const LOW_FUEL_UNITS = 30 * TICK_RATE; // 1800
export const FUEL_PER_MOTE_UNITS = 10 * TICK_RATE; // 600
export const FUEL_DECAY_UNITS_PER_TICK = 1; // 1.0/s
export const FUEL_DRAIN_UNITS_PER_TICK = 5; // 5.0/s
export const DRAIN_EVENT_INTERVAL_TICKS = 60;
export const DRAIN_ENGAGE_RADIUS = 2.0;
export const DRAIN_BREAK_PLAYER_RADIUS = 6.0;

export const SCORE_RELIGHT = 40;
export const SCORE_STUN_DRAINING = 15;
export const SCORE_DAWN_LANTERN_BASE = 50;

export const SHADE_FIRST_SPAWN_TICK = 300;
export const SHADE_DETECT_RADIUS = 12.0;
export const SHADE_LOSE_RADIUS = 18.0;
export const SHADE_RECOIL_DIST = 2.0;
export const SHADE_RECOIL_TICKS = 60;
export const SHADE_SPAWN_DELAY_TICKS = 30;
export const SAFE_PUSH_TICKS = 30;

export const PULSE_PUSH_TICKS = 15;
export const PULSE_HEIGHT_OFFSET = 0.8;
export const HEIGHT_TOLERANCE = 1.5;

export const FALL_Y_THRESHOLD = -10.0;
export const FALL_RESPAWN_WAIT_TICKS = 60;

export const DRIFTER_SPEED = 7.0;
export const DRIFTER_IDLE_SPEED = 2.0;
export const DRIFTER_MAX = 2;
export const DRIFTER_SPAWN_INTERVAL_TICKS = 1200;
export const DRIFTER_DETECT_RADIUS = 15.0;
export const DRIFTER_STEAL_RADIUS = 1.2;
export const DRIFTER_MIN_CARRIED = 5;
export const DRIFTER_STEAL_MAX = 3;
export const DRIFTER_FLEE_TICKS = 240;
export const DRIFTER_DROP_FLEE_TICKS = 120;

export const WIND_CYCLE_TICKS = 1800; // 30s
export const WIND_DURATION_TICKS = 300; // 5s
export const WIND_WARNING_TICKS = 120; // 2s
export const WIND_PUSH_SPEED = 2.0;

export const TUNING: TuningConfig = {
  player_speed: 6.0,
  carry_capacity: 10,
  capacity_max: 20,
  lantern_cost: 10,
  relight_cost: 5,
  lantern_count_night1: 5,
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  low_fuel_threshold: 30,
  drain_per_s: 5,
  win_ratio: 0.6,
  pickup_radius: 1.0,
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5.0,
  pulse_stun_s: 2.0,
  pulse_push_m: 4.0,
  pulse_cooldown_s: 3.0,
  dash_speed: 14.0,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  night1_duration_s: 240,
  night2_duration_s: 270,
  night3_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  safe_radius: 6.0,
  shade_speed: 4.0,
  shade_hit_radius: 1.0,
  fall_enabled: true,
  score: {
    per_mote: 5,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 0,
    per_flame_left: 50
  }
};

export function round1(value: number): number {
  const r = Math.round(value * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

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

export function dist3D(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function defaultInputState(): InputState {
  return {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false
  };
}
