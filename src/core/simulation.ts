import {
  createDefaultLanterns,
  defaultInputState,
  distXZ,
  DT,
  GRAVITY,
  INITIAL_MOTE_COUNT,
  INITIAL_SHADE_COUNT,
  ISLAND_RADIUS,
  JUMP_VELOCITY,
  MAX_RANDOM_SHADES,
  MOTE_RESPAWN_TICKS,
  round3,
  roundVec3,
  SHADE_SPAWN_INTERVAL_TICKS,
  TICK_RATE,
  TUNING
} from './config.ts';
import { SeededRng } from './prng.ts';
import type {
  GameStateKind,
  InputState,
  LanternState,
  MoteState,
  PlayerState,
  ScenarioConfig,
  ShadeState,
  SimEvent,
  SnapshotRecord,
  Vec3
} from './types.ts';

const SAFE_EPSILON = 0.05;

export class GameSimulation {
  readonly seed: number;
  readonly night: number;
  private readonly rng: SeededRng;

  tick = 0;
  simTick = 0;
  state: GameStateKind = 'playing';
  score = 0;

  initialTimeLeftS: number;
  timeLeftS: number;

  player: PlayerState;
  lanterns: LanternState[];
  shades: ShadeState[] = [];
  motes: MoteState[] = [];

  invulnTicks = 0;
  pulseCooldownTicks = 0;

  private prevInput: InputState = defaultInputState();
  private randomMotes: boolean;
  private randomShades: boolean;
  private nextMoteSeq = 1;
  private nextShadeSeq = 1;
  private moteRespawnTimer = 0;
  private shadeSpawnTimer = 0;

  constructor(seed: number, night = 1, scenario?: ScenarioConfig) {
    this.seed = seed;
    this.night = night;
    this.rng = new SeededRng(seed);

    this.initialTimeLeftS = scenario?.time_left_s ?? TUNING.night1_duration_s;
    this.timeLeftS = round3(this.initialTimeLeftS);

    this.randomMotes = scenario?.random_motes ?? true;
    this.randomShades = scenario?.random_shades ?? true;

    const startPos: Vec3 = scenario?.player?.pos
      ? [scenario.player.pos[0], scenario.player.pos[1], scenario.player.pos[2]]
      : [0, 0, 0];

    this.player = {
      pos: startPos,
      vy: 0,
      flames: scenario?.player?.flames ?? TUNING.flames,
      carried: scenario?.player?.carried ?? 0
    };

    this.lanterns = createDefaultLanterns();
    if (scenario?.lanterns) {
      for (const patch of scenario.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (!target) continue;
        if (patch.pos) {
          target.pos = [patch.pos[0], patch.pos[1], patch.pos[2]];
        }
        if (typeof patch.deposited === 'number') {
          target.deposited = patch.deposited;
        }
        if (typeof patch.lit === 'boolean') {
          target.lit = patch.lit;
          if (patch.lit && typeof patch.deposited !== 'number') {
            target.deposited = Math.max(target.deposited, TUNING.lantern_cost);
          }
        }
      }
    }

    // Motes setup (no events, no score)
    if (scenario?.motes !== undefined) {
      for (const item of scenario.motes) {
        if (Array.isArray(item)) {
          this.motes.push({
            id: `M${this.nextMoteSeq++}`,
            pos: [item[0], 0, item[2]]
          });
        } else {
          this.motes.push({
            id: item.id ?? `M${this.nextMoteSeq++}`,
            pos: [item.pos[0], 0, item.pos[2]]
          });
        }
      }
    } else if (this.randomMotes) {
      for (let i = 0; i < INITIAL_MOTE_COUNT; i++) {
        this.spawnRandomMote();
      }
    }

    // Shades setup (no events, no score)
    if (scenario?.shades !== undefined) {
      for (const spec of scenario.shades) {
        const id = spec.id ?? `S${this.nextShadeSeq++}`;
        const match = /^S(\d+)$/.exec(id);
        if (match) {
          this.nextShadeSeq = Math.max(this.nextShadeSeq, Number(match[1]) + 1);
        }
        this.shades.push({
          id,
          pos: [spec.pos[0], spec.pos[1], spec.pos[2]],
          state: spec.state ?? 'chase',
          stunTicks: spec.state === 'stunned' ? Math.round(TUNING.pulse_stun_s * TICK_RATE) : 0
        });
      }
    } else if (this.randomShades) {
      for (let i = 0; i < INITIAL_SHADE_COUNT; i++) {
        this.spawnRandomShade(false);
      }
    }
  }

  private spawnRandomMote(): void {
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = Math.sqrt(this.rng.next()) * (ISLAND_RADIUS - 5);
      const pos: Vec3 = [round3(Math.cos(angle) * radius), 0, round3(Math.sin(angle) * radius)];
      if (distXZ(pos, this.player.pos) < 3.5) continue;
      this.motes.push({ id: `M${this.nextMoteSeq++}`, pos });
      return;
    }
    const fallbackAngle = this.rng.range(0, Math.PI * 2);
    this.motes.push({
      id: `M${this.nextMoteSeq++}`,
      pos: [round3(Math.cos(fallbackAngle) * 15), 0, round3(Math.sin(fallbackAngle) * 15)]
    });
  }

  private spawnRandomShade(emitEvent: boolean): SimEvent | null {
    let chosen: Vec3 = [32, 0, 0];
    for (let attempt = 0; attempt < 32; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = this.rng.range(24, ISLAND_RADIUS - 4);
      const pos: Vec3 = [round3(Math.cos(angle) * radius), 0, round3(Math.sin(angle) * radius)];
      if (distXZ(pos, this.player.pos) < 12) continue;
      const inSafe = this.lanterns.some((l) => l.lit && distXZ(pos, l.pos) <= TUNING.safe_radius + 1);
      if (inSafe) continue;
      chosen = pos;
      break;
    }
    const id = `S${this.nextShadeSeq++}`;
    this.shades.push({
      id,
      pos: chosen,
      state: 'chase',
      stunTicks: 0
    });
    if (emitEvent) {
      return {
        type: 'event',
        tick: this.tick,
        name: 'shade_spawned',
        data: { id }
      };
    }
    return null;
  }

  private clampToIsland(pos: Vec3): void {
    const r = Math.hypot(pos[0], pos[2]);
    if (r > ISLAND_RADIUS) {
      const scale = ISLAND_RADIUS / r;
      pos[0] *= scale;
      pos[2] *= scale;
    }
  }

  private enforceSafeZones(shade: ShadeState): void {
    for (let pass = 0; pass < 2; pass++) {
      for (const lantern of this.lanterns) {
        if (!lantern.lit) continue;
        const dx = shade.pos[0] - lantern.pos[0];
        const dz = shade.pos[2] - lantern.pos[2];
        const d = Math.hypot(dx, dz);
        if (d <= TUNING.safe_radius) {
          const target = TUNING.safe_radius + SAFE_EPSILON;
          if (d < 1e-6) {
            shade.pos[0] = lantern.pos[0] + target;
            shade.pos[2] = lantern.pos[2];
          } else {
            shade.pos[0] = lantern.pos[0] + (dx / d) * target;
            shade.pos[2] = lantern.pos[2] + (dz / d) * target;
          }
        }
      }
    }
    this.clampToIsland(shade.pos);
  }

  step(input: InputState): SimEvent[] {
    if (this.state !== 'playing') {
      return [];
    }

    const events: SimEvent[] = [];
    this.tick += 1;
    this.simTick += 1;
    this.timeLeftS = Math.max(0, round3(this.initialTimeLeftS - this.simTick / TICK_RATE));

    if (this.invulnTicks > 0) this.invulnTicks -= 1;
    if (this.pulseCooldownTicks > 0) this.pulseCooldownTicks -= 1;

    const jumpPressed = input.jump && !this.prevInput.jump;
    const interactPressed = input.interact && !this.prevInput.interact;
    const pulsePressed = input.pulse && !this.prevInput.pulse;

    this.prevInput = {
      move: [input.move[0], input.move[1]],
      cam_yaw_deg: input.cam_yaw_deg,
      jump: input.jump,
      interact: input.interact,
      pulse: input.pulse,
      dash: input.dash
    };

    // 1. Player movement & jump
    const theta = (input.cam_yaw_deg * Math.PI) / 180;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    let wx = input.move[0] * cosT + input.move[1] * sinT;
    let wz = -input.move[0] * sinT + input.move[1] * cosT;
    const len = Math.hypot(wx, wz);
    if (len > 1) {
      wx /= len;
      wz /= len;
    }

    this.player.pos[0] += wx * TUNING.player_speed * DT;
    this.player.pos[2] += wz * TUNING.player_speed * DT;
    if (!TUNING.fall_enabled) {
      this.clampToIsland(this.player.pos);
    }

    if (jumpPressed && this.player.pos[1] <= 0) {
      this.player.vy = JUMP_VELOCITY;
    }
    if (this.player.pos[1] > 0 || this.player.vy > 0) {
      this.player.pos[1] += this.player.vy * DT;
      this.player.vy += GRAVITY * DT;
      if (this.player.pos[1] <= 0) {
        this.player.pos[1] = 0;
        this.player.vy = 0;
      }
    }

    // 2. Mote pickup (XZ distance <= pickup_radius)
    if (this.player.carried < TUNING.carry_capacity) {
      const remaining: MoteState[] = [];
      for (const mote of this.motes) {
        if (
          this.player.carried < TUNING.carry_capacity &&
          distXZ(this.player.pos, mote.pos) <= TUNING.pickup_radius
        ) {
          this.player.carried += 1;
          this.score += TUNING.score.per_mote;
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

    // 3. Interact / deposit into nearest unlit lantern within interact_radius
    if (interactPressed && this.player.carried > 0) {
      let best: LanternState | null = null;
      let bestDist = Infinity;
      for (const lantern of this.lanterns) {
        if (lantern.lit) continue;
        const d = distXZ(this.player.pos, lantern.pos);
        if (d <= TUNING.interact_radius && d < bestDist) {
          best = lantern;
          bestDist = d;
        }
      }

      if (best) {
        const needed = Math.max(0, TUNING.lantern_cost - best.deposited);
        const amount = Math.min(this.player.carried, needed);
        if (amount > 0) {
          this.player.carried -= amount;
          best.deposited += amount;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'deposit',
            data: {
              lantern_id: best.id,
              amount,
              deposited: best.deposited
            }
          });

          if (best.deposited >= TUNING.lantern_cost) {
            best.lit = true;
            this.score += TUNING.score.per_lantern;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'lantern_lit',
              data: { lantern_id: best.id }
            });

            // Repel any shade now inside newly lit lantern safe zone
            for (const shade of this.shades) {
              this.enforceSafeZones(shade);
            }

            // Win check: all lanterns lit
            if (this.lanterns.every((l) => l.lit)) {
              const timeBonus = Math.floor(this.timeLeftS) * TUNING.score.per_second_left;
              const flameBonus = this.player.flames * TUNING.score.per_flame_left;
              this.score += timeBonus + flameBonus;
              this.state = 'won';
              events.push({
                type: 'event',
                tick: this.tick,
                name: 'game_over',
                data: { result: 'won', reason: 'all_lit' }
              });
              return events;
            }
          }
        }
      }
    }

    // 4. Light pulse (rising edge)
    if (
      pulsePressed &&
      this.pulseCooldownTicks <= 0 &&
      this.player.carried >= TUNING.pulse_cost
    ) {
      this.player.carried -= TUNING.pulse_cost;
      this.pulseCooldownTicks = Math.round(TUNING.pulse_cooldown_s * TICK_RATE);
      const stunnedIds: string[] = [];

      for (const shade of this.shades) {
        const dx = shade.pos[0] - this.player.pos[0];
        const dz = shade.pos[2] - this.player.pos[2];
        const d = Math.hypot(dx, dz);
        if (d <= TUNING.pulse_radius) {
          shade.state = 'stunned';
          shade.stunTicks = Math.round(TUNING.pulse_stun_s * TICK_RATE);
          const dirX = d < 1e-6 ? 1 : dx / d;
          const dirZ = d < 1e-6 ? 0 : dz / d;
          shade.pos[0] += dirX * TUNING.pulse_push_m;
          shade.pos[2] += dirZ * TUNING.pulse_push_m;
          this.enforceSafeZones(shade);
          stunnedIds.push(shade.id);
          this.score += TUNING.score.per_stun;
        }
      }

      events.push({
        type: 'event',
        tick: this.tick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds }
      });
    }

    // 5. Shades movement & player collision
    for (const shade of this.shades) {
      if (shade.state === 'stunned') {
        shade.stunTicks -= 1;
        if (shade.stunTicks <= 0) {
          shade.state = 'chase';
          shade.stunTicks = 0;
        }
        continue;
      }

      // Chase player on XZ plane
      const dx = this.player.pos[0] - shade.pos[0];
      const dz = this.player.pos[2] - shade.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 1e-6) {
        const stepDist = Math.min(d, TUNING.shade_speed * DT);
        shade.pos[0] += (dx / d) * stepDist;
        shade.pos[2] += (dz / d) * stepDist;
      }

      this.enforceSafeZones(shade);

      if (
        this.invulnTicks <= 0 &&
        distXZ(this.player.pos, shade.pos) <= TUNING.shade_hit_radius
      ) {
        this.player.flames = Math.max(0, this.player.flames - 1);
        this.invulnTicks = Math.round(TUNING.invuln_s * TICK_RATE);
        const dropped = Math.min(
          this.player.carried,
          Math.round(this.player.carried * TUNING.hit_drop_ratio)
        );
        this.player.carried -= dropped;

        events.push({
          type: 'event',
          tick: this.tick,
          name: 'player_hit',
          data: {
            by: 'shade',
            flames: this.player.flames,
            dropped
          }
        });

        if (this.player.flames <= 0) {
          this.state = 'lost';
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'game_over',
            data: { result: 'lost', reason: 'no_flames' }
          });
          return events;
        }
      }
    }

    // 6. Random spawns (only when enabled)
    if (this.randomMotes) {
      this.moteRespawnTimer += 1;
      if (this.moteRespawnTimer >= MOTE_RESPAWN_TICKS) {
        this.moteRespawnTimer = 0;
        if (this.motes.length < INITIAL_MOTE_COUNT) {
          this.spawnRandomMote();
        }
      }
    }

    if (this.randomShades) {
      this.shadeSpawnTimer += 1;
      if (this.shadeSpawnTimer >= SHADE_SPAWN_INTERVAL_TICKS) {
        this.shadeSpawnTimer = 0;
        if (this.shades.length < MAX_RANDOM_SHADES) {
          const ev = this.spawnRandomShade(true);
          if (ev) events.push(ev);
        }
      }
    }

    // 7. Dawn timeout check
    if (this.state === 'playing' && this.timeLeftS <= 0) {
      this.state = 'lost';
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'dawn' }
      });
    }

    return events;
  }

  getSnapshot(): SnapshotRecord {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.state,
      time_left_s: this.timeLeftS,
      score: this.score,
      player: {
        pos: roundVec3(this.player.pos),
        flames: this.player.flames,
        carried: this.player.carried
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: roundVec3(l.pos),
        lit: l.lit,
        deposited: l.deposited
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: roundVec3(s.pos),
        state: s.state
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: roundVec3(m.pos)
      }))
    };
  }
}
