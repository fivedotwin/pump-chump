import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  getUserTokenInfo, 
  claimHourlyTokens, 
  getUserTokenTransactions,
  requestWithdrawal,
  getUserWithdrawals,
  type TokenInfo, 
  type TokenTransaction,
  type WithdrawalRequest
} from '../lib/supabase';

interface ChumpTokensProps {
  compact?: boolean;
}

export function ChumpTokens({ compact = false }: ChumpTokensProps) {
  const { publicKey } = useWallet();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
  const [destinationWallet, setDestinationWallet] = useState<string>('');

  const walletAddress = publicKey?.toString();

  // Load token info
  const loadTokenInfo = async () => {
    if (!walletAddress) return;
    setLoading(true);
    
    try {
      const info = await getUserTokenInfo(walletAddress);
      setTokenInfo(info);
      
      if (!compact) {
        const txns = await getUserTokenTransactions(walletAddress, 10);
        setTransactions(txns);
        
        const withdrawalHistory = await getUserWithdrawals(walletAddress);
        setWithdrawals(withdrawalHistory);
      }
    } catch (error) {
      console.error('Error loading token info:', error);
    } finally {
      setLoading(false);
    }
  };

  // Claim tokens
  const handleClaim = async () => {
    if (!walletAddress || !tokenInfo?.canClaim) return;
    setClaiming(true);
    setMessage('');

    try {
      const result = await claimHourlyTokens(walletAddress);
      
      if (result.success) {
        setMessage(`🎉 Claimed ${result.tokensGained} tokens! New balance: ${result.newBalance}`);
        await loadTokenInfo(); // Refresh
      } else {
        setMessage(`❌ ${result.error}`);
      }
    } catch (error) {
      setMessage('❌ Failed to claim tokens');
      console.error('Claim error:', error);
    } finally {
      setClaiming(false);
    }
  };

  // Handle withdrawal request
  const handleWithdrawal = async () => {
    if (!walletAddress || !withdrawalAmount || !destinationWallet) return;
    
    const amount = parseInt(withdrawalAmount);
    if (isNaN(amount) || amount < 1000000) {
      setMessage('❌ Minimum withdrawal is 1,000,000 tokens');
      return;
    }

    setWithdrawing(true);
    setMessage('');

    try {
      const result = await requestWithdrawal(walletAddress, amount, destinationWallet);
      
      if (result.success) {
        setMessage(`🚀 ${result.message}`);
        setWithdrawalAmount('');
        setDestinationWallet('');
        setShowWithdrawal(false);
        await loadTokenInfo(); // Refresh
      } else {
        setMessage(`❌ ${result.error}`);
      }
    } catch (error) {
      setMessage('❌ Failed to submit withdrawal request');
      console.error('Withdrawal error:', error);
    } finally {
      setWithdrawing(false);
    }
  };

  useEffect(() => {
    loadTokenInfo();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadTokenInfo, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  if (!walletAddress) {
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} text-center`}>
        <div className="text-gray-400">Connect wallet to view tokens</div>
      </div>
    );
  }

  if (loading && !tokenInfo) {
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} text-center`}>
        <div className="animate-spin text-2xl">🪙</div>
      </div>
    );
  }

  // Compact version for header/sidebar
  if (compact && tokenInfo) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/30">
        <div className="text-2xl">🪙</div>
        <div className="flex flex-col text-sm">
          <div className="font-bold text-yellow-300">{tokenInfo.balance.toLocaleString()}</div>
          <div className="text-xs text-gray-400">Chump Tokens</div>
        </div>
        {tokenInfo.canClaim && (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="ml-2 px-2 py-1 bg-green-500 hover:bg-green-600 rounded text-xs font-medium transition-colors disabled:opacity-50"
          >
            {claiming ? '⏳' : '📥 Claim'}
          </button>
        )}
        <button
          onClick={() => setShowWithdrawal(true)}
          className="ml-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 rounded text-xs font-medium transition-colors"
        >
          💸 Withdraw
        </button>
      </div>
    );
  }

  // Full version
  return (
    <div className="max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900/50 to-indigo-900/50 rounded-2xl border border-purple-500/30 backdrop-blur-sm">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="text-4xl">🪙</div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              Chump Tokens
            </h2>
            <div className="text-sm text-gray-400">Your gaming currency</div>
          </div>
        </div>

        {tokenInfo && (
          <div className="mb-4">
            <div className="text-4xl font-bold text-yellow-300 mb-2">
              {tokenInfo.balance.toLocaleString()}
            </div>
            <div className="text-gray-400 text-sm">Current Balance</div>
          </div>
        )}
      </div>

      {/* Claim Section */}
      {tokenInfo && (
        <div className="mb-6 p-4 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-xl border border-green-500/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-green-300">Hourly Bonus</div>
              <div className="text-sm text-gray-400">Earn 100,000 tokens every hour</div>
            </div>
            <div className="text-2xl">⏰</div>
          </div>

          {tokenInfo.canClaim ? (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
            >
              {claiming ? '⏳ Claiming...' : '📥 Claim Free Tokens'}
            </button>
          ) : (
            <div className="text-center">
              <div className="text-yellow-300 font-medium">
                Next claim in {tokenInfo.minutesUntilClaim} minutes
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Come back in {Math.ceil(tokenInfo.minutesUntilClaim / 60)} hour(s)
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {message && (
        <div className="mb-4 p-3 bg-gray-800/50 rounded-lg text-center">
          {message}
        </div>
      )}

      {/* Game Costs Info */}
      <div className="mb-6 p-4 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-xl border border-red-500/30">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-2xl">🎮</div>
          <div>
            <div className="font-semibold text-red-300">Game Entry Fee</div>
            <div className="text-sm text-gray-400">Cost to play competitive games</div>
          </div>
        </div>
        <div className="text-2xl font-bold text-red-300">20,000 tokens</div>
        <div className="text-sm text-gray-400 mt-1">
          Winner takes all entry fees from other players!
        </div>
      </div>

      {/* Withdrawal Section */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-500/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">💸</div>
            <div>
              <div className="font-semibold text-blue-300">Withdraw CHUMP Tokens</div>
              <div className="text-sm text-gray-400">Convert to CHUMP tokens and send to your wallet</div>
            </div>
          </div>
          {!showWithdrawal && (
            <button
              onClick={() => setShowWithdrawal(true)}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
            >
              Request Withdrawal
            </button>
          )}
        </div>

        {showWithdrawal && (
          <div className="space-y-4 mt-4 p-4 bg-gray-800/50 rounded-lg border border-blue-400/30">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">
                Amount to Withdraw (minimum 1,000,000 tokens)
              </label>
                                <input
                    type="number"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    placeholder="1000000"
                    min="1000000"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                  />
              <div className="text-xs text-gray-400 mt-1">
                ≈ {parseInt(withdrawalAmount) || 0} CHUMP tokens (1:1 conversion)
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">
                Destination Wallet Address
              </label>
              <input
                type="text"
                value={destinationWallet}
                onChange={(e) => setDestinationWallet(e.target.value)}
                placeholder="Enter your wallet address"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleWithdrawal}
                disabled={withdrawing || !withdrawalAmount || !destinationWallet}
                className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {withdrawing ? '⏳ Processing...' : '🚀 Submit Withdrawal'}
              </button>
              <button
                onClick={() => setShowWithdrawal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="text-xs text-gray-400 bg-gray-700/50 p-3 rounded">
              <div className="font-medium text-yellow-300 mb-1">⚠️ Important:</div>
              <ul className="space-y-1">
                <li>• Requires Level 1 to withdraw</li>
                <li>• Minimum: 1,000,000 tokens</li>
                <li>• Rate: 1,000,000 tokens = 1 CHUMP</li>
                <li>• Processing time: ~30 seconds</li>
                <li>• Tokens are deducted immediately</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Withdrawal History */}
      {withdrawals.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-300">Withdrawal History</h3>
          <div className="space-y-2">
            {withdrawals.map((withdrawal) => (
              <div
                key={withdrawal.id}
                className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  <div className="text-lg">
                    {withdrawal.status === 'pending' && '⏳'}
                    {withdrawal.status === 'processing' && '🔄'}
                    {withdrawal.status === 'completed' && '✅'}
                    {withdrawal.status === 'failed' && '❌'}
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      CHUMP Token Withdrawal
                    </div>
                    <div className="text-xs text-gray-400">
                      {withdrawal.solana_destination.slice(0, 8)}...{withdrawal.solana_destination.slice(-8)}
                    </div>
                    {withdrawal.transaction_hash && (
                      <a
                        href={`https://solscan.io/tx/${withdrawal.transaction_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline"
                      >
                        View on Solscan →
                      </a>
                    )}
                    {withdrawal.error_message && (
                      <div className="text-xs text-red-400">
                        {withdrawal.error_message}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-400">
                    -{withdrawal.amount.toLocaleString()}
                  </div>
                  <div className={`text-xs ${
                    withdrawal.status === 'pending' ? 'text-yellow-400' :
                    withdrawal.status === 'processing' ? 'text-blue-400' :
                    withdrawal.status === 'completed' ? 'text-green-400' :
                    'text-red-400'
                  }`}>
                    {withdrawal.status.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-300">Recent Transactions</h3>
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  <div className="text-lg">
                    {tx.transaction_type === 'hourly_bonus' && '📥'}
                    {tx.transaction_type === 'game_entry' && '🎮'}
                    {tx.transaction_type === 'game_payout' && '🏆'}
                    {tx.transaction_type === 'admin_adjustment' && '⚙️'}
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      {tx.transaction_type === 'hourly_bonus' && 'Hourly Bonus'}
                      {tx.transaction_type === 'game_entry' && 'Game Entry'}
                      {tx.transaction_type === 'game_payout' && 'Game Winnings'}
                      {tx.transaction_type === 'admin_adjustment' && 'Admin Adjustment'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {tx.description}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">
                    Balance: {tx.balance_after.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="text-center mt-4">
        <button
          onClick={loadTokenInfo}
          disabled={loading}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {loading ? '🔄 Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Withdrawal Modal for Compact Mode */}
      {compact && showWithdrawal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border-2 border-blue-400 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-blue-300 mb-4">Withdraw Tokens</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">
                  Amount (min 1,000,000 tokens)
                </label>
                <input
                  type="number"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  placeholder="1000000"
                  min="1000000"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">
                  Destination Wallet
                </label>
                <input
                  type="text"
                  value={destinationWallet}
                  onChange={(e) => setDestinationWallet(e.target.value)}
                  placeholder="Enter wallet address"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleWithdrawal}
                  disabled={withdrawing || !withdrawalAmount || !destinationWallet}
                  className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {withdrawing ? '⏳ Processing...' : '🚀 Submit'}
                </button>
                <button
                  onClick={() => setShowWithdrawal(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 