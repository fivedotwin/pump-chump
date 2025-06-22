import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { agoraService } from '../lib/agora';
import { useWallet } from '@solana/wallet-adapter-react';
import { CompetitiveBrickWall } from './CompetitiveBrickWall';

interface LiveStreamProps {
  onBack: () => void;
}

export const LiveStream: React.FC<LiveStreamProps> = ({ onBack }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string>('');
  
  const { publicKey } = useWallet();

  useEffect(() => {
    // Auto-join channel when component mounts
    const autoJoinChannel = async () => {
      if (!publicKey) {
        setError('Please connect your wallet first');
        setIsJoining(false);
        return;
      }

      try {
        // Use wallet address as unique user ID
        const uid = publicKey.toString().slice(0, 8);
        await agoraService.joinChannel(uid);
        setIsStreaming(true);
        setIsJoining(false);
      } catch (err) {
        console.error('Failed to join channel:', err);
        setError('Failed to join the live stream. Please try again.');
        setIsJoining(false);
      }
    };

    autoJoinChannel();

    return () => {
      // Cleanup on unmount
      agoraService.leaveChannel();
    };
  }, [publicKey]);

  // Show loading screen while joining
  if (isJoining) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-900 border border-gray-700 rounded p-6 text-center">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-2 text-green-400">Pump Chump Live</h1>
              <p className="text-gray-400 text-sm">connecting to the stream...</p>
            </div>

            <div className="mb-6 p-4 bg-gray-800 border border-gray-600 rounded">
              <div className="flex items-center gap-3 mb-2 justify-center">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-green-400 font-bold">LIVE</span>
              </div>
              <h3 className="text-white font-bold mb-1">Channel: pumpchumpv2</h3>
            </div>

            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-green-400">joining stream...</span>
            </div>

            <button
              onClick={onBack}
              className="w-full py-3 rounded font-bold bg-gray-700 text-white hover:bg-gray-600 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              [back to profile]
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show error screen if failed to join
  if (error && !isStreaming) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-900 border border-gray-700 rounded p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-2 text-red-400">Connection Failed</h1>
              <p className="text-gray-400 text-sm">unable to join the live stream</p>
            </div>

            <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-300 text-sm">
              {error}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 rounded font-bold bg-green-400 text-black hover:bg-green-300 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                [try again] 🔄
              </button>

              <button
                onClick={onBack}
                className="w-full py-3 rounded font-bold bg-gray-700 text-white hover:bg-gray-600 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                [back to profile]
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

    // Always show Competition Mode
  return (
    <CompetitiveBrickWall 
      channelName={agoraService.getChannelName()}
      onBack={onBack}
    />
  );
};