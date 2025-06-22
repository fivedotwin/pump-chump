-- Leaderboard Stats Migration
-- Add leaderboard tracking columns to the users table

-- Add leaderboard stat columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS highest_score INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_bricks_destroyed INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bosses_defeated INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS achievements_unlocked INTEGER DEFAULT 0;

-- Add indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_users_highest_score ON users(highest_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_total_bricks ON users(total_bricks_destroyed DESC);
CREATE INDEX IF NOT EXISTS idx_users_bosses_defeated ON users(bosses_defeated DESC);
CREATE INDEX IF NOT EXISTS idx_users_max_streak ON users(max_streak DESC);
CREATE INDEX IF NOT EXISTS idx_users_player_level ON users(player_level DESC);

-- Function to get global leaderboard (top 50 by highest score)
CREATE OR REPLACE FUNCTION get_global_leaderboard()
RETURNS TABLE (
    wallet_address TEXT,
    display_name TEXT,
    profile_image TEXT,
    highest_score INTEGER,
    total_bricks_destroyed INTEGER,
    bosses_defeated INTEGER,
    max_streak INTEGER,
    achievements_unlocked INTEGER,
    player_level INTEGER,
    total_xp INTEGER,
    total_wins INTEGER,
    games_played INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.wallet_address,
        u.display_name,
        u.profile_image,
        COALESCE(u.highest_score, 0) as highest_score,
        COALESCE(u.total_bricks_destroyed, 0) as total_bricks_destroyed,
        COALESCE(u.bosses_defeated, 0) as bosses_defeated,
        COALESCE(u.max_streak, 0) as max_streak,
        COALESCE(u.achievements_unlocked, 0) as achievements_unlocked,
        COALESCE(u.player_level, 1) as player_level,
        COALESCE(u.total_xp, 0) as total_xp,
        COALESCE(u.total_wins, 0) as total_wins,
        COALESCE(u.games_played, 0) as games_played,
        u.created_at,
        u.updated_at
    FROM users u
    WHERE u.highest_score > 0
    ORDER BY u.highest_score DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql; 