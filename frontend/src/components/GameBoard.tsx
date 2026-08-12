import React, { useCallback, useEffect, useState, useRef } from 'react';
import { GameState, Round } from '../types';
import { CardAsset } from './CardAsset';
import { motion } from 'framer-motion';
import { sound } from '../services/sound';
import clsx from 'clsx';

export interface GameBoardProps {
  gameState: GameState | null;
  currentRound: Round | null;
  onPlayRound: () => void | Promise<void>;
  onSimulate: () => void;
  onComplete: () => void;
  isLoading: boolean;
  isGameOver: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  currentRound,
  onPlayRound,
  onSimulate,
  onComplete,
  isLoading,
  isGameOver,
}) => {
  const [p1Flipped, setP1Flipped] = useState(false);
  const [p2Flipped, setP2Flipped] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isRoundPlaying, setIsRoundPlaying] = useState(false);
  const roundRequestPending = useRef(false);

  // React reuses this component when only the route game ID changes. Reset
  // all local flip/reveal phases so every new match visibly starts at 26/26.
  useEffect(() => {
    setP1Flipped(false);
    setP2Flipped(false);
    setIsRevealing(false);
    setIsRoundPlaying(false);
    roundRequestPending.current = false;
  }, [gameState?.game_id]);

  const requestRound = useCallback(async () => {
    // State updates are asynchronous, so use a ref as a synchronous lock. It
    // prevents the button handler and the auto-play effect from submitting the
    // same pair of flipped cards twice.
    if (roundRequestPending.current || isLoading || isGameOver) return;

    roundRequestPending.current = true;
    setIsRoundPlaying(true);
    try {
      await onPlayRound();
      setIsRevealing(true);
    } finally {
      roundRequestPending.current = false;
      setIsRoundPlaying(false);
    }
  }, [isGameOver, isLoading, onPlayRound]);

  // Sound and animation reveal on round update
  useEffect(() => {
    if (currentRound) {
      setIsRevealing(true);
      sound.playWin();
    }
  }, [currentRound]);

  // Keyboard controls
  useEffect(() => {
    if (isGameOver || isLoading || isRoundPlaying) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If currently showing a revealed/resolved round, any new flip keypress clears the old card views first
      if (isRevealing) {
        if (e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D') {
          setIsRevealing(false);
          setP1Flipped(false);
          setP2Flipped(true);
          sound.playFlip();
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          setIsRevealing(false);
          setP2Flipped(false);
          setP1Flipped(true);
          sound.playFlip();
        }
        return;
      }

      // Normal turn-taking flip
      // Player 2 (Left): A or D keys
      if (!p2Flipped && (e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D')) {
        setP2Flipped(true);
        sound.playFlip();
      }
      // Player 1 (Right): Arrow keys
      if (!p1Flipped && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        setP1Flipped(true);
        sound.playFlip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [p1Flipped, p2Flipped, isGameOver, isLoading, isRevealing, isRoundPlaying]);

  // Auto-play round when both flipped
  useEffect(() => {
    if (p1Flipped && p2Flipped && !isLoading && !isRevealing && !isRoundPlaying) {
      requestRound();
    }
  }, [p1Flipped, p2Flipped, isLoading, isRevealing, isRoundPlaying, requestRound]);

  if (!gameState || !gameState.player1 || !gameState.player2) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-amber-200 rounded-3xl shadow-md">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-emerald-800 font-medium">Loading Game Board...</p>
      </div>
    );
  }

  const isWar = currentRound?.is_war || false;
  const winner = currentRound?.winner_player;
  // A flipped card has left that player's deck even before both cards are
  // resolved. Once revealing starts, gameState already contains the awarded
  // post-round totals from the API.
  const displayedP1Cards = Math.max(
    0,
    gameState.player1.cards_remaining - (p1Flipped && !isRevealing ? 1 : 0)
  );
  const displayedP2Cards = Math.max(
    0,
    gameState.player2.cards_remaining - (p2Flipped && !isRevealing ? 1 : 0)
  );

  // Render visual stack of card backs
  const renderCardStack = (count: number, isP1: boolean) => {
    const stackSize = Math.min(Math.ceil(count / 4), 8); // Max 8 offset cards
    return (
      <div className="relative w-24 h-34">
        {Array.from({ length: stackSize }).map((_, idx) => {
          const offset = idx * 2;
          return (
            <div
              key={idx}
              className="absolute w-24 h-34 transition-all duration-300"
              style={{
                top: `${-offset}px`,
                left: isP1 ? `${offset}px` : `${-offset}px`,
                zIndex: idx,
              }}
            >
              <CardAsset rank="" suit="" faceUp={false} className="w-24 h-34 border border-amber-600/30 shadow-md" />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8 relative overflow-hidden">
      {/* Header Info (Light Mode style) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
              MATCH: {gameState.game_id.slice(0, 8)}
            </span>
            <span
              className={clsx(
                'text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full border',
                isGameOver
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border-amber-200'
              )}
            >
              {gameState.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center sm:text-right">
            <span className="text-xs text-slate-500 uppercase tracking-wider block font-bold">Round</span>
            <span className="text-xl font-extrabold text-slate-800 font-mono">#{gameState.round_counter}</span>
          </div>
          <div className="text-center sm:text-right border-l border-slate-200 pl-4">
            <span className="text-xs text-slate-500 uppercase tracking-wider block font-bold">Wars</span>
            <span className="text-xl font-extrabold text-amber-600 font-mono">{gameState.total_wars}</span>
          </div>
        </div>
      </div>

      {/* CASINO FELT TABLE SURFACE (LIGHT MODE BRIGHT FELT) */}
      <div className="relative w-full aspect-[16/9] min-h-[360px] bg-gradient-to-b from-emerald-500 to-emerald-700 rounded-[80px] border-8 border-amber-600 p-8 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Table Inner Felt Ring */}
        <div className="absolute inset-4 border-2 border-dashed border-amber-200/55 rounded-[64px] pointer-events-none"></div>

        <div className="grid grid-cols-3 h-full items-center">
          {/* PLAYER 2 (LEFT SIDE OF THE TABLE) */}
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="text-center">
              <span className="text-white font-extrabold block text-sm drop-shadow-md">{gameState.player2.name}</span>
              <span className="text-[11px] text-amber-100 font-bold block mt-0.5">{displayedP2Cards} Cards</span>
            </div>

            {/* Deck Stack */}
            <div className="relative">
              {renderCardStack(displayedP2Cards, false)}

              {/* Keyboard Prompt Hint */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white border border-slate-200 rounded-md px-2 py-0.5 shadow-md flex items-center gap-1 z-10">
                <kbd className="bg-amber-500 text-slate-950 font-black px-1.5 rounded text-[10px]">A</kbd>
                <span className="text-slate-400 text-[10px]">/</span>
                <kbd className="bg-amber-500 text-slate-950 font-black px-1.5 rounded text-[10px]">D</kbd>
                <span className="text-[10px] text-slate-700 font-semibold">to Flip</span>
              </div>
            </div>

            <div className="h-6">
              {p2Flipped && !isRevealing && (
                <span className="text-xs text-white bg-amber-500/90 px-2 py-0.5 rounded shadow-sm font-extrabold animate-pulse">Flipped Face Down</span>
              )}
            </div>
          </div>

          {/* BATTLE ZONE (CENTER OF THE TABLE) */}
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="flex justify-center gap-6 items-center w-full">
              {/* P2 Flipped Card Slot */}
              <div className="w-24 h-34 flex items-center justify-center border-2 border-dashed border-amber-300/40 rounded-xl bg-emerald-800/20">
                {p2Flipped ? (
                  <motion.div
                    initial={{ scale: 0.8, x: -80, rotateY: 180 }}
                    animate={{ 
                      scale: 1, 
                      x: 0,
                      rotateY: isRevealing ? 0 : 180 
                    }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className={clsx(
                      'w-full h-full rounded-xl',
                      isRevealing && winner === 2 && 'ring-4 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.9)] scale-105'
                    )}
                  >
                    {isRevealing && currentRound?.player2_card ? (
                      <CardAsset rank={currentRound.player2_card.slice(0, -1)} suit={currentRound.player2_card.slice(-1)} faceUp={true} />
                    ) : (
                      <CardAsset rank="" suit="" faceUp={false} />
                    )}
                  </motion.div>
                ) : (
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Empty</span>
                )}
              </div>

              {/* Center Status */}
              <div className="flex flex-col items-center justify-center">
                <span className={clsx('text-xs font-black tracking-widest', isWar ? 'text-red-100 animate-bounce' : 'text-white/70')}>
                  VS
                </span>
                {isWar && (
                  <div className="text-[10px] bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded mt-1 shadow-md">
                    WAR!
                  </div>
                )}
              </div>

              {/* P1 Flipped Card Slot */}
              <div className="w-24 h-34 flex items-center justify-center border-2 border-dashed border-amber-300/40 rounded-xl bg-emerald-800/20">
                {p1Flipped ? (
                  <motion.div
                    initial={{ scale: 0.8, x: 80, rotateY: 180 }}
                    animate={{ 
                      scale: 1, 
                      x: 0,
                      rotateY: isRevealing ? 0 : 180 
                    }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className={clsx(
                      'w-full h-full rounded-xl',
                      isRevealing && winner === 1 && 'ring-4 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.9)] scale-105'
                    )}
                  >
                    {isRevealing && currentRound?.player1_card ? (
                      <CardAsset rank={currentRound.player1_card.slice(0, -1)} suit={currentRound.player1_card.slice(-1)} faceUp={true} />
                    ) : (
                      <CardAsset rank="" suit="" faceUp={false} />
                    )}
                  </motion.div>
                ) : (
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Empty</span>
                )}
              </div>
            </div>

            {/* Battle outcome banner */}
            <div className="h-6">
              {isRevealing && currentRound && !isWar && (
                <span className="text-xs text-slate-800 bg-white border border-amber-400 px-3 py-1 rounded-full shadow-md font-bold">
                  {winner === 1 ? `${gameState.player1.name} Wins` : winner === 2 ? `${gameState.player2.name} Wins` : 'Tie'} (+{currentRound.cards_won} cards)
                </span>
              )}
            </div>
          </div>

          {/* PLAYER 1 (RIGHT SIDE OF THE TABLE) */}
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="text-center">
              <span className="text-white font-extrabold block text-sm drop-shadow-md">{gameState.player1.name}</span>
              <span className="text-[11px] text-amber-100 font-bold block mt-0.5">{displayedP1Cards} Cards</span>
            </div>

            {/* Deck Stack */}
            <div className="relative">
              {renderCardStack(displayedP1Cards, true)}

              {/* Keyboard Prompt Hint */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white border border-slate-200 rounded-md px-2 py-0.5 shadow-md flex items-center gap-1 z-10">
                <kbd className="bg-amber-500 text-slate-950 font-black px-1.5 rounded text-[10px]">↑</kbd>
                <kbd className="bg-amber-500 text-slate-950 font-black px-1.5 rounded text-[10px]">↓</kbd>
                <kbd className="bg-amber-500 text-slate-950 font-black px-1.5 rounded text-[10px]">←</kbd>
                <kbd className="bg-amber-500 text-slate-950 font-black px-1.5 rounded text-[10px]">→</kbd>
                <span className="text-[10px] text-slate-700 font-semibold">to Flip</span>
              </div>
            </div>

            <div className="h-6">
              {p1Flipped && !isRevealing && (
                <span className="text-xs text-white bg-amber-500/90 px-2 py-0.5 rounded shadow-sm font-extrabold animate-pulse">Flipped Face Down</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Winner Banner */}
      {isGameOver && (
        <div className="flex items-center justify-center p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl font-bold text-base shadow-sm">
          Winner: {gameState.winner || 'Tie Match'}!
        </div>
      )}

      {/* CONTROL BUTTONS (LIGHT MODE) */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-slate-200">
        <button
          onClick={async () => {
            if (isLoading || isRoundPlaying) return;
            setIsRevealing(false);
            setP1Flipped(true);
            setP2Flipped(true);
            sound.playFlip();
            await requestRound();
          }}
          disabled={isLoading || isRoundPlaying || isGameOver}
          className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>Play Round (Space)</span>
        </button>

        <button
          onClick={onSimulate}
          disabled={isLoading || isRoundPlaying || isGameOver}
          className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>Simulate Match</span>
        </button>

        <button
          onClick={onComplete}
          disabled={isLoading || isRoundPlaying || isGameOver}
          className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>Complete Match</span>
        </button>
      </div>
    </div>
  );
};
