import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const CLI = join(ROOT, 'dist', 'headless.mjs');
const CONTRACT = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));

function runHeadless({ seed = 42, night = 1, ticks = 300, snapshotEvery = 10, scenario, inputs }) {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-p1-'));
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

// Updated for Phase 4 (Ticket-04): Contract v1.3 adds bench_cmd & soak_cmd while keeping all v1.2 tuning
test('Contract file has required v1.3 fields and standard tuning', () => {
  assert.equal(CONTRACT.contract_version, '1.3');
  assert.equal(CONTRACT.bench_cmd, 'node dist/bench.mjs');
  assert.equal(CONTRACT.soak_cmd, 'node --expose-gc --max-semi-space-size=2 dist/soak.mjs');
  assert.equal(CONTRACT.run_cmd, 'node dist/run.mjs');
  assert.equal(CONTRACT.tuning.player_speed, 6.0);
  assert.equal(CONTRACT.tuning.carry_capacity, 10);
  assert.equal(CONTRACT.tuning.capacity_max, 20);
  assert.equal(CONTRACT.tuning.lantern_cost, 10);
  assert.equal(CONTRACT.tuning.relight_cost, 5);
  assert.equal(CONTRACT.tuning.fuel_max, 100);
  assert.equal(CONTRACT.tuning.win_ratio, 0.6);
  assert.equal(CONTRACT.tuning.night1_duration_s, 240);
  assert.equal(CONTRACT.tuning.fall_enabled, true);
  assert.equal(CONTRACT.tuning.dash_speed, 14.0);
});

test('Tick 0 snapshot, movement rotation formula, diagonal normalization, and jump', () => {
  const { lines } = runHeadless({
    seed: 1,
    ticks: 60,
    snapshotEvery: 10,
    scenario: {
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      time_left_s: 200
    },
    inputs: {
      frames: [
        { tick: 0, move: [1, 1], cam_yaw_deg: 90, jump: true },
        { tick: 1, jump: false }
      ]
    }
  });

  const snap0 = lines[0];
  assert.equal(snap0.type, 'snapshot');
  assert.equal(snap0.tick, 0);
  assert.equal(snap0.sim_tick, 0);
  assert.equal(snap0.night, 1);
  assert.deepEqual(snap0.player.pos, [0, 0, 0]);
  assert.equal(snap0.time_left_s, 200);

  const snap10 = lines.find((r) => r.type === 'snapshot' && r.tick === 10);
  assert.ok(snap10.player.pos[1] > 0.5, `Expected y > 0.5 at tick 10, got ${snap10.player.pos[1]}`);

  const expectedAxis = CONTRACT.tuning.player_speed * Math.SQRT1_2;
  const snap60 = lines.find((r) => r.type === 'snapshot' && r.tick === 60);
  assert.equal(snap60.time_left_s, 199);
  assert.equal(snap60.player.pos[1], 0);
  assert.ok(Math.abs(snap60.player.pos[0] - expectedAxis) < 0.05, `x=${snap60.player.pos[0]}`);
  assert.ok(Math.abs(snap60.player.pos[2] + expectedAxis) < 0.05, `z=${snap60.player.pos[2]}`);
});

test('Mote pickup respects pickup_radius (1.0m) and carry_capacity (10)', () => {
  const motes = [];
  for (let i = 1; i <= 12; i++) motes.push([0, 0, i * 0.6]);
  const { lines } = runHeadless({
    seed: 2,
    ticks: 120,
    snapshotEvery: 30,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      motes,
      shades: []
    },
    inputs: {
      frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 0 }]
    }
  });

  const picked = lines.filter((r) => r.type === 'event' && r.name === 'mote_picked');
  assert.equal(picked.length, CONTRACT.tuning.carry_capacity);
  assert.equal(picked.at(-1).data.carried, 10);
});

// Updated for Phase 3 (Ticket-03): all_lit early win replaced by dawn_survived; +5/mote deposit, +100 first light
test('Deposit (+5/mote), lantern_lit (+100, relight:false), no early win, and dawn_survived win', () => {
  const { lines } = runHeadless({
    seed: 3,
    ticks: 120,
    snapshotEvery: 20,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 0], carried: 10, flames: 3 },
      motes: [],
      shades: [],
      time_left_s: 1.0,
      lanterns: [
        { id: 'L1', pos: [0, 0, 1.5], deposited: 0, lit: false },
        { id: 'L2', lit: true, fuel: 100 },
        { id: 'L3', lit: true, fuel: 100 },
        { id: 'L4', lit: true, fuel: 100 },
        { id: 'L5', lit: true, fuel: 100 }
      ]
    },
    inputs: {
      frames: [
        { tick: 0, interact: true },
        { tick: 1, interact: false }
      ]
    }
  });

  assert.equal(lines[0].score, 0);
  const deposit = lines.find((r) => r.type === 'event' && r.name === 'deposit');
  assert.deepEqual(deposit.data, { lantern_id: 'L1', amount: 10, deposited: 10 });

  const lit = lines.find((r) => r.type === 'event' && r.name === 'lantern_lit');
  assert.deepEqual(lit.data, { lantern_id: 'L1', relight: false });

  // Must NOT end at tick 1; must survive until dawn (tick 60)
  const over = lines.find((r) => r.type === 'event' && r.name === 'game_over');
  assert.equal(over.tick, 60);
  assert.deepEqual(over.data, { result: 'won', reason: 'dawn_survived' });

  const end = lines.at(-1);
  assert.equal(end.state, 'won');
  assert.equal(end.ticks, 60);
  // Score: 10*5 (50) + 100 (first light) + 5*(50 + 99) (745) + 3*50 (150) = 1045
  assert.equal(end.score, 50 + 100 + 5 * (50 + 99) + 150);
});

test('Light pulse stuns (120 ticks) & pushes (4m over 15 ticks) shades in 3D 5m radius, cooldown 3s', () => {
  const { lines } = runHeadless({
    seed: 4,
    ticks: 160,
    snapshotEvery: 10,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 0], carried: 6, flames: 3 },
      motes: [],
      shades: [
        { id: 'S1', pos: [4, 0.8, 0], state: 'chase' },
        { id: 'S2', pos: [15, 0.8, 0], state: 'wander' }
      ]
    },
    inputs: {
      frames: [
        { tick: 0, pulse: true },
        { tick: 1, pulse: false },
        { tick: 20, pulse: true },
        { tick: 21, pulse: false }
      ]
    }
  });

  const pulses = lines.filter((r) => r.type === 'event' && r.name === 'pulse');
  assert.equal(pulses.length, 1);
  assert.deepEqual(pulses[0].data.stunned_ids, ['S1']);

  const snap20 = lines.find((r) => r.type === 'snapshot' && r.tick === 20);
  assert.equal(snap20.player.carried, 3);
  const s1At20 = snap20.shades.find((s) => s.id === 'S1');
  assert.equal(s1At20.state, 'stunned');
  assert.ok(s1At20.pos[0] >= 7.9, `Expected S1 pushed +4m to >=7.9, got ${s1At20.pos[0]}`);

  const snap130 = lines.find((r) => r.type === 'snapshot' && r.tick === 130);
  const s1At130 = snap130.shades.find((s) => s.id === 'S1');
  assert.notEqual(s1At130.state, 'stunned');
});

test('Shade chases, hits player, drops floor(carried/2) motes, enters recoil, and causes no_flames loss', () => {
  const { lines } = runHeadless({
    seed: 5,
    ticks: 400,
    snapshotEvery: 20,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 0], carried: 5, flames: 2 },
      motes: [],
      shades: [{ id: 'S1', pos: [1.5, 0.8, 0], state: 'chase' }]
    }
  });

  const hits = lines.filter((r) => r.type === 'event' && r.name === 'player_hit');
  assert.equal(hits.length, 2);
  assert.equal(hits[0].data.by, 'shade');
  assert.equal(hits[0].data.flames, 1);
  assert.equal(hits[0].data.dropped, 2); // floor(5/2) = 2
  assert.ok(hits[1].tick - hits[0].tick >= 90);

  const over = lines.find((r) => r.type === 'event' && r.name === 'game_over');
  assert.deepEqual(over.data, { result: 'lost', reason: 'no_flames' });
});

test('Lit lantern safe_radius (6m) blocks shades outside', () => {
  const { lines } = runHeadless({
    seed: 6,
    ticks: 180,
    snapshotEvery: 10,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      motes: [],
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
      shades: [{ id: 'S1', pos: [9, 0.8, 0], state: 'chase' }]
    }
  });

  const hits = lines.filter((r) => r.type === 'event' && r.name === 'player_hit');
  assert.equal(hits.length, 0);
  for (const snap of lines.filter((r) => r.type === 'snapshot')) {
    const s1 = snap.shades.find((s) => s.id === 'S1');
    const dist = Math.hypot(s1.pos[0], s1.pos[2]);
    assert.ok(dist >= CONTRACT.tuning.safe_radius - 0.01, `Shade inside safe_radius: ${dist}`);
  }
});

test('Dawn timeout produces lost state with reason dawn', () => {
  const { lines } = runHeadless({
    seed: 7,
    ticks: 200,
    snapshotEvery: 30,
    scenario: {
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      time_left_s: 1.5
    }
  });
  const over = lines.find((r) => r.type === 'event' && r.name === 'game_over');
  assert.deepEqual(over.data, { result: 'lost', reason: 'dawn' });
  assert.equal(lines.at(-1).ticks, 90);
});

test('Determinism: two runs with same seed produce identical JSONL output', () => {
  const inputs = {
    frames: [
      { tick: 0, move: [0.4, 0.8], cam_yaw_deg: 25 },
      { tick: 60, move: [-0.6, 0.5], jump: true },
      { tick: 61, jump: false },
      { tick: 120, move: [0, -1], dash: true },
      { tick: 121, dash: false }
    ]
  };
  const runA = runHeadless({ seed: 2026, ticks: 360, snapshotEvery: 15, inputs });
  const runB = runHeadless({ seed: 2026, ticks: 360, snapshotEvery: 15, inputs });
  assert.equal(
    createHash('sha256').update(runA.raw).digest('hex'),
    createHash('sha256').update(runB.raw).digest('hex')
  );
});

test('Malformed inputs exits with code 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-err-'));
  try {
    const badInputs = join(dir, 'bad-inputs.json');
    writeFileSync(
      badInputs,
      JSON.stringify({ frames: [{ tick: 10, move: [0, 1] }, { tick: 10, move: [0, 0] }] }),
      'utf8'
    );
    let exitCode = 0;
    try {
      execFileSync(
        process.execPath,
        [CLI, '--seed', '1', '--night', '1', '--ticks', '20', '--inputs', badInputs, '--out', join(dir, 'o.jsonl')],
        { cwd: ROOT, stdio: 'pipe' }
      );
    } catch (err) {
      exitCode = err.status;
    }
    assert.equal(exitCode, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
