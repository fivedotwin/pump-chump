import { supabase } from './supabase';

const migrationSQL = `
-- Turn-Based Collaborative Game System Migration

-- Game Sessions Table
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_name TEXT NOT NULL,
    current_player_id UUID,
    turn_start_time TIMESTAMP WITH TIME ZONE,
    turn_duration INTEGER DEFAULT 30,
    session_status TEXT DEFAULT 'waiting' CHECK (session_status IN ('waiting', 'active', 'finished')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game Players Table
CREATE TABLE IF NOT EXISTS game_players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    display_name TEXT NOT NULL,
    turn_order INTEGER NOT NULL,
    best_level INTEGER DEFAULT 0,
    best_score INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game Turns Table
CREATE TABLE IF NOT EXISTS game_turns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id UUID REFERENCES game_players(id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL,
    level_reached INTEGER DEFAULT 0,
    bricks_broken INTEGER DEFAULT 0,
    time_taken REAL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

const indexesSQL = `
-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_game_sessions_channel ON game_sessions(channel_name);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_game_players_session ON game_players(session_id);
CREATE INDEX IF NOT EXISTS idx_game_players_wallet ON game_players(wallet_address);
CREATE INDEX IF NOT EXISTS idx_game_players_turn_order ON game_players(session_id, turn_order);
CREATE INDEX IF NOT EXISTS idx_game_turns_session ON game_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_game_turns_player ON game_turns(player_id);
`;

export async function runMigrations() {
  try {
    console.log('🚀 Running database migrations...');

    // Execute main tables
    const { error: tablesError } = await supabase.rpc('exec', { sql: migrationSQL });
    if (tablesError) {
      console.error('Error creating tables:', tablesError);
      throw tablesError;
    }

    // Execute indexes
    const { error: indexesError } = await supabase.rpc('exec', { sql: indexesSQL });
    if (indexesError) {
      console.error('Error creating indexes:', indexesError);
      // Don't throw - indexes are nice to have but not critical
    }

    console.log('✅ Database migrations completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}

// Function to check if tables exist
export async function checkTablesExist() {
  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      // Table doesn't exist
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
} 