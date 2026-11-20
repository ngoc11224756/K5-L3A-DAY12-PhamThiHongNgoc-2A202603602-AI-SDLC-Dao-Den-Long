import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { defaultInputState, round1, TICK_RATE } from '../core/config.ts';
import { SeededRng } from '../core/prng.ts';
import { GameSimulation } from '../core/simulation.ts';
import type { NightId } from '../core/types.ts';

interface SoakArgs {
  seed: number;
  nights: number;
  out: string;
}

function parseArgs(argv: string[]): SoakArgs {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`Unexpected arg: ${token}`);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) throw new Error(`Missing value for ${token}`);
    map.set(token, next);
    i += 1;
  }
  const seed = Number(map.get('--seed') ?? '7');
  const nights = Number(map.get('--nights') ?? '10');
  const out = map.get('--out') ?? 'soak.json';
  if (!Number.isInteger(seed)) throw new Error('--seed must be an integer');
  if (!Number.isInteger(nights) || nights <= 0) throw new Error('--nights must be a positive integer');
  return { seed, nights, out };
}

function getRssMb(): number {
  return round1(process.memoryUsage().rss / (1024 * 1024));
}

function main(): void {
  let args: SoakArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Argument error: ${(err as Error).message}\n`);
    process.exit(1);
  }

  // Warm up V8 JIT across all 3 nights (takes ~20ms) so cold-start JIT compilation isn't counted as a memory leak
  {
    const warmInp = defaultInputState();
    for (const n of [1, 2, 3] as const) {
      const warmSim = new GameSimulation(args.seed + 999, n);
      for (let w = 0; w < 1500; w++) {
        warmInp.move[0] = (w & 1) === 0 ? 0.5 : -0.5;
        warmInp.move[1] = 0.5;
        warmSim.step(warmInp);
      }
    }
  }

  const t0 = performance.now();
  const results: string[] = [];
  let crashes = 0;
  let memStartMb = 0;
  const inp = defaultInputState();

  for (let i = 0; i < args.nights; i++) {
    const night = ((i % 3) + 1) as NightId;
    const nightSeed = args.seed + i;

    try {
      let sim: GameSimulation | null = new GameSimulation(nightSeed, night);
      if (i === 0) {
        memStartMb = getRssMb();
      }

      const inputRng = new SeededRng(nightSeed + 104729);
      const maxTicks = Math.round(sim.map.durationS * TICK_RATE) + 60;
      let moveX = 0;
      let moveZ = 1;
      let prevJump = false;
      let prevDash = false;
      let prevPulse = false;
      let prevInteract = false;

      for (let t = 0; t < maxTicks; t++) {
        if (sim.state === 'won' || sim.state === 'lost') break;

        if (t % 30 === 0) {
          const angle = inputRng.range(0, Math.PI * 2);
          moveX = Math.cos(angle);
          moveZ = Math.sin(angle);
        }

        // Edge-triggered probabilities per tick: 5% jump, 3% dash, 2% pulse, 10% interact
        const jump: boolean = !prevJump && inputRng.next() < 0.05;
        const dash: boolean = !prevDash && inputRng.next() < 0.03;
        const pulse: boolean = !prevPulse && inputRng.next() < 0.02;
        const interact: boolean = !prevInteract && inputRng.next() < 0.1;

        prevJump = jump;
        prevDash = dash;
        prevPulse = pulse;
        prevInteract = interact;

        inp.move[0] = moveX;
        inp.move[1] = moveZ;
        inp.jump = jump;
        inp.dash = dash;
        inp.pulse = pulse;
        inp.interact = interact;

        sim.step(inp);
      }

      results.push(sim.state === 'won' ? 'won' : 'lost');
      sim = null;
    } catch (err) {
      crashes += 1;
      results.push('crash');
      process.stderr.write(`Night ${i + 1} (seed ${nightSeed}) crashed: ${(err as Error).message}\n`);
    }
  }

  // Trigger GC if exposed, then measure final RSS
  const gc = (globalThis as unknown as { gc?: () => void }).gc;
  if (typeof gc === 'function') gc();
  const memEndMb = getRssMb();
  const durationS = Math.round(((performance.now() - t0) / 1000) * 100) / 100;

  const report = {
    nights: args.nights,
    crashes,
    results,
    mem_start_mb: memStartMb,
    mem_end_mb: memEndMb,
    duration_s: durationS
  };

  const dir = dirname(args.out);
  if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
  writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report));
}

main();
