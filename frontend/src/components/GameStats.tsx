import React, { useMemo } from 'react';
import { GameStats as GameStatsType, LeaderboardEntry, Game } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export interface GameStatsProps {
  stats: GameStatsType | null;
  leaderboard?: LeaderboardEntry[];
  recentGames?: Game[];
  isLoading: boolean;
  onRefresh: () => void;
  onGameClick?: (gameId: string) => void;
}

export const GameStats: React.FC<GameStatsProps> = ({
  stats,
  leaderboard = [],
  recentGames = [],
  isLoading,
  onRefresh,
  onGameClick,
}) => {
  const pieData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Player 1 Wins', value: stats.player1_wins, color: '#6366f1' },
      { name: 'Player 2 Wins', value: stats.player2_wins, color: '#e11d48' },
      { name: 'Ties / Max Rounds', value: stats.ties_or_max_rounds, color: '#94a3b8' },
    ];
  }, [stats]);

  const barData = useMemo(() => {
    if (!recentGames || recentGames.length === 0) return [];
    return recentGames.slice(0, 5).map((g) => ({
      name: `Game #${g.id.slice(0, 4)}`,
      rounds: g.total_rounds,
    }));
  }, [recentGames]);

  if (isLoading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-3xl animate-pulse shadow-sm">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs text-slate-500 font-medium">Fetching Global Analytics...</p>
      </div>
    );
  }

  const p1WinRate = stats && stats.completed_games > 0
    ? Math.round((stats.player1_wins / stats.completed_games) * 100)
    : 0;

  const p2WinRate = stats && stats.completed_games > 0
    ? Math.round((stats.player2_wins / stats.completed_games) * 100)
    : 0;

  const tooltipStyle = {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: '12px',
    color: '#0f172a',
  };

  return (
    <div className="w-full space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-950">
            Game Statistics Dashboard
          </h2>
          <p className="text-xs text-slate-600 mt-1">Real-time simulation metrics, win probabilities, and war frequencies.</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
        >
          <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Games</div>
            <div className="text-3xl font-extrabold text-slate-950">{stats.total_games}</div>
            <div className="text-[11px] text-slate-500 mt-1">{stats.completed_games} Finished</div>
          </div>

          <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1">P1 Win Rate</div>
            <div className="text-3xl font-extrabold text-indigo-700">{p1WinRate}%</div>
            <div className="text-[11px] text-slate-500 mt-1">{stats.player1_wins} Wins</div>
          </div>

          <div className="bg-white border border-rose-100 rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-semibold text-rose-700 uppercase tracking-wider mb-1">P2 Win Rate</div>
            <div className="text-3xl font-extrabold text-rose-700">{p2WinRate}%</div>
            <div className="text-[11px] text-slate-500 mt-1">{stats.player2_wins} Wins</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Avg Rounds</div>
            <div className="text-3xl font-extrabold text-slate-950">{stats.avg_rounds_per_game}</div>
            <div className="text-[11px] text-slate-500 mt-1">Per Completed Game</div>
          </div>

          <div className="bg-white border border-amber-100 rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Max Wars</div>
            <div className="text-3xl font-extrabold text-amber-700">{stats.max_wars_in_single_game}</div>
            <div className="text-[11px] text-slate-500 mt-1">In 1 Single Match</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <h3 className="font-bold text-slate-900 text-sm mb-4">Win Ratio Breakdown</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-xs text-slate-600 pt-4 border-t border-slate-200">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500"></span> Player 1</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-600"></span> Player 2</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-400"></span> Ties</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <h3 className="font-bold text-slate-900 text-sm mb-4">Recent Games Duration (Rounds)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="rounds" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 text-sm mb-4">
            Top Player Rankings
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">Player</th>
                  <th className="p-3">Wins</th>
                  <th className="p-3">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-500">No leaderboard data available.</td>
                  </tr>
                ) : (
                  leaderboard.map((lb) => (
                    <tr key={lb.rank} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-amber-700">#{lb.rank}</td>
                      <td className="p-3 font-semibold text-slate-900">{lb.player_name}</td>
                      <td className="p-3 font-bold text-indigo-700">{lb.wins}</td>
                      <td className="p-3 font-mono">{lb.win_rate}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 text-sm mb-4">
            Recent 5 Games
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3">Game ID</th>
                  <th className="p-3">Rounds</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Winner</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentGames.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-500">No recent games recorded.</td>
                  </tr>
                ) : (
                  recentGames.slice(0, 10).map((g) => (
                    <tr
                      key={g.id}
                      onClick={() => onGameClick && onGameClick(g.id)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-mono font-semibold text-indigo-700">#{g.id.slice(0, 8)}</td>
                      <td className="p-3 font-mono">{g.total_rounds}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          g.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {g.status}
                        </span>
                      </td>
                      <td className="p-3 font-bold">
                        {g.winner_player === 1 ? 'Player 1' : g.winner_player === 2 ? 'Player 2' : 'Ongoing / Tie'}
                      </td>
                      <td className="p-3">
                        <span className="text-indigo-700 text-[10px] font-semibold hover:underline">View</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
