import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pandgckozhfpfwpvtcet.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbmRnY2tvemhmcGZ3cHZ0Y2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MzU1NDUsImV4cCI6MjA2NjExMTU0NX0.lf0L2_7JEIGzzwBJNNzP07RUeWZQtpo2FNXKbB4lxVk';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Debug logs to verify configuration
console.log('🔧 Supabase Configuration:');
console.log('URL:', supabaseUrl);
console.log('Anon Key:', supabaseAnonKey ? 'Present' : 'Missing');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Don't persist auth sessions since we're using wallet auth
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
    }
  }
});

export interface UserProfile {
  wallet_address: string;
  display_name: string;
  profile_image: string;
  created_at?: string;
  updated_at?: string;
}

// Save or update user profile
export async function saveUserProfile(profile: Omit<UserProfile, 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('users')
    .upsert(profile, { 
      onConflict: 'wallet_address',
      ignoreDuplicates: false 
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving user profile:', error);
    throw error;
  }

  return data;
}

// Get user profile by wallet address
export async function getUserProfile(walletAddress: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }

  return data;
}

// Check if user profile exists
export async function userProfileExists(walletAddress: string) {
  const profile = await getUserProfile(walletAddress);
  return profile !== null;
}

// ===== LIVE COMPETITION SYSTEM =====

// Competition interfaces
export interface LiveCompetition {
  id: string;
  channel_name: string;
  game_status: 'waiting' | 'active' | 'finished';
  timer_remaining: number;
  start_time?: string;
  end_time?: string;
  winner_wallet?: string;
  max_players: number;
  created_at: string;
}

export interface CompetitionScore {
  id: string;
  competition_id: string;
  player_wallet: string;
  player_name: string;
  current_score: number;
  is_ready: boolean;
  is_active: boolean;
  bricks_broken: number;
  level_reached: number;
  updated_at: string;
}

// Create or join competition
export async function createOrJoinCompetition(channelName: string, playerWallet: string, playerName: string): Promise<{ competition: LiveCompetition; playerScore: CompetitionScore }> {
  // First, try to find existing competition (waiting OR active for single-player testing)
  const { data: existingList, error: existingError } = await supabase
    .from('live_competitions')
    .select('*')
    .eq('channel_name', channelName)
    .in('game_status', ['waiting', 'active'])
    .order('created_at', { ascending: false })
    .limit(1);

  const existing = existingList && existingList.length > 0 ? existingList[0] : null;

  let competition: LiveCompetition;

  if (existing) {
    competition = existing;
    // If competition is active, reset it for solo testing
    if (existing.game_status === 'active') {
      await supabase
        .from('live_competitions')
        .update({ 
          game_status: 'waiting', 
          timer_remaining: 60,
          start_time: null,
          end_time: null,
          winner_wallet: null 
        })
        .eq('id', existing.id);
      
      // Clear existing scores for fresh start
      await supabase
        .from('competition_scores')
        .delete()
        .eq('competition_id', existing.id);
        
      competition.game_status = 'waiting';
    }
  } else {
    // Create new competition
    const { data: newComp, error: createError } = await supabase
      .from('live_competitions')
      .insert({ channel_name: channelName })
      .select()
      .single();

    if (createError) throw createError;
    competition = newComp;
  }

  // Add player to competition (upsert to handle rejoining)
  const { data: playerScore, error: scoreError } = await supabase
    .from('competition_scores')
    .upsert({
      competition_id: competition.id,
      player_wallet: playerWallet,
      player_name: playerName,
      current_score: 0,
      is_ready: false,
      is_active: true
    }, {
      onConflict: 'competition_id,player_wallet'
    })
    .select()
    .single();

  if (scoreError) throw scoreError;

  return { competition, playerScore };
}

// Update player score in real-time
export async function updatePlayerScore(competitionId: string, playerWallet: string, score: number, bricksBroken: number, levelReached: number): Promise<void> {
  const { error } = await supabase
    .from('competition_scores')
    .update({
      current_score: score,
      bricks_broken: bricksBroken,
      level_reached: levelReached,
      updated_at: new Date().toISOString()
    })
    .eq('competition_id', competitionId)
    .eq('player_wallet', playerWallet);

  if (error) throw error;
}

// Set player ready status
export async function setPlayerReady(competitionId: string, playerWallet: string, isReady: boolean): Promise<void> {
  const { error } = await supabase
    .from('competition_scores')
    .update({ is_ready: isReady })
    .eq('competition_id', competitionId)
    .eq('player_wallet', playerWallet);

  if (error) throw error;
}

// Remove player from competition
export async function removePlayerFromCompetition(competitionId: string, playerWallet: string): Promise<void> {
  console.log('🚪 Removing player from competition:', { competitionId, playerWallet });
  
  const { error } = await supabase
    .from('competition_scores')
    .update({ is_active: false })
    .eq('competition_id', competitionId)
    .eq('player_wallet', playerWallet);

  if (error) {
    console.error('❌ Error removing player:', error);
    throw error;
  }
  
  console.log('✅ Player removed from competition successfully');
}

// Check if player is still in competition
export async function isPlayerInCompetition(competitionId: string, playerWallet: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('competition_scores')
    .select('is_active')
    .eq('competition_id', competitionId)
    .eq('player_wallet', playerWallet)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error checking player status:', error);
    return false;
  }

  return data !== null;
}

// Start competition
export async function startCompetition(competitionId: string): Promise<void> {
  const { error } = await supabase
    .from('live_competitions')
    .update({
      game_status: 'active',
      start_time: new Date().toISOString(),
      timer_remaining: 60
    })
    .eq('id', competitionId);

  if (error) throw error;
}

// Finish competition and determine winner
export async function finishCompetition(competitionId: string): Promise<CompetitionScore | null> {
  // Get winner (highest score)
  const { data: scores, error: scoresError } = await supabase
    .from('competition_scores')
    .select('*')
    .eq('competition_id', competitionId)
    .eq('is_active', true)
    .order('current_score', { ascending: false })
    .limit(1);

  if (scoresError || !scores.length) return null;

  const winner = scores[0];

  // Update competition status
  const { error: updateError } = await supabase
    .from('live_competitions')
    .update({
      game_status: 'finished',
      end_time: new Date().toISOString(),
      winner_wallet: winner.player_wallet
    })
    .eq('id', competitionId);

  if (updateError) throw updateError;

  // Award XP to winner and participants
  await awardXP(winner.player_wallet, 100, true); // Winner gets 100 XP + win

  // Participants get 25 XP
  const { data: allScores } = await supabase
    .from('competition_scores')
    .select('player_wallet')
    .eq('competition_id', competitionId)
    .eq('is_active', true);

  if (allScores) {
    for (const score of allScores) {
      if (score.player_wallet !== winner.player_wallet) {
        await awardXP(score.player_wallet, 25, false);
      }
    }
  }

  return winner;
}

// Award XP and handle level ups
export async function awardXP(walletAddress: string, xpAmount: number, isWin: boolean): Promise<{ leveledUp: boolean; newLevel: number; newXP: number }> {
  const { data: user, error: getUserError } = await supabase
    .from('users')
    .select('total_xp, player_level, total_wins, games_played')
    .eq('wallet_address', walletAddress)
    .single();

  if (getUserError) throw getUserError;

  const newXP = (user.total_xp || 0) + xpAmount;
  const newWins = (user.total_wins || 0) + (isWin ? 1 : 0);
  const newGamesPlayed = (user.games_played || 0) + 1;
  
  // Calculate new level using SQL function
  const { data: levelData, error: levelError } = await supabase
    .rpc('calculate_level', { xp: newXP });

  if (levelError) throw levelError;

  const newLevel = levelData;
  const leveledUp = newLevel > (user.player_level || 1);

  // Update user stats
  const { error: updateError } = await supabase
    .from('users')
    .update({
      total_xp: newXP,
      player_level: newLevel,
      total_wins: newWins,
      games_played: newGamesPlayed
    })
    .eq('wallet_address', walletAddress);

  if (updateError) throw updateError;

  return { leveledUp, newLevel, newXP };
}

// Get competition players
export async function getCompetitionPlayers(competitionId: string): Promise<CompetitionScore[]> {
  const { data, error } = await supabase
    .from('competition_scores')
    .select('*')
    .eq('competition_id', competitionId)
    .eq('is_active', true)
    .order('current_score', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Real-time competition subscriptions
export function subscribeToCompetition(competitionId: string, onUpdate: (competition: LiveCompetition) => void) {
  return supabase
    .channel(`competition_${competitionId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'live_competitions',
      filter: `id=eq.${competitionId}`
    }, (payload) => {
      onUpdate(payload.new as LiveCompetition);
    })
    .subscribe();
}

export function subscribeToScores(competitionId: string, onUpdate: (scores: CompetitionScore[]) => void) {
  return supabase
    .channel(`scores_${competitionId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'competition_scores',
      filter: `competition_id=eq.${competitionId}`
    }, async () => {
      // Fetch updated scores
      const scores = await getCompetitionPlayers(competitionId);
      onUpdate(scores);
    })
    .subscribe();
}

// Game Session Types
export interface GameSession {
  id: string;
  channel_name: string;
  current_player_id: string;
  turn_start_time: string;
  turn_duration: number; // 30 seconds
  session_status: 'waiting' | 'active' | 'finished';
  created_at: string;
  updated_at: string;
}

export interface GamePlayer {
  id: string;
  session_id: string;
  wallet_address: string;
  display_name: string;
  turn_order: number;
  best_level: number;
  best_score: number;
  is_active: boolean;
  joined_at: string;
}

export interface GameTurn {
  id: string;
  session_id: string;
  player_id: string;
  turn_number: number;
  level_reached: number;
  bricks_broken: number;
  time_taken: number;
  created_at: string;
}

// Game Session Functions
export async function createGameSession(channelName: string): Promise<GameSession> {
  const { data, error } = await supabase
    .from('game_sessions')
    .insert({
      channel_name: channelName,
      turn_duration: 30,
      session_status: 'waiting'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating game session:', error);
    throw error;
  }

  return data;
}

export async function getActiveGameSession(channelName: string): Promise<GameSession | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('channel_name', channelName)
    .eq('session_status', 'active')
    .maybeSingle();

  if (error) {
    console.error('Error fetching active game session:', error);
    throw error;
  }

  return data;
}

export async function joinGameSession(sessionId: string, walletAddress: string, displayName: string): Promise<GamePlayer> {
  // First, get the current max turn order
  const { data: existingPlayers, error: countError } = await supabase
    .from('game_players')
    .select('turn_order')
    .eq('session_id', sessionId)
    .order('turn_order', { ascending: false })
    .limit(1);

  if (countError) {
    console.error('Error getting player count:', countError);
    throw countError;
  }

  const nextTurnOrder = existingPlayers.length > 0 ? existingPlayers[0].turn_order + 1 : 1;

  const { data, error } = await supabase
    .from('game_players')
    .insert({
      session_id: sessionId,
      wallet_address: walletAddress,
      display_name: displayName,
      turn_order: nextTurnOrder,
      best_level: 0,
      best_score: 0,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    console.error('Error joining game session:', error);
    throw error;
  }

  return data;
}

export async function getGamePlayers(sessionId: string): Promise<GamePlayer[]> {
  const { data, error } = await supabase
    .from('game_players')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_active', true)
    .order('turn_order', { ascending: true });

  if (error) {
    console.error('Error fetching game players:', error);
    throw error;
  }

  return data || [];
}

export async function updateCurrentPlayer(sessionId: string, playerId: string): Promise<void> {
  const { error } = await supabase
    .from('game_sessions')
    .update({
      current_player_id: playerId,
      turn_start_time: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId);

  if (error) {
    console.error('Error updating current player:', error);
    throw error;
  }
}

export async function saveTurnResult(sessionId: string, playerId: string, levelReached: number, bricksBreken: number, timeTaken: number): Promise<void> {
  // Save the turn result
  const { error: turnError } = await supabase
    .from('game_turns')
    .insert({
      session_id: sessionId,
      player_id: playerId,
      level_reached: levelReached,
      bricks_broken: bricksBreken,
      time_taken: timeTaken
    });

  if (turnError) {
    console.error('Error saving turn result:', turnError);
    throw turnError;
  }

  // Update player's best score if this is better
  const { error: updateError } = await supabase
    .from('game_players')
    .update({
      best_level: levelReached,
      best_score: bricksBreken
    })
    .eq('id', playerId)
    .lt('best_level', levelReached);

  if (updateError) {
    console.error('Error updating player best score:', updateError);
    throw updateError;
  }
}

export async function getGameLeaderboard(sessionId: string): Promise<GamePlayer[]> {
  const { data, error } = await supabase
    .from('game_players')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_active', true)
    .order('best_level', { ascending: false })
    .order('best_score', { ascending: false });

  if (error) {
    console.error('Error fetching game leaderboard:', error);
    throw error;
  }

  return data || [];
}

// Real-time subscriptions for game updates
export function subscribeToGameSession(sessionId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`game_session_${sessionId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_sessions',
      filter: `id=eq.${sessionId}`
    }, callback)
    .subscribe();
}

export function subscribeToGamePlayers(sessionId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`game_players_${sessionId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_players',
      filter: `session_id=eq.${sessionId}`
    }, callback)
    .subscribe();
}

// ===== GLOBAL LEADERBOARD SYSTEM =====

export interface LeaderboardEntry {
  wallet_address: string;
  display_name: string;
  profile_image: string;
  highest_score: number;
  total_bricks_destroyed: number;
  bosses_defeated: number;
  max_streak: number;
  achievements_unlocked: number;
  player_level: number;
  total_xp: number;
  total_wins: number;
  games_played: number;
  created_at: string;
  updated_at: string;
}

// Update player stats for leaderboard - fallback version
export async function updatePlayerLeaderboardStats(
  walletAddress: string, 
  stats: {
    score?: number;
    bricksDestroyed?: number;
    bossesDefeated?: number;
    maxStreak?: number;
    achievements?: number;
  }
): Promise<void> {
  try {
    // Convert game stats to XP for now (since we have XP tracking)
    let additionalXP = 0;
    
    if (stats.score) {
      additionalXP += Math.floor(stats.score / 10); // 1 XP per 10 points
    }
    
    if (stats.bricksDestroyed) {
      additionalXP += stats.bricksDestroyed * 2; // 2 XP per brick
    }
    
    if (stats.bossesDefeated) {
      additionalXP += stats.bossesDefeated * 250; // 250 XP per boss - Much more rewarding!
    }
    
    if (stats.maxStreak && stats.maxStreak > 10) {
      additionalXP += stats.maxStreak * 5; // 5 XP per streak point over 10
    }
    
    if (stats.achievements) {
      additionalXP += stats.achievements * 25; // 25 XP per achievement
    }

    if (additionalXP > 0) {
      // Get current user stats
      const { data: currentUser, error: getUserError } = await supabase
        .from('users')
        .select('total_xp, player_level')
        .eq('wallet_address', walletAddress)
        .single();

      if (getUserError) {
        console.error('Error fetching current user stats:', getUserError);
        return;
      }

      const newXP = (currentUser?.total_xp || 0) + additionalXP;
      
      // Calculate new level
      const { data: newLevel, error: levelError } = await supabase
        .rpc('calculate_level', { xp: newXP });

      const updateData: any = {
        total_xp: newXP,
        updated_at: new Date().toISOString()
      };

      if (!levelError && newLevel) {
        updateData.player_level = newLevel;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('wallet_address', walletAddress);

      if (updateError) {
        console.error('Error updating leaderboard stats:', updateError);
      } else {
        console.log('✅ Leaderboard stats updated for', walletAddress, `+${additionalXP} XP`);
      }
    }
  } catch (error) {
    console.error('Error in updatePlayerLeaderboardStats:', error);
    // Don't throw error to prevent game disruption
  }
}

// Get global leaderboard (top 50 players) - fallback version
export async function getGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    // Try to get all users and create leaderboard from available data
    const { data, error } = await supabase
      .from('users')
      .select(`
        wallet_address,
        display_name,
        profile_image,
        total_xp,
        player_level,
        total_wins,
        games_played,
        created_at,
        updated_at
      `)
      .not('total_xp', 'is', null)
      .order('total_xp', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching global leaderboard:', error);
      return [];
    }

    // Transform existing data into leaderboard format
    return (data || []).map(user => ({
      ...user,
      highest_score: (user.total_xp || 0) * 10, // Approximate score from XP
      total_bricks_destroyed: (user.total_wins || 0) * 100, // Estimate from wins
      bosses_defeated: Math.floor((user.total_wins || 0) / 3), // Estimate
      max_streak: Math.floor((user.total_xp || 0) / 50), // Estimate
      achievements_unlocked: Math.floor((user.player_level || 1) - 1), // Estimate
    }));
  } catch (error) {
    console.error('Error in getGlobalLeaderboard:', error);
    return [];
  }
}

// Get player's leaderboard rank - fallback version
export async function getPlayerRank(walletAddress: string): Promise<number | null> {
  try {
    const { data: userScore, error: userError } = await supabase
      .from('users')
      .select('total_xp')
      .eq('wallet_address', walletAddress)
      .single();

    if (userError || !userScore?.total_xp) {
      return null;
    }

    const { count, error: countError } = await supabase
      .from('users')
      .select('wallet_address', { count: 'exact', head: true })
      .gt('total_xp', userScore.total_xp);

    if (countError) {
      console.error('Error fetching player rank:', countError);
      return null;
    }

    return (count || 0) + 1; // +1 because rank is 1-indexed
  } catch (error) {
    console.error('Error in getPlayerRank:', error);
    return null;
  }
}

// Initialize player leaderboard stats (called when profile is created)
export async function initializePlayerStats(walletAddress: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        highest_score: 0,
        total_bricks_destroyed: 0,
        bosses_defeated: 0,
        max_streak: 0,
        achievements_unlocked: 0,
        total_xp: 0,
        player_level: 1,
        total_wins: 0,
        games_played: 0,
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress)
      .is('highest_score', null); // Only update if not already initialized

    if (error) {
      console.error('Error initializing player stats:', error);
    }
  } catch (error) {
    console.error('Error in initializePlayerStats:', error);
  }
}

// Token System Functions

export interface TokenInfo {
  balance: number;
  canClaim: boolean;
  minutesUntilClaim: number;
  lastClaim: string;
}

export interface TokenTransaction {
  id: string;
  transaction_type: 'hourly_bonus' | 'game_entry' | 'game_payout' | 'admin_adjustment';
  amount: number;
  balance_after: number;
  competition_id?: string;
  description?: string;
  created_at: string;
}

// Get user's token balance and claim status
export async function getUserTokenInfo(walletAddress: string): Promise<TokenInfo | null> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('chump_tokens, last_token_claim')
      .eq('wallet_address', walletAddress)
      .single();

    if (error || !user) {
      // If user doesn't exist, create them with default tokens
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress,
          display_name: `Player_${walletAddress.slice(0, 6)}`,
          chump_tokens: 1000,
          last_token_claim: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error creating user:', insertError);
        return null;
      }

      return {
        balance: 1000,
        canClaim: false,
        minutesUntilClaim: 60,
        lastClaim: new Date().toISOString()
      };
    }

    const lastClaim = new Date(user.last_token_claim);
    const now = new Date();
    const hoursSinceClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
    const canClaim = hoursSinceClaim >= 1;
    const minutesUntilClaim = canClaim ? 0 : Math.ceil((60 - (hoursSinceClaim * 60)));

    return {
      balance: user.chump_tokens || 0,
      canClaim,
      minutesUntilClaim,
      lastClaim: user.last_token_claim
    };
  } catch (error) {
    console.error('Error getting token info:', error);
    return null;
  }
}

// Claim hourly tokens
export async function claimHourlyTokens(walletAddress: string): Promise<{ success: boolean; tokensGained?: number; newBalance?: number; error?: string }> {
  try {
    const tokenInfo = await getUserTokenInfo(walletAddress);
    if (!tokenInfo) {
      return { success: false, error: 'User not found' };
    }

    if (!tokenInfo.canClaim) {
      return { success: false, error: `Must wait ${tokenInfo.minutesUntilClaim} minutes` };
    }

    const lastClaim = new Date(tokenInfo.lastClaim);
    const now = new Date();
    const hoursSinceClaim = Math.floor((now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60));
    const tokensToAdd = Math.min(hoursSinceClaim * 1000, 24000); // Cap at 24 hours
    const newBalance = tokenInfo.balance + tokensToAdd;

    // Update user's tokens and claim time
    const { error: updateError } = await supabase
      .from('users')
      .update({
        chump_tokens: newBalance,
        last_token_claim: now.toISOString()
      })
      .eq('wallet_address', walletAddress);

    if (updateError) {
      console.error('Error updating tokens:', updateError);
      return { success: false, error: 'Failed to update tokens' };
    }

    // Record transaction
    await supabase
      .from('token_transactions')
      .insert({
        wallet_address: walletAddress,
        transaction_type: 'hourly_bonus',
        amount: tokensToAdd,
        balance_after: newBalance,
        description: `Claimed ${hoursSinceClaim} hours worth of tokens`
      });

    return { success: true, tokensGained: tokensToAdd, newBalance };
  } catch (error) {
    console.error('Error claiming tokens:', error);
    return { success: false, error: 'Failed to claim tokens' };
  }
}

// Charge game entry fee
export async function chargeGameEntryFee(walletAddress: string, competitionId: string, entryCost: number = 20000): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const tokenInfo = await getUserTokenInfo(walletAddress);
    if (!tokenInfo) {
      return { success: false, error: 'User not found' };
    }

    if (tokenInfo.balance < entryCost) {
      return { success: false, error: `Insufficient tokens. Need ${entryCost}, have ${tokenInfo.balance}` };
    }

    const newBalance = tokenInfo.balance - entryCost;

    // Update user's balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ chump_tokens: newBalance })
      .eq('wallet_address', walletAddress);

    if (updateError) {
      console.error('Error charging entry fee:', updateError);
      return { success: false, error: 'Failed to charge entry fee' };
    }

    // Add to competition pot - Get current pot first, then update
    const { data: currentComp, error: getError } = await supabase
      .from('live_competitions')
      .select('total_pot')
      .eq('id', competitionId)
      .single();

    if (!getError && currentComp) {
      const newPot = (currentComp.total_pot || 0) + entryCost;
      const { error: potUpdateError } = await supabase
        .from('live_competitions')
        .update({ total_pot: newPot })
        .eq('id', competitionId);
      
      if (potUpdateError) {
        console.error('Error updating competition pot:', potUpdateError);
      }
    }

    // Record transaction
    await supabase
      .from('token_transactions')
      .insert({
        wallet_address: walletAddress,
        transaction_type: 'game_entry',
        amount: -entryCost,
        balance_after: newBalance,
        competition_id: competitionId,
        description: 'Game entry fee'
      });

    return { success: true, newBalance };
  } catch (error) {
    console.error('Error charging entry fee:', error);
    return { success: false, error: 'Failed to charge entry fee' };
  }
}

// Distribute winnings to winner
export async function distributeWinnings(competitionId: string, winnerWallet: string): Promise<{ success: boolean; winnings?: number; newBalance?: number; error?: string }> {
  try {
    // Get competition info
    const { data: competition, error: compError } = await supabase
      .from('live_competitions')
      .select('total_pot, pot_distributed')
      .eq('id', competitionId)
      .single();

    if (compError || !competition) {
      return { success: false, error: 'Competition not found' };
    }

    if (competition.pot_distributed) {
      return { success: false, error: 'Winnings already distributed' };
    }

    if (!competition.total_pot || competition.total_pot <= 0) {
      return { success: false, error: 'No pot to distribute' };
    }

    const tokenInfo = await getUserTokenInfo(winnerWallet);
    if (!tokenInfo) {
      return { success: false, error: 'Winner not found' };
    }

    const newBalance = tokenInfo.balance + competition.total_pot;

    // Update winner's balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ chump_tokens: newBalance })
      .eq('wallet_address', winnerWallet);

    if (updateError) {
      console.error('Error updating winner balance:', updateError);
      return { success: false, error: 'Failed to update winner balance' };
    }

    // Mark pot as distributed
    const { error: potError } = await supabase
      .from('live_competitions')
      .update({ pot_distributed: true })
      .eq('id', competitionId);

    if (potError) {
      console.error('Error marking pot distributed:', potError);
    }

    // Record transaction
    await supabase
      .from('token_transactions')
      .insert({
        wallet_address: winnerWallet,
        transaction_type: 'game_payout',
        amount: competition.total_pot,
        balance_after: newBalance,
        competition_id: competitionId,
        description: 'Game winnings'
      });

    return { success: true, winnings: competition.total_pot, newBalance };
  } catch (error) {
    console.error('Error distributing winnings:', error);
    return { success: false, error: 'Failed to distribute winnings' };
  }
}

// Get user's token transaction history
export async function getUserTokenTransactions(walletAddress: string, limit: number = 10): Promise<TokenTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('token_transactions')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting transactions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting transactions:', error);
    return [];
  }
}

// ===== WITHDRAWAL SYSTEM =====

export interface WithdrawalRequest {
  id: string;
  wallet_address: string;
  amount: number;
  solana_destination: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transaction_hash?: string;
  error_message?: string;
  requested_at: string;
  processed_at?: string;
}

// Request a token withdrawal to Solana wallet
export async function requestWithdrawal(walletAddress: string, amount: number, destinationWallet: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('request_withdrawal', {
      user_wallet: walletAddress,
      withdrawal_amount: amount,
      destination_wallet: destinationWallet
    });

    if (error) {
      console.error('Error requesting withdrawal:', error);
      return { success: false, error: error.message };
    }

    if (data.success) {
      return { 
        success: true, 
        message: `Withdrawal request submitted! ${amount.toLocaleString()} tokens will be converted to SOL and sent to ${destinationWallet}` 
      };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    return { success: false, error: 'Failed to submit withdrawal request' };
  }
}

// Get user's withdrawal history
export async function getUserWithdrawals(walletAddress: string): Promise<WithdrawalRequest[]> {
  try {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Error getting withdrawals:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting withdrawals:', error);
    return [];
  }
}

// Get withdrawal status
export async function getWithdrawalStatus(withdrawalId: string): Promise<WithdrawalRequest | null> {
  try {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (error) {
      console.error('Error getting withdrawal status:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting withdrawal status:', error);
    return null;
  }
}