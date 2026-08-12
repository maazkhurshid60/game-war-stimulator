import React, { useState } from 'react';
import { Game, Round } from '../types';
import apiService from '../services/api';
import toast from 'react-hot-toast';

export interface GameControllerProps {
  gameId: string | null;
  onGameStart: (game: Game) => void;
  onRoundPlay: (round: Round) => void | Promise<void>;
  onGameComplete: (game: Game) => void | Promise<void>;
  isLoading: boolean;
}

export const GameController: React.FC<GameControllerProps> = ({
  gameId,
  onGameStart,
  onRoundPlay,
  onGameComplete,
  isLoading,
}) => {
  const [internalLoading, setInternalLoading] = useState(false);

  const handleStartGame = async () => {
    setInternalLoading(true);
    const toastId = toast.loading('Initializing new War game match...');
    try {
      const newGame = await apiService.startGame();
      onGameStart(newGame);
      toast.success('New match started! Cards dealt.', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to start game', { id: toastId });
    } finally {
      setInternalLoading(false);
    }
  };

  const handlePlayRound = async () => {
    if (!gameId) return;
    setInternalLoading(true);
    try {
      const round = await apiService.playRound(gameId);
      await onRoundPlay(round);
      if (round.is_war) {
        toast('WAR triggered. One additional card was played by each player.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to play round');
    } finally {
      setInternalLoading(false);
    }
  };

  const handleSimulateAll = async () => {
    if (!gameId) return;
    setInternalLoading(true);
    const toastId = toast.loading('Simulating match to completion...');
    try {
      const completedGame = await apiService.simulateGame(gameId);
      await onGameComplete(completedGame);
      toast.success(`Match Finished in ${completedGame.total_rounds} rounds!`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to simulate game', { id: toastId });
    } finally {
      setInternalLoading(false);
    }
  };

  const handleCompleteEarly = async () => {
    if (!gameId) return;
    setInternalLoading(true);
    const toastId = toast.loading('Completing match...');
    try {
      const completedGame = await apiService.completeGame(gameId);
      await onGameComplete(completedGame);
      toast.success('Match completed early.', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete game', { id: toastId });
    } finally {
      setInternalLoading(false);
    }
  };

  const busy = isLoading || internalLoading;

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
        <button
          onClick={handleStartGame}
          disabled={busy}
          className="flex-1 sm:flex-initial flex items-center justify-center px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>New Game</span>
        </button>

        <button
          onClick={handlePlayRound}
          disabled={!gameId || busy}
          className="flex-1 sm:flex-initial flex items-center justify-center px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-xs rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>Play Round</span>
        </button>

        <button
          onClick={handleSimulateAll}
          disabled={!gameId || busy}
          className="flex-1 sm:flex-initial flex items-center justify-center px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>Simulate All</span>
        </button>

        <button
          onClick={handleCompleteEarly}
          disabled={!gameId || busy}
          className="flex-1 sm:flex-initial flex items-center justify-center px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 font-semibold text-xs rounded-xl border border-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>Complete</span>
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500 font-mono font-medium">
        {gameId ? (
          <span>Active Game: <strong className="text-emerald-700">{gameId.slice(0, 8)}</strong></span>
        ) : (
          <span>No game loaded. Click <strong>New Game</strong> to start.</span>
        )}
      </div>
    </div>
  );
};
