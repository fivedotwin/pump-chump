import React, { useState, useEffect } from 'react';
import { X, Volume2, VolumeX, Maximize, Camera, Gamepad2, Crown, Timer, Users } from 'lucide-react';
import { supabase, LiveCompetition, CompetitionScore } from '../lib/supabase';
import { PlayerSpectatorCard } from './PlayerSpectatorCard';
import { LiveScoreboard } from './LiveScoreboard';

interface LiveRoomSpectatorProps {
  competition: LiveCompetition;
  onClose: () => void;
}

export const LiveRoomSpectator: React.FC<LiveRoomSpectatorProps> = ({ competition, onClose }) => {
  const [players, setPlayers] = useState<CompetitionScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [focusedPlayer, setFocusedPlayer] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Calculate time remaining
  useEffect(() => {
    if (competition.game_status === 'active' && competition.start_time) {
      const interval = setInterval(() => {
        const startTime = new Date(competition.start_time!).getTime();
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, 60 - elapsed);
        setTimeRemaining(remaining);
        
        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [competition.start_time, competition.game_status]);

  // Fetch players data
  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('competition_scores')
        .select('*')
        .eq('competition_id', competition.id)
        .eq('is_active', true)
        .order('current_score', { ascending: false });

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchPlayers();
  }, [competition.id]);

  // Real-time subscriptions
  useEffect(() => {
    const scoreSubscription = supabase
      .channel(`spectator_${competition.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'competition_scores',
        filter: `competition_id=eq.${competition.id}`
      }, () => {
        fetchPlayers();
      })
      .subscribe();

    // Auto refresh every 2 seconds for smooth updates
    const interval = setInterval(fetchPlayers, 2000);

    return () => {
      scoreSubscription.unsubscribe();
      clearInterval(interval);
    };
  }, [competition.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'f' || e.key === 'F') setIsFullscreen(!isFullscreen);
      if (e.key === 'm' || e.key === 'M') setIsMuted(!isMuted);
      if (e.key >= '1' && e.key <= '4') {
        const playerIndex = parseInt(e.key) - 1;
        if (players[playerIndex]) {
          setFocusedPlayer(focusedPlayer === players[playerIndex].id ? null : players[playerIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose, isFullscreen, isMuted, focusedPlayer, players]);

  const getGameStatusIcon = () => {
    switch (competition.game_status) {
      case 'waiting': return '⏳';
      case 'active': return '🎮';
      case 'finished': return '🏁';
      default: return '❓';
    }
  };

  const getGameStatusColor = () => {
    switch (competition.game_status) {
      case 'waiting': return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/50';
      case 'active': return 'text-green-400 bg-green-400/20 border-green-400/50 animate-pulse';
      case 'finished': return 'text-purple-400 bg-purple-400/20 border-purple-400/50';
      default: return 'text-gray-400 bg-gray-400/20 border-gray-400/50';
    }
  };

  // Fill empty slots with placeholder cards
  const displayPlayers = [...players];
  while (displayPlayers.length < 4) {
    displayPlayers.push({
      id: `empty-${displayPlayers.length}`,
      competition_id: competition.id,
      player_wallet: '',
      player_name: 'Waiting for player...',
      current_score: 0,
      is_ready: false,
      is_active: false,
      bricks_broken: 0,
      level_reached: 0,
      updated_at: new Date().toISOString()
    });
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cyan-400 text-xl font-bold">Connecting to Live Stream...</p>
          <p className="text-cyan-300 text-sm mt-2">🔴 LIVE • {competition.channel_name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 bg-black backdrop-blur-sm z-50 ${isFullscreen ? 'p-0' : 'p-4'}`}>
      <div className="w-full h-full bg-gradient-to-br from-gray-900 via-black to-purple-900 rounded-xl overflow-hidden flex flex-col">
        
        {/* Broadcast Header */}
        <div className="bg-gradient-to-r from-red-600/20 via-purple-600/20 to-blue-600/20 border-b border-red-400/30 p-4 relative overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-purple-500/10 to-blue-500/10 animate-pulse"></div>
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Live Indicator */}
              <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                <span className="text-white font-bold text-sm">🔴 LIVE</span>
              </div>
              
              {/* Competition Info */}
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-red-300 via-purple-300 to-blue-300 bg-clip-text text-transparent">
                  🏆 LIVE COMPETITION
                </h1>
                <p className="text-gray-300 text-sm">Room: {competition.channel_name}</p>
              </div>
              
              {/* Game Status */}
              <div className={`px-3 py-1 rounded-full border text-sm font-bold ${getGameStatusColor()}`}>
                {getGameStatusIcon()} {competition.game_status.toUpperCase()}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Timer */}
              {competition.game_status === 'active' && (
                <div className="bg-red-600/20 border border-red-400/50 rounded-lg px-4 py-2 text-center">
                  <Timer className="w-5 h-5 text-red-300 mx-auto mb-1" />
                  <div className="text-red-300 font-bold text-xl">{timeRemaining}s</div>
                  <div className="text-red-200/80 text-xs">Remaining</div>
                </div>
              )}
              
              {/* Player Count */}
              <div className="bg-blue-600/20 border border-blue-400/50 rounded-lg px-4 py-2 text-center">
                <Users className="w-5 h-5 text-blue-300 mx-auto mb-1" />
                <div className="text-blue-300 font-bold text-xl">{players.length}/4</div>
                <div className="text-blue-200/80 text-xs">Players</div>
              </div>
              
              {/* Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 bg-gray-800/50 border border-gray-600/50 rounded-lg hover:bg-gray-700/50 transition-colors"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-5 h-5 text-gray-400" /> : <Volume2 className="w-5 h-5 text-green-400" />}
                </button>
                
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 bg-gray-800/50 border border-gray-600/50 rounded-lg hover:bg-gray-700/50 transition-colors"
                  title="Toggle Fullscreen (F)"
                >
                  <Maximize className="w-5 h-5 text-cyan-400" />
                </button>
                
                <button
                  onClick={onClose}
                  className="p-2 bg-red-600/50 border border-red-400/50 rounded-lg hover:bg-red-500/50 transition-colors"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5 text-red-300" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Player Grid */}
          <div className="flex-1 grid grid-cols-2 gap-4 p-4">
            {displayPlayers.slice(0, 4).map((player, index) => (
              <PlayerSpectatorCard
                key={player.id}
                player={player}
                rank={index + 1}
                isFocused={focusedPlayer === player.id}
                onFocus={() => setFocusedPlayer(focusedPlayer === player.id ? null : player.id)}
                competition={competition}
                isEmpty={player.player_wallet === ''}
              />
            ))}
          </div>
          
          {/* Live Scoreboard */}
          <div className="w-80 border-l border-gray-700/50 bg-gray-900/50">
            <LiveScoreboard 
              players={players.filter(p => p.player_wallet !== '')} 
              competition={competition}
              timeRemaining={timeRemaining}
            />
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        <div className="bg-gray-900/50 border-t border-gray-700/50 px-4 py-2">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
            <span>⌨️ Shortcuts:</span>
            <span><kbd className="bg-gray-800 px-1 rounded">1-4</kbd> Focus player</span>
            <span><kbd className="bg-gray-800 px-1 rounded">F</kbd> Fullscreen</span>
            <span><kbd className="bg-gray-800 px-1 rounded">M</kbd> Mute</span>
            <span><kbd className="bg-gray-800 px-1 rounded">Esc</kbd> Exit</span>
          </div>
        </div>
      </div>
    </div>
  );
}; 