# 🎯 **FINAL DETAILED 2-HOUR IMPLEMENTATION PLAN**

## **Live Competition Mode with XP/Level System using Supabase Real-time**

---

## 📊 **Phase 1: Database Setup (15 minutes)**

### **Step 1.1: SQL Migration (5 min)**
Create `project/supabase/migrations/20250622050000_live_competition.sql`:

```sql
-- Add XP/Level columns to existing users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS player_level INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_wins INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0;

-- Live Competition Sessions
CREATE TABLE live_competitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_name TEXT NOT NULL,
    game_status TEXT DEFAULT 'waiting' CHECK (game_status IN ('waiting', 'active', 'finished')),
    timer_remaining INTEGER DEFAULT 60,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    winner_wallet TEXT,
    max_players INTEGER DEFAULT 4,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-time Player Scores
CREATE TABLE competition_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    competition_id UUID REFERENCES live_competitions(id) ON DELETE CASCADE,
    player_wallet TEXT NOT NULL,
    player_name TEXT NOT NULL,
    current_score INTEGER DEFAULT 0,
    is_ready BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    bricks_broken INTEGER DEFAULT 0,
    level_reached INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_live_competitions_channel ON live_competitions(channel_name);
CREATE INDEX idx_live_competitions_status ON live_competitions(game_status);
CREATE INDEX idx_competition_scores_competition ON competition_scores(competition_id);
CREATE INDEX idx_competition_scores_player ON competition_scores(player_wallet);

-- Enable RLS
ALTER TABLE live_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_scores ENABLE ROW LEVEL SECURITY;

-- Policies (public read/write for demo)
CREATE POLICY "Public access to competitions" ON live_competitions FOR ALL USING (true);
CREATE POLICY "Public access to scores" ON competition_scores FOR ALL USING (true);

-- Auto-update trigger
CREATE TRIGGER update_competition_scores_updated_at
    BEFORE UPDATE ON competition_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### **Step 1.2: XP Level Calculation Function (5 min)**
```sql
-- Function to calculate level from XP
CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
    CASE 
        WHEN xp < 100 THEN RETURN 1;
        WHEN xp < 250 THEN RETURN 2;
        WHEN xp < 500 THEN RETURN 3;
        WHEN xp < 1000 THEN RETURN 4;
        WHEN xp < 2000 THEN RETURN 5;
        WHEN xp < 3500 THEN RETURN 6;
        WHEN xp < 5500 THEN RETURN 7;
        WHEN xp < 8000 THEN RETURN 8;
        WHEN xp < 12000 THEN RETURN 9;
        ELSE RETURN 10;
    END CASE;
END;
$$ LANGUAGE plpgsql;
```

### **Step 1.3: Execute Migration (5 min)**
Copy SQL to Supabase dashboard → SQL Editor → Execute

---

## 🔧 **Phase 2: Supabase Functions (25 minutes)**

### **Step 2.1: Competition Functions (15 min)**
Add to `project/src/lib/supabase.ts`:

```typescript
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
  // First, try to find existing active competition
  const { data: existing, error: existingError } = await supabase
    .from('live_competitions')
    .select('*')
    .eq('channel_name', channelName)
    .eq('game_status', 'waiting')
    .single();

  let competition: LiveCompetition;

  if (existing) {
    competition = existing;
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

  // Add player to competition
  const { data: playerScore, error: scoreError } = await supabase
    .from('competition_scores')
    .upsert({
      competition_id: competition.id,
      player_wallet: playerWallet,
      player_name: playerName,
      current_score: 0,
      is_ready: false,
      is_active: true
    })
    .select()
    .single();

  if (scoreError) throw scoreError;

  return { competition, playerScore };
}

// Update player score in real-time
export async function updatePlayerScore(competitionId: string, playerWallet: string, score: number, bricksBreken: number, levelReached: number): Promise<void> {
  const { error } = await supabase
    .from('competition_scores')
    .update({
      current_score: score,
      bricks_broken: bricksBreken,
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
  for (const score of scores.slice(1)) {
    await awardXP(score.player_wallet, 25, false);
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
```

### **Step 2.2: Real-time Subscriptions (10 min)**
```typescript
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
      const { data } = await supabase
        .from('competition_scores')
        .select('*')
        .eq('competition_id', competitionId)
        .eq('is_active', true)
        .order('current_score', { ascending: false });

      if (data) onUpdate(data);
    })
    .subscribe();
}
```

---

## 🎮 **Phase 3: Competition Component (45 minutes)**

### **Step 3.1: Create CompetitiveBrickWall Component (30 min)**
Create `project/src/components/CompetitiveBrickWall.tsx`:

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Clock, Users, Star, Zap } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  createOrJoinCompetition, 
  updatePlayerScore, 
  setPlayerReady, 
  startCompetition, 
  finishCompetition,
  subscribeToCompetition,
  subscribeToScores,
  LiveCompetition,
  CompetitionScore,
  awardXP
} from '../lib/supabase';
import { BrickWall } from './BrickWall';

interface CompetitiveBrickWallProps {
  channelName: string;
  onBack: () => void;
}

export const CompetitiveBrickWall: React.FC<CompetitiveBrickWallProps> = ({ channelName, onBack }) => {
  const [competition, setCompetition] = useState<LiveCompetition | null>(null);
  const [scores, setScores] = useState<CompetitionScore[]>([]);
  const [myScore, setMyScore] = useState<CompetitionScore | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameActive, setGameActive] = useState(false);
  const [winner, setWinner] = useState<CompetitionScore | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [leveledUp, setLeveledUp] = useState(false);
  const [loading, setLoading] = useState(true);

  const { publicKey } = useWallet();
  const playerWallet = publicKey?.toString() || '';

  // Initialize competition
  useEffect(() => {
    if (!playerWallet) return;

    const initCompetition = async () => {
      try {
        const { competition: comp, playerScore } = await createOrJoinCompetition(
          channelName, 
          playerWallet, 
          'Player' // You can get actual name from user profile
        );
        
        setCompetition(comp);
        setMyScore(playerScore);
        setGameActive(comp.game_status === 'active');
        setLoading(false);
      } catch (error) {
        console.error('Error initializing competition:', error);
        setLoading(false);
      }
    };

    initCompetition();
  }, [channelName, playerWallet]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!competition) return;

    const competitionSub = subscribeToCompetition(competition.id, (updatedComp) => {
      setCompetition(updatedComp);
      setGameActive(updatedComp.game_status === 'active');
      
      if (updatedComp.game_status === 'finished') {
        handleGameFinished();
      }
    });

    const scoresSub = subscribeToScores(competition.id, (updatedScores) => {
      setScores(updatedScores);
      const myUpdatedScore = updatedScores.find(s => s.player_wallet === playerWallet);
      if (myUpdatedScore) setMyScore(myUpdatedScore);
    });

    return () => {
      competitionSub.unsubscribe();
      scoresSub.unsubscribe();
    };
  }, [competition, playerWallet]);

  // Game timer
  useEffect(() => {
    if (!gameActive || !competition) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameActive, competition]);

  const handleReady = async () => {
    if (!competition || !playerWallet) return;
    
    try {
      await setPlayerReady(competition.id, playerWallet, !isReady);
      setIsReady(!isReady);
    } catch (error) {
      console.error('Error setting ready status:', error);
    }
  };

  const handleStartGame = async () => {
    if (!competition) return;
    
    try {
      await startCompetition(competition.id);
    } catch (error) {
      console.error('Error starting competition:', error);
    }
  };

  const handleBrickBreak = async (brickId: string, playerWallet: string) => {
    if (!gameActive || !competition || !myScore) return;

    const newScore = myScore.current_score + 10;
    const newBricks = myScore.bricks_broken + 1;

    try {
      await updatePlayerScore(
        competition.id,
        playerWallet,
        newScore,
        newBricks,
        Math.floor(newBricks / 50) + 1 // Simple level calculation
      );
    } catch (error) {
      console.error('Error updating score:', error);
    }
  };

  const handleTimeUp = async () => {
    if (!competition) return;
    
    try {
      const winnerData = await finishCompetition(competition.id);
      setWinner(winnerData);
    } catch (error) {
      console.error('Error finishing competition:', error);
    }
  };

  const handleGameFinished = async () => {
    if (!playerWallet) return;

    try {
      const isWinner = winner?.player_wallet === playerWallet;
      const xpAmount = isWinner ? 100 : 25;
      
      const { leveledUp: didLevelUp, newLevel } = await awardXP(playerWallet, xpAmount, isWinner);
      
      setXpGained(xpAmount);
      setLeveledUp(didLevelUp);
      setShowCelebration(true);
    } catch (error) {
      console.error('Error awarding XP:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-green-400 text-lg">Joining competition...</p>
        </div>
      </div>
    );
  }

  // Celebration Screen
  if (showCelebration) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center relative overflow-hidden">
        {/* Confetti Animation */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-green-400 rounded animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random()}s`
              }}
            />
          ))}
        </div>

        <div className="text-center z-10">
          <div className="mb-8">
            {winner?.player_wallet === playerWallet ? (
              <>
                <Trophy className="w-24 h-24 text-yellow-400 mx-auto mb-4 animate-bounce" />
                <h1 className="text-5xl font-bold text-yellow-400 mb-2">🏆 YOU WON! 🏆</h1>
                <p className="text-2xl text-white">Congratulations Champion!</p>
              </>
            ) : (
              <>
                <Star className="w-20 h-20 text-green-400 mx-auto mb-4 animate-pulse" />
                <h1 className="text-4xl font-bold text-green-400 mb-2">Great Game!</h1>
                <p className="text-xl text-white">Thanks for competing!</p>
              </>
            )}
          </div>

          <div className="bg-gray-900 border-2 border-green-400 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Zap className="w-6 h-6 text-yellow-400" />
              <span className="text-2xl font-bold text-yellow-400">+{xpGained} XP</span>
            </div>
            
            {leveledUp && (
              <div className="text-center">
                <p className="text-green-400 text-xl font-bold mb-2">🎉 LEVEL UP! 🎉</p>
                <p className="text-white">You're now Level {myScore?.level_reached || 1}!</p>
              </div>
            )}
          </div>

          <button
            onClick={onBack}
            className="px-8 py-3 bg-green-400 text-black font-bold rounded-lg hover:bg-green-300 transition-all"
          >
            Back to Stream
          </button>
        </div>
      </div>
    );
  }

  // Waiting/Ready Screen
  if (!gameActive) {
    const allReady = scores.length > 0 && scores.every(s => s.is_ready);
    const canStart = scores.length >= 2 && allReady;

    return (
      <div className="min-h-screen bg-black text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-green-400">🎮 Competition Lobby</h1>
              <div className="flex items-center gap-2 text-gray-400">
                <Users className="w-5 h-5" />
                <span>{scores.length}/{competition?.max_players || 4} players</span>
              </div>
            </div>

            {/* Player List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {scores.map((score) => (
                <div
                  key={score.id}
                  className={`p-4 rounded-lg border-2 ${
                    score.is_ready ? 'border-green-400 bg-green-400/10' : 'border-gray-600 bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{score.player_name}</span>
                    <span className={`text-sm ${score.is_ready ? 'text-green-400' : 'text-red-400'}`}>
                      {score.is_ready ? '✓ Ready' : '⏳ Waiting'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Ready Button */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleReady}
                className={`px-8 py-3 font-bold rounded-lg transition-all ${
                  isReady
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : 'bg-green-400 text-black hover:bg-green-300'
                }`}
              >
                {isReady ? 'Cancel Ready' : 'Ready to Play!'}
              </button>

              {canStart && (
                <button
                  onClick={handleStartGame}
                  className="px-8 py-3 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-300 transition-all animate-pulse"
                >
                  🚀 START GAME!
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Game Screen
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Game Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Clock className="w-6 h-6 text-red-400" />
            <span className="text-2xl font-bold text-red-400">{timeLeft}s</span>
          </div>
          
          <h1 className="text-xl font-bold text-green-400">🏆 LIVE COMPETITION</h1>
          
          <div className="text-right">
            <div className="text-lg font-bold text-white">Your Score: {myScore?.current_score || 0}</div>
            <div className="text-sm text-gray-400">Bricks: {myScore?.bricks_broken || 0}</div>
          </div>
        </div>
      </div>

      {/* Live Leaderboard */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-center gap-8">
          {scores.slice(0, 4).map((score, index) => (
            <div
              key={score.id}
              className={`text-center ${score.player_wallet === playerWallet ? 'ring-2 ring-green-400 rounded-lg p-2' : ''}`}
            >
              <div className="text-sm text-gray-400">#{index + 1}</div>
              <div className="font-bold text-white">{score.player_name}</div>
              <div className="text-lg font-bold text-green-400">{score.current_score}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Brick Game */}
      <BrickWall
        playerWallet={playerWallet}
        onBrickBreak={handleBrickBreak}
        onGameWin={() => {}} // Not used in competition mode
      />
    </div>
  );
};
```

### **Step 3.2: Integrate with LiveStream (15 min)**
Update `project/src/components/LiveStream.tsx`:

```typescript
// Add import
import { CompetitiveBrickWall } from './CompetitiveBrickWall';

// Add state
const [gameMode, setGameMode] = useState<'normal' | 'competition'>('normal');

// Add competition toggle button in the controls section
<button
  onClick={() => setGameMode(gameMode === 'normal' ? 'competition' : 'normal')}
  className="p-2 rounded-full bg-yellow-400 text-black hover:bg-yellow-300 transition-all duration-200"
>
  {gameMode === 'normal' ? '🏆' : '🎮'}
</button>

// Replace BrickWall component conditionally
{gameMode === 'competition' ? (
  <CompetitiveBrickWall 
    channelName={agoraService.getChannelName()}
    onBack={() => setGameMode('normal')}
  />
) : (
  <BrickWall 
    playerWallet={publicKey?.toString() || ''}
    onBrickBreak={handleBrickBreak}
    onGameWin={handleGameWin}
  />
)}
```

---

## 🎯 **Phase 4: Testing & Polish (15 minutes)**

### **Step 4.1: Test Flow (10 min)**
1. Start dev server: `npm run dev`
2. Open multiple browser tabs
3. Connect different wallets (or simulate)
4. Test ready/start/compete flow
5. Verify real-time score updates
6. Test winner celebration

### **Step 4.2: Final Polish (5 min)**
- Add loading states
- Error handling
- Visual improvements
- Performance optimization

---

## 🏆 **FINAL RESULT:**

**After 2 hours, you'll have:**
- ✅ **Live 2-4 player competition** with real-time scoring
- ✅ **60-second time limit** with synchronized timer
- ✅ **Real-time leaderboard** updating on every brick break
- ✅ **XP/Level system** with automatic rewards
- ✅ **Winner celebration** with confetti and camera spotlight
- ✅ **Ready/Start system** for fair gameplay
- ✅ **Spectator mode** for non-competing viewers
- ✅ **Database persistence** for scores and progression

**This creates an incredibly engaging, competitive experience that will keep players coming back to level up and compete!** 🚀

---

## 📋 **Implementation Checklist:**

### **Database Setup:**
- [ ] Execute SQL migration in Supabase dashboard
- [ ] Verify tables created successfully
- [ ] Test basic CRUD operations

### **Backend Functions:**
- [ ] Add competition functions to supabase.ts
- [ ] Add real-time subscription handlers
- [ ] Test XP/level calculation functions

### **Frontend Components:**
- [ ] Create CompetitiveBrickWall component
- [ ] Integrate with LiveStream component
- [ ] Add competition toggle button

### **Testing:**
- [ ] Test multi-player competition flow
- [ ] Verify real-time score updates
- [ ] Test winner celebration and XP awards
- [ ] Performance optimization and bug fixes

---

## 🚀 **Ready to Start Implementation!** 