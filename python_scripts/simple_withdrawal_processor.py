#!/usr/bin/env python3
"""
Simplified Pump Chump Token Withdrawal Processor
Listens to database for withdrawal requests and sends Solana tokens
"""

import os
import time
import logging
from typing import Optional, Dict, Any

# Supabase imports
from supabase import create_client, Client as SupabaseClient

# Environment imports
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('withdrawal_processor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SimpleWithdrawalProcessor:
    def __init__(self):
        """Initialize the withdrawal processor"""
        
        # Supabase configuration
        self.supabase_url = os.getenv('SUPABASE_URL', 'https://pandgckozhfpfwpvtcet.supabase.co')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbmRnY2tvemhmcGZ3cHZ0Y2V0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUzNTU0NSwiZXhwIjoyMDY2MTExNTQ1fQ.2GiGHcI2XykHWrVORIWkXy2e9Bf8bQWbrrHIJ9BggGo')
        
        # Treasury wallet info
        self.treasury_private_key = os.getenv('TREASURY_PRIVATE_KEY', '')
        
        # Withdrawal settings - Updated for CHUMP tokens
        self.token_to_chump_rate = float(os.getenv('INTERNAL_TO_CHUMP_RATE', '1.0'))  # 1:1 conversion
        self.min_withdrawal_tokens = int(os.getenv('MIN_WITHDRAWAL_CHUMP', '1000000'))  # 1M tokens minimum
        self.max_withdrawal_tokens = int(os.getenv('MAX_WITHDRAWAL_CHUMP', '10000000'))   # 10M tokens maximum
        
        # Initialize clients
        self.supabase: SupabaseClient = create_client(self.supabase_url, self.supabase_key)
        
        # Validate configuration
        if not self.treasury_private_key:
            logger.error("TREASURY_PRIVATE_KEY not set in environment variables!")
            raise ValueError("Treasury private key required")
        
        logger.info("✅ Simple withdrawal processor initialized")
        logger.info(f"💱 Token→CHUMP Rate: {self.token_to_chump_rate}")
        logger.info(f"💰 Min/Max Withdrawal: {self.min_withdrawal_tokens}-{self.max_withdrawal_tokens} tokens")
    
    def convert_tokens_to_chump(self, tokens: int) -> int:
        """Convert internal tokens to CHUMP tokens"""
        chump_amount = int(tokens * self.token_to_chump_rate)
        return min(max(chump_amount, self.min_withdrawal_tokens), self.max_withdrawal_tokens)
    
    def get_pending_withdrawals(self) -> list:
        """Get all pending withdrawal requests from database"""
        try:
            response = self.supabase.table('withdrawal_requests').select('*').eq('status', 'pending').execute()
            return response.data
        except Exception as e:
            logger.error(f"Error fetching pending withdrawals: {e}")
            return []
    
    def update_withdrawal_status(self, withdrawal_id: str, status: str, tx_hash: Optional[str] = None, error_msg: Optional[str] = None) -> bool:
        """Update withdrawal status in database"""
        try:
            # Call the database function
            response = self.supabase.rpc('update_withdrawal_status', {
                'withdrawal_id': withdrawal_id,
                'new_status': status,
                'tx_hash': tx_hash,
                'error_msg': error_msg
            }).execute()
            
            logger.info(f"Updated withdrawal {withdrawal_id} to status: {status}")
            return True
        except Exception as e:
            logger.error(f"Error updating withdrawal status: {e}")
            return False
    
    def simulate_sol_transfer(self, destination_wallet: str, sol_amount: float) -> Optional[str]:
        """Simulate SOL transfer (for testing without real transactions)"""
        try:
            # Validate destination wallet format (basic check)
            if len(destination_wallet) < 32 or len(destination_wallet) > 45:
                raise ValueError("Invalid Solana wallet address format")
            
            # Simulate transaction processing time
            import random
            time.sleep(random.uniform(1, 3))
            
            # Generate a fake transaction hash for testing
            import hashlib
            fake_tx_data = f"{destination_wallet}{sol_amount}{time.time()}"
            fake_tx_hash = hashlib.sha256(fake_tx_data.encode()).hexdigest()[:64]
            
            logger.info(f"🔄 SIMULATED SOL transfer: {sol_amount} SOL to {destination_wallet}")
            logger.info(f"🔄 SIMULATED TX Hash: {fake_tx_hash}")
            
            return fake_tx_hash
            
        except Exception as e:
            logger.error(f"Error in simulated SOL transfer: {e}")
            return None
    
    def process_withdrawal(self, withdrawal: Dict[str, Any]) -> bool:
        """Process a single withdrawal request"""
        withdrawal_id = withdrawal['id']
        wallet_address = withdrawal['wallet_address']
        token_amount = withdrawal['amount']
        destination_wallet = withdrawal['solana_destination']
        
        logger.info(f"Processing withdrawal {withdrawal_id}: {token_amount} tokens → {destination_wallet}")
        
        try:
            # Update status to processing
            if not self.update_withdrawal_status(withdrawal_id, 'processing'):
                return False
            
            # Convert tokens to CHUMP
            chump_amount = self.convert_tokens_to_chump(token_amount)
            
            # Validate minimum withdrawal
            if token_amount < self.min_withdrawal_tokens:
                error_msg = f"Amount too small: {token_amount} tokens (min: {self.min_withdrawal_tokens:,} tokens)"
                self.update_withdrawal_status(withdrawal_id, 'failed', error_msg=error_msg)
                return False
            
            logger.info(f"Converting {token_amount} internal tokens → {chump_amount} CHUMP tokens")
            
            # Send CHUMP tokens (simulated for now)
            tx_hash = self.simulate_chump_transfer(wallet_address, chump_amount)
            
            if tx_hash:
                # Success - update to completed
                self.update_withdrawal_status(withdrawal_id, 'completed', tx_hash=tx_hash)
                logger.info(f"✅ Withdrawal {withdrawal_id} completed successfully")
                return True
            else:
                # Failed - update status
                error_msg = "Failed to send SOL transaction"
                self.update_withdrawal_status(withdrawal_id, 'failed', error_msg=error_msg)
                logger.error(f"❌ Withdrawal {withdrawal_id} failed")
                return False
                
        except Exception as e:
            error_msg = f"Processing error: {str(e)}"
            logger.error(f"Error processing withdrawal {withdrawal_id}: {e}")
            self.update_withdrawal_status(withdrawal_id, 'failed', error_msg=error_msg)
            return False
    
    def run_processor(self, poll_interval: int = 30):
        """Main processing loop - checks for withdrawals every poll_interval seconds"""
        logger.info(f"🚀 Starting Simple Withdrawal Processor")
        logger.info(f"💱 Token→SOL Rate: {self.token_to_sol_rate}")
        logger.info(f"⏱️ Poll Interval: {poll_interval} seconds")
        logger.info(f"💰 Min Withdrawal: {self.min_withdrawal_sol} SOL")
        logger.info(f"💰 Max Withdrawal: {self.max_withdrawal_sol} SOL")
        logger.info(f"🔄 SIMULATION MODE: No real SOL transfers")
        
        while True:
            try:
                # Get pending withdrawals
                pending_withdrawals = self.get_pending_withdrawals()
                
                if pending_withdrawals:
                    logger.info(f"Found {len(pending_withdrawals)} pending withdrawals")
                    
                    for withdrawal in pending_withdrawals:
                        try:
                            self.process_withdrawal(withdrawal)
                            time.sleep(2)  # Small delay between withdrawals
                        except Exception as e:
                            logger.error(f"Error processing individual withdrawal: {e}")
                            continue
                else:
                    logger.debug("No pending withdrawals")
                
                # Wait before next check
                time.sleep(poll_interval)
                
            except KeyboardInterrupt:
                logger.info("🛑 Withdrawal processor stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                time.sleep(poll_interval)  # Continue running even on errors

def main():
    """Main entry point"""
    try:
        processor = SimpleWithdrawalProcessor()
        processor.run_processor(poll_interval=30)  # Check every 30 seconds
    except Exception as e:
        logger.error(f"Failed to start withdrawal processor: {e}")

if __name__ == "__main__":
    main() 