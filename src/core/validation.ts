import type {
  DrifterStateKind,
  InputFrame,
  InputsFile,
  MoteKind,
  ScenarioConfig,
  ShadeStateKind,
  Vec3
} from './types.ts';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const VALID_SHADE_STATES = new Set<ShadeStateKind>([
  'spawning',
  'wander',
  'chase',
  'recoil',
  'stunned',
  'drain'
]);

const VALID_DRIFTER_STATES = new Set<DrifterStateKind>(['idle', 'chase', 'flee', 'removed']);

function isVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

export function validateInputsFile(raw: unknown): InputsFile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('Inputs file must be a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.frames)) {
    throw new ValidationError('Inputs file must contain a "frames" array');
  }

  let prevTick = -1;
  const frames: InputFrame[] = [];

  for (let i = 0; i < obj.frames.length; i++) {
    const f = obj.frames[i];
    if (!f || typeof f !== 'object' || Array.isArray(f)) {
      throw new ValidationError(`frames[${i}] must be an object`);
    }
    const frame = f as Record<string, unknown>;
    if (
      typeof frame.tick !== 'number' ||
      !Number.isInteger(frame.tick) ||
      frame.tick < 0
    ) {
      throw new ValidationError(`frames[${i}].tick must be a non-negative integer`);
    }
    if (frame.tick <= prevTick) {
      throw new ValidationError(
        `frames[${i}].tick (${frame.tick}) must be strictly greater than previous tick (${prevTick})`
      );
    }
    prevTick = frame.tick;

    const validated: InputFrame = { tick: frame.tick };

    if (frame.move !== undefined) {
      if (
        !Array.isArray(frame.move) ||
        frame.move.length !== 2 ||
        typeof frame.move[0] !== 'number' ||
        typeof frame.move[1] !== 'number' ||
        !Number.isFinite(frame.move[0]) ||
        !Number.isFinite(frame.move[1]) ||
        frame.move[0] < -1 ||
        frame.move[0] > 1 ||
        frame.move[1] < -1 ||
        frame.move[1] > 1
      ) {
        throw new ValidationError(`frames[${i}].move must be [x, z] with values in [-1, 1]`);
      }
      validated.move = [frame.move[0], frame.move[1]];
    }

    if (frame.cam_yaw_deg !== undefined) {
      if (typeof frame.cam_yaw_deg !== 'number' || !Number.isFinite(frame.cam_yaw_deg)) {
        throw new ValidationError(`frames[${i}].cam_yaw_deg must be a finite number`);
      }
      validated.cam_yaw_deg = frame.cam_yaw_deg;
    }

    for (const key of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) {
      if (frame[key] !== undefined) {
        if (typeof frame[key] !== 'boolean') {
          throw new ValidationError(`frames[${i}].${key} must be a boolean`);
        }
        validated[key] = frame[key] as boolean;
      }
    }

    frames.push(validated);
  }

  return { frames };
}

export function validateScenarioConfig(raw: unknown): ScenarioConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('Scenario file must be a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  const out: ScenarioConfig = {};

  if (obj.player !== undefined) {
    if (!obj.player || typeof obj.player !== 'object' || Array.isArray(obj.player)) {
      throw new ValidationError('scenario.player must be an object');
    }
    const p = obj.player as Record<string, unknown>;
    out.player = {};
    if (p.pos !== undefined) {
      if (!isVec3(p.pos)) throw new ValidationError('scenario.player.pos must be [x, y, z]');
      out.player.pos = p.pos;
    }
    for (const k of [
      'carried',
      'flames',
      'invuln_ticks',
      'dash_cd_ticks',
      'pulse_cd_ticks',
      'charm_ticks',
      'successful_lights'
    ] as const) {
      if (p[k] !== undefined) {
        if (typeof p[k] !== 'number' || !Number.isInteger(p[k]) || (p[k] as number) < 0) {
          throw new ValidationError(`scenario.player.${k} must be a non-negative integer`);
        }
        out.player[k] = p[k] as number;
      }
    }
  }

  for (const flag of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'] as const) {
    if (obj[flag] !== undefined) {
      if (typeof obj[flag] !== 'boolean') {
        throw new ValidationError(`scenario.${flag} must be a boolean`);
      }
      out[flag] = obj[flag] as boolean;
    }
  }

  if (obj.time_left_s !== undefined) {
    if (typeof obj.time_left_s !== 'number' || !Number.isFinite(obj.time_left_s) || obj.time_left_s < 0) {
      throw new ValidationError('scenario.time_left_s must be a non-negative number');
    }
    out.time_left_s = obj.time_left_s;
  }

  if (obj.motes !== undefined) {
    if (!Array.isArray(obj.motes)) {
      throw new ValidationError('scenario.motes must be an array');
    }
    out.motes = obj.motes.map((m, idx) => {
      if (isVec3(m)) return m;
      if (m && typeof m === 'object' && !Array.isArray(m)) {
        const mo = m as Record<string, unknown>;
        if (!isVec3(mo.pos)) {
          throw new ValidationError(`scenario.motes[${idx}].pos must be [x, y, z]`);
        }
        return {
          id: typeof mo.id === 'string' ? mo.id : undefined,
          pos: mo.pos,
          kind: (mo.kind === 'dropped' ? 'dropped' : 'random') as MoteKind,
          ttl_s: typeof mo.ttl_s === 'number' ? mo.ttl_s : null
        };
      }
      throw new ValidationError(`scenario.motes[${idx}] must be [x,y,z] or {pos:[x,y,z]}`);
    });
  }

  if (obj.shades !== undefined) {
    if (!Array.isArray(obj.shades)) {
      throw new ValidationError('scenario.shades must be an array');
    }
    out.shades = obj.shades.map((s, idx) => {
      if (!s || typeof s !== 'object' || Array.isArray(s)) {
        throw new ValidationError(`scenario.shades[${idx}] must be an object`);
      }
      const so = s as Record<string, unknown>;
      if (!isVec3(so.pos)) {
        throw new ValidationError(`scenario.shades[${idx}].pos must be [x, y, z]`);
      }
      if (so.state !== undefined && !VALID_SHADE_STATES.has(so.state as ShadeStateKind)) {
        throw new ValidationError(`scenario.shades[${idx}].state invalid: ${String(so.state)}`);
      }
      if (
        so.state_ticks_left !== undefined &&
        (typeof so.state_ticks_left !== 'number' || !Number.isInteger(so.state_ticks_left) || so.state_ticks_left < 0)
      ) {
        throw new ValidationError(`scenario.shades[${idx}].state_ticks_left must be a non-negative integer`);
      }
      return {
        id: typeof so.id === 'string' ? so.id : undefined,
        pos: so.pos,
        state: so.state as ShadeStateKind | undefined,
        state_ticks_left: so.state_ticks_left as number | undefined,
        target_lantern_id: typeof so.target_lantern_id === 'string' ? so.target_lantern_id : undefined
      };
    });
  }

  if (obj.drifters !== undefined) {
    if (!Array.isArray(obj.drifters)) {
      throw new ValidationError('scenario.drifters must be an array');
    }
    out.drifters = obj.drifters.map((d, idx) => {
      if (!d || typeof d !== 'object' || Array.isArray(d)) {
        throw new ValidationError(`scenario.drifters[${idx}] must be an object`);
      }
      const doObj = d as Record<string, unknown>;
      if (!isVec3(doObj.pos)) {
        throw new ValidationError(`scenario.drifters[${idx}].pos must be [x, y, z]`);
      }
      if (doObj.state !== undefined && !VALID_DRIFTER_STATES.has(doObj.state as DrifterStateKind)) {
        throw new ValidationError(`scenario.drifters[${idx}].state invalid`);
      }
      return {
        id: typeof doObj.id === 'string' ? doObj.id : undefined,
        pos: doObj.pos,
        state: doObj.state as DrifterStateKind | undefined,
        stolen: typeof doObj.stolen === 'number' ? doObj.stolen : 0
      };
    });
  }

  if (obj.charms !== undefined) {
    if (!Array.isArray(obj.charms)) {
      throw new ValidationError('scenario.charms must be an array');
    }
    out.charms = obj.charms.map((c, idx) => {
      if (!c || typeof c !== 'object' || Array.isArray(c)) {
        throw new ValidationError(`scenario.charms[${idx}] must be an object`);
      }
      const co = c as Record<string, unknown>;
      if (!isVec3(co.pos)) {
        throw new ValidationError(`scenario.charms[${idx}].pos must be [x, y, z]`);
      }
      return {
        id: typeof co.id === 'string' ? co.id : undefined,
        pos: co.pos,
        available: typeof co.available === 'boolean' ? co.available : true,
        respawn_s: typeof co.respawn_s === 'number' ? co.respawn_s : 0
      };
    });
  }

  if (obj.lanterns !== undefined) {
    if (!Array.isArray(obj.lanterns)) {
      throw new ValidationError('scenario.lanterns must be an array');
    }
    out.lanterns = obj.lanterns.map((l, idx) => {
      if (!l || typeof l !== 'object' || Array.isArray(l)) {
        throw new ValidationError(`scenario.lanterns[${idx}] must be an object`);
      }
      const lo = l as Record<string, unknown>;
      if (typeof lo.id !== 'string' || lo.id.length === 0) {
        throw new ValidationError(`scenario.lanterns[${idx}].id must be a non-empty string`);
      }
      if (lo.pos !== undefined && !isVec3(lo.pos)) {
        throw new ValidationError(`scenario.lanterns[${idx}].pos must be [x, y, z]`);
      }
      if (
        lo.deposited !== undefined &&
        (typeof lo.deposited !== 'number' || !Number.isInteger(lo.deposited) || lo.deposited < 0)
      ) {
        throw new ValidationError(`scenario.lanterns[${idx}].deposited must be a non-negative integer`);
      }
      if (lo.lit !== undefined && typeof lo.lit !== 'boolean') {
        throw new ValidationError(`scenario.lanterns[${idx}].lit must be a boolean`);
      }
      if (lo.fuel !== undefined && (typeof lo.fuel !== 'number' || !Number.isFinite(lo.fuel) || lo.fuel < 0)) {
        throw new ValidationError(`scenario.lanterns[${idx}].fuel must be a non-negative number`);
      }
      if (lo.ever_lit !== undefined && typeof lo.ever_lit !== 'boolean') {
        throw new ValidationError(`scenario.lanterns[${idx}].ever_lit must be a boolean`);
      }
      return {
        id: lo.id,
        pos: lo.pos as Vec3 | undefined,
        deposited: lo.deposited as number | undefined,
        lit: lo.lit as boolean | undefined,
        fuel: lo.fuel as number | undefined,
        ever_lit: lo.ever_lit as boolean | undefined
      };
    });
  }

  return out;
}
