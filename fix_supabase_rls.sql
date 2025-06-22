-- Fix RLS policies for anonymous access in development
-- Run this in your Supabase SQL Editor

-- Update token_transactions policies to allow anonymous access
DROP POLICY IF EXISTS "Users can view their own token transactions" ON token_transactions;

CREATE POLICY "Allow anonymous read access to token_transactions" ON token_transactions
    FOR SELECT TO anon, authenticated USING (true);

-- Ensure users table allows anonymous access to chump_tokens column
-- (Should already be allowed by existing policies, but let's be explicit)

-- Grant usage on functions to anonymous users
GRANT EXECUTE ON FUNCTION claim_hourly_tokens(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION charge_game_entry(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION distribute_winnings(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_token_info(TEXT) TO anon;

-- Ensure the users table has the required columns (should already exist)
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS chump_tokens INTEGER DEFAULT 500000;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS last_token_claim TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- For testing: Temporarily allow all anonymous access to users table
DROP POLICY IF EXISTS "Temporary anonymous full access to users" ON users;
CREATE POLICY "Temporary anonymous full access to users" ON users
    FOR ALL TO anon USING (true) WITH CHECK (true); 