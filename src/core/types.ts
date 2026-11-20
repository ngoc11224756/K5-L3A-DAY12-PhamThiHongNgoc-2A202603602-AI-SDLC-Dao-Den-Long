export type Vec3 = [number, number, number];

export type GameStateKind = 'playing' | 'won' | 'lost';
export type ShadeStateKind = 'chase' | 'stunned';

export interface ScoreTuning {
  per_mote: number;
  per_lantern: number;
  per_stun: number;
  per_second_left: number;
  per_flame_left: number;
}

export interface TuningConfig {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  score: ScoreTuning;
}

export interface PlayerState {
  pos: Vec3;
  vy: number;
  flames: number;
  carried: number;
}

export interface LanternState {
  id: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
}

export interface ShadeState {
  id: string;
  pos: Vec3;
  state: ShadeStateKind;
  stunTicks: number;
}

export interface MoteState {
  id: string;
  pos: Vec3;
}

export interface InputState {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
}

export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
}

export interface InputsFile {
  frames: InputFrame[];
}

export interface ScenarioLanternPatch {
  id: string;
  pos?: Vec3;
  deposited?: number;
  lit?: boolean;
}

export interface ScenarioShadeSpec {
  id?: string;
  pos: Vec3;
  state?: ShadeStateKind;
}

export interface ScenarioConfig {
  player?: {
    pos?: Vec3;
    carried?: number;
    flames?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: Array<Vec3 | { id?: string; pos: Vec3 }>;
  shades?: ScenarioShadeSpec[];
  lanterns?: ScenarioLanternPatch[];
  time_left_s?: number;
}

export interface SimEvent {
  type: 'event';
  tick: number;
  name:
    | 'mote_picked'
    | 'deposit'
    | 'lantern_lit'
    | 'pulse'
    | 'player_hit'
    | 'shade_spawned'
    | 'game_over';
  data: Record<string, unknown>;
}

export interface SnapshotRecord {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  state: GameStateKind;
  time_left_s: number;
  score: number;
  player: {
    pos: Vec3;
    flames: number;
    carried: number;
  };
  lanterns: Array<{
    id: string;
    pos: Vec3;
    lit: boolean;
    deposited: number;
  }>;
  shades: Array<{
    id: string;
    pos: Vec3;
    state: ShadeStateKind;
  }>;
  motes_active: number;
  motes: Array<{
    id: string;
    pos: Vec3;
  }>;
}

export interface EndRecord {
  type: 'end';
  ticks: number;
  state: GameStateKind;
  score: number;
}

export type JsonlRecord = SnapshotRecord | SimEvent | EndRecord;
