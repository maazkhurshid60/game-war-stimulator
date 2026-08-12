import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Game, GameState, Round } from '../types';
import apiService from '../services/api';
import { GameBoard } from '../components/GameBoard';
import { RoundHistory } from '../components/RoundHistory';
import { GameController } from '../components/GameController';
import toast from 'react-hot-toast';

const normalizeGameState = (state: Partial<GameState> | null | undefined, game: Game): GameState => {
  const legacyState = state as (Partial<GameState> & { total_rounds?: number }) | null | undefined;
  const completedWinner = game.status === 'completed' ? game.winner_player : null;
  const defaultP1Cards = completedWinner === 1 ? 52 : completedWinner === 2 ? 0 : 26;
  const defaultP2Cards = completedWinner === 2 ? 52 : completedWinner === 1 ? 0 : 26;

  return {
    game_id: state?.game_id || game.id,
    status: state?.status || game.status,
    round_counter: state?.round_counter ?? legacyState?.total_rounds ?? game.total_rounds ?? 0,
    total_wars: state?.total_wars ?? 0,
    player1: {
      id: state?.player1?.id || '1',
      name: state?.player1?.name || game.player1_name || 'Player 1',
      cards_remaining: state?.player1?.cards_remaining ?? defaultP1Cards,
    },
    player2: {
      id: state?.player2?.id || '2',
      name: state?.player2?.name || game.player2_name || 'Player 2',
      cards_remaining: state?.player2?.cards_remaining ?? defaultP2Cards,
    },
    winner: state?.winner ?? (
      completedWinner === 1
        ? game.player1_name || 'Player 1'
        : completedWinner === 2
          ? game.player2_name || 'Player 2'
          : null
    ),
  };
};

export const GamePage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;

    setGame(null);
    setGameState(null);
    setRounds([]);
    setCurrentRound(null);
    setIsReadOnly(false);

    const loadGameData = async () => {
      setIsLoading(true);
      try {
        const [gDetails, gState] = await Promise.all([
          apiService.getGame(gameId),
          apiService.getGameState(gameId),
        ]);

        if (cancelled) return;
        setGame(gDetails);
        setGameState(normalizeGameState(gState, gDetails));

        let loadedRounds: Round[] = [];
        try {
          const allRounds = await apiService.getAllRounds(gameId);
          if (cancelled) return;
          loadedRounds = allRounds;
          setRounds(loadedRounds);
        } catch (roundsError) {
          if (cancelled) return;
          console.error('Failed to load round history', roundsError);
          setRounds([]);
        }

        if (cancelled) return;
        if (gDetails.status === 'completed') {
          setIsReadOnly(true);
        }
        if (loadedRounds.length > 0) {
          setCurrentRound(loadedRounds[loadedRounds.length - 1]);
        }
      } catch (err: any) {
        if (cancelled) return;
        toast.error('Failed to load game match details');
        console.error(err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadGameData();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const handleGameStart = (newGame: Game) => {
    navigate(`/game/${newGame.id}`);
  };

  const handleRoundPlay = useCallback(async (newRound: Round) => {
    setRounds((prev) => [...prev, newRound]);
    setCurrentRound(newRound);

    if (newRound.p1_remaining != null && newRound.p2_remaining != null) {
      setGameState((previousState) => previousState ? {
        ...previousState,
        round_counter: newRound.round_number,
        total_wars: previousState.total_wars + (newRound.is_war ? 1 : 0),
        player1: {
          ...previousState.player1,
          cards_remaining: newRound.p1_remaining as number,
        },
        player2: {
          ...previousState.player2,
          cards_remaining: newRound.p2_remaining as number,
        },
      } : previousState);
    }

    if (gameId) {
      try {
        const freshState = await apiService.getGameState(gameId);
        setGameState(game ? normalizeGameState(freshState, game) : freshState);
        if (freshState.status === 'completed') {
          const [completedGame, allRounds] = await Promise.all([
            apiService.getGame(gameId),
            apiService.getAllRounds(gameId),
          ]);
          setGame(completedGame);
          setRounds(allRounds);
          setIsReadOnly(true);
          if (allRounds.length > 0) {
            setCurrentRound(allRounds[allRounds.length - 1]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch fresh state', err);
      }
    }
  }, [gameId, game]);

  const handleGameComplete = useCallback(async (completedGame: Game) => {
    setGame(completedGame);
    setIsReadOnly(true);

    if (!gameId) return;
    try {
      const [freshState, allRounds] = await Promise.all([
        apiService.getGameState(gameId),
        apiService.getAllRounds(gameId),
      ]);
      setGameState(normalizeGameState(freshState, completedGame));
      setRounds(allRounds);
      if (allRounds.length > 0) {
        setCurrentRound(allRounds[allRounds.length - 1]);
      }
    } catch (err) {
      console.error('Failed to refresh completed game result', err);
      setGameState((previousState) => previousState ? {
        ...previousState,
        status: 'completed',
        winner: completedGame.winner_player === 1
          ? previousState.player1.name
          : completedGame.winner_player === 2
            ? previousState.player2.name
            : 'Tie',
      } : previousState);
    }
  }, [gameId]);

  const isGameOver = game?.status === 'completed' || gameState?.status === 'completed';

  const roundResults = useMemo(() => {
    let player1Wins = 0;
    let player2Wins = 0;
    let tieRounds = 0;

    rounds.forEach((round) => {
      if (round.is_war || round.winner_player == null) tieRounds += 1;
      else if (round.winner_player === 1) player1Wins += 1;
      else if (round.winner_player === 2) player2Wins += 1;
    });

    return { player1Wins, player2Wins, tieRounds };
  }, [rounds]);

  const finalWinner = game?.winner_player === 1
    ? gameState?.player1.name || game.player1_name || 'Player 1'
    : game?.winner_player === 2
      ? gameState?.player2.name || game.player2_name || 'Player 2'
      : gameState?.winner || 'Tie';

  useEffect(() => {
    if (isReadOnly) return;
    const handleSpacePress = async (e: KeyboardEvent) => {
      if (e.code === 'Space' && gameId && !isLoading && !isGameOver) {
        e.preventDefault();
        try {
          const r = await apiService.playRound(gameId);
          await handleRoundPlay(r);
        } catch (err: any) {
          toast.error(err.message || 'Round failed');
        }
      }
    };
    window.addEventListener('keydown', handleSpacePress);
    return () => window.removeEventListener('keydown', handleSpacePress);
  }, [gameId, isLoading, isGameOver, handleRoundPlay, isReadOnly]);

  const handleDownloadReport = useCallback(() => {
    if (!game || rounds.length === 0) return;

    const winnerLabel =
      game.winner_player === 1
        ? 'Player 1'
        : game.winner_player === 2
          ? 'Player 2'
          : 'Tie / Max Rounds';

    const headers = ['Round', 'P1 Card', 'P2 Card', 'Winner', 'Is War', 'War Count', 'Cards Won'];

    const rows = rounds.map((r) => [
      r.round_number,
      r.player1_card || '-',
      r.player2_card || '-',
      r.winner_player === 1 ? 'Player 1' : r.winner_player === 2 ? 'Player 2' : 'Tie / War',
      r.is_war ? 'Yes' : 'No',
      r.war_round_count ?? 0,
      r.cards_won ?? '-',
    ]);

    const csvLines = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const metaBlock = [
      `# War Game Report`,
      `# Game ID: ${game.id}`,
      `# Status: ${game.status}`,
      `# Winner: ${winnerLabel}`,
      `# Total Rounds: ${game.total_rounds}`,
      `# Generated: ${new Date().toISOString()}`,
      '',
    ].join('\n');

    const blob = new Blob([metaBlock + csvLines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `war_game_${game.id.slice(0, 8)}_report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Game report downloaded!');
  }, [game, rounds]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {isReadOnly && game && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => navigate('/stats')}
              className="flex items-center text-xs text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Back to Stats
            </button>
            <div className="hidden sm:block h-4 border-l border-slate-200" />
            <div>
              <span className="text-xs text-slate-700 font-medium">Completed Game</span>
              <span className="text-xs text-slate-500 ml-2">#{game.id.slice(0, 12)}</span>
            </div>
            <span className="text-xs text-slate-700 font-semibold">{rounds.length} rounds played</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
              game.winner_player === 1
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : game.winner_player === 2
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              {game.winner_player === 1 ? 'Player 1 Won' : game.winner_player === 2 ? 'Player 2 Won' : 'Tie'}
            </span>
          </div>

          <button
            onClick={handleDownloadReport}
            disabled={rounds.length === 0}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            Download Report
          </button>
        </div>
      )}

      {!isReadOnly && (
        <GameController
          gameId={gameId || null}
          onGameStart={handleGameStart}
          onRoundPlay={handleRoundPlay}
          onGameComplete={handleGameComplete}
          isLoading={isLoading}
        />
      )}

      {isGameOver && gameState && (
        <section className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-widest text-amber-700 font-bold">Final Result</p>
              <h2 className="text-xl font-extrabold text-slate-950 mt-0.5">
                {finalWinner === 'Tie' ? 'The game ended in a tie' : `${finalWinner} is the winner`}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                <div className="text-2xl font-black text-indigo-700">{roundResults.player1Wins}</div>
                <div className="text-[10px] uppercase text-slate-500 font-bold">Player 1 wins</div>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                <div className="text-2xl font-black text-rose-700">{roundResults.player2Wins}</div>
                <div className="text-[10px] uppercase text-slate-500 font-bold">Player 2 wins</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <div className="text-2xl font-black text-slate-800">{roundResults.tieRounds}</div>
                <div className="text-[10px] uppercase text-slate-500 font-bold">Tie rounds</div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GameBoard
            gameState={gameState}
            currentRound={currentRound}
            onPlayRound={async () => {
              if (!gameId || isReadOnly) return;
              try {
                const r = await apiService.playRound(gameId);
                await handleRoundPlay(r);
              } catch (err: any) {
                toast.error(err.message || 'Round failed');
              }
            }}
            onSimulate={async () => {
              if (!gameId || isReadOnly) return;
              try {
                const g = await apiService.simulateGame(gameId);
                await handleGameComplete(g);
              } catch (err: any) {
                toast.error(err.message || 'Simulation failed');
              }
            }}
            onComplete={async () => {
              if (!gameId || isReadOnly) return;
              try {
                const g = await apiService.completeGame(gameId);
                await handleGameComplete(g);
              } catch (err: any) {
                toast.error(err.message || 'Completion failed');
              }
            }}
            isLoading={isLoading}
            isGameOver={isGameOver}
          />
        </div>

        <div className="lg:col-span-1">
          <RoundHistory
            rounds={rounds}
            isLoading={isLoading}
            currentRound={currentRound?.round_number || 0}
            onRoundClick={(rNum) => {
              const found = rounds.find((r) => r.round_number === rNum);
              if (found) setCurrentRound(found);
            }}
          />
          {isReadOnly && rounds.length > 0 && (
            <button
              onClick={handleDownloadReport}
              className="mt-4 w-full flex items-center justify-center px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
            >
              Download Full Report (CSV)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
