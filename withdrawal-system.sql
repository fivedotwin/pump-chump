-- WITHDRAWAL SYSTEM SETUP
-- Add withdrawal functionality to the token system

-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    amount INTEGER NOT NULL,
    solana_destination TEXT NOT NULL, -- User's Solana wallet to receive tokens
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    transaction_hash TEXT, -- Solana transaction hash when completed
    error_message TEXT,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_withdrawal_wallet FOREIGN KEY (wallet_address) REFERENCES users(wallet_address)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_wallet ON withdrawal_requests(wallet_address);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_requested_at ON withdrawal_requests(requested_at);

-- Enable Row Level Security
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own withdrawal requests" ON withdrawal_requests
    FOR SELECT USING (wallet_address = current_setting('request.jwt.claims')::json->>'wallet_address');

CREATE POLICY "Users can create withdrawal requests" ON withdrawal_requests
    FOR INSERT WITH CHECK (wallet_address = current_setting('request.jwt.claims')::json->>'wallet_address');

CREATE POLICY "System can update withdrawal requests" ON withdrawal_requests
    FOR UPDATE USING (true);

-- Function to request withdrawal
CREATE OR REPLACE FUNCTION request_withdrawal(user_wallet TEXT, withdrawal_amount INTEGER, destination_wallet TEXT)
RETURNS JSONB AS $$
DECLARE
    user_balance INTEGER;
    min_withdrawal INTEGER := 50000; -- Minimum 50K tokens to withdraw
    user_level INTEGER;
    new_balance INTEGER;
BEGIN
    -- Get user current state
    SELECT chump_tokens, player_level INTO user_balance, user_level
    FROM users WHERE wallet_address = user_wallet;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
    
    -- Check minimum level requirement (Level 1)
    IF user_level < 1 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Must reach Level 1 to withdraw tokens',
            'current_level', user_level,
            'required_level', 1
        );
    END IF;
    
    -- Check minimum withdrawal amount
    IF withdrawal_amount < min_withdrawal THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Minimum withdrawal is 50,000 tokens',
            'minimum', min_withdrawal,
            'requested', withdrawal_amount
        );
    END IF;
    
    -- Check sufficient balance
    IF user_balance < withdrawal_amount THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Insufficient token balance',
            'balance', user_balance,
            'requested', withdrawal_amount
        );
    END IF;
    
    -- Check for pending withdrawals
    IF EXISTS(SELECT 1 FROM withdrawal_requests WHERE wallet_address = user_wallet AND status = 'pending') THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'You already have a pending withdrawal request'
        );
    END IF;
    
    -- Deduct tokens from user balance immediately
    new_balance := user_balance - withdrawal_amount;
    UPDATE users SET chump_tokens = new_balance WHERE wallet_address = user_wallet;
    
    -- Create withdrawal request
    INSERT INTO withdrawal_requests (wallet_address, amount, solana_destination)
    VALUES (user_wallet, withdrawal_amount, destination_wallet);
    
    -- Record transaction
    INSERT INTO token_transactions (wallet_address, transaction_type, amount, balance_after, description)
    VALUES (user_wallet, 'admin_adjustment', -withdrawal_amount, new_balance, 
            FORMAT('Withdrawal request: %s tokens to %s', withdrawal_amount, destination_wallet));
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Withdrawal request submitted successfully',
        'amount', withdrawal_amount,
        'new_balance', new_balance,
        'status', 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update withdrawal status (called by Python script)
CREATE OR REPLACE FUNCTION update_withdrawal_status(
    withdrawal_id UUID, 
    new_status TEXT, 
    tx_hash TEXT DEFAULT NULL,
    error_msg TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE withdrawal_requests 
    SET 
        status = new_status,
        transaction_hash = COALESCE(tx_hash, transaction_hash),
        error_message = COALESCE(error_msg, error_message),
        processed_at = CASE WHEN new_status IN ('completed', 'failed') THEN NOW() ELSE processed_at END
    WHERE id = withdrawal_id;
    
    -- If withdrawal failed, refund the tokens
    IF new_status = 'failed' THEN
        UPDATE users 
        SET chump_tokens = chump_tokens + (
            SELECT amount FROM withdrawal_requests WHERE id = withdrawal_id
        )
        WHERE wallet_address = (
            SELECT wallet_address FROM withdrawal_requests WHERE id = withdrawal_id
        );
        
        -- Record refund transaction
        INSERT INTO token_transactions (
            wallet_address, 
            transaction_type, 
            amount, 
            balance_after, 
            description
        )
        SELECT 
            wr.wallet_address,
            'admin_adjustment',
            wr.amount,
            u.chump_tokens,
            FORMAT('Withdrawal failed - tokens refunded: %s', COALESCE(error_msg, 'Unknown error'))
        FROM withdrawal_requests wr
        JOIN users u ON u.wallet_address = wr.wallet_address
        WHERE wr.id = withdrawal_id;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 