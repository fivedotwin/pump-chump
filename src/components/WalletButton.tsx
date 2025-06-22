import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

interface WalletButtonProps {
  onConnected: () => void;
}

export const WalletButton: React.FC<WalletButtonProps> = ({ onConnected }) => {
  const { wallet, connect, connecting, connected, disconnect, publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  const handleClick = async () => {
    if (connected) {
      await disconnect();
    } else if (wallet) {
      try {
        await connect();
        if (connected) {
          onConnected();
        }
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    } else {
      setVisible(true);
    }
  };

  // Listen for connection changes
  React.useEffect(() => {
    if (connected && publicKey) {
      onConnected();
    }
  }, [connected, publicKey, onConnected]);

  const getButtonText = () => {
    if (connecting) return 'connecting wallet...';
    if (connected) return `[connected: ${publicKey?.toString().slice(0, 4)}...${publicKey?.toString().slice(-4)}]`;
    if (wallet) return '[connect wallet]';
    return '[select wallet]';
  };

  return (
    <button
      onClick={handleClick}
      disabled={connecting}
      className={`w-full py-3 px-6 rounded font-bold text-lg transition-all duration-200 mb-4 ${
        connecting
          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
          : connected
          ? 'bg-green-400 text-black hover:bg-green-300'
          : 'bg-green-400 text-black hover:bg-green-300 hover:scale-105 active:scale-95'
      }`}
    >
      {connecting ? (
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          {getButtonText()}
        </div>
      ) : (
        getButtonText()
      )}
    </button>
  );
};