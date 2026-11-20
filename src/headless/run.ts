import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, platform } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import {
  formatIsoWithTimezone,
  insertLeaderboardEntry,
  isValidPlayerName,
  sortAndTrimLeaderboard,
  type LeaderboardData,
  type LeaderboardEntry
} from '../core/leaderboard.ts';

const LEADERBOARD_PATH = join(homedir(), '.dao-den-long-leaderboard.json');

function readLeaderboard(): LeaderboardData {
  if (!existsSync(LEADERBOARD_PATH)) {
    return { entries: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(LEADERBOARD_PATH, 'utf8')) as Partial<LeaderboardData>;
    const entries = Array.isArray(raw.entries) ? sortAndTrimLeaderboard(raw.entries) : [];
    return { entries };
  } catch {
    return { entries: [] };
  }
}

function writeLeaderboard(entries: LeaderboardEntry[]): LeaderboardData {
  const data: LeaderboardData = { entries: sortAndTrimLeaderboard(entries) };
  writeFileSync(LEADERBOARD_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return data;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function main(): void {
  const argv = process.argv.slice(2);
  const exportIdx = argv.indexOf('--export-leaderboard');
  if (exportIdx !== -1) {
    const outPath = argv[exportIdx + 1];
    if (!outPath) {
      process.stderr.write('Missing output path for --export-leaderboard\n');
      process.exit(1);
    }
    const data = readLeaderboard();
    const dir = dirname(outPath);
    if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
    writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`Exported ${data.entries.length} leaderboard entries to ${outPath}`);
    process.exit(0);
  }

  const webDir = resolve(process.cwd(), 'dist', 'web');
  if (!existsSync(join(webDir, 'index.html'))) {
    process.stderr.write('dist/web/index.html not found. Run "npm run build" first.\n');
    process.exit(1);
  }

  const port = Number(process.env.PORT ?? '5173');
  const server = createServer((req, res) => {
    const urlObj = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

    if (urlObj.pathname === '/api/leaderboard') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(readLeaderboard()));
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (c) => {
          body += c;
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body) as Partial<LeaderboardEntry>;
            const name = String(payload.name ?? '').trim();
            if (!isValidPlayerName(name)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid name (3-12 chars)' }));
              return;
            }
            const current = readLeaderboard().entries;
            const entry: LeaderboardEntry = {
              name,
              score: Math.max(0, Math.floor(Number(payload.score ?? 0))),
              nights_won: Math.max(0, Math.min(3, Math.floor(Number(payload.nights_won ?? 0)))),
              achieved_at:
                typeof payload.achieved_at === 'string' && payload.achieved_at.length > 0
                  ? payload.achieved_at
                  : formatIsoWithTimezone(),
              seed: Math.floor(Number(payload.seed ?? 0))
            };
            const updated = writeLeaderboard(insertLeaderboardEntry(current, entry));
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(updated));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
          }
        });
        return;
      }
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

  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`Đảo Đèn Lồng running at ${url}`);
    if (platform() === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform() === 'linux') {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  });
}

main();
