import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Star, Crown, X, Flame, RefreshCw } from 'lucide-react';
import { 
  getGlobalLeaderboard, 
  getPlayerRank, 
  updatePlayerLeaderboardStats,
  LeaderboardEntry as DBLeaderboardEntry 
} from '../lib/supabase';

interface LeaderboardEntry extends DBLeaderboardEntry {
  // Database entry with all fields from Supabase
}

interface LeaderboardProps {
  onClose: () => void;
  currentPlayer?: {
    name: string;
    wallet: string;
    score: number;
    bricksDestroyed: number;
    bossesDefeated: number;
    maxStreak: number;
    achievements: number;
    level: number;
  };
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ onClose, currentPlayer }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentPlayerRank, setCurrentPlayerRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load leaderboard data from database
  const loadLeaderboard = async () => {
    try {
      const data = await getGlobalLeaderboard();
      setEntries(data);
      
      // Get current player rank if provided
      if (currentPlayer && currentPlayer.wallet) {
        const rank = await getPlayerRank(currentPlayer.wallet);
        setCurrentPlayerRank(rank);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  // Update current player stats in database if provided
  useEffect(() => {
    if (currentPlayer) {
      updateCurrentPlayerStats();
    }
  }, [currentPlayer]);

  const updateCurrentPlayerStats = async () => {
    if (!currentPlayer) return;
    
    try {
      await updatePlayerLeaderboardStats(currentPlayer.wallet, {
        score: currentPlayer.score,
        bricksDestroyed: currentPlayer.bricksDestroyed,
        bossesDefeated: currentPlayer.bossesDefeated,
        maxStreak: currentPlayer.maxStreak,
        achievements: currentPlayer.achievements
      });
      
      // Refresh leaderboard after updating
      await loadLeaderboard();
    } catch (error) {
      console.error('Error updating player stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  const formatScore = (score: number) => {
    if (score >= 1000000) return `${(score / 1000000).toFixed(1)}M`;
    if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
    return score.toLocaleString();
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-6 h-6 text-yellow-300 animate-pulse drop-shadow-lg" />;
      case 2: return <Medal className="w-5 h-5 text-gray-100 animate-pulse drop-shadow-lg" />;
      case 3: return <Medal className="w-5 h-5 text-orange-400 animate-pulse drop-shadow-lg" />;
      default: return <span className="w-6 h-6 flex items-center justify-center text-cyan-300 font-bold text-sm border border-cyan-400/30 rounded-full bg-cyan-500/10">#{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-gradient-to-r from-yellow-500/30 via-yellow-400/20 to-orange-500/30 border-yellow-300/70 shadow-lg shadow-yellow-500/20';
      case 2: return 'bg-gradient-to-r from-slate-400/20 via-gray-300/20 to-slate-400/20 border-gray-200/60 shadow-lg shadow-gray-300/20';
      case 3: return 'bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-orange-600/20 border-orange-400/60 shadow-lg shadow-orange-500/20';
      default: return 'bg-gradient-to-r from-purple-800/20 to-blue-800/20 border-purple-600/30 hover:border-purple-500/50 transition-colors';
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900/95 via-black/95 to-blue-900/95 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900 border-2 border-cyan-400 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-cyan-500/25">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 border-b border-cyan-400/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-300 animate-pulse drop-shadow-lg" />
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">🏆 PUMP CHUMP LEADERBOARD</h2>
              <p className="text-cyan-300 text-sm font-medium">Global XP Rankings - Live Database</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-cyan-500/20 rounded-lg transition-all duration-200 disabled:opacity-50 border border-cyan-400/30 hover:border-cyan-400/60"
              title="Refresh Leaderboard"
            >
              <RefreshCw className={`w-5 h-5 text-cyan-300 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-all duration-200 border border-red-400/30 hover:border-red-400/60"
            >
              <X className="w-6 h-6 text-red-300" />
            </button>
          </div>
        </div>

                {/* Current Player Rank */}
        {currentPlayerRank && (
          <div className="bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-red-500/20 border-b border-yellow-400/50 p-3">
            <div className="flex items-center justify-center gap-2">
              <Star className="w-5 h-5 text-yellow-300 animate-pulse" />
              <span className="text-yellow-200 font-bold">YOUR XP RANK: #{currentPlayerRank}</span>
              <span className="text-orange-200">with {formatScore(currentPlayer?.score || 0)} estimated score!</span>
            </div>
          </div>
        )}

        {/* Stats Summary */}
        <div className="bg-gradient-to-r from-purple-800/30 via-blue-800/30 to-indigo-800/30 border-b border-purple-400/30 p-3">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gradient-to-b from-yellow-500/10 to-orange-500/10 rounded-lg p-2 border border-yellow-400/20">
              <div className="text-yellow-300 font-bold text-lg">{entries.length}</div>
              <div className="text-yellow-200/80 text-xs">Total Players</div>
            </div>
            <div className="bg-gradient-to-b from-green-500/10 to-emerald-500/10 rounded-lg p-2 border border-green-400/20">
              <div className="text-green-300 font-bold text-lg">
                {formatScore(entries.reduce((sum, e) => sum + (e.total_bricks_destroyed || 0), 0))}
              </div>
              <div className="text-green-200/80 text-xs">Bricks Destroyed</div>
            </div>
            <div className="bg-gradient-to-b from-red-500/10 to-pink-500/10 rounded-lg p-2 border border-red-400/20">
              <div className="text-red-300 font-bold text-lg">
                {entries.reduce((sum, e) => sum + (e.bosses_defeated || 0), 0)}
              </div>
              <div className="text-red-200/80 text-xs">Bosses Defeated</div>
            </div>
          </div>
        </div>

        {/* Leaderboard List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-16 h-16 text-cyan-300 mx-auto mb-4 animate-spin drop-shadow-lg" />
              <p className="text-cyan-200 text-lg font-medium">Loading global leaderboard...</p>
              <p className="text-cyan-400/80 text-sm">Fetching data from database</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-pulse" />
              <p className="text-purple-200 text-lg font-medium">No scores yet!</p>
              <p className="text-purple-300/80 text-sm">Be the first to set a high score!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, index) => {
                const rank = index + 1;
                const isCurrentPlayer = currentPlayer?.wallet === entry.wallet_address;
                
                return (
                  <div
                    key={entry.wallet_address}
                    className={`p-3 rounded-lg border transition-all duration-200 ${
                      isCurrentPlayer 
                        ? 'bg-gradient-to-r from-cyan-500/30 via-blue-500/30 to-purple-500/30 border-cyan-300/70 ring-2 ring-cyan-400/40 shadow-lg shadow-cyan-500/25' 
                        : getRankBg(rank)
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {/* Rank & Player Info */}
                      <div className="flex items-center gap-3">
                        {getRankIcon(rank)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${isCurrentPlayer ? 'text-cyan-200' : 'text-white'}`}>
                              {entry.display_name}
                            </span>
                            {isCurrentPlayer && (
                              <span className="text-xs bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-2 py-1 rounded-full animate-pulse">YOU</span>
                            )}
                          </div>
                          <div className="text-xs text-cyan-400 font-mono break-all">
                            {entry.wallet_address}
                          </div>
                        </div>
                      </div>

                      {/* Score & Stats */}
                      <div className="text-right">
                        <div className="text-xl font-bold bg-gradient-to-r from-green-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
                          {formatScore(entry.highest_score || 0)}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-orange-300">🧱 {entry.total_bricks_destroyed || 0}</span>
                          <span className="text-red-300">👹 {entry.bosses_defeated || 0}</span>
                          <span className="text-yellow-300">🔥 {entry.max_streak || 0}</span>
                          <span className="text-purple-300">🏆 {entry.achievements_unlocked || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Level Progress Bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-indigo-300 font-bold bg-gradient-to-r from-indigo-500/20 to-purple-500/20 px-2 py-1 rounded border border-indigo-400/30">LVL {entry.player_level || 1}</span>
                      <div className="flex-1 bg-gray-700/50 rounded-full h-2 border border-gray-600/50">
                        <div 
                          className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 h-2 rounded-full transition-all duration-300 shadow-md"
                          style={{ width: `${((entry.player_level || 1) % 10) * 10}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gradient-to-r from-purple-800/30 via-indigo-800/30 to-blue-800/30 border-t border-purple-400/30 p-4 text-center">
          <p className="text-purple-200 text-sm font-medium">
            💪 Keep playing to climb the ranks! 🚀
          </p>
          <p className="text-indigo-300 text-xs mt-1">
            🌐 Global leaderboard powered by Supabase database
          </p>
        </div>
      </div>
    </div>
  );
}; 