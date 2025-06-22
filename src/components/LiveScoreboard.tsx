import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Medal, Target, Zap, Timer, TrendingUp, Activity, Flame } from 'lucide-react';
import { LiveCompetition, CompetitionScore } from '../lib/supabase';

interface LiveScoreboardProps {
  players: CompetitionScore[];
  competition: LiveCompetition;
  timeRemaining: number;
}

export const LiveScoreboard: React.FC<LiveScoreboardProps> = ({ players, competition, timeRemaining }) => {
  const [lastScores, setLastScores] = useState<{[key: string]: number}>({});
  const [scoreChanges, setScoreChanges] = useState<{[key: string]: number}>({});

  // Track score changes for animations
  useEffect(() => {
    const newChanges: {[key: string]: number} = {};
    
    players.forEach(player => {
      const lastScore = lastScores[player.id] || 0;
      if (player.current_score > lastScore) {
        newChanges[player.id] = player.current_score - lastScore;
      }
    });
    
    setScoreChanges(newChanges);
    
    const newLastScores: {[key: string]: number} = {};
    players.forEach(player => {
      newLastScores[player.id] = player.current_score;
    });
    setLastScores(newLastScores);

    // Clear score change animations after 2 seconds
    if (Object.keys(newChanges).length > 0) {
      const timer = setTimeout(() => {
        setScoreChanges({});
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [players, lastScores]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-5 h-5 text-yellow-400 animate-pulse" />;
      case 2: return <Medal className="w-4 h-4 text-gray-300" />;
      case 3: return <Medal className="w-4 h-4 text-orange-400" />;
      default: return <span className="text-gray-400 font-bold text-sm">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-400/20 border-yellow-400/50 text-yellow-300';
      case 2: return 'bg-gray-300/20 border-gray-300/50 text-gray-200';
      case 3: return 'bg-orange-400/20 border-orange-400/50 text-orange-300';
      default: return 'bg-purple-600/20 border-purple-600/50 text-purple-200';
    }
  };

  const formatScore = (score: number) => {
    if (score >= 1000000) return `${(score / 1000000).toFixed(1)}M`;
    if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
    return score.toLocaleString();
  };

  const getTimeColor = () => {
    if (timeRemaining > 30) return 'text-green-400';
    if (timeRemaining > 10) return 'text-yellow-400';
    return 'text-red-400 animate-pulse';
  };

  const getTotalStats = () => {
    return {
      totalScore: players.reduce((sum, p) => sum + p.current_score, 0),
      totalBricks: players.reduce((sum, p) => sum + p.bricks_broken, 0),
      avgLevel: players.length > 0 ? Math.round(players.reduce((sum, p) => sum + (p.level_reached || 1), 0) / players.length) : 1
    };
  };

  const stats = getTotalStats();

  return (
    <div className="h-full flex flex-col bg-gray-900/50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-purple-400/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-6 h-6 text-purple-400" />
          <h2 className="text-lg font-bold text-purple-300">LIVE SCOREBOARD</h2>
        </div>
        
        {/* Timer and Status */}
        {competition.game_status === 'active' && (
          <div className="bg-black/30 border border-gray-600/50 rounded-lg p-3 text-center">
            <Timer className={`w-6 h-6 mx-auto mb-1 ${getTimeColor()}`} />
            <div className={`text-2xl font-bold ${getTimeColor()}`}>{timeRemaining}s</div>
            <div className="text-gray-400 text-xs">Time Remaining</div>
          </div>
        )}
      </div>

      {/* Competition Stats */}
      <div className="border-b border-gray-700/50 p-4">
        <h3 className="text-sm font-bold text-gray-300 mb-3">🏆 Competition Stats</h3>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-green-500/10 border border-green-400/30 rounded p-2 text-center">
            <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
            <div className="text-green-400 font-bold">{formatScore(stats.totalScore)}</div>
            <div className="text-green-300/80 text-xs">Total Score</div>
          </div>
          
          <div className="bg-orange-500/10 border border-orange-400/30 rounded p-2 text-center">
            <Target className="w-4 h-4 text-orange-400 mx-auto mb-1" />
            <div className="text-orange-400 font-bold">{stats.totalBricks}</div>
            <div className="text-orange-300/80 text-xs">Total Bricks</div>
          </div>
          
          <div className="bg-purple-500/10 border border-purple-400/30 rounded p-2 text-center">
            <Zap className="w-4 h-4 text-purple-400 mx-auto mb-1" />
            <div className="text-purple-400 font-bold">L{stats.avgLevel}</div>
            <div className="text-purple-300/80 text-xs">Avg Level</div>
          </div>
        </div>
      </div>

      {/* Player Rankings */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Live Rankings ({players.length})
        </h3>
        
        {players.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-500">No players in competition</p>
          </div>
        ) : (
          <div className="space-y-3">
            {players.map((player, index) => {
              const rank = index + 1;
              const scoreChange = scoreChanges[player.id];
              
              return (
                <div
                  key={player.id}
                  className={`border-2 rounded-lg p-3 transition-all duration-300 ${getRankColor(rank)}`}
                >
                  {/* Player Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getRankIcon(rank)}
                      <div>
                        <h4 className="font-bold text-white text-sm">{player.player_name}</h4>
                        <p className="text-gray-400 text-xs">
                          {player.player_wallet.slice(0, 4)}...{player.player_wallet.slice(-4)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Live Indicator */}
                    {competition.game_status === 'active' && (
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    )}
                  </div>

                  {/* Score */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">SCORE</span>
                      {scoreChange && (
                        <div className="flex items-center gap-1 text-green-400 animate-bounce">
                          <TrendingUp className="w-3 h-3" />
                          <span className="text-xs font-bold">+{scoreChange}</span>
                        </div>
                      )}
                    </div>
                    <div className={`text-xl font-bold ${rank === 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {formatScore(player.current_score)}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <Target className="w-3 h-3 text-orange-400" />
                      <span className="text-orange-400">{player.bricks_broken}</span>
                      <span className="text-gray-500">bricks</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-purple-400" />
                      <span className="text-purple-400">L{player.level_reached || 1}</span>
                      <span className="text-gray-500">level</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2">
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          rank === 1 
                            ? 'bg-gradient-to-r from-yellow-400 to-orange-500' 
                            : 'bg-gradient-to-r from-cyan-400 to-blue-500'
                        }`}
                        style={{ 
                          width: `${Math.min((player.bricks_broken || 0) / 50 * 100, 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Winner Announcement */}
      {competition.game_status === 'finished' && players.length > 0 && (
        <div className="border-t border-gray-700/50 p-4">
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/50 rounded-lg p-4 text-center">
            <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-2 animate-bounce" />
            <h3 className="text-lg font-bold text-yellow-400 mb-1">🏆 WINNER!</h3>
            <p className="text-white font-bold">{players[0]?.player_name}</p>
            <p className="text-yellow-300 text-sm">{formatScore(players[0]?.current_score || 0)} points</p>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="border-t border-gray-700/50 p-3 text-center">
        <p className="text-gray-500 text-xs">
          🔴 Live Updates • Room: {competition.channel_name}
        </p>
      </div>
    </div>
  );
}; 