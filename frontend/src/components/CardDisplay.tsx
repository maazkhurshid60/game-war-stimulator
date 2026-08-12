import React from 'react';
import { Card as CardType } from '../types';
import { CardAsset } from './CardAsset';
import clsx from 'clsx';

export interface CardDisplayProps {
  card?: CardType | string | null;
  faceUp?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  onClick?: () => void;
  animate?: boolean;
}

function parseCard(card?: CardType | string | null) {
  if (!card) return { rank: '', suit: '' };
  if (typeof card === 'string') {
    return {
      rank: card.slice(0, -1),
      suit: card.slice(-1),
    };
  }
  return {
    rank: card.rank,
    suit: card.suit,
  };
}

export const CardDisplay: React.FC<CardDisplayProps> = React.memo(({
  card,
  faceUp = true,
  size = 'medium',
  className = '',
  onClick,
  animate = false,
}) => {
  const sizeStyles = {
    small: 'w-[60px] h-[84px]',
    medium: 'w-[80px] h-[112px]',
    large: 'w-[100px] h-[140px]',
  }[size];

  const parsed = parseCard(card);

  return (
    <CardAsset
      rank={parsed.rank}
      suit={parsed.suit}
      faceUp={faceUp && !!card}
      onClick={onClick}
      className={clsx(
        sizeStyles,
        'transition-all duration-300',
        onClick && 'cursor-pointer hover:-translate-y-1 hover:shadow-2xl',
        animate && 'animate-deal',
        className
      )}
    />
  );
});

CardDisplay.displayName = 'CardDisplay';
