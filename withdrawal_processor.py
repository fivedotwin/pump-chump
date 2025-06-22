#!/usr/bin/env python3
"""
Pump Chump Token Withdrawal Processor
Listens to database for withdrawal requests and sends Solana tokens
"""

import os
import time
import json
import logging
from typing import Optional, Dict, Any
from decimal import Decimal

# Solana imports
from solana.rpc.api import Client
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import Transaction
from solders.system_program import transfer, TransferParams
from solders.commitment import Commitment

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

class SolanaWithdrawalProcessor:
    def __init__(self):
        """Initialize the withdrawal processor"""
        
        # Supabase configuration
        self.supabase_url = os.getenv('SUPABASE_URL', 'https://pandgckozhfpfwpvtcet.supabase.co')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbmRnY2tvemhmcGZ3cHZ0Y2V0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUzNTU0NSwiZXhwIjoyMDY2MTExNTQ1fQ.2GiGHcI2XykHWrVORIWkXy2e9Bf8bQWbrrHIJ9BggGo')
        
        # Solana configuration
        self.solana_rpc_url = os.getenv('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com')
        self.treasury_private_key = os.getenv('TREASURY_PRIVATE_KEY', '')  # SET THIS IN .env
        
        # Withdrawal settings
        self.token_to_sol_rate = float(os.getenv('TOKEN_TO_SOL_RATE', '0.000001'))  # 1 token = 0.000001 SOL
        self.min_withdrawal_sol = float(os.getenv('MIN_WITHDRAWAL_SOL', '0.01'))  # Minimum 0.01 SOL
        self.max_withdrawal_sol = float(os.getenv('MAX_WITHDRAWAL_SOL', '1.0'))   # Maximum 1 SOL
        
        # Initialize clients
        self.supabase: SupabaseClient = create_client(self.supabase_url, self.supabase_key)
        self.solana_client = Client(self.solana_rpc_url, commitment=Commitment("confirmed"))
        
        # Initialize treasury keypair
        if not self.treasury_private_key:
            logger.error("TREASURY_PRIVATE_KEY not set in environment variables!")
            raise ValueError("Treasury private key required")
            
        try:
            # Decode base58 private key
            import base58
            private_key_bytes = base58.b58decode(self.treasury_private_key)
            self.treasury_keypair = Keypair.from_bytes(private_key_bytes)
            logger.info(f"Treasury wallet loaded: {self.treasury_keypair.pubkey()}")
        except Exception as e:
            logger.error(f"Failed to load treasury keypair: {e}")
            raise
    
    def convert_tokens_to_sol(self, tokens: int) -> float:
        """Convert Chump tokens to SOL amount"""
        sol_amount = tokens * self.token_to_sol_rate
        return min(max(sol_amount, self.min_withdrawal_sol), self.max_withdrawal_sol)
    
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
    
    def send_sol_to_wallet(self, destination_wallet: str, sol_amount: float) -> Optional[str]:
        """Send SOL to destination wallet and return transaction hash"""
        try:
            # Validate destination wallet
            destination_pubkey = Pubkey.from_string(destination_wallet)
            
            # Convert SOL to lamports (1 SOL = 1,000,000,000 lamports)
            lamports = int(sol_amount * 1_000_000_000)
            
            # Check treasury balance
            treasury_balance = self.solana_client.get_balance(self.treasury_keypair.pubkey()).value
            if treasury_balance < lamports + 5000:  # Extra for transaction fees
                raise ValueError(f"Insufficient treasury balance. Need: {lamports + 5000}, Have: {treasury_balance}")
            
            # Create transfer instruction
            transfer_instruction = transfer(
                TransferParams(
                    from_pubkey=self.treasury_keypair.pubkey(),
                    to_pubkey=destination_pubkey,
                    lamports=lamports
                )
            )
            
            # Create and sign transaction
            transaction = Transaction.new_with_payer([transfer_instruction], self.treasury_keypair.pubkey())
            
            # Get recent blockhash
            recent_blockhash = self.solana_client.get_latest_blockhash().value.blockhash
            transaction.recent_blockhash = recent_blockhash
            
            # Sign transaction
            transaction.sign([self.treasury_keypair], recent_blockhash)
            
            # Send transaction
            response = self.solana_client.send_transaction(transaction)
            tx_hash = str(response.value)
            
            logger.info(f"SOL transfer successful: {sol_amount} SOL to {destination_wallet} | TX: {tx_hash}")
            return tx_hash
            
        except Exception as e:
            logger.error(f"Error sending SOL: {e}")
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
            
            # Convert tokens to SOL
            sol_amount = self.convert_tokens_to_sol(token_amount)
            
            # Validate minimum withdrawal
            if sol_amount < self.min_withdrawal_sol:
                error_msg = f"Amount too small: {sol_amount} SOL (min: {self.min_withdrawal_sol} SOL)"
                self.update_withdrawal_status(withdrawal_id, 'failed', error_msg=error_msg)
                return False
            
            logger.info(f"Converting {token_amount} tokens → {sol_amount} SOL")
            
            # Send SOL transaction
            tx_hash = self.send_sol_to_wallet(destination_wallet, sol_amount)
            
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
        logger.info(f"🚀 Starting Pump Chump Withdrawal Processor")
        logger.info(f"Treasury Wallet: {self.treasury_keypair.pubkey()}")
        logger.info(f"Token→SOL Rate: {self.token_to_sol_rate}")
        logger.info(f"Poll Interval: {poll_interval} seconds")
        logger.info(f"Min Withdrawal: {self.min_withdrawal_sol} SOL")
        logger.info(f"Max Withdrawal: {self.max_withdrawal_sol} SOL")
        
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
        processor = SolanaWithdrawalProcessor()
        processor.run_processor(poll_interval=30)  # Check every 30 seconds
    except Exception as e:
        logger.error(f"Failed to start withdrawal processor: {e}")

if __name__ == "__main__":
    main() 