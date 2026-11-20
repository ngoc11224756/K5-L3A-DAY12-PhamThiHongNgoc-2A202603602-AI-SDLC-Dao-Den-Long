import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const SOAK = join(ROOT, 'dist', 'soak.mjs');
const RUN = join(ROOT, 'dist', 'run.mjs');

test('Phase 4 — Soak test runs 3 consecutive nights with 0 crashes and bounded RSS memory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-soak-'));
  try {
    const outPath = join(dir, 'soak.json');
    execFileSync(
      process.execPath,
      ['--expose-gc', '--max-semi-space-size=2', SOAK, '--seed', '7', '--nights', '3', '--out', outPath],
      { cwd: ROOT, stdio: 'pipe' }
    );
    const report = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(report.nights, 3);
    assert.equal(report.crashes, 0);
    assert.equal(report.results.length, 3);
    assert.ok(report.mem_start_mb > 0);
    assert.ok(
      report.mem_end_mb <= 1.2 * report.mem_start_mb,
      `Memory grew too much: ${report.mem_start_mb} -> ${report.mem_end_mb}`
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Phase 4 — run_cmd --export-leaderboard exports valid {"entries": [...]} JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-lb-'));
  try {
    const outPath = join(dir, 'lb.json');
    execFileSync(process.execPath, [RUN, '--export-leaderboard', outPath], {
      cwd: ROOT,
      stdio: 'pipe'
    });
    const data = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.ok(Array.isArray(data.entries));
    for (let i = 1; i < data.entries.length; i++) {
      const prev = data.entries[i - 1];
      const curr = data.entries[i];
      assert.ok(
        prev.score > curr.score ||
          (prev.score === curr.score && prev.achieved_at <= curr.achieved_at),
        'Leaderboard entries not sorted properly'
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
