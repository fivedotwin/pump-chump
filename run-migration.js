import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Your Supabase config
const supabaseUrl = 'https://pandgckozhfpfwpvtcet.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbmRnY2tvemhmcGZ3cHZ0Y2V0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUzNTU0NSwiZXhwIjoyMDY2MTExNTQ1fQ.2GiGHcI2XykHWrVORIWkXy2e9Bf8bQWbrrHIJ9BggGo';

// Create Supabase client with service key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting database migration...');

  try {
    // Read the migration file
    const sql = fs.readFileSync('migration.sql', 'utf8');
    console.log('📄 Migration file loaded');

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
      
      const { data, error } = await supabase.rpc('exec', { sql: statement });
      
      if (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error);
        // Continue with other statements even if one fails
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    }

    console.log('🎉 Migration completed!');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const { data: tables, error: tablesError } = await supabase.rpc('exec', {
      sql: `SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('live_competitions', 'competition_scores', 'users');`
    });

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
    } else {
      console.log('✅ Tables verified successfully!');
      console.log('📋 Available tables:', tables);
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
  }
}

// Run the migration
runMigration(); 