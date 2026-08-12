import React, { useRef, useEffect, useState } from 'react';
import { Round } from '../types';
import clsx from 'clsx';

export interface RoundHistoryProps {
  rounds: Round[];
  isLoading: boolean;
  currentRound: number;
  onRoundClick: (roundNumber: number) => void;
}

function formatCard(cardStr: string) {
  if (!cardStr) return { rank: '?', suit: '?', isRed: false };
  const suitChar = cardStr.slice(-1).toUpperCase();
  const rank = cardStr.slice(0, -1);
  const isRed = suitChar === 'H' || suitChar === 'D';
  return { rank, suit: suitChar, isRed };
}

export const RoundHistory: React.FC<RoundHistoryProps> = React.memo(({
  rounds,
  isLoading,
  currentRound,
  onRoundClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [rounds.length]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRounds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <h3 className="font-bold text-slate-900 text-base">Round Logs</h3>
        <span className="text-xs text-slate-500 font-mono font-medium">{rounds.length} Turns Played</span>
      </div>

      <div
        ref={containerRef}
        className="max-h-80 overflow-y-auto pr-1.5 space-y-2 scrollbar-thin scrollbar-thumb-slate-200"
      >
        {isLoading && rounds.length === 0 ? (
          <div className="space-y-2 animate-pulse py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-50 rounded-xl border border-slate-100"></div>
            ))}
          </div>
        ) : rounds.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 font-medium">
            No turns played yet. Flip cards to start.
          </div>
        ) : (
          rounds.map((r, idx) => {
            const p1Card = formatCard(r.player1_card);
            const p2Card = formatCard(r.player2_card);
            const isCurrent = r.round_number === currentRound;
            const isExpanded = !!expandedRounds[r.id];

            return (
              <div
                key={r.id || idx}
                onClick={() => onRoundClick(r.round_number)}
                className={clsx(
                  'p-3 rounded-xl border text-xs transition-all cursor-pointer',
                  idx % 2 === 0 ? 'bg-slate-50/60' : 'bg-white',
                  isCurrent
                    ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50'
                    : r.is_war
                    ? 'border-red-200 bg-red-50 hover:border-red-400'
                    : 'border-slate-100 hover:border-slate-200'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="w-16 font-mono font-bold text-slate-500">
                    #{r.round_number}
                    {r.is_war && <span className="ml-1 text-red-600">WAR</span>}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 w-24">
                    <span className={clsx('font-extrabold', p1Card.isRed ? 'text-red-500' : 'text-slate-800')}>
                      {p1Card.rank}{p1Card.suit}
                    </span>
                  </div>

                  <div className="flex items-center justify-center w-32">
                    {r.is_war ? (
                      <span className="px-2.5 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full font-bold text-[10px]">
                        WAR (+{r.cards_won})
                      </span>
                    ) : r.winner_player === 1 ? (
                      <span className="text-emerald-700 font-bold">P1 Won (+{r.cards_won})</span>
                    ) : r.winner_player === 2 ? (
                      <span className="text-emerald-700 font-bold">P2 Won (+{r.cards_won})</span>
                    ) : (
                      <span className="text-slate-400 font-semibold">Tie</span>
                    )}
                  </div>

                  <div className="flex items-center justify-start gap-1.5 w-24">
                    <span className={clsx('font-extrabold', p2Card.isRed ? 'text-red-500' : 'text-slate-800')}>
                      {p2Card.rank}{p2Card.suit}
                    </span>
                  </div>

                  {r.war_details && r.war_details.length > 0 && (
                    <button
                      onClick={(e) => toggleExpand(r.id, e)}
                      className="px-2 py-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {isExpanded ? 'Hide' : 'Show'}
                    </button>
                  )}
                </div>

                {isExpanded && r.war_details && r.war_details.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-red-200 space-y-1.5 pl-4 text-[11px] bg-red-50/40 rounded-lg p-2">
                    <span className="text-red-600 font-bold block mb-1">War Details:</span>
                    {r.war_details.map((wd, wIdx) => {
                      const p1W = formatCard(wd.player1_card);
                      const p2W = formatCard(wd.player2_card);
                      return (
                        <div key={wd.id || wIdx} className="flex items-center justify-between text-slate-700">
                          <span>War Step #{wd.war_round_number}</span>
                          <span className={p1W.isRed ? 'text-red-500 font-bold' : 'text-slate-800 font-bold'}>
                            P1: {p1W.rank}{p1W.suit}
                          </span>
                          <span className="text-slate-400">vs</span>
                          <span className={p2W.isRed ? 'text-red-500 font-bold' : 'text-slate-800 font-bold'}>
                            P2: {p2W.rank}{p2W.suit}
                          </span>
                          <span className="text-emerald-700 font-semibold">
                            {wd.winner_player ? `P${wd.winner_player} Won` : 'Tie'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

RoundHistory.displayName = 'RoundHistory';
