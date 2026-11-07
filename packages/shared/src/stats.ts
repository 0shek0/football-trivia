import type { GamePlayerView } from './protocol';

export interface LeaderboardRow {
  rank: number;
  player: GamePlayerView;
}

// Most correct answers first. Fewer wrong answers breaks ties, and equal players share a rank.
export function leaderboard(players: GamePlayerView[]): LeaderboardRow[] {
  const sorted = [...players].sort((a, b) => b.correct - a.correct || a.wrong - b.wrong || a.name.localeCompare(b.name));
  const rows: LeaderboardRow[] = [];
  sorted.forEach((player, i) => {
    const previous = rows[i - 1];
    const tied = previous && previous.player.correct === player.correct && previous.player.wrong === player.wrong;
    rows.push({ rank: tied ? previous.rank : i + 1, player });
  });
  return rows;
}

const AWARDS = [
  { key: 'correct', title: 'Most correct answers', unit: 'correct' },
  { key: 'answered', title: 'Most questions answered', unit: 'answered' },
  { key: 'tilesCaptured', title: 'Most land won', unit: 'hexagons' },
  { key: 'wrong', title: 'Most wrong answers', unit: 'wrong' },
] as const;

export interface Award {
  key: string;
  title: string;
  unit: string;
  value: number;
  // More than one when players tie.
  players: GamePlayerView[];
}

export function awards(players: GamePlayerView[]): Award[] {
  return AWARDS.flatMap(({ key, title, unit }) => {
    const value = Math.max(0, ...players.map((p) => p[key]));
    if (value === 0) return [];
    return [{ key, title, unit, value, players: players.filter((p) => p[key] === value) }];
  });
}
