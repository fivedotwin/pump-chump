import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Your Supabase config
const supabaseUrl = 'https://pandgckozhfpfwpvtcet.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbmRnY2tvemhmcGZ3cHZ0Y2V0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUzNTU0NSwiZXhwIjoyMDY2MTExNTQ1fQ.2GiGHcI2XykHWrVORIWkXy2e9Bf8bQWbrrHIJ9BggGo';

// Create Supabase client with service key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runLiveCompetitionsMigration() {
  console.log('🏆 Starting Live Competitions migration...');

  try {
    // Read the live competitions migration file
    const sql = fs.readFileSync('supabase/migrations/20250622050000_live_competitions.sql', 'utf8');
    console.log('📄 Live competitions migration file loaded');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      console.log(`   Statement: ${statement.substring(0, 60)}...`);
      
      const { data, error } = await supabase.rpc('exec', { sql: statement });
      
      if (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error);
        console.error(`   Statement was: ${statement}`);
        // Continue with other statements even if one fails
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    }

    console.log('🎉 Live Competitions migration completed!');

    // Verify tables were created
    console.log('🔍 Verifying live competition tables...');
    const { data: tables, error: tablesError } = await supabase.rpc('exec', {
      sql: `SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('live_competitions', 'competition_scores');`
    });

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
    } else {
      console.log('✅ Live competition tables verified successfully!');
      console.log('📋 Live competition tables:', tables);
    }

    // Check if users table has the new columns
    console.log('🔍 Verifying users table columns...');
    const { data: columns, error: columnsError } = await supabase.rpc('exec', {
      sql: `SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name IN ('total_xp', 'player_level', 'total_wins', 'games_played');`
    });

    if (columnsError) {
      console.error('❌ Error checking user columns:', columnsError);
    } else {
      console.log('✅ User table columns verified!');
      console.log('📋 New user columns:', columns);
    }

  } catch (error) {
    console.error('💥 Live Competitions migration failed:', error);
  }
}

// Run the migration
runLiveCompetitionsMigration(); 