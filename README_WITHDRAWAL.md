# 💸 Solana Token Withdrawal System

A complete system that allows users to withdraw Chump Tokens as SOL to their Solana wallets.

## 🚀 Quick Start

### 1. Setup Database
Run this SQL in Supabase dashboard:
```sql
-- Copy contents of withdrawal-system.sql and run in Supabase SQL Editor
```

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment
Copy `withdrawal_config.env` to `.env` and add your treasury private key:
```bash
TREASURY_PRIVATE_KEY=your_base58_private_key_here
```

### 4. Run Withdrawal Processor
```bash
python withdrawal_processor.py
```

## 🎯 Features

- ✅ **Automatic Processing** - Withdrawals processed every 30 seconds
- ✅ **Level Requirement** - Users must reach Level 1 to withdraw  
- ✅ **Minimum Amount** - 50,000 tokens minimum withdrawal
- ✅ **Rate Conversion** - 1,000,000 tokens = 1 SOL
- ✅ **Error Handling** - Failed withdrawals automatically refunded
- ✅ **Transaction History** - Complete audit trail
- ✅ **Security** - One pending withdrawal per user

## 💰 Token Economics

| Tokens | SOL | USD Estimate |
|--------|-----|--------------|
| 50,000 | 0.05 | ~$10 |
| 100,000 | 0.1 | ~$20 |
| 500,000 | 0.5 | ~$100 |
| 1,000,000 | 1.0 | ~$200 |

## 🔧 Technical Flow

1. **User Request** → Frontend submits withdrawal
2. **Database** → Request stored with "pending" status  
3. **Python Processor** → Detects and processes request
4. **Solana Transaction** → SOL sent to user's wallet
5. **Status Update** → Marked "completed" with tx hash

## 📋 Requirements

- **Python 3.8+**
- **Solana wallet** with SOL for treasury
- **Supabase database** access
- **Level 1** game progression for users

Your withdrawal system is ready! 🎉 