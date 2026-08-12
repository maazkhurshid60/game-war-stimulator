import React, { useEffect, useState } from 'react';
import { GameStats as GameStatsType, LeaderboardEntry, Game } from '../types';
import apiService from '../services/api';
import { GameStats } from '../components/GameStats';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export const StatsPage: React.FC = () => {
  const [stats, setStats] = useState<GameStatsType | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sOverview, lbData, gList] = await Promise.all([
        apiService.getStatsOverview(),
        apiService.getLeaderboard(),
        apiService.getGames(1, 10),
      ]);

      setStats(sOverview);
      setLeaderboard(lbData);
      setRecentGames(gList.data);
    } catch (err: any) {
      toast.error('Failed to load statistics dashboard');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportCSV = () => {
    if (!stats) return;

    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Games', stats.total_games],
      ['Completed Games', stats.completed_games],
      ['Abandoned Games', stats.abandoned_games],
      ['Player 1 Wins', stats.player1_wins],
      ['Player 2 Wins', stats.player2_wins],
      ['Ties / Max Rounds', stats.ties_or_max_rounds],
      ['Avg Rounds Per Game', stats.avg_rounds_per_game],
      ['Total Wars Fought', stats.total_wars_fought],
      ['Max Wars In Single Game', stats.max_wars_in_single_game],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `war_game_stats_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Statistics exported to CSV file!');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h1 className="text-xl font-bold text-slate-950">Global War Game Analytics</h1>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={!stats || isLoading}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <span>Export CSV</span>
          </button>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
          >
            <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      <GameStats
        stats={stats}
        leaderboard={leaderboard}
        recentGames={recentGames}
        isLoading={isLoading}
        onRefresh={loadData}
        onGameClick={(gameId) => navigate(`/game/${gameId}`)}
      />
    </div>
  );
};
