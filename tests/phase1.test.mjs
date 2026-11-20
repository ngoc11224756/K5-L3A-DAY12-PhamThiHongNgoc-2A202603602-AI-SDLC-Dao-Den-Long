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
  const dir = mkdtempSync(join(tmpdir(), 'ddl-test-'));
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

test('Contract file has required v1.0 fields and valid tuning', () => {
  assert.equal(CONTRACT.contract_version, '1.0');
  assert.equal(CONTRACT.tuning.lantern_count_night1, 5);
  assert.equal(CONTRACT.headless_cmd, 'node dist/headless.mjs');
  assert.equal(CONTRACT.tuning.fall_enabled, false);
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
  assert.deepEqual(snap0.player.pos, [0, 0, 0]);
  assert.equal(snap0.time_left_s, 200);

  // At tick 10 player should be mid-air (y > 0)
  const snap10 = lines.find((r) => r.type === 'snapshot' && r.tick === 10);
  assert.ok(snap10.player.pos[1] > 0.5, `Expected y > 0.5 at tick 10, got ${snap10.player.pos[1]}`);

  // After 60 ticks (1s) at cam_yaw_deg = 90 and move = [1, 1] (normalized -> [0.7071, 0.7071]):
  // x' = x*cos(90) + z*sin(90) = +0.7071, z' = -x*sin(90) + z*cos(90) = -0.7071
  // Distance moved in 1s = CONTRACT.tuning.player_speed
  const expectedAxis = CONTRACT.tuning.player_speed * Math.SQRT1_2;
  const snap60 = lines.find((r) => r.type === 'snapshot' && r.tick === 60);
  assert.equal(snap60.time_left_s, 199);
  assert.equal(snap60.player.pos[1], 0);
  assert.ok(Math.abs(snap60.player.pos[0] - expectedAxis) < 0.05, `x=${snap60.player.pos[0]}`);
  assert.ok(Math.abs(snap60.player.pos[2] + expectedAxis) < 0.05, `z=${snap60.player.pos[2]}`);

  const end = lines.at(-1);
  assert.equal(end.type, 'end');
  assert.equal(end.ticks, 60);
  assert.equal(end.state, 'playing');
});

test('Mote pickup respects pickup_radius and carry_capacity, awards per_mote score', () => {
  const { lines } = runHeadless({
    seed: 2,
    ticks: 90,
    snapshotEvery: 30,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      motes: [
        [0, 0, 2.5],
        [0, 0, 3.0],
        [0, 0, 3.5],
        [0, 0, 4.0],
        [0, 0, 4.5],
        [0, 0, 5.0]
      ],
      shades: []
    },
    inputs: {
      frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 0 }]
    }
  });

  const picked = lines.filter((r) => r.type === 'event' && r.name === 'mote_picked');
  assert.equal(picked.length, CONTRACT.tuning.carry_capacity);
  assert.equal(picked.at(-1).data.carried, 5);

  const end = lines.at(-1);
  assert.equal(end.score, 5 * CONTRACT.tuning.score.per_mote);
});

test('Deposit, lantern_lit, scenario pre-lit gives no score, and winning all 5 lanterns', () => {
  const { lines } = runHeadless({
    seed: 3,
    ticks: 120,
    snapshotEvery: 20,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 0], carried: 4, flames: 3 },
      motes: [],
      shades: [],
      time_left_s: 100,
      lanterns: [
        { id: 'L1', pos: [0, 0, 2], deposited: 0, lit: false },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', lit: true }
      ]
    },
    inputs: {
      frames: [
        { tick: 0, interact: true },
        { tick: 1, interact: false }
      ]
    }
  });

  // Tick 0 snapshot must have score 0 (pre-lit L2..L5 must NOT award points)
  assert.equal(lines[0].score, 0);

  const deposit = lines.find((r) => r.type === 'event' && r.name === 'deposit');
  assert.ok(deposit);
  assert.equal(deposit.tick, 1);
  assert.deepEqual(deposit.data, { lantern_id: 'L1', amount: 4, deposited: 4 });

  const lit = lines.find((r) => r.type === 'event' && r.name === 'lantern_lit');
  assert.ok(lit);
  assert.equal(lit.data.lantern_id, 'L1');

  const over = lines.find((r) => r.type === 'event' && r.name === 'game_over');
  assert.ok(over);
  assert.deepEqual(over.data, { result: 'won', reason: 'all_lit' });

  const end = lines.at(-1);
  assert.equal(end.type, 'end');
  assert.equal(end.state, 'won');
  assert.equal(end.ticks, 1);
  // Score: 200 (per_lantern) + floor(99.983)*2 (198) + 3*100 (300) = 698
  assert.equal(end.score, 200 + 99 * 2 + 3 * 100);
});

test('Light pulse stuns & pushes shades in pulse_radius, respects cooldown and cost', () => {
  const { lines } = runHeadless({
    seed: 4,
    ticks: 220,
    snapshotEvery: 10,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 0], carried: 3, flames: 3 },
      motes: [],
      shades: [
        { id: 'S1', pos: [5, 0, 0] },
        { id: 'S2', pos: [20, 0, 0] }
      ]
    },
    inputs: {
      frames: [
        { tick: 0, pulse: true },
        { tick: 1, pulse: false },
        // Attempt second pulse during cooldown (2.0s = 120 ticks) -> must be ignored
        { tick: 20, pulse: true },
        { tick: 21, pulse: false }
      ]
    }
  });

  const pulses = lines.filter((r) => r.type === 'event' && r.name === 'pulse');
  assert.equal(pulses.length, 1);
  assert.deepEqual(pulses[0].data.stunned_ids, ['S1']);

  const snap10 = lines.find((r) => r.type === 'snapshot' && r.tick === 10);
  assert.equal(snap10.player.carried, 2);
  const s1At10 = snap10.shades.find((s) => s.id === 'S1');
  assert.equal(s1At10.state, 'stunned');
  // S1 started at x=5, pushed +6m -> x=11
  assert.ok(s1At10.pos[0] >= 10.9, `Expected S1 pushed to >= 10.9, got ${s1At10.pos[0]}`);

  // After stun duration (3.0s = 180 ticks), S1 should return to chase
  const snap190 = lines.find((r) => r.type === 'snapshot' && r.tick === 190);
  const s1At190 = snap190.shades.find((s) => s.id === 'S1');
  assert.equal(s1At190.state, 'chase');
});

test('Shade chases, hits player, drops motes, respects invuln, and causes no_flames loss', () => {
  const { lines } = runHeadless({
    seed: 5,
    ticks: 400,
    snapshotEvery: 20,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [0, 0, 0], carried: 4, flames: 2 },
      motes: [],
      shades: [{ id: 'S1', pos: [2, 0, 0] }]
    }
  });

  const hits = lines.filter((r) => r.type === 'event' && r.name === 'player_hit');
  assert.equal(hits.length, 2);
  assert.equal(hits[0].data.by, 'shade');
  assert.equal(hits[0].data.flames, 1);
  assert.equal(hits[0].data.dropped, 2);
  // Second hit must be at least invuln_s * 60 = 90 ticks after first hit
  assert.ok(hits[1].tick - hits[0].tick >= 90, `Invuln gap too small: ${hits[1].tick - hits[0].tick}`);

  const over = lines.find((r) => r.type === 'event' && r.name === 'game_over');
  assert.deepEqual(over.data, { result: 'lost', reason: 'no_flames' });

  const end = lines.at(-1);
  assert.equal(end.state, 'lost');
});

test('Lit lantern safe_radius prevents shades from entering', () => {
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
      shades: [{ id: 'S1', pos: [9, 0, 0] }]
    }
  });

  const hits = lines.filter((r) => r.type === 'event' && r.name === 'player_hit');
  assert.equal(hits.length, 0);

  const snapshots = lines.filter((r) => r.type === 'snapshot');
  for (const snap of snapshots) {
    const s1 = snap.shades.find((s) => s.id === 'S1');
    const dist = Math.hypot(s1.pos[0], s1.pos[2]);
    assert.ok(
      dist > CONTRACT.tuning.safe_radius - 0.001,
      `Shade entered safe_radius at tick ${snap.tick}: dist=${dist}`
    );
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
  assert.ok(over);
  assert.deepEqual(over.data, { result: 'lost', reason: 'dawn' });
  assert.equal(lines.at(-1).state, 'lost');
  assert.equal(lines.at(-1).ticks, 90);
});

test('Determinism: two runs with same seed produce identical JSONL output', () => {
  const inputs = {
    frames: [
      { tick: 0, move: [0.4, 0.8], cam_yaw_deg: 25 },
      { tick: 60, move: [-0.6, 0.5], jump: true },
      { tick: 61, jump: false },
      { tick: 120, move: [0, -1], pulse: true },
      { tick: 121, pulse: false }
    ]
  };
  const runA = runHeadless({ seed: 2026, ticks: 300, snapshotEvery: 15, inputs });
  const runB = runHeadless({ seed: 2026, ticks: 300, snapshotEvery: 15, inputs });

  const hashA = createHash('sha256').update(runA.raw).digest('hex');
  const hashB = createHash('sha256').update(runB.raw).digest('hex');
  assert.equal(hashA, hashB);
  assert.equal(runA.raw, runB.raw);
});

test('Malformed inputs (non-strictly-increasing tick) exits with code 2', () => {
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
