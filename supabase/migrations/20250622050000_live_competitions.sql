-- Live Competitions System Migration

-- Add XP and level columns to existing users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS player_level INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_wins INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0;

-- Live Competitions Table
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

-- Competition Scores Table
CREATE TABLE competition_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    competition_id UUID REFERENCES live_competitions(id) ON DELETE CASCADE,
    player_wallet TEXT NOT NULL,
    player_name TEXT NOT NULL,
    current_score INTEGER DEFAULT 0,
    is_ready BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    bricks_broken INTEGER DEFAULT 0,
    level_reached INTEGER DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(competition_id, player_wallet)
);

-- Indexes for better performance
CREATE INDEX idx_live_competitions_channel ON live_competitions(channel_name);
CREATE INDEX idx_live_competitions_status ON live_competitions(game_status);
CREATE INDEX idx_competition_scores_competition ON competition_scores(competition_id);
CREATE INDEX idx_competition_scores_wallet ON competition_scores(player_wallet);
CREATE INDEX idx_competition_scores_score ON competition_scores(competition_id, current_score DESC);

-- Enable Row Level Security
ALTER TABLE live_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_scores ENABLE ROW LEVEL SECURITY;

-- Policies for live_competitions
CREATE POLICY "Allow public read access to live competitions" ON live_competitions
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to create competitions" ON live_competitions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update competitions" ON live_competitions
    FOR UPDATE USING (true);

-- Policies for competition_scores
CREATE POLICY "Allow public read access to competition scores" ON competition_scores
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to join competitions" ON competition_scores
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow players to update their own scores" ON competition_scores
    FOR UPDATE USING (true);

-- Function to calculate level from XP
CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Level progression: 1=0, 2=100, 3=250, 4=500, 5=1000, 6=2000, 7=3500, 8=5500, 9=8000, 10=12000+
    IF xp >= 12000 THEN RETURN 10;
    ELSIF xp >= 8000 THEN RETURN 9;
    ELSIF xp >= 5500 THEN RETURN 8;
    ELSIF xp >= 3500 THEN RETURN 7;
    ELSIF xp >= 2000 THEN RETURN 6;
    ELSIF xp >= 1000 THEN RETURN 5;
    ELSIF xp >= 500 THEN RETURN 4;
    ELSIF xp >= 250 THEN RETURN 3;
    ELSIF xp >= 100 THEN RETURN 2;
    ELSE RETURN 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on competition_scores
CREATE TRIGGER update_competition_scores_updated_at
    BEFORE UPDATE ON competition_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 