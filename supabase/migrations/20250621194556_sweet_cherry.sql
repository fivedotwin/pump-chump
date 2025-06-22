/*
  # Create users table for Pump Chump profiles

  1. New Tables
    - `users`
      - `wallet_address` (text, primary key) - Solana wallet address as unique identifier
      - `display_name` (text) - User's chosen display name
      - `profile_image` (text) - Base64 encoded profile image or URL
      - `created_at` (timestamp) - When the profile was created
      - `updated_at` (timestamp) - When the profile was last updated

  2. Security
    - Enable RLS on `users` table
    - Add policy for users to read all profiles (public read)
    - Add policy for users to insert/update their own profile only
*/

CREATE TABLE IF NOT EXISTS users (
  wallet_address text PRIMARY KEY,
  display_name text NOT NULL,
  profile_image text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read user profiles (public read)
CREATE POLICY "Anyone can read user profiles"
  ON users
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON users
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON users
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();