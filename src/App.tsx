import React, { useState, useRef, useEffect } from 'react';
import { Upload, User, Shield, Coins } from 'lucide-react';
import { WalletContextProvider } from './components/WalletProvider';
import { WalletButton } from './components/WalletButton';
import { LiveStream } from './components/LiveStream';
import { TermsOfService } from './components/TermsOfService';
import { AdminPanel } from './components/AdminPanel';
import { ChumpTokens } from './components/ChumpTokens';
import { useWallet } from '@solana/wallet-adapter-react';
import { saveUserProfile, getUserProfile, UserProfile } from './lib/supabase';

function AppContent() {
  const [step, setStep] = useState<'connect' | 'profile' | 'complete' | 'stream' | 'terms' | 'tokens'>('connect');
  const [name, setName] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingProfile, setExistingProfile] = useState<UserProfile | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { connected, publicKey } = useWallet();

  // Admin wallet check
  const ADMIN_WALLET = '27piCD7MZDaFK7ioTbESg2dBxNuWdn8QLY8HWMwuD7Ed';
  const isAdmin = connected && publicKey && publicKey.toString() === ADMIN_WALLET;

  // Auto-advance to complete screen when wallet connects
  useEffect(() => {
    const handleWalletConnection = async () => {
      if (connected && publicKey) {
        try {
          const profile = await getUserProfile(publicKey.toString());
          if (profile) {
            setExistingProfile(profile);
            setName(profile.display_name);
            setUploadedImage(profile.profile_image);
          } else {
            // Set default profile for new users
            setExistingProfile({
              wallet_address: publicKey.toString(),
              display_name: `Chump ${publicKey.toString().slice(0, 4)}`,
              profile_image: 'https://i.imgur.com/RdENATy.png'
            });
          }
          setStep('complete');
        } catch (error) {
          console.error('Error checking existing profile:', error);
          // Still proceed to complete screen with default profile
          setExistingProfile({
            wallet_address: publicKey.toString(),
            display_name: `Chump ${publicKey.toString().slice(0, 4)}`,
            profile_image: 'https://i.imgur.com/RdENATy.png'
          });
          setStep('complete');
        }
      }
    };

    handleWalletConnection();
  }, [connected, publicKey]);

  // Keyboard shortcuts for admin panel
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl+Shift+A to open admin panel
      if (e.ctrlKey && e.shiftKey && e.key === 'A' && isAdmin) {
        e.preventDefault();
        setShowAdminPanel(true);
      }
      // Escape to close admin panel
      if (e.key === 'Escape' && showAdminPanel) {
        setShowAdminPanel(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isAdmin, showAdminPanel]);

  const handleWalletConnected = () => {
    // Profile check happens in useEffect
  };

  const handleImageUpload = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleImageUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const handleComplete = async () => {
    if (name.trim() && uploadedImage && connected && publicKey) {
      setIsLoading(true);
      try {
        const profile: Omit<UserProfile, 'created_at' | 'updated_at'> = {
          wallet_address: publicKey.toString(),
          display_name: name.trim(),
          profile_image: uploadedImage
        };

        await saveUserProfile(profile);
        setExistingProfile({ ...profile });
        setStep('complete');
        
        // Show success popup
        setShowSuccessPopup(true);
      } catch (error) {
        console.error('Error saving profile:', error);
        alert('Failed to save profile. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleUpdateProfile = () => {
    setStep('profile');
  };

  const handleStartChumping = () => {
    console.log('Starting stream...');
    setStep('stream');
  };

  const handleBackFromStream = () => {
    setStep('complete');
  };

  const handleShowTerms = () => {
    setStep('terms');
  };

  const handleBackFromTerms = () => {
    setStep('connect');
  };

  const handleShowTokens = () => {
    setStep('tokens');
  };

  const handleBackFromTokens = () => {
    setStep('complete');
  };

  // Add a quick access button for testing
  const handleQuickStream = () => {
    if (connected && publicKey) {
      // Set minimal profile data for quick access
      if (!existingProfile) {
        setExistingProfile({
          wallet_address: publicKey.toString(),
          display_name: 'Test User',
          profile_image: 'https://i.imgur.com/RdENATy.png'
        });
      }
      setStep('stream');
    }
  };

  if (step === 'terms') {
    return <TermsOfService onBack={handleBackFromTerms} />;
  }

  if (step === 'tokens') {
    return (
      <div className="min-h-screen bg-black text-white font-mono p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleBackFromTokens}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold">Chump Tokens</h1>
            <div className="w-20"></div> {/* Spacer */}
          </div>

          {/* Token Component */}
          <ChumpTokens />
        </div>
      </div>
    );
  }

  if (step === 'stream') {
    return (
      <>
        <LiveStream onBack={handleBackFromStream} />
        {/* Admin Panel */}
        {showAdminPanel && isAdmin && (
          <AdminPanel
            currentWalletAddress={publicKey?.toString() || ''}
            onClose={() => setShowAdminPanel(false)}
          />
        )}
      </>
    );
  }

  if (step === 'connect') {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          {/* Logo Section */}
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto mb-6 rounded overflow-hidden border border-green-400/30 bg-gray-900">
              <img 
                src="https://i.imgur.com/RdENATy.png" 
                alt="Pump Chump" 
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="text-3xl font-bold mb-4 text-white">
              Welcome to <span className="text-green-400">Pump Chump</span>
            </h1>
            <p className="text-gray-400 text-lg mb-2">
              the memecoin launchpad
            </p>
            <p className="text-gray-500 text-sm">
              connect your Solana wallet to start trading
            </p>
          </div>

          {/* Connect Button */}
          <WalletButton onConnected={handleWalletConnected} />

          {/* Start Chump Button */}
          {connected && (
            <button
              onClick={handleQuickStream}
              className="w-full py-4 px-6 mb-6 rounded-xl font-bold text-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:from-yellow-300 hover:to-orange-400 hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg border-2 border-yellow-300"
            >
              🎮 START CHUMP 🎮
            </button>
          )}

          <div className="text-center text-xs text-gray-500">
            by connecting you agree to our{' '}
            <button 
              onClick={handleShowTerms}
              className="text-green-400 hover:underline cursor-pointer"
            >
              terms of service
            </button>
          </div>

          {/* Admin Button - Only visible to admin wallet */}
          {isAdmin && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowAdminPanel(true)}
                className="px-4 py-2 bg-purple-600/20 border border-purple-400/50 rounded-lg text-purple-300 text-xs font-bold hover:bg-purple-600/30 transition-all flex items-center gap-2 mx-auto"
                title="Admin Control Panel (Ctrl+Shift+A)"
              >
                <Shield className="w-4 h-4" />
                🛡️ ADMIN PANEL
              </button>
              <p className="text-purple-400/60 text-xs mt-2">Ctrl+Shift+A</p>
            </div>
          )}

          {/* Admin Panel */}
          {showAdminPanel && isAdmin && (
            <AdminPanel
              currentWalletAddress={publicKey?.toString() || ''}
              onClose={() => setShowAdminPanel(false)}
            />
          )}
        </div>
      </div>
    );
  }

  if (step === 'complete' && existingProfile) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <div className="bg-gray-900 border border-gray-700 rounded p-6 text-center">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-2 text-green-400">Welcome Back!</h1>
              <p className="text-gray-400 text-sm">your profile is ready to go</p>
            </div>

            {/* Compact Token Display */}
            {connected && (
              <div className="mb-6">
                <ChumpTokens compact={true} />
              </div>
            )}

            {/* Profile Display */}
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-2 border-green-400">
                <img src={existingProfile.profile_image} alt="Profile" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{existingProfile.display_name}</h2>
              <p className="text-green-400 text-xs font-mono">
                {existingProfile.wallet_address.slice(0, 8)}...{existingProfile.wallet_address.slice(-8)}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleStartChumping}
                className="w-full py-4 px-6 rounded-xl font-bold text-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:from-yellow-300 hover:to-orange-400 hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg border-2 border-yellow-300"
              >
                🎮 START CHUMP 🎮
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={handleShowTokens}
                  className="flex-1 py-2 rounded font-bold bg-gradient-to-r from-yellow-600 to-orange-600 text-white hover:from-yellow-500 hover:to-orange-500 transition-all duration-200 text-sm flex items-center justify-center gap-2"
                >
                  <Coins className="w-4 h-4" />
                  🪙 tokens
                </button>
                <button
                  onClick={handleUpdateProfile}
                  className="flex-1 py-2 rounded font-bold bg-gray-700 text-white hover:bg-gray-600 transition-all duration-200 text-sm"
                >
                  [update profile]
                </button>
              </div>
            </div>

            <div className="text-center mt-4 text-xs text-gray-500">
              ready to pump some coins? let's go! 📈
            </div>
          </div>

          {/* Admin Panel */}
          {showAdminPanel && isAdmin && (
            <AdminPanel
              currentWalletAddress={publicKey?.toString() || ''}
              onClose={() => setShowAdminPanel(false)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border-2 border-green-400 rounded-xl p-8 max-w-md w-full text-center animate-pulse">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-400/20 flex items-center justify-center">
                <span className="text-4xl">🚀</span>
              </div>
              <h2 className="text-2xl font-bold text-green-400 mb-2">Welcome to Pump Chump!</h2>
              <p className="text-white text-lg">Profile saved successfully!</p>
            </div>
            
            <div className="mb-6 p-4 bg-green-400/10 border border-green-400/30 rounded-lg">
              <p className="text-green-400 font-bold text-sm">🎉 You're all set to start chumping!</p>
              <p className="text-gray-300 text-sm mt-1">Ready to break some bricks and win prizes?</p>
            </div>

            <button
              onClick={() => setShowSuccessPopup(false)}
              className="w-full py-3 rounded-lg font-bold bg-green-400 text-black hover:bg-green-300 hover:scale-105 active:scale-95 transition-all duration-200"
            >
              [let's go!] 🎯
            </button>
          </div>
        </div>
      )}

      {/* Main App Content */}
      <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <div className="bg-gray-900 border border-gray-700 rounded p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-2 text-white">
                {existingProfile ? 'Update Your Profile' : 'Create Your Profile'}
              </h1>
              <p className="text-gray-400 text-sm">set up your pump chump identity to start trading</p>
              {connected && publicKey && (
                <p className="text-green-400 text-xs mt-2 font-mono">
                  wallet: {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
                </p>
              )}
            </div>

            {/* Profile Picture */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-white mb-3 uppercase">
                Profile Picture
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded p-6 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-green-400 bg-green-400/10'
                    : uploadedImage
                    ? 'border-green-400 bg-green-400/10'
                    : 'border-gray-600 hover:border-gray-500 bg-gray-800'
                }`}
              >
                {uploadedImage ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-green-400">
                      <img src={uploadedImage} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-green-400 font-bold text-sm">[click to change]</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center border border-gray-600">
                      <Upload className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-bold text-white mb-1">[upload image]</p>
                      <p className="text-gray-400 text-sm">drag & drop or click to browse</p>
                      <p className="text-gray-500 text-xs mt-1">recommended: 400x400px</p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* Name Input */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-white mb-3 uppercase">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="enter your display name"
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition-all"
                  maxLength={25}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <p className="text-gray-500 text-xs">this is how other traders will see you</p>
                <p className="text-gray-500 text-xs">{name.length}/25</p>
              </div>
            </div>

            {/* Complete Button */}
            <button
              onClick={handleComplete}
              disabled={!name.trim() || !uploadedImage || !connected || isLoading}
              className={`w-full py-3 rounded font-bold transition-all duration-200 mb-3 ${
                name.trim() && uploadedImage && connected && !isLoading
                  ? 'bg-green-400 text-black hover:bg-green-300 hover:scale-105 active:scale-95'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  saving profile...
                </div>
              ) : name.trim() && uploadedImage && connected ? (
                existingProfile ? '[update profile] 🔄' : '[save profile] 🚀'
              ) : (
                '[complete your profile]'
              )}
            </button>



            <div className="text-center mt-4 text-xs text-gray-500">
              ready to pump some coins? let's go! 📈
            </div>
          </div>
        </div>
      </div>

      {/* Admin Panel */}
      {showAdminPanel && isAdmin && (
        <AdminPanel
          currentWalletAddress={publicKey?.toString() || ''}
          onClose={() => setShowAdminPanel(false)}
        />
      )}
    </>
  );
}

function App() {
  return (
    <WalletContextProvider>
      <AppContent />
    </WalletContextProvider>
  );
}

export default App;