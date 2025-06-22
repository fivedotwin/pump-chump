import React from 'react';
import { Activity, Zap, Target, Flame, Crown } from 'lucide-react';
import { LiveCompetition, CompetitionScore } from '../lib/supabase';

interface GameStateViewerProps {
  player: CompetitionScore;
  competition: LiveCompetition;
  isActive: boolean;
}

export const GameStateViewer: React.FC<GameStateViewerProps> = ({ player, competition, isActive }) => {
  // Create a mini brick wall visualization based on player progress
  const generateMiniBricks = () => {
    const totalBricks = 50; // 5 rows x 10 columns
    const brokenBricks = Math.min(player.bricks_broken || 0, totalBricks);
    const bricks = [];

    for (let i = 0; i < totalBricks; i++) {
      const row = Math.floor(i / 10);
      const col = i % 10;
      const isBroken = i < brokenBricks;
      
      bricks.push(
        <div
          key={i}
          className={`
            w-2 h-1.5 rounded-sm transition-all duration-300
            ${isBroken 
              ? 'bg-transparent' 
              : isActive 
                ? 'bg-gradient-to-r from-green-400 to-emerald-500 shadow-sm' 
                : 'bg-gray-600'
            }
          `}
          style={{
            opacity: isBroken ? 0 : (isActive ? 0.9 : 0.5),
          }}
        />
      );
    }

    return bricks;
  };

  const getProgressPercentage = () => {
    const maxBricks = 50;
    return Math.min((player.bricks_broken || 0) / maxBricks * 100, 100);
  };

  const getCurrentLevel = () => {
    return player.level_reached || 1;
  };

  const hasActivePowerUp = () => {
    // Simulate power-up detection based on recent score increases
    return isActive && (player.current_score % 100 === 0) && player.current_score > 0;
  };

  const isBossFight = () => {
    // Boss fights happen every 5 levels
    return getCurrentLevel() % 5 === 0 && getCurrentLevel() > 0;
  };

  if (competition.game_status === 'waiting') {
    return (
      <div className="bg-gray-800/30 border border-gray-600/30 rounded-lg p-3 h-full flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-6 h-6 text-gray-500 mx-auto mb-2" />
          <p className="text-gray-500 text-xs">Waiting to start...</p>
        </div>
      </div>
    );
  }

  if (competition.game_status === 'finished') {
    return (
      <div className="bg-purple-900/20 border border-purple-600/30 rounded-lg p-3 h-full flex items-center justify-center">
        <div className="text-center">
          <Crown className="w-6 h-6 text-purple-400 mx-auto mb-2" />
          <p className="text-purple-400 text-xs font-bold">Game Complete!</p>
          <p className="text-gray-400 text-xs">Final Score: {player.current_score}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg p-3 h-full">
      {/* Game Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${isActive ? 'text-green-400 animate-pulse' : 'text-gray-500'}`} />
          <span className="text-xs font-bold text-gray-300">LEVEL {getCurrentLevel()}</span>
        </div>
        
        {/* Status Indicators */}
        <div className="flex items-center gap-1">
          {hasActivePowerUp() && (
            <div className="flex items-center gap-1 text-yellow-400">
              <Zap className="w-3 h-3 animate-pulse" />
              <span className="text-xs">PWR</span>
            </div>
          )}
          {isBossFight() && (
            <div className="flex items-center gap-1 text-red-400">
              <Crown className="w-3 h-3 animate-pulse" />
              <span className="text-xs">BOSS</span>
            </div>
          )}
        </div>
      </div>

      {/* Mini Brick Wall */}
      <div className="mb-3">
        <div className="bg-black/30 border border-gray-700/50 rounded p-2">
          <div className="grid grid-cols-10 gap-0.5">
            {generateMiniBricks()}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-400">Progress</span>
          <span className="text-cyan-400 font-bold">{getProgressPercentage().toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>

      {/* Game Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-orange-500/10 border border-orange-400/30 rounded p-1.5 text-center">
          <Target className="w-3 h-3 text-orange-400 mx-auto mb-1" />
          <div className="text-orange-400 font-bold">{player.bricks_broken}</div>
          <div className="text-orange-300/80 text-xs">Bricks</div>
        </div>
        
        <div className="bg-purple-500/10 border border-purple-400/30 rounded p-1.5 text-center">
          <Flame className="w-3 h-3 text-purple-400 mx-auto mb-1" />
          <div className="text-purple-400 font-bold">L{getCurrentLevel()}</div>
          <div className="text-purple-300/80 text-xs">Level</div>
        </div>
      </div>

      {/* Boss Battle Indicator */}
      {isBossFight() && isActive && (
        <div className="mt-2 bg-red-900/30 border border-red-500/50 rounded p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-red-400">
            <Crown className="w-4 h-4 animate-bounce" />
            <span className="text-xs font-bold animate-pulse">BOSS BATTLE!</span>
          </div>
        </div>
      )}

      {/* Power-Up Indicator */}
      {hasActivePowerUp() && isActive && (
        <div className="mt-2 bg-yellow-900/30 border border-yellow-500/50 rounded p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-yellow-400">
            <Zap className="w-4 h-4 animate-spin" />
            <span className="text-xs font-bold">POWER-UP ACTIVE!</span>
          </div>
        </div>
      )}
    </div>
  );
}; 