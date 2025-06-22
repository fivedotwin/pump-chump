-- Update Token Values Migration
-- Change entry cost from 200 to 20,000 tokens
-- Change hourly bonus from 1,000 to 100,000 tokens

-- Update default entry cost for future competitions
ALTER TABLE live_competitions ALTER COLUMN entry_cost SET DEFAULT 20000;

-- Update existing competitions entry cost
UPDATE live_competitions SET entry_cost = 20000 WHERE entry_cost = 200;

-- Update the claim hourly tokens function to give 100,000 tokens per hour
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
    
    -- NEW: 100,000 tokens per hour, cap at 24 hours worth (2.4M max)
    tokens_to_add := LEAST(FLOOR(hours_since_last_claim) * 100000, 2400000);
    new_balance := user_record.chump_tokens + tokens_to_add;
    
    -- Update user balance and claim time
    UPDATE users 
    SET chump_tokens = new_balance, 
        last_token_claim = NOW()
    WHERE wallet_address = user_wallet;
    
    -- Record transaction
    INSERT INTO token_transactions (wallet_address, transaction_type, amount, balance_after, description)
    VALUES (user_wallet, 'hourly_bonus', tokens_to_add, new_balance, 
            FORMAT('Claimed %s hours worth of tokens (100K per hour)', FLOOR(hours_since_last_claim)));
    
    RETURN jsonb_build_object(
        'success', true, 
        'tokens_claimed', tokens_to_add,
        'new_balance', new_balance,
        'hours_claimed', FLOOR(hours_since_last_claim)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the game entry charge function to use 20,000 tokens
CREATE OR REPLACE FUNCTION charge_game_entry(user_wallet TEXT, competition_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    user_balance INTEGER;
    entry_cost INTEGER := 20000; -- NEW: 20,000 tokens entry cost
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
    VALUES (user_wallet, 'game_entry', -entry_cost, new_balance, competition_uuid, 'Game entry fee (20K tokens)');
    
    RETURN jsonb_build_object(
        'success', true,
        'charged', entry_cost,
        'new_balance', new_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Give existing users a bonus to play with the new economy
-- Everyone gets 500,000 tokens to start with the new high-value economy
UPDATE users SET chump_tokens = GREATEST(chump_tokens, 500000) WHERE chump_tokens < 500000; 