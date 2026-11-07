import type { WaveEvent } from '@tb/shared';
import type { Battle, GameState, Rng, Tile } from './types';
import { neighborsOf } from './map';
import { pick } from './rng';

interface Hold {
  tileId: number;
  capturer: string;
}

// Section 11: prefer a loser's hexagon bordering the winner's land, otherwise any of theirs.
export function pickCaptureTile(pool: Tile[], allTiles: Tile[], winnerSide: string, rng: Rng): Tile {
  const bordering = pool.filter((t) => neighborsOf(t, allTiles).some((n) => n.owner === winnerSide));
  return pick(bordering.length ? bordering : pool, rng);
}

// Applies a finished wave's results in finishing order, including the last stand rule.
export function applyWaveResults(game: GameState, cost: number, rng: Rng): WaveEvent[] {
  const events: WaveEvent[] = [];
  const ordered = game.battles.filter((b) => b.finishOrder !== null).sort((x, y) => x.finishOrder! - y.finishOrder!);
  const sideOf = (playerId: string) => game.players.find((p) => p.id === playerId)!.sideId;
  const sideById = (id: string) => game.sides.find((s) => s.id === id)!;
  const holds = new Map<string, Hold>();
  const eliminatedBy = new Map<string, string>();

  const hasRoundAfter = (sideId: string, index: number) =>
    ordered.slice(index + 1).some((b: Battle) => sideOf(b.a) === sideId || sideOf(b.b) === sideId);
  const liveTiles = (sideId: string) => {
    const held = holds.get(sideId)?.tileId;
    return game.tiles.filter((t) => t.owner === sideId && t.id !== held);
  };

  const recipientFor = (capturer: string): string => {
    let id = capturer;
    const seen = new Set<string>();
    while (sideById(id).eliminated && eliminatedBy.has(id) && !seen.has(id)) {
      seen.add(id);
      id = eliminatedBy.get(id)!;
    }
    if (!sideById(id).eliminated) return id;
    return game.sides.filter((s) => !s.eliminated).sort((x, y) => liveTiles(y.id).length - liveTiles(x.id).length)[0].id;
  };

  // A held hexagon finally goes to whoever took it, or to whoever knocked them out.
  const transferHold = (sideId: string) => {
    const hold = holds.get(sideId)!;
    holds.delete(sideId);
    const recipient = recipientFor(hold.capturer);
    game.tiles.find((t) => t.id === hold.tileId)!.owner = recipient;
    events.push({ type: 'capture', winnerSide: recipient, loserSide: sideId, winnerId: '', loserId: '', tiles: [hold.tileId] });
    // Gaining land means the recipient is no longer at 0, so its own hold can complete.
    if (holds.has(recipient)) transferHold(recipient);
  };

  const eliminate = (sideId: string, by: string) => {
    sideById(sideId).eliminated = true;
    eliminatedBy.set(sideId, by);
    events.push({ type: 'eliminated', side: sideId });
  };

  ordered.forEach((battle, index) => {
    if (battle.winner) {
      const loserId = battle.winner === battle.a ? battle.b : battle.a;
      const winnerSide = sideOf(battle.winner);
      const loserSide = sideOf(loserId);
      const hold = holds.get(winnerSide);

      if (hold) {
        // Last stand: the win saves the team on its last hexagon and captures nothing else.
        holds.delete(winnerSide);
        events.push({ type: 'saved', side: winnerSide, tile: hold.tileId, playerId: battle.winner });
      } else {
        const captured: number[] = [];
        for (let i = 0; i < cost; i++) {
          const pool = liveTiles(loserSide);
          if (pool.length === 0) break;
          if (pool.length === 1 && hasRoundAfter(loserSide, index)) {
            holds.set(loserSide, { tileId: pool[0].id, capturer: winnerSide });
            events.push({ type: 'hold', side: loserSide, tile: pool[0].id });
            break;
          }
          const tile = pickCaptureTile(pool, game.tiles, winnerSide, rng);
          tile.owner = winnerSide;
          captured.push(tile.id);
        }
        if (captured.length) {
          events.push({ type: 'capture', winnerSide, loserSide, winnerId: battle.winner, loserId, tiles: captured });
        }
        if (!sideById(loserSide).eliminated && !holds.has(loserSide) && liveTiles(loserSide).length === 0) {
          eliminate(loserSide, winnerSide);
        }
      }
    }

    // Sides on hold with no rounds left have lost their last stand.
    for (const [sideId, hold] of [...holds]) {
      if (hasRoundAfter(sideId, index)) continue;
      const by = hold.capturer;
      transferHold(sideId);
      if (liveTiles(sideId).length === 0 && !sideById(sideId).eliminated) eliminate(sideId, by);
    }
  });

  return events;
}
