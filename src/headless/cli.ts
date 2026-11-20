import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { defaultInputState } from '../core/config.ts';
import { GameSimulation } from '../core/simulation.ts';
import type { EndRecord, InputState, InputsFile, JsonlRecord, ScenarioConfig } from '../core/types.ts';
import { validateInputsFile, validateScenarioConfig, ValidationError } from '../core/validation.ts';

interface CliArgs {
  seed: number;
  night: number;
  ticks: number;
  out: string;
  snapshotEvery: number;
  scenarioPath?: string;
  inputsPath?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    map.set(token, next);
    i += 1;
  }

  const reqInt = (key: string): number => {
    const raw = map.get(key);
    if (raw === undefined) throw new Error(`Missing required argument: ${key}`);
    const n = Number(raw);
    if (!Number.isInteger(n)) throw new Error(`${key} must be an integer, got: ${raw}`);
    return n;
  };

  const seed = reqInt('--seed');
  const night = reqInt('--night');
  if (night !== 1) {
    throw new Error(`Unsupported --night ${night}. Phase 1 supports --night 1 only.`);
  }
  const ticks = reqInt('--ticks');
  if (ticks < 0) {
    throw new Error(`--ticks must be >= 0, got: ${ticks}`);
  }
  const out = map.get('--out');
  if (!out) {
    throw new Error('Missing required argument: --out');
  }

  let snapshotEvery = 10;
  if (map.has('--snapshot-every')) {
    snapshotEvery = reqInt('--snapshot-every');
    if (snapshotEvery <= 0) {
      throw new Error(`--snapshot-every must be > 0, got: ${snapshotEvery}`);
    }
  }

  return {
    seed,
    night,
    ticks,
    out,
    snapshotEvery,
    scenarioPath: map.get('--scenario'),
    inputsPath: map.get('--inputs')
  };
}

function readJsonFile(path: string, label: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    throw new ValidationError(`Cannot read ${label} file "${path}": ${(err as Error).message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new ValidationError(`Invalid JSON in ${label} file "${path}": ${(err as Error).message}`);
  }
}

function main(): void {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Argument error: ${(err as Error).message}\n`);
    process.exit(1);
  }

  let scenario: ScenarioConfig | undefined;
  let inputs: InputsFile = { frames: [] };

  try {
    if (args.scenarioPath) {
      scenario = validateScenarioConfig(readJsonFile(args.scenarioPath, 'scenario'));
    }
    if (args.inputsPath) {
      inputs = validateInputsFile(readJsonFile(args.inputsPath, 'inputs'));
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      process.stderr.write(`Validation error: ${err.message}\n`);
      process.exit(2);
    }
    process.stderr.write(`Error loading files: ${(err as Error).message}\n`);
    process.exit(1);
  }

  const sim = new GameSimulation(args.seed, args.night, scenario);
  const records: JsonlRecord[] = [];

  // Tick 0 snapshot: state after scenario setup, before any input
  records.push(sim.getSnapshot());

  const currentInput: InputState = defaultInputState();
  let frameIdx = 0;

  for (let k = 0; k < args.ticks; k++) {
    if (sim.state !== 'playing') break;

    // Apply frame at tick k if present
    while (frameIdx < inputs.frames.length && inputs.frames[frameIdx].tick <= k) {
      const f = inputs.frames[frameIdx];
      if (f.move !== undefined) currentInput.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) currentInput.cam_yaw_deg = f.cam_yaw_deg;
      if (f.jump !== undefined) currentInput.jump = f.jump;
      if (f.interact !== undefined) currentInput.interact = f.interact;
      if (f.pulse !== undefined) currentInput.pulse = f.pulse;
      if (f.dash !== undefined) currentInput.dash = f.dash;
      frameIdx += 1;
    }

    const events = sim.step(currentInput);
    for (const ev of events) {
      records.push(ev);
    }

    if (sim.tick % args.snapshotEvery === 0) {
      records.push(sim.getSnapshot());
    }

    if (sim.state !== 'playing') {
      break;
    }
  }

  const endRecord: EndRecord = {
    type: 'end',
    ticks: sim.tick,
    state: sim.state,
    score: sim.score
  };
  records.push(endRecord);

  try {
    const dir = dirname(args.out);
    if (dir && dir !== '.') {
      mkdirSync(dir, { recursive: true });
    }
    const content = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
    writeFileSync(args.out, content, 'utf8');
  } catch (err) {
    process.stderr.write(`Failed to write output "${args.out}": ${(err as Error).message}\n`);
    process.exit(1);
  }
}

main();
