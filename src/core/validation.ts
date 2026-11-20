import type { InputFrame, InputsFile, ScenarioConfig, Vec3 } from './types.ts';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

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

    for (const key of ['jump', 'interact', 'pulse', 'dash'] as const) {
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
    if (p.carried !== undefined) {
      if (typeof p.carried !== 'number' || !Number.isInteger(p.carried) || p.carried < 0) {
        throw new ValidationError('scenario.player.carried must be a non-negative integer');
      }
      out.player.carried = p.carried;
    }
    if (p.flames !== undefined) {
      if (typeof p.flames !== 'number' || !Number.isInteger(p.flames) || p.flames < 0) {
        throw new ValidationError('scenario.player.flames must be a non-negative integer');
      }
      out.player.flames = p.flames;
    }
  }

  if (obj.random_motes !== undefined) {
    if (typeof obj.random_motes !== 'boolean') {
      throw new ValidationError('scenario.random_motes must be a boolean');
    }
    out.random_motes = obj.random_motes;
  }

  if (obj.random_shades !== undefined) {
    if (typeof obj.random_shades !== 'boolean') {
      throw new ValidationError('scenario.random_shades must be a boolean');
    }
    out.random_shades = obj.random_shades;
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
          pos: mo.pos
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
      if (so.state !== undefined && so.state !== 'chase' && so.state !== 'stunned') {
        throw new ValidationError(`scenario.shades[${idx}].state must be "chase" or "stunned"`);
      }
      return {
        id: typeof so.id === 'string' ? so.id : undefined,
        pos: so.pos,
        state: so.state as 'chase' | 'stunned' | undefined
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
      return {
        id: lo.id,
        pos: lo.pos as Vec3 | undefined,
        deposited: lo.deposited as number | undefined,
        lit: lo.lit as boolean | undefined
      };
    });
  }

  return out;
}
