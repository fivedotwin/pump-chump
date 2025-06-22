import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Your Supabase config
const supabaseUrl = 'https://pandgckozhfpfwpvtcet.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbmRnY2tvemhmcGZ3cHZ0Y2V0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUzNTU0NSwiZXhwIjoyMDY2MTExNTQ1fQ.2GiGHcI2XykHWrVORIWkXy2e9Bf8bQWbrrHIJ9BggGo';

// Create Supabase client with service key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runTokenMigration() {
  console.log('🪙 Starting Chump Token system migration...');

  try {
    // Check if users table exists
    console.log('📋 Checking existing tables...');
    const { data: existingUsers } = await supabase
      .from('users')
      .select('wallet_address')
      .limit(1);

    if (!existingUsers) {
      console.log('⚠️  Users table not found. Creating basic users table...');
      // Create users table if it doesn't exist
      await supabase.rpc('exec', {
        sql: `CREATE TABLE IF NOT EXISTS users (
          wallet_address TEXT PRIMARY KEY,
          display_name TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );`
      });
    }

    // Add token columns to users table
    console.log('💰 Adding token columns to users table...');
    
    // Check if chump_tokens column exists
    const { data: tokenCheck } = await supabase
      .from('users')
      .select('wallet_address, chump_tokens')
      .limit(1);

    if (!tokenCheck || (tokenCheck.length > 0 && tokenCheck[0].chump_tokens === undefined)) {
      console.log('Adding chump_tokens column...');
      await supabase.rpc('exec', {
        sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS chump_tokens INTEGER DEFAULT 1000;`
      });
    }

    // Check if last_token_claim column exists
    const { data: claimCheck } = await supabase
      .from('users')
      .select('wallet_address, last_token_claim')
      .limit(1);

    if (!claimCheck || (claimCheck.length > 0 && claimCheck[0].last_token_claim === undefined)) {
      console.log('Adding last_token_claim column...');
      await supabase.rpc('exec', {
        sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_token_claim TIMESTAMP WITH TIME ZONE DEFAULT NOW();`
      });
    }

    // Check if token_transactions table exists
    console.log('📊 Checking token_transactions table...');
    const { data: transactionCheck } = await supabase
      .from('token_transactions')
      .select('id')
      .limit(1);

    if (!transactionCheck) {
      console.log('Creating token_transactions table...');
      await supabase.rpc('exec', {
        sql: `CREATE TABLE token_transactions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          transaction_type TEXT NOT NULL CHECK (transaction_type IN ('hourly_bonus', 'game_entry', 'game_payout', 'admin_adjustment')),
          amount INTEGER NOT NULL,
          balance_after INTEGER NOT NULL,
          competition_id UUID,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );`
      });
    }

    // Check if live_competitions table has token columns
    console.log('🏆 Updating live_competitions table...');
    const { data: competitionCheck } = await supabase
      .from('live_competitions')
      .select('id, entry_cost, total_pot, pot_distributed')
      .limit(1);

    if (competitionCheck && competitionCheck.length > 0) {
      if (competitionCheck[0].entry_cost === undefined) {
        console.log('Adding entry_cost column...');
        await supabase.rpc('exec', {
          sql: `ALTER TABLE live_competitions ADD COLUMN IF NOT EXISTS entry_cost INTEGER DEFAULT 20000;`
        });
      }
      
      if (competitionCheck[0].total_pot === undefined) {
        console.log('Adding total_pot column...');
        await supabase.rpc('exec', {
          sql: `ALTER TABLE live_competitions ADD COLUMN IF NOT EXISTS total_pot INTEGER DEFAULT 0;`
        });
      }
      
      if (competitionCheck[0].pot_distributed === undefined) {
        console.log('Adding pot_distributed column...');
        await supabase.rpc('exec', {
          sql: `ALTER TABLE live_competitions ADD COLUMN IF NOT EXISTS pot_distributed BOOLEAN DEFAULT false;`
        });
      }
    }

    console.log('✅ Chump Token system migration completed successfully!');
    console.log('🎉 Users now have 1000 starting tokens and can earn more every hour!');

  } catch (error) {
    console.error('💥 Token migration failed:', error);
    
    // Try direct SQL approach
    console.log('🔄 Attempting direct SQL approach...');
    
    // Read and execute the migration file directly
    const sql = fs.readFileSync('supabase/migrations/20250622060000_chump_tokens.sql', 'utf8');
    
    // For now, let's just log what we would execute
    console.log('📝 Migration SQL ready to execute:');
    console.log(sql.substring(0, 500) + '...');
    
    console.log('⚠️  Please run this SQL directly in your Supabase SQL editor:');
    console.log('1. Go to https://supabase.com/dashboard/project/pandgckozhfpfwpvtcet/sql');
    console.log('2. Copy and paste the contents of supabase/migrations/20250622060000_chump_tokens.sql');
    console.log('3. Click "Run"');
  }
}

// Run the migration
runTokenMigration(); 