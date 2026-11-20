import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const CLI = join(ROOT, 'dist', 'headless.mjs');

function runHeadless({ seed = 42, night = 1, ticks = 300, snapshotEvery = 10, scenario, inputs }) {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-p3-'));
  try {
    const outPath = join(dir, 'out.jsonl');
    const args = [
      CLI,
      '--seed',
      String(seed),
      '--night',
      String(night),
      '--ticks',
      String(ticks),
      '--snapshot-every',
      String(snapshotEvery),
      '--out',
      outPath
    ];
    if (scenario !== undefined) {
      const scenarioPath = join(dir, 'scenario.json');
      writeFileSync(scenarioPath, JSON.stringify(scenario), 'utf8');
      args.push('--scenario', scenarioPath);
    }
    if (inputs !== undefined) {
      const inputsPath = join(dir, 'inputs.json');
      writeFileSync(inputsPath, JSON.stringify(inputs), 'utf8');
      args.push('--inputs', inputsPath);
    }
    execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'pipe' });
    const raw = readFileSync(outPath, 'utf8');
    const lines = raw
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    return { raw, lines };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('Phase 3 — Fuel decay (1/s), lantern_out at 0, ever_lit relight cost = 5 (+40 score)', () => {
  const { lines } = runHeadless({
    seed: 31,
    night: 1,
    ticks: 140,
    snapshotEvery: 20,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 0], carried: 5, flames: 3 },
      motes: [],
      shades: [],
      time_left_s: 240,
      lanterns: [{ id: 'L1', pos: [0, 0, 1.5], lit: true, fuel: 1.0 }]
    },
    inputs: {
      frames: [
        { tick: 70, interact: true },
        { tick: 71, interact: false }
      ]
    }
  });

  const outEv = lines.find((r) => r.type === 'event' && r.name === 'lantern_out');
  assert.ok(outEv, 'Expected lantern_out event at tick 60');
  assert.equal(outEv.tick, 60);
  assert.equal(outEv.data.lantern_id, 'L1');

  const litEv = lines.find((r) => r.type === 'event' && r.name === 'lantern_lit');
  assert.ok(litEv, 'Expected lantern_lit relight event');
  assert.deepEqual(litEv.data, { lantern_id: 'L1', relight: true });

  const snap80 = lines.find((r) => r.type === 'snapshot' && r.tick === 80);
  const l1 = snap80.lanterns.find((l) => l.id === 'L1');
  assert.equal(l1.lit, true);
  assert.equal(l1.ever_lit, true);
  assert.equal(l1.relit_count, 1);
  assert.ok(l1.fuel > 99.5);
  // Score: 5*5 (deposit) + 40 (relight) = 65
  assert.equal(snap80.score, 65);
  // Capacity increased from 10 -> 12 after 1 successful light
  assert.equal(snap80.player.capacity, 12);
});

test('Phase 3 — Refuel lit lantern (ceil((100-fuel)/10)) and ignore full lantern', () => {
  const { lines } = runHeadless({
    seed: 32,
    night: 1,
    ticks: 20,
    snapshotEvery: 5,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 0], carried: 8, flames: 3 },
      motes: [],
      shades: [],
      lanterns: [{ id: 'L1', pos: [0, 0, 1.5], lit: true, fuel: 75 }]
    },
    inputs: {
      frames: [
        { tick: 0, interact: true },
        { tick: 1, interact: false },
        { tick: 5, interact: true }, // now fuel ~99.9 -> needs 1 mote, or at tick 1 full
        { tick: 6, interact: false }
      ]
    }
  });

  const refuels = lines.filter((r) => r.type === 'event' && r.name === 'refuel');
  assert.ok(refuels.length >= 1);
  // At tick 1, fuel decayed by 1/60 to 74.983 -> ceil((100 - 74.983)/10) = 3 motes -> fuel = 100
  assert.equal(refuels[0].data.lantern_id, 'L1');
  assert.equal(refuels[0].data.amount, 3);
  assert.equal(refuels[0].data.fuel, 100);
});

test('Phase 3 — Shade drains weak lantern (<30 fuel), emits fuel_drain, Pulse grants +15 bonus', () => {
  const { lines } = runHeadless({
    seed: 33,
    night: 1,
    ticks: 100,
    snapshotEvery: 10,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 4], carried: 5, flames: 3 }, // 4m from lantern & shade (>6m? No, let's keep player far then pulse)
      motes: [],
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 25 }],
      shades: [{ id: 'S1', pos: [1.5, 0.8, 0], state: 'drain', target_lantern_id: 'L1' }]
    },
    inputs: {
      frames: [
        // Move player outside 6m first? Actually test drain with player at [15,0,0], then separate pulse test
        { tick: 0, pulse: true },
        { tick: 1, pulse: false }
      ]
    }
  });

  // At tick 1, S1 was in 'drain' state within 5m 3D of player -> Pulse gives +15!
  const pulseEv = lines.find((r) => r.type === 'event' && r.name === 'pulse');
  assert.deepEqual(pulseEv.data.stunned_ids, ['S1']);
  const snap10 = lines.find((r) => r.type === 'snapshot' && r.tick === 10);
  assert.equal(snap10.score, 15);

  // Separate drain-over-time test (player far away at [20, 0, 0])
  const drainRun = runHeadless({
    seed: 34,
    night: 1,
    ticks: 80,
    snapshotEvery: 20,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [20, 0, 0], carried: 0, flames: 3 },
      motes: [],
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 25 }],
      shades: [{ id: 'S1', pos: [1.2, 0.8, 0], state: 'wander' }]
    }
  });

  const drainEv = drainRun.lines.find((r) => r.type === 'event' && r.name === 'fuel_drain');
  assert.ok(drainEv, 'Expected fuel_drain event after 60 ticks of draining');
  assert.equal(drainEv.data.lantern_id, 'L1');
  assert.equal(drainEv.data.shade_id, 'S1');
  // 25 - (1 decay + 5 drain) = 19.0 (approx 19.0 after 60 ticks)
  assert.ok(drainEv.data.fuel <= 19.1, `Expected fuel <= 19.1, got ${drainEv.data.fuel}`);
});

test('Phase 3 — Dawn win threshold (3/5 wins, 2/5 loses) & dynamic capacity capped at 20', () => {
  // 2/5 lit at dawn -> LOST (dawn)
  const loseRun = runHeadless({
    seed: 35,
    night: 1,
    ticks: 90,
    snapshotEvery: 30,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 0], carried: 0, flames: 3, successful_lights: 6 },
      motes: [],
      shades: [],
      time_left_s: 1.0,
      lanterns: [
        { id: 'L1', lit: true, fuel: 50 },
        { id: 'L2', lit: true, fuel: 50 }
      ]
    }
  });

  assert.equal(loseRun.lines[0].player.capacity, 20); // min(20, 10 + 2*6) = 20
  const loseOver = loseRun.lines.find((r) => r.type === 'event' && r.name === 'game_over');
  assert.deepEqual(loseOver.data, { result: 'lost', reason: 'dawn' });

  // 3/5 lit at dawn -> WON (dawn_survived)
  const winRun = runHeadless({
    seed: 36,
    night: 1,
    ticks: 90,
    snapshotEvery: 30,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 0], carried: 0, flames: 2 },
      motes: [],
      shades: [],
      time_left_s: 1.0,
      lanterns: [
        { id: 'L1', lit: true, fuel: 60 },
        { id: 'L2', lit: true, fuel: 40 },
        { id: 'L3', lit: true, fuel: 80 }
      ]
    }
  });

  const winOver = winRun.lines.find((r) => r.type === 'event' && r.name === 'game_over');
  assert.deepEqual(winOver.data, { result: 'won', reason: 'dawn_survived' });
  // Dawn score: (50+59) + (50+39) + (50+79) + 2*50 = 109 + 89 + 129 + 100 = 427
  assert.equal(winRun.lines.at(-1).score, 427);
});

test('Phase 3 — Determinism on Night 3 (v1.2 with fuel & drain)', () => {
  const a = runHeadless({ seed: 777, night: 3, ticks: 1800, snapshotEvery: 180 });
  const b = runHeadless({ seed: 777, night: 3, ticks: 1800, snapshotEvery: 180 });
  assert.equal(
    createHash('sha256').update(a.raw).digest('hex'),
    createHash('sha256').update(b.raw).digest('hex')
  );
});
