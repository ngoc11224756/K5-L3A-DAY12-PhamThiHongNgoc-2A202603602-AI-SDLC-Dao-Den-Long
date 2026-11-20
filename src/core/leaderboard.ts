export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
}

export const LEADERBOARD_MAX_ENTRIES = 10;

// 3-12 chars: ASCII [A-Za-z0-9_] + Unicode letters (Vietnamese diacritics supported)
export function isValidPlayerName(name: string): boolean {
  return /^[\p{L}0-9_]{3,12}$/u.test(name);
}

export function formatIsoWithTimezone(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const tzMin = -date.getTimezoneOffset();
  const sign = tzMin >= 0 ? '+' : '-';
  const absMin = Math.abs(tzMin);
  const hh = pad(Math.floor(absMin / 60));
  const mm = pad(absMin % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hh}:${mm}`;
}

export function sortAndTrimLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.achieved_at.localeCompare(b.achieved_at);
    })
    .slice(0, LEADERBOARD_MAX_ENTRIES);
}

export function insertLeaderboardEntry(
  current: LeaderboardEntry[],
  entry: LeaderboardEntry
): LeaderboardEntry[] {
  return sortAndTrimLeaderboard([...current, entry]);
}
