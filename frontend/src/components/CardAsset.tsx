import React from 'react';

export interface CardAssetProps {
  rank: string;
  suit: string;
  faceUp?: boolean;
  className?: string;
  onClick?: () => void;
}

type SuitKey = 'hearts' | 'diamonds' | 'clubs' | 'spades';

type Pip = {
  x: number;
  y: number;
  scale?: number;
  rotate?: boolean;
};

const normalizeSuit = (suit: string): SuitKey => {
  const normalized = suit.toLowerCase();
  if (normalized === 'h' || normalized === 'hearts') return 'hearts';
  if (normalized === 'd' || normalized === 'diamonds') return 'diamonds';
  if (normalized === 'c' || normalized === 'clubs') return 'clubs';
  return 'spades';
};

const normalizeRank = (rank: string) => rank.toUpperCase();

const isRedSuit = (suit: SuitKey) => suit === 'hearts' || suit === 'diamonds';

const pipLayouts: Record<string, Pip[]> = {
  A: [{ x: 50, y: 50, scale: 2.1 }],
  '2': [
    { x: 50, y: 25 },
    { x: 50, y: 75, rotate: true },
  ],
  '3': [
    { x: 50, y: 23 },
    { x: 50, y: 50 },
    { x: 50, y: 77, rotate: true },
  ],
  '4': [
    { x: 32, y: 25 },
    { x: 68, y: 25 },
    { x: 32, y: 75, rotate: true },
    { x: 68, y: 75, rotate: true },
  ],
  '5': [
    { x: 32, y: 25 },
    { x: 68, y: 25 },
    { x: 50, y: 50 },
    { x: 32, y: 75, rotate: true },
    { x: 68, y: 75, rotate: true },
  ],
  '6': [
    { x: 32, y: 22 },
    { x: 68, y: 22 },
    { x: 32, y: 50 },
    { x: 68, y: 50 },
    { x: 32, y: 78, rotate: true },
    { x: 68, y: 78, rotate: true },
  ],
  '7': [
    { x: 32, y: 21 },
    { x: 68, y: 21 },
    { x: 50, y: 36 },
    { x: 32, y: 51 },
    { x: 68, y: 51 },
    { x: 32, y: 79, rotate: true },
    { x: 68, y: 79, rotate: true },
  ],
  '8': [
    { x: 32, y: 20 },
    { x: 68, y: 20 },
    { x: 50, y: 35 },
    { x: 32, y: 50 },
    { x: 68, y: 50 },
    { x: 50, y: 65, rotate: true },
    { x: 32, y: 80, rotate: true },
    { x: 68, y: 80, rotate: true },
  ],
  '9': [
    { x: 32, y: 19 },
    { x: 68, y: 19 },
    { x: 32, y: 37 },
    { x: 68, y: 37 },
    { x: 50, y: 50 },
    { x: 32, y: 63, rotate: true },
    { x: 68, y: 63, rotate: true },
    { x: 32, y: 81, rotate: true },
    { x: 68, y: 81, rotate: true },
  ],
  '10': [
    { x: 32, y: 17 },
    { x: 68, y: 17 },
    { x: 32, y: 33 },
    { x: 68, y: 33 },
    { x: 50, y: 43 },
    { x: 50, y: 57, rotate: true },
    { x: 32, y: 67, rotate: true },
    { x: 68, y: 67, rotate: true },
    { x: 32, y: 83, rotate: true },
    { x: 68, y: 83, rotate: true },
  ],
};

const SuitShape: React.FC<{ suit: SuitKey; className?: string }> = ({ suit, className }) => {
  if (suit === 'hearts') {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="currentColor" aria-hidden="true">
        <path d="M32 56C24.7 51.3 8 39.6 8 24.8 8 16.4 14.3 10 22.4 10c4.8 0 8.1 2.4 9.6 5.8C33.5 12.4 36.8 10 41.6 10 49.7 10 56 16.4 56 24.8 56 39.6 39.3 51.3 32 56Z" />
      </svg>
    );
  }

  if (suit === 'diamonds') {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="currentColor" aria-hidden="true">
        <path d="M32 4 56 32 32 60 8 32 32 4Z" />
      </svg>
    );
  }

  if (suit === 'clubs') {
    return (
      <svg viewBox="0 0 64 64" className={className} fill="currentColor" aria-hidden="true">
        <circle cx="32" cy="19" r="11" />
        <circle cx="20" cy="34" r="11" />
        <circle cx="44" cy="34" r="11" />
        <path d="M29 39h6v9c0 5 3 8 8 8H21c5 0 8-3 8-8v-9Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" className={className} fill="currentColor" aria-hidden="true">
      <path d="M32 6C23.8 18.6 9 27.1 9 41c0 8.4 6.1 14 14 14 4.2 0 7.2-1.7 9-4.3 1.8 2.6 4.8 4.3 9 4.3 7.9 0 14-5.6 14-14C55 27.1 40.2 18.6 32 6Z" />
      <path d="M29 43h6v6c0 5 3 8 8 8H21c5 0 8-3 8-8v-6Z" />
    </svg>
  );
};

const Corner: React.FC<{ rank: string; suit: SuitKey; inverted?: boolean }> = ({ rank, suit, inverted = false }) => {
  const colorClass = isRedSuit(suit) ? 'text-red-600' : 'text-slate-950';

  return (
    <div className={`absolute ${inverted ? 'bottom-2 right-2 rotate-180' : 'top-2 left-2'} flex flex-col items-center z-20 ${colorClass}`}>
      <span className="font-mono text-[22px] leading-none font-black tracking-tight">{rank}</span>
      <SuitShape suit={suit} className="w-4 h-4 mt-0.5" />
    </div>
  );
};

const PipShape: React.FC<{ suit: SuitKey; pip: Pip }> = ({ suit, pip }) => {
  const colorClass = isRedSuit(suit) ? 'text-red-600' : 'text-slate-950';
  const scale = pip.scale ?? 1;
  const rotation = pip.rotate ? ' rotate(180deg)' : '';
  const style: React.CSSProperties = {
    left: `${pip.x}%`,
    top: `${pip.y}%`,
    transform: `translate(-50%, -50%) scale(${scale})${rotation}`,
  };

  return (
    <div className={`absolute ${colorClass}`} style={style}>
      <SuitShape suit={suit} className="w-7 h-7" />
    </div>
  );
};

export const CardAsset: React.FC<CardAssetProps> = ({
  rank,
  suit,
  faceUp = true,
  className = '',
  onClick,
}) => {
  const suitKey = normalizeSuit(suit);
  const rankKey = normalizeRank(rank);
  const colorClass = isRedSuit(suitKey) ? 'text-red-600' : 'text-slate-950';
  const isFaceCard = rankKey === 'J' || rankKey === 'Q' || rankKey === 'K';
  const pips = pipLayouts[rankKey] || [];

  if (!faceUp) {
    return (
      <div
        onClick={onClick}
        className={`relative aspect-[5/7] w-full rounded-2xl bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-950 border-[6px] border-white shadow-xl overflow-hidden select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        <div className="absolute inset-0 opacity-35 bg-[linear-gradient(45deg,#ffffff_1px,transparent_1px),linear-gradient(-45deg,#ffffff_1px,transparent_1px)] bg-[size:14px_14px]"></div>
        <div className="absolute inset-2 rounded-xl border-2 border-white/70"></div>
        <div className="absolute inset-5 rounded-lg border border-white/40"></div>
        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/70 bg-white/10"></div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`relative aspect-[5/7] w-full rounded-2xl bg-white border border-slate-300 shadow-xl overflow-hidden select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className="absolute inset-1 rounded-xl border border-slate-100 pointer-events-none"></div>
      <Corner rank={rankKey} suit={suitKey} />
      <Corner rank={rankKey} suit={suitKey} inverted />

      <div className="absolute inset-x-8 inset-y-9">
        {isFaceCard ? (
          <div className={`h-full w-full rounded-xl border-2 border-slate-200 bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-center ${colorClass}`}>
            <span className="font-serif text-5xl font-black leading-none">{rankKey}</span>
            <SuitShape suit={suitKey} className="mt-2 w-12 h-12" />
          </div>
        ) : (
          pips.map((pip, index) => (
            <PipShape key={`${pip.x}-${pip.y}-${index}`} suit={suitKey} pip={pip} />
          ))
        )}
      </div>
    </div>
  );
};
