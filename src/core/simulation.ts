import {
  CHARM_DURATION_TICKS,
  CHARM_RESPAWN_TICKS,
  CHARM_SPEED,
  defaultInputState,
  dist3D,
  distXZ,
  DRAIN_BREAK_PLAYER_RADIUS,
  DRAIN_ENGAGE_RADIUS,
  DRAIN_EVENT_INTERVAL_TICKS,
  DRIFTER_DETECT_RADIUS,
  DRIFTER_DROP_FLEE_TICKS,
  DRIFTER_FLEE_TICKS,
  DRIFTER_IDLE_SPEED,
  DRIFTER_MAX,
  DRIFTER_MIN_CARRIED,
  DRIFTER_SPAWN_INTERVAL_TICKS,
  DRIFTER_SPEED,
  DRIFTER_STEAL_MAX,
  DRIFTER_STEAL_RADIUS,
  DROPPED_MOTE_TTL_TICKS,
  DT,
  FALL_RESPAWN_WAIT_TICKS,
  FALL_Y_THRESHOLD,
  FUEL_DECAY_UNITS_PER_TICK,
  FUEL_DRAIN_UNITS_PER_TICK,
  FUEL_PER_MOTE_UNITS,
  GRAVITY,
  HEIGHT_TOLERANCE,
  INITIAL_MOTE_COUNT,
  JUMP_VELOCITY,
  LOW_FUEL_UNITS,
  MAX_FUEL_UNITS,
  MAX_MOTE_COUNT,
  MOTE_SPAWN_INTERVAL_TICKS,
  PULSE_HEIGHT_OFFSET,
  PULSE_PUSH_TICKS,
  round1,
  round3,
  roundVec3,
  SAFE_PUSH_TICKS,
  SCORE_DAWN_LANTERN_BASE,
  SCORE_RELIGHT,
  SCORE_STUN_DRAINING,
  SHADE_DETECT_RADIUS,
  SHADE_FIRST_SPAWN_TICK,
  SHADE_LOSE_RADIUS,
  SHADE_RECOIL_DIST,
  SHADE_RECOIL_TICKS,
  SHADE_SPAWN_DELAY_TICKS,
  TICK_RATE,
  TUNING,
  WIND_CYCLE_TICKS,
  WIND_DURATION_TICKS,
  WIND_PUSH_SPEED,
  WIND_WARNING_TICKS
} from './config.ts';
import { getNightMap, getSupportHeight, resolveHorizontalObstacles, type NightMapConfig } from './maps.ts';
import { SeededRng } from './prng.ts';
import type {
  CharmState,
  DrifterState,
  GameStateKind,
  InputState,
  LanternState,
  MoteState,
  NightId,
  PlayerState,
  ScenarioConfig,
  ShadeState,
  SimEvent,
  SnapshotRecord,
  Vec3,
  WindState
} from './types.ts';

const SAFE_EPS = 0.02;

export class GameSimulation {
  readonly seed: number;
  readonly night: NightId;
  readonly map: NightMapConfig;
  private readonly rng: SeededRng;

  tick = 0;
  simTick = 0;
  state: GameStateKind = 'playing';
  score = 0;

  initialTimeLeftS: number;
  timeLeftS: number;

  player: PlayerState;
  successfulLights = 0;
  lanterns: LanternState[];
  shades: ShadeState[] = [];
  motes: MoteState[] = [];
  drifters: DrifterState[] = [];
  charms: CharmState[] = [];
  wind: WindState = { active: false, warning: false, dir_deg: 0 };

  invulnTicks = 0;
  dashCdTicks = 0;
  dashTicksLeft = 0;
  dashDir: [number, number] = [0, 1];
  pulseCdTicks = 0;
  charmTicks = 0;
  launchLocked = false;
  falling = false;
  respawnWaitTicks = 0;

  private prevInput: InputState = defaultInputState();
  private randomMotes: boolean;
  private randomShades: boolean;
  private randomDrifters: boolean;
  private windEnabled: boolean;
  private windCycleTimer = 0;
  private nextMoteSeq = 1;
  private nextShadeSeq = 1;
  private nextDrifterSeq = 1;

  constructor(seed: number, night: NightId = 1, scenario?: ScenarioConfig) {
    this.seed = seed;
    this.night = night;
    this.map = getNightMap(night);
    this.rng = new SeededRng(seed);

    this.initialTimeLeftS = scenario?.time_left_s ?? this.map.durationS;
    this.timeLeftS = round3(this.initialTimeLeftS);

    this.randomMotes = scenario?.random_motes ?? true;
    this.randomShades = scenario?.random_shades ?? true;
    this.randomDrifters = scenario?.random_drifters ?? this.map.driftersEnabled;
    this.windEnabled = scenario?.wind_enabled ?? this.map.windEnabled;

    const startPos: Vec3 = scenario?.player?.pos
      ? [scenario.player.pos[0], scenario.player.pos[1], scenario.player.pos[2]]
      : [...this.map.spawnPos];
    const groundY = getSupportHeight(this.night, startPos[0], startPos[2], startPos[1]);

    this.player = {
      pos: startPos,
      vel: [0, 0, 0],
      grounded: groundY !== null && Math.abs(startPos[1] - groundY) <= 0.05,
      flames: scenario?.player?.flames ?? TUNING.flames,
      carried: scenario?.player?.carried ?? 0,
      facing: [0, 1]
    };

    this.invulnTicks = scenario?.player?.invuln_ticks ?? 0;
    this.dashCdTicks = scenario?.player?.dash_cd_ticks ?? 0;
    this.pulseCdTicks = scenario?.player?.pulse_cd_ticks ?? 0;
    this.charmTicks = scenario?.player?.charm_ticks ?? 0;
    this.successfulLights = scenario?.player?.successful_lights ?? 0;

    // Lanterns (scenario pre-lit does NOT increment successfulLights or score)
    this.lanterns = this.map.lanterns.map((l) => ({
      id: l.id,
      pos: [l.pos[0], l.pos[1], l.pos[2]],
      lit: l.lit,
      deposited: l.deposited,
      fuelUnits: l.fuelUnits,
      everLit: l.everLit,
      relitCount: l.relitCount
    }));
    if (scenario?.lanterns) {
      for (const patch of scenario.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (!target) continue;
        if (patch.pos) target.pos = [patch.pos[0], patch.pos[1], patch.pos[2]];
        if (typeof patch.deposited === 'number') target.deposited = patch.deposited;
        if (typeof patch.ever_lit === 'boolean') target.everLit = patch.ever_lit;
        if (typeof patch.lit === 'boolean') {
          target.lit = patch.lit;
          if (patch.lit) {
            target.everLit = true;
            if (typeof patch.deposited !== 'number') {
              target.deposited = Math.max(target.deposited, TUNING.lantern_cost);
            }
            target.fuelUnits =
              typeof patch.fuel === 'number'
                ? Math.min(MAX_FUEL_UNITS, Math.max(0, Math.round(patch.fuel * TICK_RATE)))
                : MAX_FUEL_UNITS;
          } else {
            target.fuelUnits = 0;
          }
        } else if (typeof patch.fuel === 'number' && target.lit) {
          target.fuelUnits = Math.min(
            MAX_FUEL_UNITS,
            Math.max(0, Math.round(patch.fuel * TICK_RATE))
          );
        }
      }
    }

    // Motes
    if (scenario?.motes !== undefined) {
      for (const item of scenario.motes) {
        if (Array.isArray(item)) {
          this.motes.push({
            id: `M${this.nextMoteSeq++}`,
            pos: [item[0], item[1], item[2]],
            kind: 'random',
            ttlTicks: null,
            spawnTick: -1,
            spawnPointIdx: null
          });
        } else {
          this.motes.push({
            id: item.id ?? `M${this.nextMoteSeq++}`,
            pos: [item.pos[0], item.pos[1], item.pos[2]],
            kind: item.kind ?? 'random',
            ttlTicks:
              item.ttl_s !== undefined && item.ttl_s !== null
                ? Math.round(item.ttl_s * TICK_RATE)
                : item.kind === 'dropped'
                  ? DROPPED_MOTE_TTL_TICKS
                  : null,
            spawnTick: -1,
            spawnPointIdx: null
          });
        }
      }
    } else if (this.randomMotes) {
      const indices = this.map.moteSpawns.map((_, idx) => idx);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng.next() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const count = Math.min(INITIAL_MOTE_COUNT, indices.length);
      for (let i = 0; i < count; i++) {
        const ptIdx = indices[i];
        const pt = this.map.moteSpawns[ptIdx];
        this.motes.push({
          id: `M${this.nextMoteSeq++}`,
          pos: [pt[0], pt[1], pt[2]],
          kind: 'random',
          ttlTicks: null,
          spawnTick: -1,
          spawnPointIdx: ptIdx
        });
      }
    }

    // Shades
    if (scenario?.shades !== undefined) {
      for (const spec of scenario.shades) {
        const id = spec.id ?? `S${this.nextShadeSeq++}`;
        const m = /^S(\d+)$/.exec(id);
        if (m) this.nextShadeSeq = Math.max(this.nextShadeSeq, Number(m[1]) + 1);
        const defaultState =
          spec.state ??
          (distXZ(spec.pos, this.player.pos) <= SHADE_DETECT_RADIUS ? 'chase' : 'wander');
        const defaultTicks =
          spec.state_ticks_left ??
          (defaultState === 'stunned'
            ? Math.round(TUNING.pulse_stun_s * TICK_RATE)
            : defaultState === 'recoil'
              ? SHADE_RECOIL_TICKS
              : defaultState === 'spawning'
                ? SHADE_SPAWN_DELAY_TICKS
                : 0);
        this.shades.push({
          id,
          pos: [spec.pos[0], spec.pos[1], spec.pos[2]],
          state: defaultState,
          stateTicksLeft: defaultTicks,
          pushTicksLeft: 0,
          pushDir: [1, 0],
          safePushTicksLeft: 0,
          recoilDir: [1, 0],
          wanderAngle: this.rng.range(0, Math.PI * 2),
          spawnTick: -1,
          targetLanternId: spec.target_lantern_id ?? null,
          drainTickCounter: 0
        });
      }
    }

    // Drifters
    if (scenario?.drifters !== undefined) {
      for (const spec of scenario.drifters) {
        const id = spec.id ?? `D${this.nextDrifterSeq++}`;
        const m = /^D(\d+)$/.exec(id);
        if (m) this.nextDrifterSeq = Math.max(this.nextDrifterSeq, Number(m[1]) + 1);
        this.drifters.push({
          id,
          pos: [spec.pos[0], spec.pos[1], spec.pos[2]],
          state: spec.state ?? 'idle',
          stolen: spec.stolen ?? 0,
          fleeTicksLeft: spec.state === 'flee' ? DRIFTER_FLEE_TICKS : 0,
          idleAngle: this.rng.range(0, Math.PI * 2),
          spawnTick: -1
        });
      }
    }

    // Charms
    if (scenario?.charms !== undefined) {
      this.charms = scenario.charms.map((c, idx) => ({
        id: c.id ?? `C${idx + 1}`,
        pos: [c.pos[0], c.pos[1], c.pos[2]],
        available: c.available ?? true,
        respawnTicks: c.respawn_s ? Math.round(c.respawn_s * TICK_RATE) : 0
      }));
    } else {
      this.charms = this.map.charms.map((c) => ({
        id: c.id,
        pos: [c.pos[0], c.pos[1], c.pos[2]],
        available: c.available,
        respawnTicks: c.respawnTicks
      }));
    }
  }

  getCapacity(): number {
    return Math.min(TUNING.capacity_max, TUNING.carry_capacity + 2 * this.successfulLights);
  }

  private hasActiveSafeZone(l: LanternState): boolean {
    return l.lit && l.fuelUnits >= LOW_FUEL_UNITS;
  }

  private spawnRandomMote(): void {
    if (this.motes.length >= MAX_MOTE_COUNT) return;
    const occupied = new Set<number>();
    for (const m of this.motes) {
      if (m.spawnPointIdx !== null) occupied.add(m.spawnPointIdx);
    }
    const free: number[] = [];
    for (let i = 0; i < this.map.moteSpawns.length; i++) {
      if (!occupied.has(i)) free.push(i);
    }
    if (free.length === 0) return;
    const chosenIdx = free[Math.floor(this.rng.next() * free.length)];
    const pt = this.map.moteSpawns[chosenIdx];
    this.motes.push({
      id: `M${this.nextMoteSeq++}`,
      pos: [pt[0], pt[1], pt[2]],
      kind: 'random',
      ttlTicks: null,
      spawnTick: this.simTick,
      spawnPointIdx: chosenIdx
    });
  }

  private spawnRandomShade(): SimEvent | null {
    if (this.shades.length >= this.map.maxShades) return null;
    const valid = this.map.shadeSpawns.filter((pt) => {
      if (distXZ(pt, this.player.pos) < 15.0) return false;
      for (const l of this.lanterns) {
        if (this.hasActiveSafeZone(l) && distXZ(pt, l.pos) <= TUNING.safe_radius) return false;
      }
      return true;
    });
    if (valid.length === 0) return null;
    const pt = valid[Math.floor(this.rng.next() * valid.length)];
    const id = `S${this.nextShadeSeq++}`;
    this.shades.push({
      id,
      pos: [pt[0], pt[1] + PULSE_HEIGHT_OFFSET, pt[2]],
      state: 'spawning',
      stateTicksLeft: SHADE_SPAWN_DELAY_TICKS,
      pushTicksLeft: 0,
      pushDir: [1, 0],
      safePushTicksLeft: 0,
      recoilDir: [1, 0],
      wanderAngle: this.rng.range(0, Math.PI * 2),
      spawnTick: this.simTick,
      targetLanternId: null,
      drainTickCounter: 0
    });
    return {
      type: 'event',
      tick: this.tick,
      name: 'shade_spawned',
      data: { id }
    };
  }

  private spawnRandomDrifter(): void {
    const active = this.drifters.filter((d) => d.state !== 'removed');
    if (active.length >= DRIFTER_MAX) return;
    const pts = this.map.shadeSpawns;
    if (pts.length === 0) return;
    const pt = pts[Math.floor(this.rng.next() * pts.length)];
    const id = `D${this.nextDrifterSeq++}`;
    this.drifters.push({
      id,
      pos: [pt[0], pt[1] + 1.2, pt[2]],
      state: 'idle',
      stolen: 0,
      fleeTicksLeft: 0,
      idleAngle: this.rng.range(0, Math.PI * 2),
      spawnTick: this.simTick
    });
  }

  private spawnDroppedMotes(center: Vec3, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = this.rng.range(1.5, 2.5);
      const mx = center[0] + Math.cos(angle) * radius;
      const mz = center[2] + Math.sin(angle) * radius;
      const gy = getSupportHeight(this.night, mx, mz, center[1]) ?? center[1];
      this.motes.push({
        id: `M${this.nextMoteSeq++}`,
        pos: [round3(mx), round3(gy), round3(mz)],
        kind: 'dropped',
        ttlTicks: DROPPED_MOTE_TTL_TICKS,
        spawnTick: this.simTick,
        spawnPointIdx: null
      });
    }
  }

  private blockShadeAtSafeEdge(shade: ShadeState, prevX: number, prevZ: number): void {
    for (const l of this.lanterns) {
      if (!this.hasActiveSafeZone(l)) continue;
      const dx = shade.pos[0] - l.pos[0];
      const dz = shade.pos[2] - l.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < TUNING.safe_radius) {
        const pd = Math.hypot(prevX - l.pos[0], prevZ - l.pos[2]);
        if (pd >= TUNING.safe_radius - 0.05) {
          const target = TUNING.safe_radius + SAFE_EPS;
          if (d < 1e-6) {
            shade.pos[0] = l.pos[0] + target;
            shade.pos[2] = l.pos[2];
          } else {
            shade.pos[0] = l.pos[0] + (dx / d) * target;
            shade.pos[2] = l.pos[2] + (dz / d) * target;
          }
        }
      }
    }
  }

  private triggerSafePushOut(lantern: LanternState): void {
    for (const s of this.shades) {
      if (s.state === 'drain' && s.targetLanternId === lantern.id) {
        s.state = 'wander';
        s.targetLanternId = null;
        s.drainTickCounter = 0;
      }
      if (distXZ(s.pos, lantern.pos) < TUNING.safe_radius) {
        s.safePushTicksLeft = SAFE_PUSH_TICKS;
      }
    }
  }

  step(input: InputState): SimEvent[] {
    if (this.state === 'won' || this.state === 'lost') {
      return [];
    }

    const events: SimEvent[] = [];
    this.tick += 1;

    // 1. Read input & handle pause rising edge first
    const pausePressed = input.pause && !this.prevInput.pause;
    const jumpPressed = input.jump && !this.prevInput.jump;
    const interactPressed = input.interact && !this.prevInput.interact;
    const pulsePressed = input.pulse && !this.prevInput.pulse;
    const dashPressed = input.dash && !this.prevInput.dash;

    this.prevInput = {
      move: [input.move[0], input.move[1]],
      cam_yaw_deg: input.cam_yaw_deg,
      jump: input.jump,
      interact: input.interact,
      pulse: input.pulse,
      dash: input.dash,
      pause: input.pause
    };

    if (this.state === 'paused') {
      if (pausePressed) {
        this.state = 'playing';
        events.push({ type: 'event', tick: this.tick, name: 'resumed', data: {} });
      } else {
        return events;
      }
    } else if (pausePressed) {
      this.state = 'paused';
      events.push({ type: 'event', tick: this.tick, name: 'paused', data: {} });
      return events;
    }

    // 2. Decrement counters & fuel decay/drain (Ticket-03 exact order)
    this.simTick += 1;
    this.timeLeftS = Math.max(0, round3(this.initialTimeLeftS - this.simTick / TICK_RATE));

    if (this.dashCdTicks > 0) this.dashCdTicks -= 1;
    if (this.pulseCdTicks > 0) this.pulseCdTicks -= 1;
    if (this.invulnTicks > 0) this.invulnTicks -= 1;
    if (this.charmTicks > 0) this.charmTicks -= 1;

    if (this.respawnWaitTicks > 0) {
      this.respawnWaitTicks -= 1;
      if (this.respawnWaitTicks === 0 && this.falling) {
        this.falling = false;
        this.launchLocked = false;
        this.dashTicksLeft = 0;
        this.player.pos = [...this.map.spawnPos];
        this.player.vel = [0, 0, 0];
        this.player.grounded = true;
        this.invulnTicks = Math.round(TUNING.invuln_s * TICK_RATE);
      }
    }

    // Shade timers
    for (const s of this.shades) {
      if (s.stateTicksLeft > 0) {
        s.stateTicksLeft -= 1;
        if (s.stateTicksLeft === 0) {
          if (s.state === 'spawning' || s.state === 'stunned' || s.state === 'recoil') {
            s.state = 'wander';
          }
        }
      }
    }

    // Lantern fuel decay (1/60) + shade drain (5/60 per draining shade)
    const sortedShadesForDrain = [...this.shades].sort((a, b) => a.id.localeCompare(b.id));
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      l.fuelUnits -= FUEL_DECAY_UNITS_PER_TICK;

      for (const s of sortedShadesForDrain) {
        if (s.state === 'drain' && s.targetLanternId === l.id) {
          l.fuelUnits -= FUEL_DRAIN_UNITS_PER_TICK;
          s.drainTickCounter += 1;
          if (s.drainTickCounter % DRAIN_EVENT_INTERVAL_TICKS === 0) {
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'fuel_drain',
              data: {
                lantern_id: l.id,
                shade_id: s.id,
                fuel: round1(Math.max(0, l.fuelUnits) / TICK_RATE)
              }
            });
          }
        }
      }
    }

    // Immediately after step 2: turn off lanterns with fuel <= 0
    for (const l of this.lanterns) {
      if (l.lit && l.fuelUnits <= 0) {
        l.lit = false;
        l.fuelUnits = 0;
        l.deposited = 0;
        l.everLit = true;
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'lantern_out',
          data: { lantern_id: l.id }
        });
        for (const s of this.shades) {
          if (s.state === 'drain' && s.targetLanternId === l.id) {
            s.state = 'wander';
            s.targetLanternId = null;
            s.drainTickCounter = 0;
          }
        }
      }
    }

    // Dropped motes TTL
    this.motes = this.motes.filter((m) => {
      if (m.ttlTicks === null) return true;
      m.ttlTicks -= 1;
      return m.ttlTicks > 0;
    });

    // Charm respawn
    for (const c of this.charms) {
      if (!c.available && c.respawnTicks > 0) {
        c.respawnTicks -= 1;
        if (c.respawnTicks <= 0) {
          c.available = true;
          c.respawnTicks = 0;
        }
      }
    }

    // Wind cycle (Night 3)
    if (this.windEnabled) {
      this.windCycleTimer += 1;
      if (this.windCycleTimer === WIND_CYCLE_TICKS - WIND_WARNING_TICKS) {
        this.wind.dir_deg = round3(this.rng.range(0, 360));
        this.wind.warning = true;
      } else if (this.windCycleTimer === WIND_CYCLE_TICKS) {
        this.wind.warning = false;
        this.wind.active = true;
      } else if (this.windCycleTimer >= WIND_CYCLE_TICKS + WIND_DURATION_TICKS) {
        this.wind.active = false;
        this.wind.warning = false;
        this.windCycleTimer = 0;
      }
    } else {
      this.wind.active = false;
      this.wind.warning = false;
    }

    // 3. Move Mây (jump, dash, jump pads, wind) then check fall
    if (!this.falling) {
      const theta = (input.cam_yaw_deg * Math.PI) / 180;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      let wx = input.move[0] * cosT + input.move[1] * sinT;
      let wz = -input.move[0] * sinT + input.move[1] * cosT;
      const wLen = Math.hypot(wx, wz);
      if (wLen > 1) {
        wx /= wLen;
        wz /= wLen;
      }
      if (wLen > 1e-4) {
        this.player.facing = [wx / wLen, wz / wLen];
      }

      if (dashPressed && this.dashTicksLeft <= 0 && (this.dashCdTicks <= 0 || this.charmTicks > 0)) {
        this.dashTicksLeft = Math.round(TUNING.dash_duration_s * TICK_RATE);
        this.dashCdTicks =
          this.charmTicks > 0 ? 0 : Math.round(TUNING.dash_cooldown_s * TICK_RATE);
        this.dashDir =
          wLen > 1e-4 ? [wx / wLen, wz / wLen] : [this.player.facing[0], this.player.facing[1]];
        this.launchLocked = false;
        this.player.vel[1] = 0;
        events.push({ type: 'event', tick: this.tick, name: 'dash', data: {} });
      }

      if (jumpPressed && this.player.grounded && this.dashTicksLeft <= 0) {
        this.player.vel[1] = JUMP_VELOCITY;
        this.player.grounded = false;
      }

      let vx = this.player.vel[0];
      let vz = this.player.vel[2];

      if (this.dashTicksLeft > 0) {
        vx = this.dashDir[0] * TUNING.dash_speed;
        vz = this.dashDir[1] * TUNING.dash_speed;
        this.player.vel[1] = 0;
        this.dashTicksLeft -= 1;
      } else if (!this.launchLocked) {
        const moveSpeed = this.charmTicks > 0 ? CHARM_SPEED : TUNING.player_speed;
        vx = wx * moveSpeed;
        vz = wz * moveSpeed;
      }

      if (this.wind.active) {
        const wr = (this.wind.dir_deg * Math.PI) / 180;
        vx += Math.cos(wr) * WIND_PUSH_SPEED;
        vz += Math.sin(wr) * WIND_PUSH_SPEED;
      }

      const prevX = this.player.pos[0];
      const prevY = this.player.pos[1];
      const prevZ = this.player.pos[2];

      const nextX = prevX + vx * DT;
      const nextZ = prevZ + vz * DT;
      const horiz = resolveHorizontalObstacles(this.night, prevX, prevZ, nextX, nextZ, prevY);
      this.player.pos[0] = horiz.x;
      this.player.pos[2] = horiz.z;
      this.player.vel[0] = horiz.blocked ? 0 : vx;
      this.player.vel[2] = horiz.blocked ? 0 : vz;

      const supportY = getSupportHeight(this.night, this.player.pos[0], this.player.pos[2], prevY);

      if (this.dashTicksLeft > 0) {
        if (supportY !== null && Math.abs(this.player.pos[1] - supportY) <= 0.05) {
          this.player.pos[1] = supportY;
          this.player.grounded = true;
        } else {
          this.player.grounded = false;
        }
      } else {
        if (this.player.grounded) {
          if (supportY !== null && Math.abs(supportY - prevY) <= 0.55) {
            this.player.pos[1] = supportY;
            this.player.vel[1] = 0;
          } else {
            this.player.grounded = false;
          }
        }
        if (!this.player.grounded) {
          this.player.pos[1] += this.player.vel[1] * DT;
          this.player.vel[1] += GRAVITY * DT;
          if (
            supportY !== null &&
            this.player.vel[1] <= 0 &&
            prevY >= supportY - 0.15 &&
            this.player.pos[1] <= supportY
          ) {
            this.player.pos[1] = supportY;
            this.player.vel[1] = 0;
            this.player.grounded = true;
            this.launchLocked = false;
          }
        }
      }

      if (this.player.grounded && this.dashTicksLeft <= 0) {
        for (const pad of this.map.jumpPads) {
          if (
            distXZ(this.player.pos, pad.pos) <= pad.radius &&
            Math.abs(this.player.pos[1] - pad.pos[1]) <= 0.5
          ) {
            this.player.vel[0] = pad.dirXZ[0] * pad.horizSpeed;
            this.player.vel[1] = pad.vy;
            this.player.vel[2] = pad.dirXZ[1] * pad.horizSpeed;
            this.player.grounded = false;
            this.launchLocked = true;
            break;
          }
        }
      }

      if (TUNING.fall_enabled && this.player.pos[1] < FALL_Y_THRESHOLD) {
        this.falling = true;
        this.player.flames = Math.max(0, this.player.flames - 1);
        const lost = this.player.carried;
        this.player.carried = 0;
        this.player.vel = [0, 0, 0];
        this.dashTicksLeft = 0;
        this.launchLocked = false;
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'player_hit',
          data: {
            by: 'fall',
            flames: this.player.flames,
            dropped: lost,
            lost
          }
        });
        if (this.player.flames > 0) {
          this.respawnWaitTicks = FALL_RESPAWN_WAIT_TICKS;
        }
      }
    }

    // 4. Pick up motes & charms (dynamic capacity!)
    if (!this.falling) {
      const cap = this.getCapacity();
      if (this.player.carried < cap) {
        const remaining: MoteState[] = [];
        for (const mote of this.motes) {
          if (
            this.player.carried < cap &&
            mote.spawnTick < this.simTick &&
            distXZ(this.player.pos, mote.pos) <= TUNING.pickup_radius &&
            Math.abs(this.player.pos[1] - mote.pos[1]) <= HEIGHT_TOLERANCE
          ) {
            this.player.carried += 1;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'mote_picked',
              data: { carried: this.player.carried }
            });
          } else {
            remaining.push(mote);
          }
        }
        this.motes = remaining;
      }

      for (const charm of this.charms) {
        if (
          charm.available &&
          distXZ(this.player.pos, charm.pos) <= TUNING.pickup_radius &&
          Math.abs(this.player.pos[1] - charm.pos[1]) <= HEIGHT_TOLERANCE
        ) {
          charm.available = false;
          charm.respawnTicks = CHARM_RESPAWN_TICKS;
          this.charmTicks = CHARM_DURATION_TICKS;
          this.dashCdTicks = 0;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'charm_picked',
            data: { charm_id: charm.id, charm_ticks: CHARM_DURATION_TICKS }
          });
        }
      }
    }

    // 5. Interact with lantern (unlit OR lit with fuel < 100; nearest, tie-break smaller id)
    if (!this.falling && interactPressed && this.player.carried > 0) {
      let best: LanternState | null = null;
      let bestDist = Infinity;
      for (const l of this.lanterns) {
        const canAccept = !l.lit || l.fuelUnits < MAX_FUEL_UNITS;
        if (!canAccept) continue;
        const d = distXZ(this.player.pos, l.pos);
        if (d <= TUNING.interact_radius) {
          if (d < bestDist - 1e-6 || (Math.abs(d - bestDist) <= 1e-6 && best && l.id < best.id)) {
            best = l;
            bestDist = d;
          }
        }
      }

      if (best) {
        if (!best.lit) {
          const cost = best.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
          const needed = Math.max(0, cost - best.deposited);
          const amount = Math.min(this.player.carried, needed);
          if (amount > 0) {
            this.player.carried -= amount;
            best.deposited += amount;
            this.score += amount * TUNING.score.per_mote;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'deposit',
              data: { lantern_id: best.id, amount, deposited: best.deposited }
            });

            if (best.deposited >= cost) {
              const isRelight = best.everLit;
              best.lit = true;
              best.fuelUnits = MAX_FUEL_UNITS;
              best.everLit = true;
              if (isRelight) {
                best.relitCount += 1;
                this.score += SCORE_RELIGHT;
              } else {
                this.score += TUNING.score.per_lantern;
              }
              this.successfulLights += 1;

              events.push({
                type: 'event',
                tick: this.tick,
                name: 'lantern_lit',
                data: { lantern_id: best.id, relight: isRelight }
              });

              this.triggerSafePushOut(best);
            }
          }
        } else {
          // Refuel lit lantern with fuel < 100
          const wasLow = best.fuelUnits < LOW_FUEL_UNITS;
          const missingUnits = MAX_FUEL_UNITS - best.fuelUnits;
          const neededMotes = Math.ceil(missingUnits / FUEL_PER_MOTE_UNITS);
          const used = Math.min(this.player.carried, neededMotes);
          if (used > 0) {
            this.player.carried -= used;
            best.fuelUnits = Math.min(MAX_FUEL_UNITS, best.fuelUnits + used * FUEL_PER_MOTE_UNITS);
            this.score += used * TUNING.score.per_mote;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'refuel',
              data: {
                lantern_id: best.id,
                amount: used,
                fuel: round1(best.fuelUnits / TICK_RATE)
              }
            });
            if (wasLow && best.fuelUnits >= LOW_FUEL_UNITS) {
              this.triggerSafePushOut(best);
            }
          }
        }
      }
    }

    // 6. Update safe zones (push out shades within <= 30 ticks for lanterns with fuel >= 30)
    for (const s of this.shades) {
      if (s.safePushTicksLeft > 0) {
        let stillInside = false;
        for (const l of this.lanterns) {
          if (!this.hasActiveSafeZone(l)) continue;
          const dx = s.pos[0] - l.pos[0];
          const dz = s.pos[2] - l.pos[2];
          const d = Math.hypot(dx, dz);
          if (d < TUNING.safe_radius) {
            stillInside = true;
            const remaining = TUNING.safe_radius + SAFE_EPS - d;
            const stepDist = remaining / s.safePushTicksLeft;
            const ux = d < 1e-6 ? 1 : dx / d;
            const uz = d < 1e-6 ? 0 : dz / d;
            s.pos[0] += ux * stepDist;
            s.pos[2] += uz * stepDist;
          }
        }
        s.safePushTicksLeft -= 1;
        if (!stillInside) s.safePushTicksLeft = 0;
      }
    }

    // 7. Pulse (+5 normally, +15 total if shade was draining right before!)
    if (
      !this.falling &&
      pulsePressed &&
      this.pulseCdTicks <= 0 &&
      this.player.carried >= TUNING.pulse_cost
    ) {
      this.player.carried -= TUNING.pulse_cost;
      this.pulseCdTicks = Math.round(TUNING.pulse_cooldown_s * TICK_RATE);
      const center: Vec3 = [
        this.player.pos[0],
        this.player.pos[1] + PULSE_HEIGHT_OFFSET,
        this.player.pos[2]
      ];
      const stunnedIds: string[] = [];

      const sortedShades = [...this.shades].sort((a, b) => a.id.localeCompare(b.id));
      for (const s of sortedShades) {
        if (s.state === 'spawning' || s.spawnTick >= this.simTick) continue;
        if (dist3D(center, s.pos) <= TUNING.pulse_radius) {
          const wasDraining = s.state === 'drain';
          const dx = s.pos[0] - this.player.pos[0];
          const dz = s.pos[2] - this.player.pos[2];
          const d = Math.hypot(dx, dz);
          s.state = 'stunned';
          s.stateTicksLeft = Math.round(TUNING.pulse_stun_s * TICK_RATE);
          s.pushTicksLeft = PULSE_PUSH_TICKS;
          s.pushDir = d < 1e-6 ? [1, 0] : [dx / d, dz / d];
          s.targetLanternId = null;
          s.drainTickCounter = 0;
          this.score += wasDraining ? SCORE_STUN_DRAINING : TUNING.score.per_stun;
          stunnedIds.push(s.id);
        }
      }

      for (const d of this.drifters) {
        if (d.state === 'removed' || d.spawnTick >= this.simTick) continue;
        if (dist3D(center, d.pos) <= TUNING.pulse_radius) {
          if (d.state === 'chase') {
            d.state = 'flee';
            d.fleeTicksLeft = DRIFTER_FLEE_TICKS;
          } else if (d.state === 'flee' && d.stolen > 0) {
            const amount = d.stolen;
            this.spawnDroppedMotes(d.pos, amount);
            d.stolen = 0;
            d.fleeTicksLeft = DRIFTER_DROP_FLEE_TICKS;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'drifter_drop',
              data: { drifter_id: d.id, amount }
            });
          }
        }
      }

      events.push({
        type: 'event',
        tick: this.tick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds }
      });
    }

    // 8. Move Shades & Drifters (including Ticket-03 drain AI!)
    for (const s of this.shades) {
      if (s.spawnTick >= this.simTick) continue;
      const prevX = s.pos[0];
      const prevZ = s.pos[2];

      if (s.state === 'spawning') continue;

      if (s.state === 'stunned') {
        if (s.pushTicksLeft > 0) {
          const stepDist = TUNING.pulse_push_m / PULSE_PUSH_TICKS;
          const nx = s.pos[0] + s.pushDir[0] * stepDist;
          const nz = s.pos[2] + s.pushDir[1] * stepDist;
          const res = resolveHorizontalObstacles(this.night, prevX, prevZ, nx, nz, s.pos[1]);
          s.pos[0] = res.x;
          s.pos[2] = res.z;
          s.pushTicksLeft -= 1;
          if (res.blocked) s.pushTicksLeft = 0;
        }
        continue;
      }

      if (s.state === 'recoil') {
        const stepDist = SHADE_RECOIL_DIST / SHADE_RECOIL_TICKS;
        const nx = s.pos[0] + s.recoilDir[0] * stepDist;
        const nz = s.pos[2] + s.recoilDir[1] * stepDist;
        const res = resolveHorizontalObstacles(this.night, prevX, prevZ, nx, nz, s.pos[1]);
        s.pos[0] = res.x;
        s.pos[2] = res.z;
        this.blockShadeAtSafeEdge(s, prevX, prevZ);
        continue;
      }

      const dPlayer = distXZ(s.pos, this.player.pos);

      if (s.state === 'drain') {
        const target = this.lanterns.find((l) => l.id === s.targetLanternId);
        if (!this.falling && dPlayer <= DRAIN_BREAK_PLAYER_RADIUS) {
          s.state = 'chase';
          s.targetLanternId = null;
          s.drainTickCounter = 0;
        } else if (
          !target ||
          !target.lit ||
          target.fuelUnits >= LOW_FUEL_UNITS ||
          distXZ(s.pos, target.pos) > DRAIN_ENGAGE_RADIUS
        ) {
          s.state = 'wander';
          s.targetLanternId = null;
          s.drainTickCounter = 0;
        } else {
          // Stay still while draining
          continue;
        }
      }

      if (s.state === 'wander' && !this.falling && dPlayer <= SHADE_DETECT_RADIUS) {
        s.state = 'chase';
        s.targetLanternId = null;
      } else if (s.state === 'chase' && (this.falling || dPlayer > SHADE_LOSE_RADIUS)) {
        s.state = 'wander';
      }

      if (s.state === 'chase') {
        const dx = this.player.pos[0] - s.pos[0];
        const dz = this.player.pos[2] - s.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 1e-6) {
          const stepDist = Math.min(d, this.map.shadeSpeed * DT);
          const nx = s.pos[0] + (dx / d) * stepDist;
          const nz = s.pos[2] + (dz / d) * stepDist;
          const res = resolveHorizontalObstacles(this.night, prevX, prevZ, nx, nz, s.pos[1]);
          s.pos[0] = res.x;
          s.pos[2] = res.z;
        }
      } else {
        // Wander: seek nearest weak lit lantern (fuel < 30), else nearest unlit lantern
        let weakTarget: LanternState | null = null;
        let weakDist = Infinity;
        for (const l of this.lanterns) {
          if (l.lit && l.fuelUnits < LOW_FUEL_UNITS) {
            const d = distXZ(s.pos, l.pos);
            if (
              d < weakDist - 1e-6 ||
              (Math.abs(d - weakDist) <= 1e-6 && weakTarget && l.id < weakTarget.id)
            ) {
              weakTarget = l;
              weakDist = d;
            }
          }
        }

        if (weakTarget) {
          if (weakDist <= DRAIN_ENGAGE_RADIUS) {
            s.state = 'drain';
            s.targetLanternId = weakTarget.id;
            s.drainTickCounter = 0;
          } else {
            const dx = weakTarget.pos[0] - s.pos[0];
            const dz = weakTarget.pos[2] - s.pos[2];
            const stepDist = Math.min(weakDist, this.map.shadeSpeed * DT);
            const nx = s.pos[0] + (dx / weakDist) * stepDist;
            const nz = s.pos[2] + (dz / weakDist) * stepDist;
            const res = resolveHorizontalObstacles(this.night, prevX, prevZ, nx, nz, s.pos[1]);
            s.pos[0] = res.x;
            s.pos[2] = res.z;
            if (distXZ(s.pos, weakTarget.pos) <= DRAIN_ENGAGE_RADIUS) {
              s.state = 'drain';
              s.targetLanternId = weakTarget.id;
              s.drainTickCounter = 0;
            }
          }
        } else {
          // Move gently toward nearest unlit lantern, or gentle wander
          let unlitTarget: LanternState | null = null;
          let unlitDist = Infinity;
          for (const l of this.lanterns) {
            if (!l.lit) {
              const d = distXZ(s.pos, l.pos);
              if (
                d < unlitDist - 1e-6 ||
                (Math.abs(d - unlitDist) <= 1e-6 && unlitTarget && l.id < unlitTarget.id)
              ) {
                unlitTarget = l;
                unlitDist = d;
              }
            }
          }
          if (unlitTarget && unlitDist > 2.5) {
            const dx = unlitTarget.pos[0] - s.pos[0];
            const dz = unlitTarget.pos[2] - s.pos[2];
            const stepDist = Math.min(unlitDist, this.map.shadeSpeed * 0.45 * DT);
            const nx = s.pos[0] + (dx / unlitDist) * stepDist;
            const nz = s.pos[2] + (dz / unlitDist) * stepDist;
            const res = resolveHorizontalObstacles(this.night, prevX, prevZ, nx, nz, s.pos[1]);
            s.pos[0] = res.x;
            s.pos[2] = res.z;
          } else {
            s.wanderAngle += 0.015;
            const stepDist = this.map.shadeSpeed * 0.35 * DT;
            const nx = s.pos[0] + Math.cos(s.wanderAngle) * stepDist;
            const nz = s.pos[2] + Math.sin(s.wanderAngle) * stepDist;
            if (getSupportHeight(this.night, nx, nz, s.pos[1]) !== null) {
              const res = resolveHorizontalObstacles(this.night, prevX, prevZ, nx, nz, s.pos[1]);
              s.pos[0] = res.x;
              s.pos[2] = res.z;
            } else {
              s.wanderAngle += Math.PI * 0.75;
            }
          }
        }
      }

      if (s.safePushTicksLeft === 0) {
        this.blockShadeAtSafeEdge(s, prevX, prevZ);
      }
    }

    // Move Drifters
    for (const d of this.drifters) {
      if (d.state === 'removed' || d.spawnTick >= this.simTick) continue;
      const distP = distXZ(d.pos, this.player.pos);

      if (d.state === 'idle') {
        if (!this.falling && this.player.carried >= DRIFTER_MIN_CARRIED && distP <= DRIFTER_DETECT_RADIUS) {
          d.state = 'chase';
        } else {
          d.idleAngle += 0.025;
          d.pos[0] += Math.cos(d.idleAngle) * DRIFTER_IDLE_SPEED * DT;
          d.pos[2] += Math.sin(d.idleAngle) * DRIFTER_IDLE_SPEED * DT;
        }
      }

      if (d.state === 'chase') {
        if (this.falling || this.player.carried < DRIFTER_MIN_CARRIED || distP > DRIFTER_DETECT_RADIUS) {
          d.state = 'idle';
        } else {
          const dx = this.player.pos[0] - d.pos[0];
          const dz = this.player.pos[2] - d.pos[2];
          const len = Math.hypot(dx, dz);
          if (len > 1e-6) {
            const step = Math.min(len, DRIFTER_SPEED * DT);
            d.pos[0] += (dx / len) * step;
            d.pos[2] += (dz / len) * step;
          }
        }
      } else if (d.state === 'flee') {
        const dx = d.pos[0] - this.player.pos[0];
        const dz = d.pos[2] - this.player.pos[2];
        const len = Math.hypot(dx, dz);
        const ux = len < 1e-6 ? 1 : dx / len;
        const uz = len < 1e-6 ? 0 : dz / len;
        d.pos[0] += ux * DRIFTER_SPEED * DT;
        d.pos[2] += uz * DRIFTER_SPEED * DT;
        d.fleeTicksLeft -= 1;
        if (d.fleeTicksLeft <= 0) {
          d.state = 'removed';
        }
      }
    }
    this.drifters = this.drifters.filter((d) => d.state !== 'removed');

    // 9. Collisions: Drifters steal first, then Shades hit (ascending id)
    if (!this.falling) {
      const sortedDrifters = [...this.drifters].sort((a, b) => a.id.localeCompare(b.id));
      for (const d of sortedDrifters) {
        if (d.state !== 'chase' || d.spawnTick >= this.simTick) continue;
        if (this.player.carried > 0 && distXZ(this.player.pos, d.pos) <= DRIFTER_STEAL_RADIUS) {
          const amount = Math.min(DRIFTER_STEAL_MAX, this.player.carried);
          this.player.carried -= amount;
          d.stolen = amount;
          d.state = 'flee';
          d.fleeTicksLeft = DRIFTER_FLEE_TICKS;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'drifter_steal',
            data: { drifter_id: d.id, amount, carried: this.player.carried }
          });
        }
      }

      if (this.invulnTicks <= 0) {
        const sortedShades = [...this.shades].sort((a, b) => a.id.localeCompare(b.id));
        for (const s of sortedShades) {
          if (
            s.spawnTick >= this.simTick ||
            s.state === 'spawning' ||
            s.state === 'stunned' ||
            s.state === 'recoil' ||
            s.safePushTicksLeft > 0
          ) {
            continue;
          }
          if (
            distXZ(this.player.pos, s.pos) <= TUNING.shade_hit_radius &&
            Math.abs(this.player.pos[1] - s.pos[1]) <= HEIGHT_TOLERANCE
          ) {
            this.player.flames = Math.max(0, this.player.flames - 1);
            this.invulnTicks = Math.round(TUNING.invuln_s * TICK_RATE);
            const dropped = Math.floor(this.player.carried * TUNING.hit_drop_ratio);
            this.player.carried -= dropped;
            if (dropped > 0) {
              this.spawnDroppedMotes(this.player.pos, dropped);
            }
            const dx = s.pos[0] - this.player.pos[0];
            const dz = s.pos[2] - this.player.pos[2];
            const len = Math.hypot(dx, dz);
            s.state = 'recoil';
            s.stateTicksLeft = SHADE_RECOIL_TICKS;
            s.recoilDir = len < 1e-6 ? [1, 0] : [dx / len, dz / len];
            s.targetLanternId = null;
            s.drainTickCounter = 0;

            events.push({
              type: 'event',
              tick: this.tick,
              name: 'player_hit',
              data: { by: 'shade', flames: this.player.flames, dropped }
            });
            break;
          }
        }
      }
    }

    // 10. Scheduled spawns
    if (this.randomMotes && this.simTick % MOTE_SPAWN_INTERVAL_TICKS === 0) {
      this.spawnRandomMote();
    }

    if (this.randomShades) {
      if (this.simTick === SHADE_FIRST_SPAWN_TICK) {
        for (let i = 0; i < 2; i++) {
          const ev = this.spawnRandomShade();
          if (ev) events.push(ev);
        }
      } else if (
        this.simTick > SHADE_FIRST_SPAWN_TICK &&
        (this.simTick - SHADE_FIRST_SPAWN_TICK) % this.map.shadeIntervalTicks === 0
      ) {
        const ev = this.spawnRandomShade();
        if (ev) events.push(ev);
      }
    }

    if (this.randomDrifters && this.simTick % DRIFTER_SPAWN_INTERVAL_TICKS === 0) {
      this.spawnRandomDrifter();
    }

    // 11. Win / loss check (Ticket-03: no early win; survive until dawn with >= ceil(0.6 * total) lit!)
    if (this.player.flames <= 0) {
      this.state = 'lost';
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'no_flames' }
      });
    } else if (this.timeLeftS <= 0) {
      const litLanterns = this.lanterns.filter((l) => l.lit);
      const threshold = Math.ceil(TUNING.win_ratio * this.lanterns.length);
      if (litLanterns.length >= threshold) {
        for (const l of litLanterns) {
          this.score += SCORE_DAWN_LANTERN_BASE + Math.floor(l.fuelUnits / TICK_RATE);
        }
        this.score += this.player.flames * TUNING.score.per_flame_left;
        this.state = 'won';
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'game_over',
          data: { result: 'won', reason: 'dawn_survived' }
        });
      } else {
        this.state = 'lost';
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'game_over',
          data: { result: 'lost', reason: 'dawn' }
        });
      }
    }

    return events;
  }

  getSnapshot(): SnapshotRecord {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.night,
      state: this.state,
      time_left_s: this.timeLeftS,
      score: this.score,
      wind: {
        active: this.wind.active,
        dir_deg: this.wind.dir_deg
      },
      player: {
        pos: roundVec3(this.player.pos),
        vel: roundVec3(this.player.vel),
        grounded: this.player.grounded,
        flames: this.player.flames,
        carried: this.player.carried,
        capacity: this.getCapacity(),
        invuln: this.invulnTicks > 0,
        dash_cd_s: round3(this.dashCdTicks / TICK_RATE),
        pulse_cd_s: round3(this.pulseCdTicks / TICK_RATE),
        charm_s: round3(this.charmTicks / TICK_RATE)
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: roundVec3(l.pos),
        lit: l.lit,
        deposited: l.deposited,
        fuel: l.lit ? round1(l.fuelUnits / TICK_RATE) : 0,
        ever_lit: l.everLit,
        relit_count: l.relitCount
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: roundVec3(s.pos),
        state: s.state
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: roundVec3(m.pos),
        kind: m.kind,
        ttl_s: m.ttlTicks === null ? null : round3(m.ttlTicks / TICK_RATE)
      })),
      drifters: this.drifters.map((d) => ({
        id: d.id,
        pos: roundVec3(d.pos),
        state: d.state,
        stolen: d.stolen
      })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: round3(c.respawnTicks / TICK_RATE)
      }))
    };
  }
}
