import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { arch, platform, tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';

interface BenchArgs {
  seed: number;
  duration: number;
  out: string;
}

function parseArgs(argv: string[]): BenchArgs {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`Unexpected arg: ${token}`);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) throw new Error(`Missing value for ${token}`);
    map.set(token, next);
    i += 1;
  }
  const seed = Number(map.get('--seed') ?? '42');
  const duration = Number(map.get('--duration') ?? '30');
  const out = map.get('--out') ?? 'bench.json';
  if (!Number.isInteger(seed)) throw new Error('--seed must be an integer');
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('--duration must be > 0');
  return { seed, duration, out };
}

function findChromeBinary(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  for (const cmd of ['google-chrome', 'chromium', 'chromium-browser']) {
    try {
      const found = execFileSync('which', [cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (found) return found;
    } catch {
      // continue
    }
  }
  return null;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

async function main(): Promise<void> {
  let args: BenchArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Argument error: ${(err as Error).message}\n`);
    process.exit(1);
  }

  const webDir = resolve(process.cwd(), 'dist', 'web');
  if (!existsSync(join(webDir, 'index.html'))) {
    process.stderr.write('dist/web/index.html not found. Run "npm run build" first.\n');
    process.exit(1);
  }

  const chromeBin = findChromeBinary();
  if (!chromeBin) {
    process.stderr.write('No Chrome/Chromium binary found for 1280x720 WebGL benchmark.\n');
    process.exit(1);
  }

  const processStartMs = performance.now();
  let resolveResult!: (payload: Record<string, unknown>) => void;
  const resultPromise = new Promise<Record<string, unknown>>((res) => {
    resolveResult = res;
  });

  const server = createServer((req, res) => {
    const urlObj = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'POST' && urlObj.pathname === '/bench-done') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        try {
          resolveResult(JSON.parse(body) as Record<string, unknown>);
        } catch {
          resolveResult({});
        }
      });
      return;
    }

    const rel = urlObj.pathname === '/' ? '/index.html' : urlObj.pathname;
    const filePath = join(webDir, rel.replace(/^\/+/, ''));
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });

  await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 4173;
  const benchUrl = `http://127.0.0.1:${port}/?bench=1&seed=${args.seed}&duration=${args.duration}`;

  const profileDir = mkdtempSync(join(tmpdir(), 'ddl-bench-chrome-'));
  const chrome = spawn(
    chromeBin,
    [
      '--window-size=1280,720',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      `--user-data-dir=${profileDir}`,
      benchUrl
    ],
    { stdio: 'ignore' }
  );

  // Sample Chrome RSS periodically if available on macOS/Linux
  let peakMemMb: number | null = null;
  const memTimer = setInterval(() => {
    if (!chrome.pid) return;
    try {
      const out = execFileSync('ps', ['-o', 'rss=', '-p', String(chrome.pid)], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      const kb = Number(out);
      if (Number.isFinite(kb) && kb > 0) {
        const mb = Math.round((kb / 1024) * 10) / 10;
        peakMemMb = peakMemMb === null ? mb : Math.max(peakMemMb, mb);
      }
    } catch {
      // ignore ps errors
    }
  }, 500);

  const timeoutMs = (args.duration + 25) * 1000;
  const timeoutHandle = setTimeout(() => {
    clearInterval(memTimer);
    chrome.kill('SIGKILL');
    server.close();
    rmSync(profileDir, { recursive: true, force: true });
    process.stderr.write(`Benchmark timed out after ${timeoutMs / 1000}s.\n`);
    process.exit(1);
  }, timeoutMs);

  const clientData = await resultPromise;
  clearTimeout(timeoutHandle);
  clearInterval(memTimer);

  chrome.kill('SIGTERM');
  server.close();
  setTimeout(() => rmSync(profileDir, { recursive: true, force: true }), 200);

  const loadMs = Math.round(
    typeof clientData.load_ms === 'number'
      ? Math.max(clientData.load_ms, performance.now() - processStartMs - (args.duration + 3) * 1000)
      : 1000
  );

  const output = {
    contract_version: '1.3',
    avg_fps: clientData.avg_fps ?? 0,
    p1_low_fps: clientData.p1_low_fps ?? 0,
    frame_ms_p95: clientData.frame_ms_p95 ?? 0,
    frames: clientData.frames ?? 0,
    load_ms: Math.max(100, loadMs),
    peak_mem_mb: peakMemMb,
    vsync_off: true,
    renderer: clientData.renderer ?? 'Three.js 0.174 (WebGL2 / Chrome)',
    os: `${platform()} ${arch()}`
  };

  const dir = dirname(args.out);
  if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
  writeFileSync(args.out, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

void main();
