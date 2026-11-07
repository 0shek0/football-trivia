import { randomCostRange, STORE_ITEMS, type GameView, type LobbyView, type MyBattleView, type SpectateView } from '@tb/shared';
import { battleOf, currentCost, mapSize, startError, wavesToNextCost, type Battle, type GameState, type Lobby } from '@tb/engine';

export function lobbyView(lobby: Lobby): LobbyView {
  return {
    players: lobby.players.map((p) => ({ id: p.id, name: p.name, ready: p.ready, color: p.color, team: p.team, connected: p.connected })),
    teamColors: lobby.teamColors,
    settings: lobby.settings,
    mapSize: mapSize(lobby),
    startError: startError(lobby),
  };
}

function myBattleView(battle: Battle, playerId: string, msLeft: number): MyBattleView {
  const isA = battle.a === playerId;
  const showQuestion = (battle.stage === 'question' || battle.stage === 'reveal') && battle.current;
  const revealed = battle.stage === 'reveal' && battle.current;
  const opponentAnswer = isA ? battle.answerB : battle.answerA;
  return {
    id: battle.id,
    opponentId: isA ? battle.b : battle.a,
    stage: battle.stage,
    question: battle.sudden ? battle.suddenCount : battle.questionIndex + 1,
    sudden: battle.sudden,
    text: showQuestion ? battle.current!.text : null,
    options: showQuestion ? battle.current!.options : null,
    myAnswer: isA ? battle.answerA : battle.answerB,
    opponentAnswered: opponentAnswer !== null,
    // Hidden until the reveal, so neither is readable from the browser early.
    correct: revealed ? battle.current!.correct : null,
    opponentAnswer: revealed ? opponentAnswer : null,
    myScore: isA ? battle.scoreA : battle.scoreB,
    opponentScore: isA ? battle.scoreB : battle.scoreA,
    winner: battle.winner,
    forfeit: battle.forfeit,
    msLeft,
  };
}

function spectateView(battle: Battle, msLeft: number): SpectateView {
  const showQuestion = (battle.stage === 'question' || battle.stage === 'reveal') && battle.current;
  return {
    id: battle.id,
    stage: battle.stage,
    text: showQuestion ? battle.current!.text : null,
    options: showQuestion ? battle.current!.options : null,
    answerA: battle.answerA,
    answerB: battle.answerB,
    correct: battle.stage === 'reveal' && battle.current ? battle.current.correct : null,
    forfeit: battle.forfeit,
    msLeft,
  };
}

export function gameView(game: GameState, playerId: string, phaseMsLeft: number, battleMsLeft: (battleId: number) => number): GameView {
  const me = game.players.find((p) => p.id === playerId);
  const battle = game.phase === 'team_naming' || game.phase === 'countdown' ? null : battleOf(game, playerId);
  const watched = game.phase === 'wave' ? game.battles.find((b) => b.id === me?.watching) : undefined;
  const naming = game.phase === 'team_naming' ? game.sides.find((s) => s.namerId === playerId && !s.named) : undefined;
  return {
    phase: game.phase,
    msLeft: phaseMsLeft,
    wave: game.wave,
    cost: currentCost(game),
    wavesToNextCost: wavesToNextCost(game),
    costJustRose: game.costRose,
    costRange: randomCostRange(game.completedWaves + 1),
    questionTimeSec: game.settings.questionTimeSec,
    sides: game.sides.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      memberIds: s.memberIds,
      isTeam: s.isTeam,
      named: s.named,
      eliminated: s.eliminated,
      tiles: game.tiles.filter((t) => t.owner === s.id).length,
    })),
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      sideId: p.sideId,
      roundsPlayed: p.roundsPlayed,
      correct: p.correct,
      wrong: p.wrong,
      answered: p.answered,
      roundsWon: p.roundsWon,
      tilesCaptured: p.tilesCaptured,
      connected: p.connected,
      left: p.left,
    })),
    tiles: game.tiles.map((t) => ({ id: t.id, q: t.q, r: t.r, owner: t.owner, decor: t.decor })),
    battles: game.battles.map((b) => ({
      id: b.id,
      a: b.a,
      b: b.b,
      scoreA: b.scoreA,
      scoreB: b.scoreB,
      question: b.sudden ? b.suddenCount : b.questionIndex + 1,
      sudden: b.sudden,
      finished: b.stage === 'finished',
      winner: b.winner,
    })),
    myBattle: battle ? myBattleView(battle, playerId, battleMsLeft(battle.id)) : null,
    spectating: watched ? spectateView(watched, battleMsLeft(watched.id)) : null,
    sittingOut: game.sittingOut,
    namingFor: naming?.id ?? null,
    lastWave: game.lastWave,
    winnerSide: game.winnerSide,
    credits: me?.credits ?? 0,
    inventory: me?.inventory ?? [],
    store: STORE_ITEMS,
  };
}
