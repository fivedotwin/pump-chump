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

-- Enable Row Level Security
ALTER TABLE live_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_scores ENABLE ROW LEVEL SECURITY;

-- Policies for public access (demo purposes)
CREATE POLICY "Public access to competitions" ON live_competitions FOR ALL USING (true);
CREATE POLICY "Public access to scores" ON competition_scores FOR ALL USING (true);

-- XP Level calculation function
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

-- Auto-update trigger for timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_competition_scores_updated_at
    BEFORE UPDATE ON competition_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 