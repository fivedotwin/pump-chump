import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Your Supabase config
const supabaseUrl = 'https://pandgckozhfpfwpvtcet.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbmRnY2tvemhmcGZ3cHZ0Y2V0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUzNTU0NSwiZXhwIjoyMDY2MTExNTQ1fQ.2GiGHcI2XykHWrVORIWkXy2e9Bf8bQWbrrHIJ9BggGo';

// Create Supabase client with service key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateTokenValues() {
  console.log('💰 Updating token values to new amounts...');
  console.log('🔄 Entry Cost: 200 → 20,000 tokens');
  console.log('🔄 Hourly Bonus: 1,000 → 100,000 tokens');

  try {
    // Read the update SQL file
    const sql = fs.readFileSync('token-value-update.sql', 'utf8');
    console.log('📄 Token update SQL loaded');

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec', { sql });
    
    if (error) {
      console.error('❌ Error updating token values:', error);
      throw error;
    }

    console.log('✅ Token values updated successfully!');
    console.log('');
    console.log('🎉 NEW TOKEN ECONOMY:');
    console.log('   💎 Hourly Bonus: 100,000 tokens per hour');
    console.log('   🎮 Game Entry Cost: 20,000 tokens');
    console.log('   💰 Starting Bonus: 500,000 tokens for all users');
    console.log('   🏆 Max Daily Claim: 2,400,000 tokens (24 hours)');
    console.log('');
    console.log('🚀 Players can now enjoy the high-stakes economy!');

  } catch (error) {
    console.error('💥 Token value update failed:', error);
  }
}

// Run the update
updateTokenValues(); 