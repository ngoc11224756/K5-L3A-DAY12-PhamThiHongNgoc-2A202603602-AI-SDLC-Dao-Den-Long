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
  const dir = mkdtempSync(join(tmpdir(), 'ddl-p2-'));
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
    const t0 = performance.now();
    execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'pipe' });
    const elapsedMs = performance.now() - t0;
    const raw = readFileSync(outPath, 'utf8');
    const lines = raw
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    return { raw, lines, elapsedMs };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('Phase 2 — Dash (14 m/s, 12 ticks, 90-tick cooldown, holds air altitude)', () => {
  const { lines } = runHeadless({
    seed: 10,
    night: 1,
    ticks: 30,
    snapshotEvery: 1,
    scenario: { random_motes: false, random_shades: false, motes: [], shades: [] },
    inputs: {
      frames: [
        { tick: 0, move: [0, 1], jump: true },
        { tick: 1, jump: false },
        { tick: 5, dash: true },
        { tick: 6, dash: false },
        { tick: 20, dash: true }, // during cooldown -> ignored
        { tick: 21, dash: false }
      ]
    }
  });

  const dashes = lines.filter((r) => r.type === 'event' && r.name === 'dash');
  assert.equal(dashes.length, 1);
  assert.equal(dashes[0].tick, 6);

  // During dash (ticks 6..17), Y stays constant
  const snap6 = lines.find((r) => r.type === 'snapshot' && r.tick === 6);
  const snap15 = lines.find((r) => r.type === 'snapshot' && r.tick === 15);
  assert.equal(snap6.player.pos[1], snap15.player.pos[1]);
  assert.ok(snap15.player.pos[2] - snap6.player.pos[2] > 2.0);
});

test('Phase 2 — Fall off island (Y < -10), loses all motes & 1 flame, respawns after 60 ticks with invuln', () => {
  const { lines } = runHeadless({
    seed: 11,
    night: 1,
    ticks: 260,
    snapshotEvery: 10,
    scenario: {
      random_motes: false,
      random_shades: false,
      player: { pos: [39.5, 0, 0], carried: 4, flames: 3 },
      motes: [],
      shades: []
    },
    inputs: {
      frames: [{ tick: 0, move: [1, 0], cam_yaw_deg: 0 }]
    }
  });

  const fallHit = lines.find((r) => r.type === 'event' && r.name === 'player_hit');
  assert.ok(fallHit, 'Expected player_hit by fall');
  assert.equal(fallHit.data.by, 'fall');
  assert.equal(fallHit.data.flames, 2);
  assert.equal(fallHit.data.lost, 4);

  // After 60-tick respawn wait, player is back near spawn (0,0,0) and invuln
  const snapAfter = lines.find(
    (r) => r.type === 'snapshot' && r.tick >= fallHit.tick + 65 && r.tick <= fallHit.tick + 80
  );
  assert.ok(snapAfter, 'Expected snapshot after respawn');
  assert.equal(snapAfter.player.invuln, true);
  assert.equal(snapAfter.player.carried, 0);
  assert.ok(snapAfter.player.pos[0] < 10, `Expected respawn near 0, got x=${snapAfter.player.pos[0]}`);
});

test('Phase 2 — Pause freezes sim_tick, time_left_s, and cooldowns while tick advances', () => {
  const { lines } = runHeadless({
    seed: 12,
    night: 1,
    ticks: 40,
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
        { tick: 5, pause: true },
        { tick: 6, pause: false },
        { tick: 25, pause: true },
        { tick: 26, pause: false }
      ]
    }
  });

  const pausedEv = lines.find((r) => r.type === 'event' && r.name === 'paused');
  const resumedEv = lines.find((r) => r.type === 'event' && r.name === 'resumed');
  assert.ok(pausedEv);
  assert.ok(resumedEv);

  const snap10 = lines.find((r) => r.type === 'snapshot' && r.tick === 10);
  const snap20 = lines.find((r) => r.type === 'snapshot' && r.tick === 20);
  assert.equal(snap10.state, 'paused');
  assert.equal(snap20.state, 'paused');
  assert.equal(snap10.sim_tick, snap20.sim_tick);
  assert.equal(snap10.time_left_s, snap20.time_left_s);

  const snap40 = lines.find((r) => r.type === 'snapshot' && r.tick === 40);
  assert.equal(snap40.state, 'playing');
  assert.ok(snap40.sim_tick < snap40.tick);
});

test('Phase 2 — Night 2 (Đảo Cau): Jump pad launches across to Island B + Wind Charm removes dash cooldown', () => {
  const { lines } = runHeadless({
    seed: 13,
    night: 2,
    ticks: 160,
    snapshotEvery: 10,
    scenario: {
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      player: { pos: [20, 0, 18], carried: 0, flames: 3 },
      motes: [],
      shades: []
    }
  });

  // Landing on Island B (center x=70, radius 28 -> x in [42, 98])
  const snap100 = lines.find((r) => r.type === 'snapshot' && r.tick === 100);
  assert.equal(snap100.night, 2);
  assert.equal(snap100.lanterns.length, 6);
  assert.ok(snap100.player.pos[0] > 42, `Expected launch onto Island B, got x=${snap100.player.pos[0]}`);
  assert.equal(snap100.player.pos[1], 0);
  assert.equal(snap100.player.grounded, true);

  // Wind Charm test on Night 2 (C1 at [35, 0, 0])
  const charmRun = runHeadless({
    seed: 14,
    night: 2,
    ticks: 40,
    snapshotEvery: 5,
    scenario: {
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      player: { pos: [35, 0, 0], carried: 0, flames: 3 },
      motes: [],
      shades: []
    },
    inputs: {
      frames: [
        { tick: 2, dash: true },
        { tick: 3, dash: false },
        { tick: 16, dash: true }, // immediate second dash after 12-tick dash finishes!
        { tick: 17, dash: false }
      ]
    }
  });

  const charmEv = charmRun.lines.find((r) => r.type === 'event' && r.name === 'charm_picked');
  assert.ok(charmEv);
  assert.equal(charmEv.data.charm_id, 'C1');
  assert.equal(charmEv.data.charm_ticks, 600);
  const dashes = charmRun.lines.filter((r) => r.type === 'event' && r.name === 'dash');
  assert.equal(dashes.length, 2, 'Expected 2 dashes with Wind Charm (zero cooldown)');
});

test('Phase 2 — Drifter (Gió Lạc) steals motes and drops them when hit by Pulse during flee', () => {
  const { lines } = runHeadless({
    seed: 15,
    night: 2,
    ticks: 80,
    snapshotEvery: 5,
    scenario: {
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      player: { pos: [0, 0, 0], carried: 6, flames: 3 },
      motes: [],
      shades: [],
      drifters: [{ id: 'D1', pos: [2.5, 0.8, 0], state: 'idle' }]
    },
    inputs: {
      frames: [
        { tick: 20, pulse: true },
        { tick: 21, pulse: false }
      ]
    }
  });

  const steal = lines.find((r) => r.type === 'event' && r.name === 'drifter_steal');
  assert.ok(steal, 'Expected drifter_steal event');
  assert.equal(steal.data.drifter_id, 'D1');
  assert.equal(steal.data.amount, 3);
  assert.equal(steal.data.carried, 3);

  const drop = lines.find((r) => r.type === 'event' && r.name === 'drifter_drop');
  assert.ok(drop, 'Expected drifter_drop event when pulsed during flee');
  assert.equal(drop.data.drifter_id, 'D1');
  assert.equal(drop.data.amount, 3);
});

test('Phase 2 — Night 3 (Đảo Chuông): 7 lanterns, Tier 1->Tier 2 jump pad, wind active, & <= 30s full run', () => {
  // Jump pad at (0, 3, 13) launches to Tier 2 (Y = 6, r <= 8)
  const padRun = runHeadless({
    seed: 16,
    night: 3,
    ticks: 120,
    snapshotEvery: 10,
    scenario: {
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      wind_enabled: false,
      player: { pos: [0, 3, 13], carried: 0, flames: 3 },
      motes: [],
      shades: []
    }
  });
  const snap80 = padRun.lines.find((r) => r.type === 'snapshot' && r.tick === 80);
  assert.equal(snap80.lanterns.length, 7);
  assert.equal(snap80.player.pos[1], 6, `Expected landing on Tier 2 (Y=6), got Y=${snap80.player.pos[1]}`);

  // Full Night 3 run (21,600 ticks) performance + wind active check + determinism
  const fullA = runHeadless({ seed: 99, night: 3, ticks: 21600, snapshotEvery: 600 });
  assert.ok(fullA.elapsedMs < 30000, `Full 21,600-tick run took ${fullA.elapsedMs}ms (> 30s)`);
  const windActiveSnap = fullA.lines.find((r) => r.type === 'snapshot' && r.wind?.active === true);
  assert.ok(windActiveSnap, 'Expected wind.active === true during Night 3');

  const fullB = runHeadless({ seed: 99, night: 3, ticks: 21600, snapshotEvery: 600 });
  assert.equal(
    createHash('sha256').update(fullA.raw).digest('hex'),
    createHash('sha256').update(fullB.raw).digest('hex')
  );
});
