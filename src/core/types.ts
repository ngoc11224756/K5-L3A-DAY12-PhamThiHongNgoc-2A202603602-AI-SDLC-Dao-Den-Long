export type Vec3 = [number, number, number];
export type NightId = 1 | 2 | 3;

export type GameStateKind = 'playing' | 'paused' | 'won' | 'lost';
export type ShadeStateKind = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned';
export type DrifterStateKind = 'idle' | 'chase' | 'flee' | 'removed';
export type MoteKind = 'random' | 'dropped';

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
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  night1_duration_s: number;
  night2_duration_s: number;
  night3_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  score: ScoreTuning;
}

export interface PlayerState {
  pos: Vec3;
  vel: Vec3;
  grounded: boolean;
  flames: number;
  carried: number;
  facing: [number, number];
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
  stateTicksLeft: number;
  pushTicksLeft: number;
  pushDir: [number, number];
  safePushTicksLeft: number;
  recoilDir: [number, number];
  wanderAngle: number;
  spawnTick: number;
}

export interface MoteState {
  id: string;
  pos: Vec3;
  kind: MoteKind;
  ttlTicks: number | null;
  spawnTick: number;
  spawnPointIdx: number | null;
}

export interface DrifterState {
  id: string;
  pos: Vec3;
  state: DrifterStateKind;
  stolen: number;
  fleeTicksLeft: number;
  idleAngle: number;
  spawnTick: number;
}

export interface CharmState {
  id: string;
  pos: Vec3;
  available: boolean;
  respawnTicks: number;
}

export interface WindState {
  active: boolean;
  warning: boolean;
  dir_deg: number;
}

export interface JumpPadSpec {
  pos: Vec3;
  radius: number;
  vy: number;
  horizSpeed: number;
  dirXZ: [number, number];
}

export interface InputState {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
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
  state_ticks_left?: number;
}

export interface ScenarioDrifterSpec {
  id?: string;
  pos: Vec3;
  state?: DrifterStateKind;
  stolen?: number;
}

export interface ScenarioCharmSpec {
  id?: string;
  pos: Vec3;
  available?: boolean;
  respawn_s?: number;
}

export interface ScenarioConfig {
  player?: {
    pos?: Vec3;
    carried?: number;
    flames?: number;
    invuln_ticks?: number;
    dash_cd_ticks?: number;
    pulse_cd_ticks?: number;
    charm_ticks?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: Array<Vec3 | { id?: string; pos: Vec3; kind?: MoteKind; ttl_s?: number | null }>;
  shades?: ScenarioShadeSpec[];
  drifters?: ScenarioDrifterSpec[];
  charms?: ScenarioCharmSpec[];
  lanterns?: ScenarioLanternPatch[];
  time_left_s?: number;
}

export interface SimEvent {
  type: 'event';
  tick: number;
  name:
    | 'night_start'
    | 'mote_picked'
    | 'deposit'
    | 'lantern_lit'
    | 'pulse'
    | 'dash'
    | 'charm_picked'
    | 'drifter_steal'
    | 'drifter_drop'
    | 'player_hit'
    | 'shade_spawned'
    | 'paused'
    | 'resumed'
    | 'game_over';
  data: Record<string, unknown>;
}

export interface SnapshotRecord {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  night: NightId;
  state: GameStateKind;
  time_left_s: number;
  score: number;
  wind: {
    active: boolean;
    dir_deg: number;
  };
  player: {
    pos: Vec3;
    vel: Vec3;
    grounded: boolean;
    flames: number;
    carried: number;
    invuln: boolean;
    dash_cd_s: number;
    pulse_cd_s: number;
    charm_s: number;
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
    kind: MoteKind;
    ttl_s: number | null;
  }>;
  drifters: Array<{
    id: string;
    pos: Vec3;
    state: DrifterStateKind;
    stolen: number;
  }>;
  charms: Array<{
    id: string;
    available: boolean;
    respawn_s: number;
  }>;
}

export interface EndRecord {
  type: 'end';
  ticks: number;
  state: GameStateKind;
  score: number;
}

export type JsonlRecord = SnapshotRecord | SimEvent | EndRecord;
