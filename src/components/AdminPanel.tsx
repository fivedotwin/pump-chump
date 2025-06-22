import React, { useState, useEffect } from 'react';
import { Shield, Users, Clock, Trophy, Eye, Activity, Database, RefreshCw, X, Play } from 'lucide-react';
import { supabase, LiveCompetition, CompetitionScore } from '../lib/supabase';
import { LiveRoomSpectator } from './LiveRoomSpectator';

interface AdminPanelProps {
  currentWalletAddress: string;
  onClose: () => void;
}

interface RoomData {
  competition: LiveCompetition;
  players: CompetitionScore[];
  lastUpdate: string;
}

const AUTHORIZED_WALLET = '27piCD7MZDaFK7ioTbESg2dBxNuWdn8QLY8HWMwuD7Ed';

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentWalletAddress, onClose }) => {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spectatorRoom, setSpectatorRoom] = useState<LiveCompetition | null>(null);

  // Check authorization
  const isAuthorized = currentWalletAddress === AUTHORIZED_WALLET;

  const fetchAllRooms = async () => {
    try {
      setError(null);
      
      // Get all live competitions
      const { data: competitions, error: compError } = await supabase
        .from('live_competitions')
        .select('*')
        .order('created_at', { ascending: false });

      if (compError) throw compError;

      if (!competitions) {
        setRooms([]);
        return;
      }

      // Get players for each competition
      const roomsWithPlayers = await Promise.all(
        competitions.map(async (competition) => {
          const { data: players, error: playersError } = await supabase
            .from('competition_scores')
            .select('*')
            .eq('competition_id', competition.id)
            .eq('is_active', true)
            .order('current_score', { ascending: false });

          if (playersError) {
            console.error('Error fetching players for competition', competition.id, playersError);
            return {
              competition,
              players: [],
              lastUpdate: new Date().toISOString()
            };
          }

          return {
            competition,
            players: players || [],
            lastUpdate: new Date().toISOString()
          };
        })
      );

      setRooms(roomsWithPlayers);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch rooms');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllRooms();
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchAllRooms();
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchAllRooms, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthorized]);

  // Real-time subscriptions for live updates
  useEffect(() => {
    if (!isAuthorized) return;

    const subscriptions: any[] = [];

    // Subscribe to competition changes
    const competitionSub = supabase
      .channel('admin_competitions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_competitions'
      }, () => {
        fetchAllRooms();
      })
      .subscribe();

    // Subscribe to score changes
    const scoreSub = supabase
      .channel('admin_scores')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'competition_scores'
      }, () => {
        fetchAllRooms();
      })
      .subscribe();

    subscriptions.push(competitionSub, scoreSub);

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-red-900 via-gray-900 to-black border-2 border-red-500 rounded-xl p-8 max-w-md text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-400 mb-4">🚫 ACCESS DENIED</h2>
          <p className="text-red-300 mb-4">This admin panel is restricted to authorized personnel only.</p>
          <p className="text-gray-400 text-sm mb-6">Wallet: {currentWalletAddress.slice(0, 8)}...{currentWalletAddress.slice(-6)}</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/50';
      case 'active': return 'text-green-400 bg-green-400/20 border-green-400/50';
      case 'finished': return 'text-gray-400 bg-gray-400/20 border-gray-400/50';
      default: return 'text-blue-400 bg-blue-400/20 border-blue-400/50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting': return '⏳';
      case 'active': return '🎮';
      case 'finished': return '🏁';
      default: return '❓';
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);
    
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-900 via-gray-900 to-indigo-900 border-2 border-purple-400 rounded-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-500/25">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-blue-600/20 border-b border-purple-400/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-300 animate-pulse" />
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-300 via-indigo-300 to-blue-300 bg-clip-text text-transparent">
                🛡️ ADMIN CONTROL PANEL
              </h2>
              <p className="text-purple-300 text-sm">Live Competition Monitoring • Read-Only Access</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="text-purple-200">Last Refresh: {formatTime(lastRefresh.toISOString())}</div>
              <div className="text-purple-400">Authorized: {currentWalletAddress.slice(0, 6)}...{currentWalletAddress.slice(-4)}</div>
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-purple-500/20 rounded-lg transition-all duration-200 disabled:opacity-50 border border-purple-400/30 hover:border-purple-400/60"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 text-purple-300 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-all duration-200 border border-red-400/30 hover:border-red-400/60"
            >
              <X className="w-6 h-6 text-red-300" />
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="bg-gradient-to-r from-indigo-800/30 via-purple-800/30 to-blue-800/30 border-b border-indigo-400/30 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-b from-green-500/10 to-emerald-500/10 rounded-lg p-3 border border-green-400/20 text-center">
              <div className="text-green-300 font-bold text-lg">
                {rooms.filter(r => r.competition.game_status === 'active').length}
              </div>
              <div className="text-green-200/80 text-xs">Active Games</div>
            </div>
            
            <div className="bg-gradient-to-b from-yellow-500/10 to-orange-500/10 rounded-lg p-3 border border-yellow-400/20 text-center">
              <div className="text-yellow-300 font-bold text-lg">
                {rooms.filter(r => r.competition.game_status === 'waiting').length}
              </div>
              <div className="text-yellow-200/80 text-xs">Waiting Rooms</div>
            </div>
            
            <div className="bg-gradient-to-b from-blue-500/10 to-cyan-500/10 rounded-lg p-3 border border-blue-400/20 text-center">
              <div className="text-blue-300 font-bold text-lg">
                {rooms.reduce((total, room) => total + room.players.length, 0)}
              </div>
              <div className="text-blue-200/80 text-xs">Total Players</div>
            </div>
            
            <div className="bg-gradient-to-b from-purple-500/10 to-pink-500/10 rounded-lg p-3 border border-purple-400/20 text-center">
              <div className="text-purple-300 font-bold text-lg">{rooms.length}</div>
              <div className="text-purple-200/80 text-xs">Total Rooms</div>
            </div>
          </div>
        </div>

        {/* Rooms List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12">
              <Database className="w-16 h-16 text-purple-300 mx-auto mb-4 animate-pulse" />
              <p className="text-purple-200 text-lg">Loading all competitions...</p>
              <p className="text-purple-400/80 text-sm">Fetching real-time data from database</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400 text-lg font-bold mb-2">⚠️ Error Loading Data</div>
              <p className="text-red-300 text-sm mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-300 text-lg">No active competitions found</p>
              <p className="text-gray-500 text-sm">All rooms are currently empty</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {rooms.map((room) => (
                <div
                  key={room.competition.id}
                  className="bg-gradient-to-br from-gray-800/50 via-gray-900/50 to-purple-900/50 border-2 border-purple-600/30 rounded-xl p-4 shadow-lg"
                >
                  {/* Room Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{room.competition.channel_name}</h3>
                      <p className="text-purple-300 text-sm">Room ID: {room.competition.id.slice(0, 8)}...</p>
                    </div>
                    
                    <div className="text-right">
                      <div className={`px-3 py-1 rounded-full border text-sm font-bold ${getStatusColor(room.competition.game_status)}`}>
                        {getStatusIcon(room.competition.game_status)} {room.competition.game_status.toUpperCase()}
                      </div>
                      <p className="text-gray-400 text-xs mt-1">
                        Created: {formatTime(room.competition.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Room Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-3 text-center">
                      <Users className="w-5 h-5 text-blue-300 mx-auto mb-1" />
                      <div className="text-blue-300 font-bold">{room.players.length}</div>
                      <div className="text-blue-200/80 text-xs">Players</div>
                    </div>
                    
                    <div className="bg-orange-500/10 border border-orange-400/30 rounded-lg p-3 text-center">
                      <Clock className="w-5 h-5 text-orange-300 mx-auto mb-1" />
                      <div className="text-orange-300 font-bold text-sm">
                        {room.competition.start_time 
                          ? formatDuration(room.competition.start_time, room.competition.end_time)
                          : 'Not started'
                        }
                      </div>
                      <div className="text-orange-200/80 text-xs">Duration</div>
                    </div>
                  </div>

                  {/* Players List */}
                  <div className="bg-gray-800/30 border border-gray-600/30 rounded-lg p-3">
                    <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Live Players ({room.players.length})
                    </h4>
                    
                    {room.players.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-4">No players in this room</p>
                    ) : (
                      <div className="space-y-2">
                        {room.players.map((player, index) => (
                          <div
                            key={player.id}
                            className={`flex items-center justify-between p-2 rounded ${
                              index === 0 && room.competition.game_status === 'finished'
                                ? 'bg-yellow-400/20 border border-yellow-400/50'
                                : 'bg-gray-700/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">#{index + 1}</span>
                              {index === 0 && room.competition.game_status === 'finished' && (
                                <Trophy className="w-4 h-4 text-yellow-400" />
                              )}
                              <span className="text-white font-medium text-sm">{player.player_name}</span>
                              <span className="text-gray-500 text-xs">
                                {player.player_wallet.slice(0, 4)}...{player.player_wallet.slice(-4)}
                              </span>
                              {player.is_ready && room.competition.game_status === 'waiting' && (
                                <span className="text-green-400 text-xs">✓ Ready</span>
                              )}
                            </div>
                            
                            <div className="text-right">
                              <div className="text-green-400 font-bold text-sm">{player.current_score}</div>
                              <div className="text-gray-400 text-xs">{player.bricks_broken} bricks</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Winner Display */}
                  {room.competition.game_status === 'finished' && room.competition.winner_wallet && (
                    <div className="mt-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/50 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-400" />
                        <span className="text-yellow-300 font-bold">Winner:</span>
                        <span className="text-white">
                          {room.players.find(p => p.player_wallet === room.competition.winner_wallet)?.player_name || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Watch Button */}
                  {(room.competition.game_status === 'active' || room.competition.game_status === 'waiting') && room.players.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => setSpectatorRoom(room.competition)}
                        className="w-full px-4 py-2 bg-gradient-to-r from-red-600/20 to-purple-600/20 border border-red-400/50 rounded-lg text-red-300 font-bold hover:bg-red-600/30 transition-all duration-200 flex items-center justify-center gap-2 hover:scale-105"
                      >
                        <Play className="w-4 h-4" />
                        👁️ WATCH LIVE
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gradient-to-r from-purple-800/30 via-indigo-800/30 to-blue-800/30 border-t border-purple-400/30 p-3 text-center">
          <p className="text-purple-200 text-sm">
            🔒 Admin Panel • Real-time monitoring • Auto-refresh every 30s
          </p>
          <p className="text-indigo-300 text-xs mt-1">
            Authorized access for wallet: {AUTHORIZED_WALLET.slice(0, 8)}...{AUTHORIZED_WALLET.slice(-8)}
          </p>
        </div>
              </div>

        {/* Live Room Spectator */}
        {spectatorRoom && (
          <LiveRoomSpectator
            competition={spectatorRoom}
            onClose={() => setSpectatorRoom(null)}
          />
        )}
      </div>
    );
  }; 