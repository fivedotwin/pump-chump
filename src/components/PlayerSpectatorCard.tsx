import React, { useState, useEffect } from 'react';
import { Camera, CameraOff, Crown, Medal, Gamepad2, Zap, Target, Flame } from 'lucide-react';
import { LiveCompetition, CompetitionScore } from '../lib/supabase';
import { GameStateViewer } from './GameStateViewer';

interface PlayerSpectatorCardProps {
  player: CompetitionScore;
  rank: number;
  isFocused: boolean;
  onFocus: () => void;
  competition: LiveCompetition;
  isEmpty: boolean;
}

export const PlayerSpectatorCard: React.FC<PlayerSpectatorCardProps> = ({
  player,
  rank,
  isFocused,
  onFocus,
  competition,
  isEmpty
}) => {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [lastScore, setLastScore] = useState(player.current_score);
  const [scoreAnimation, setScoreAnimation] = useState(false);

  // Animate score changes
  useEffect(() => {
    if (player.current_score !== lastScore) {
      setScoreAnimation(true);
      setLastScore(player.current_score);
      
      const timer = setTimeout(() => setScoreAnimation(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [player.current_score, lastScore]);

  const getRankIcon = () => {
    if (isEmpty) return null;
    
    switch (rank) {
      case 1: return <Crown className="w-5 h-5 text-yellow-400 animate-pulse" />;
      case 2: return <Medal className="w-4 h-4 text-gray-300" />;
      case 3: return <Medal className="w-4 h-4 text-orange-400" />;
      default: return <span className="text-gray-400 font-bold text-sm">#{rank}</span>;
    }
  };

  const getRankBorder = () => {
    if (isEmpty) return 'border-gray-600/50';
    
    switch (rank) {
      case 1: return 'border-yellow-400/70 shadow-lg shadow-yellow-400/20';
      case 2: return 'border-gray-300/70 shadow-lg shadow-gray-300/20';
      case 3: return 'border-orange-400/70 shadow-lg shadow-orange-400/20';
      default: return 'border-purple-600/50';
    }
  };

  const getScoreColor = () => {
    if (isEmpty) return 'text-gray-500';
    return rank === 1 ? 'text-yellow-400' : 'text-green-400';
  };

  const formatScore = (score: number) => {
    if (score >= 1000000) return `${(score / 1000000).toFixed(1)}M`;
    if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
    return score.toLocaleString();
  };

  if (isEmpty) {
    return (
      <div className={`
        bg-gradient-to-br from-gray-800/30 to-gray-900/30 
        border-2 ${getRankBorder()} 
        rounded-xl p-4 
        transition-all duration-300 
        ${isFocused ? 'scale-105 ring-2 ring-cyan-400/50' : ''}
      `}>
        <div className="flex flex-col h-full">
          {/* Empty Video Area */}
          <div className="aspect-video bg-gray-800/50 border border-gray-600/50 rounded-lg mb-3 flex items-center justify-center">
            <div className="text-center">
              <CameraOff className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Waiting for player...</p>
            </div>
          </div>
          
          {/* Empty Game Area */}
          <div className="flex-1 bg-gray-800/30 border border-gray-600/30 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Gamepad2 className="w-6 h-6 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-500 text-xs">No game active</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`
        bg-gradient-to-br from-gray-800/50 to-gray-900/50 
        border-2 ${getRankBorder()} 
        rounded-xl p-4 cursor-pointer 
        transition-all duration-300 hover:scale-[1.02]
        ${isFocused ? 'scale-105 ring-2 ring-cyan-400/50 bg-cyan-900/20' : ''}
      `}
      onClick={onFocus}
    >
      <div className="flex flex-col h-full">
        {/* Player Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getRankIcon()}
            <div>
              <h3 className="font-bold text-white text-sm">{player.player_name}</h3>
              <p className="text-gray-400 text-xs">
                {player.player_wallet.slice(0, 4)}...{player.player_wallet.slice(-4)}
              </p>
            </div>
          </div>
          
          {/* Player Status */}
          <div className="flex items-center gap-1">
            {competition.game_status === 'waiting' && player.is_ready && (
              <span className="text-green-400 text-xs bg-green-400/20 px-2 py-1 rounded-full">✓ Ready</span>
            )}
            {competition.game_status === 'active' && (
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            )}
          </div>
        </div>

        {/* Video Feed */}
        <div className="aspect-video bg-gray-900 border border-gray-600/50 rounded-lg mb-3 relative overflow-hidden">
          {isVideoEnabled ? (
            <div className="w-full h-full bg-gradient-to-br from-blue-900/20 to-purple-900/20 flex items-center justify-center">
              <div className="text-center">
                <Camera className="w-8 h-8 text-blue-400 mx-auto mb-2 animate-pulse" />
                <p className="text-blue-400 text-sm">Live Camera</p>
                <p className="text-gray-500 text-xs">{player.player_name}</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <CameraOff className="w-8 h-8 text-gray-500" />
            </div>
          )}
          
          {/* Video Controls Overlay */}
          <div className="absolute top-2 right-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVideoEnabled(!isVideoEnabled);
              }}
              className="p-1 bg-black/50 rounded-lg hover:bg-black/70 transition-colors"
            >
              {isVideoEnabled ? 
                <Camera className="w-4 h-4 text-white" /> : 
                <CameraOff className="w-4 h-4 text-gray-400" />
              }
            </button>
          </div>
        </div>

        {/* Game State Viewer */}
        <div className="flex-1 mb-3">
          <GameStateViewer 
            player={player} 
            competition={competition}
            isActive={competition.game_status === 'active'}
          />
        </div>

        {/* Score and Stats */}
        <div className="bg-gray-800/50 border border-gray-600/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs font-bold">SCORE</span>
            <div className="flex items-center gap-1">
              {rank <= 3 && getRankIcon()}
            </div>
          </div>
          
          <div className={`text-2xl font-bold ${getScoreColor()} ${scoreAnimation ? 'animate-pulse' : ''}`}>
            {formatScore(player.current_score)}
          </div>
          
          {/* Stats Row */}
          <div className="flex items-center justify-between mt-2 text-xs">
            <div className="flex items-center gap-1 text-orange-400">
              <Target className="w-3 h-3" />
              <span>{player.bricks_broken}</span>
            </div>
            <div className="flex items-center gap-1 text-purple-400">
              <Zap className="w-3 h-3" />
              <span>L{player.level_reached || 1}</span>
            </div>
            {player.current_score > lastScore && (
              <div className="flex items-center gap-1 text-green-400 animate-bounce">
                <Flame className="w-3 h-3" />
                <span>+{player.current_score - lastScore}</span>
              </div>
            )}
          </div>
        </div>

        {/* Focus Indicator */}
        {isFocused && (
          <div className="mt-2 text-center">
            <span className="text-cyan-400 text-xs font-bold bg-cyan-400/20 px-2 py-1 rounded-full">
              📺 FOCUSED
            </span>
          </div>
        )}
      </div>
    </div>
  );
}; 