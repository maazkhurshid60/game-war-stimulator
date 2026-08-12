import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Game } from '../types';
import apiService from '../services/api';
import toast from 'react-hot-toast';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await apiService.getGames(1, 5);
        setRecentGames(res.data);
      } catch (err) {
        console.error('Failed to load recent games', err);
      }
    };
    fetchRecent();
  }, []);

  const handleStartGame = async () => {
    setIsLoading(true);
    const toastId = toast.loading('Initializing new War game match...');
    try {
      const newGame = await apiService.startGame();
      toast.success('Game created! Opening match...', { id: toastId });
      navigate(`/game/${newGame.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start game', { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col items-center gap-10 py-6">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center px-4 py-1.5 bg-white border border-indigo-200 rounded-full text-indigo-700 text-xs font-semibold uppercase tracking-widest shadow-sm">
          Interactive Simulator Engine
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-950 tracking-tight">
          War Card Game Simulator
        </h1>
        <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          Simulate standard 52-card War card battles, visualize turn progression, trigger cascading tie wars, and analyze statistical analytics.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={handleStartGame}
            disabled={isLoading}
            className="w-full sm:w-auto flex items-center justify-center px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-sm transition-all cursor-pointer transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            <span>Start New Game</span>
          </button>

          <button
            onClick={() => navigate('/stats')}
            className="w-full sm:w-auto flex items-center justify-center px-8 py-4 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-2xl border border-slate-200 shadow-sm transition-all cursor-pointer"
          >
            <span>View Analytics</span>
          </button>
        </div>
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <h3 className="font-bold text-slate-900 text-base mb-1">Standard 52 Cards</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Deck is split evenly into 26 cards per player. Higher card rank wins the round.
          </p>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <h3 className="font-bold text-slate-900 text-base mb-1">War Ties</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Equal card ranks trigger WAR. Each player contributes one additional face-up card until the tie is broken.
          </p>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <h3 className="font-bold text-slate-900 text-base mb-1">Victory Condition</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            A player wins by taking all 52 cards or having more cards when maximum rounds limit is reached.
          </p>
        </div>
      </div>

      <div className="w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-base">
          Recent Matches
        </h3>

        <div className="space-y-2">
          {recentGames.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No recent games. Click "Start New Game" to launch a match.</p>
          ) : (
            recentGames.map((g) => (
              <div
                key={g.id}
                onClick={() => navigate(`/game/${g.id}`)}
                className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl text-xs transition-all cursor-pointer"
              >
                <span className="font-mono text-indigo-700 font-bold">#{g.id.slice(0, 8)}</span>
                <span className="text-slate-700 font-medium">{g.total_rounds} Rounds Played</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-white text-slate-600 border border-slate-200">
                  {g.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
