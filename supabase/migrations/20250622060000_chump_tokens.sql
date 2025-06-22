-- Chump Tokens System Migration

-- Add token balance and last token claim to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS chump_tokens INTEGER DEFAULT 1000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_token_claim TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Token Transactions Table to track all token movements
CREATE TABLE token_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('hourly_bonus', 'game_entry', 'game_payout', 'admin_adjustment')),
    amount INTEGER NOT NULL, -- positive for gains, negative for costs
    balance_after INTEGER NOT NULL,
    competition_id UUID REFERENCES live_competitions(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add game entry cost and pot to live competitions
ALTER TABLE live_competitions ADD COLUMN IF NOT EXISTS entry_cost INTEGER DEFAULT 20000;
ALTER TABLE live_competitions ADD COLUMN IF NOT EXISTS total_pot INTEGER DEFAULT 0;
ALTER TABLE live_competitions ADD COLUMN IF NOT EXISTS pot_distributed BOOLEAN DEFAULT false;

-- Indexes for performance
CREATE INDEX idx_token_transactions_wallet ON token_transactions(wallet_address);
CREATE INDEX idx_token_transactions_type ON token_transactions(transaction_type);
CREATE INDEX idx_token_transactions_competition ON token_transactions(competition_id);
CREATE INDEX idx_users_last_token_claim ON users(last_token_claim);

-- Enable Row Level Security
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for token_transactions
CREATE POLICY "Users can view their own token transactions" ON token_transactions
    FOR SELECT USING (wallet_address = current_setting('request.jwt.claims')::json->>'wallet_address');

CREATE POLICY "Allow system to insert token transactions" ON token_transactions
    FOR INSERT WITH CHECK (true);

-- Function to claim hourly tokens (1000 tokens every hour)
CREATE OR REPLACE FUNCTION claim_hourly_tokens(user_wallet TEXT)
RETURNS JSONB AS $$
DECLARE
    user_record RECORD;
    hours_since_last_claim INTEGER;
    tokens_to_add INTEGER;
    new_balance INTEGER;
BEGIN
    -- Get user current state
    SELECT chump_tokens, last_token_claim INTO user_record
    FROM users WHERE wallet_address = user_wallet;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
    
    -- Calculate hours since last claim
    hours_since_last_claim := EXTRACT(EPOCH FROM (NOW() - user_record.last_token_claim)) / 3600;
    
    IF hours_since_last_claim < 1 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Must wait 1 hour between token claims',
            'minutes_remaining', CEIL((3600 - EXTRACT(EPOCH FROM (NOW() - user_record.last_token_claim))) / 60)
        );
    END IF;
    
    -- Cap at 24 hours worth of tokens (24000 max)
    tokens_to_add := LEAST(FLOOR(hours_since_last_claim) * 1000, 24000);
    new_balance := user_record.chump_tokens + tokens_to_add;
    
    -- Update user balance and claim time
    UPDATE users 
    SET chump_tokens = new_balance, 
        last_token_claim = NOW()
    WHERE wallet_address = user_wallet;
    
    -- Record transaction
    INSERT INTO token_transactions (wallet_address, transaction_type, amount, balance_after, description)
    VALUES (user_wallet, 'hourly_bonus', tokens_to_add, new_balance, 
            FORMAT('Claimed %s hours worth of tokens', FLOOR(hours_since_last_claim)));
    
    RETURN jsonb_build_object(
        'success', true, 
        'tokens_claimed', tokens_to_add,
        'new_balance', new_balance,
        'hours_claimed', FLOOR(hours_since_last_claim)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to charge game entry fee
CREATE OR REPLACE FUNCTION charge_game_entry(user_wallet TEXT, competition_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    user_balance INTEGER;
    entry_cost INTEGER := 20000;
    new_balance INTEGER;
BEGIN
    -- Get user current balance
    SELECT chump_tokens INTO user_balance
    FROM users WHERE wallet_address = user_wallet;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
    
    IF user_balance < entry_cost THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Insufficient tokens',
            'required', entry_cost,
            'current_balance', user_balance
        );
    END IF;
    
    new_balance := user_balance - entry_cost;
    
    -- Deduct tokens from user
    UPDATE users 
    SET chump_tokens = new_balance
    WHERE wallet_address = user_wallet;
    
    -- Add to competition pot
    UPDATE live_competitions 
    SET total_pot = total_pot + entry_cost
    WHERE id = competition_uuid;
    
    -- Record transaction
    INSERT INTO token_transactions (wallet_address, transaction_type, amount, balance_after, competition_id, description)
    VALUES (user_wallet, 'game_entry', -entry_cost, new_balance, competition_uuid, 'Game entry fee');
    
    RETURN jsonb_build_object(
        'success', true,
        'charged', entry_cost,
        'new_balance', new_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to distribute winnings to game winner
CREATE OR REPLACE FUNCTION distribute_winnings(competition_uuid UUID, winner_wallet TEXT)
RETURNS JSONB AS $$
DECLARE
    competition_pot INTEGER;
    winner_balance INTEGER;
    new_balance INTEGER;
    already_distributed BOOLEAN;
BEGIN
    -- Check if already distributed
    SELECT total_pot, pot_distributed INTO competition_pot, already_distributed
    FROM live_competitions WHERE id = competition_uuid;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Competition not found');
    END IF;
    
    IF already_distributed THEN
        RETURN jsonb_build_object('success', false, 'error', 'Winnings already distributed');
    END IF;
    
    IF competition_pot <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No pot to distribute');
    END IF;
    
    -- Get winner's current balance
    SELECT chump_tokens INTO winner_balance
    FROM users WHERE wallet_address = winner_wallet;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Winner not found');
    END IF;
    
    new_balance := winner_balance + competition_pot;
    
    -- Give winnings to winner
    UPDATE users 
    SET chump_tokens = new_balance
    WHERE wallet_address = winner_wallet;
    
    -- Mark pot as distributed
    UPDATE live_competitions 
    SET pot_distributed = true
    WHERE id = competition_uuid;
    
    -- Record transaction
    INSERT INTO token_transactions (wallet_address, transaction_type, amount, balance_after, competition_id, description)
    VALUES (winner_wallet, 'game_payout', competition_pot, new_balance, competition_uuid, 
            FORMAT('Game winnings from competition pot'));
    
    RETURN jsonb_build_object(
        'success', true,
        'winnings', competition_pot,
        'new_balance', new_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user token info
CREATE OR REPLACE FUNCTION get_user_token_info(user_wallet TEXT)
RETURNS JSONB AS $$
DECLARE
    user_record RECORD;
    hours_until_next_claim NUMERIC;
    minutes_until_next_claim INTEGER;
BEGIN
    SELECT chump_tokens, last_token_claim INTO user_record
    FROM users WHERE wallet_address = user_wallet;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
    
    hours_until_next_claim := 1 - (EXTRACT(EPOCH FROM (NOW() - user_record.last_token_claim)) / 3600);
    minutes_until_next_claim := GREATEST(0, CEIL(hours_until_next_claim * 60));
    
    RETURN jsonb_build_object(
        'success', true,
        'balance', user_record.chump_tokens,
        'can_claim', hours_until_next_claim <= 0,
        'minutes_until_claim', minutes_until_next_claim,
        'last_claim', user_record.last_token_claim
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 