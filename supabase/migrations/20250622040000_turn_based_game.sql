-- Turn-Based Collaborative Game System Migration

-- Game Sessions Table
CREATE TABLE game_sessions (
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
CREATE TABLE game_players (
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
CREATE TABLE game_turns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id UUID REFERENCES game_players(id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL,
    level_reached INTEGER DEFAULT 0,
    bricks_broken INTEGER DEFAULT 0,
    time_taken REAL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_game_sessions_channel ON game_sessions(channel_name);
CREATE INDEX idx_game_sessions_status ON game_sessions(session_status);
CREATE INDEX idx_game_players_session ON game_players(session_id);
CREATE INDEX idx_game_players_wallet ON game_players(wallet_address);
CREATE INDEX idx_game_players_turn_order ON game_players(session_id, turn_order);
CREATE INDEX idx_game_turns_session ON game_turns(session_id);
CREATE INDEX idx_game_turns_player ON game_turns(player_id);

-- Enable Row Level Security
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_turns ENABLE ROW LEVEL SECURITY;

-- Policies for game_sessions
CREATE POLICY "Allow public read access to game sessions" ON game_sessions
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to create game sessions" ON game_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update game sessions" ON game_sessions
    FOR UPDATE USING (true);

-- Policies for game_players
CREATE POLICY "Allow public read access to game players" ON game_players
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to join games" ON game_players
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow players to update their own data" ON game_players
    FOR UPDATE USING (true);

-- Policies for game_turns
CREATE POLICY "Allow public read access to game turns" ON game_turns
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to save turns" ON game_turns
    FOR INSERT WITH CHECK (true);

-- Function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on game_sessions
CREATE TRIGGER update_game_sessions_updated_at
    BEFORE UPDATE ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get next player in turn rotation
CREATE OR REPLACE FUNCTION get_next_player(session_uuid UUID, current_player_uuid UUID)
RETURNS UUID AS $$
DECLARE
    next_player_id UUID;
    current_turn_order INTEGER;
    max_turn_order INTEGER;
BEGIN
    -- Get current player's turn order
    SELECT turn_order INTO current_turn_order
    FROM game_players
    WHERE id = current_player_uuid AND session_id = session_uuid AND is_active = true;
    
    -- Get max turn order for this session
    SELECT MAX(turn_order) INTO max_turn_order
    FROM game_players
    WHERE session_id = session_uuid AND is_active = true;
    
    -- Get next player (wrap around to 1 if current is max)
    IF current_turn_order >= max_turn_order THEN
        SELECT id INTO next_player_id
        FROM game_players
        WHERE session_id = session_uuid AND turn_order = 1 AND is_active = true;
    ELSE
        SELECT id INTO next_player_id
        FROM game_players
        WHERE session_id = session_uuid AND turn_order = current_turn_order + 1 AND is_active = true;
    END IF;
    
    RETURN next_player_id;
END;
$$ LANGUAGE plpgsql; 