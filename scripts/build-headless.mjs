import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

const targets = [
  { in: 'src/headless/cli.ts', out: 'dist/headless.mjs' },
  { in: 'src/headless/soak.ts', out: 'dist/soak.mjs' },
  { in: 'src/headless/bench.ts', out: 'dist/bench.mjs' },
  { in: 'src/headless/run.ts', out: 'dist/run.mjs' }
];

for (const t of targets) {
  await build({
    entryPoints: [t.in],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    outfile: t.out,
    sourcemap: false,
    minify: false
  });
}

console.log('Built dist/headless.mjs, dist/soak.mjs, dist/bench.mjs, dist/run.mjs');
