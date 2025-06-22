import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Clock, Users, Star, Zap, ArrowLeft, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { agoraService, RemoteUser } from '../lib/agora';
import { 
  createOrJoinCompetition, 
  updatePlayerScore, 
  setPlayerReady, 
  startCompetition, 
  finishCompetition,
  subscribeToCompetition,
  subscribeToScores,
  LiveCompetition,
  CompetitionScore,
  awardXP,
  getCompetitionPlayers,
  updatePlayerLeaderboardStats,
  getUserTokenInfo,
  chargeGameEntryFee,
  distributeWinnings,
  type TokenInfo
} from '../lib/supabase';
import { BrickWall } from './BrickWall';
import { Leaderboard } from './Leaderboard';

interface CompetitiveBrickWallProps {
  channelName: string;
  onBack: () => void;
}

export const CompetitiveBrickWall: React.FC<CompetitiveBrickWallProps> = ({ channelName, onBack }) => {
  const [competition, setCompetition] = useState<LiveCompetition | null>(null);
  const [scores, setScores] = useState<CompetitionScore[]>([]);
  const [myScore, setMyScore] = useState<CompetitionScore | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameActive, setGameActive] = useState(false);
  const [winner, setWinner] = useState<CompetitionScore | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [leveledUp, setLeveledUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myBricksCount, setMyBricksCount] = useState(0);
  
  // 🚀 NEW: Countdown system
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownNumber, setCountdownNumber] = useState(5);
  const [countdownText, setCountdownText] = useState('');
  
  // Token system states
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [entryFeeCharged, setEntryFeeCharged] = useState(false);
  const [insufficientTokens, setInsufficientTokens] = useState(false);
  const [winningsDistributed, setWinningsDistributed] = useState(false);
  
  // Leaderboard states
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [playerStats, setPlayerStats] = useState({
    bricksDestroyed: 0,
    bossesDefeated: 0,
    maxStreak: 0,
    achievements: 0,
    level: 1
  });
  
  // Video streaming states
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [videoInitialized, setVideoInitialized] = useState(false);
  const localVideoRef = useRef<HTMLDivElement>(null);

  const { publicKey } = useWallet();
  const playerWallet = publicKey?.toString() || '';

  // 🎵 NEW: Play countdown sounds
  const playCountdownSound = (number: number, isReady = false, isGo = false) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (isGo) {
        // 🚀 "GO!" sound - epic ascending sequence
        const frequencies = [523, 659, 784, 1047]; // C5, E5, G5, C6
        frequencies.forEach((freq, i) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          
          osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.1);
          gain.gain.setValueAtTime(0.6, audioContext.currentTime + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
          osc.start(audioContext.currentTime + i * 0.1);
          osc.stop(audioContext.currentTime + 0.8);
        });
      } else if (isReady) {
        // 🎯 "Players Ready" sound - triumphant chord
        [440, 554, 659].forEach((freq, i) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          
          osc.frequency.setValueAtTime(freq, audioContext.currentTime);
          gain.gain.setValueAtTime(0.4, audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
          osc.start();
          osc.stop(audioContext.currentTime + 0.6);
        });
      } else {
        // 🔢 Number countdown - rising pitch
        const baseFreq = 400 + (number * 100);
        oscillator.frequency.setValueAtTime(baseFreq, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
      }
    } catch (error) {
      console.log('Audio not available:', error);
    }
  };

  // 🚀 NEW: Start countdown when all players are ready
  const startCountdown = async () => {
    if (!competition || !playerWallet) return;
    
    console.log('🚀 Starting countdown sequence!');
    setShowCountdown(true);
    
    // 5, 4, 3, 2, 1 countdown
    for (let i = 5; i >= 1; i--) {
      setCountdownNumber(i);
      setCountdownText(`${i}`);
      playCountdownSound(i);
      console.log(`⏰ Countdown: ${i}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // "Players Ready!"
    setCountdownText('PLAYERS READY!');
    playCountdownSound(0, true);
    console.log('🎯 Players Ready!');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // "SET"
    setCountdownText('SET!');
    playCountdownSound(0, true);
    console.log('🎯 Set!');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // "GO!"
    setCountdownText('GO!');
    playCountdownSound(0, false, true);
    console.log('🚀 GO!');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Hide countdown and start game
    setShowCountdown(false);
    
    // Actually start the competition
    try {
      if (!competition.id.startsWith('local-')) {
        await startCompetition(competition.id);
      } else {
        setCompetition(prev => prev ? { ...prev, game_status: 'active' } : prev);
      }
      setGameActive(true);
      setTimeLeft(60);
      console.log('🎮 Game started!');
    } catch (error) {
      console.error('❌ Error starting competition:', error);
    }
  };

  // Load token info when wallet connects
  useEffect(() => {
    const loadTokenInfo = async () => {
      if (!playerWallet) return;
      
      try {
        console.log('🪙 Loading token info for:', playerWallet);
        const info = await getUserTokenInfo(playerWallet);
        setTokenInfo(info);
        
        if (info && info.balance < 20000) {
          setInsufficientTokens(true);
          console.log('❌ Insufficient tokens:', info.balance, '< 20,000');
        } else {
          setInsufficientTokens(false);
          console.log('✅ Sufficient tokens:', info?.balance || 0, '>= 20,000');
        }
      } catch (error) {
        console.error('❌ Error loading token info:', error);
      }
    };

    loadTokenInfo();
    
    // Refresh token info every 30 seconds
    const interval = setInterval(loadTokenInfo, 30000);
    return () => clearInterval(interval);
  }, [playerWallet]);

  // Initialize video streaming
  useEffect(() => {
    if (!playerWallet || videoInitialized) return;

    const initVideo = async () => {
      try {
        console.log('🎥 Initializing video streaming...');
        
        // Set up remote user callback
        agoraService.onRemoteUserUpdate = (users: RemoteUser[]) => {
          console.log('📺 Remote users updated:', users.length, users.map(u => u.uid));
          setRemoteUsers(users);
          
          // Auto-play remote video tracks with delay to ensure DOM is ready
          setTimeout(() => {
            users.forEach(user => {
              if (user.videoTrack) {
                // Try multiple possible container IDs
                const containers = [
                  `remote-video-${user.uid}`,
                  `winner-remote-video-${user.uid}`,
                  `winner-main-remote-video-${user.uid}`
                ];
                
                                 for (const containerId of containers) {
                   const container = document.getElementById(containerId);
                   if (container) {
                     console.log(`▶️ Playing video for user ${user.uid} in ${containerId}`);
                     try {
                       user.videoTrack.play(container);
                     } catch (error) {
                       console.warn(`Failed to play video for ${user.uid}:`, error);
                     }
                   }
                 }
              }
            });
          }, 100);
        };

        // Join the video channel
        await agoraService.joinChannel(playerWallet);
        console.log('✅ Joined video channel successfully');
        setVideoInitialized(true);
        
      } catch (error) {
        console.error('❌ Failed to initialize video:', error);
      }
    };

    initVideo();

    // Cleanup on unmount
    return () => {
      agoraService.leaveChannel().catch(console.error);
    };
  }, [playerWallet]);

  // Handle video enable/disable
  const toggleVideo = async () => {
    try {
      if (isVideoEnabled) {
        await agoraService.stopLocalVideo();
        setIsVideoEnabled(false);
      } else {
        const videoTrack = await agoraService.startLocalVideo();
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }
        setIsVideoEnabled(true);
      }
    } catch (error) {
      console.error('Error toggling video:', error);
    }
  };

  // Handle audio enable/disable
  const toggleAudio = async () => {
    try {
      if (isAudioEnabled) {
        await agoraService.stopLocalAudio();
        setIsAudioEnabled(false);
      } else {
        await agoraService.startLocalAudio();
        setIsAudioEnabled(true);
      }
    } catch (error) {
      console.error('Error toggling audio:', error);
    }
  };

  // Handle video playback in winner screen
  useEffect(() => {
    if (!showCelebration) return;

    const playWinnerVideos = () => {
      // Play main winner video (large display)
      if (winner?.player_wallet === playerWallet && isVideoEnabled) {
        // Current user is winner - play local video
        const localTracks = agoraService.getLocalTracks();
        if (localTracks.videoTrack) {
          const mainContainer = document.getElementById('winner-main-local-video');
          if (mainContainer) {
            localTracks.videoTrack.play(mainContainer);
          }
        }
      } else {
        // Remote user is winner - play their video
        const winnerRemoteUser = remoteUsers.find(user => 
          String(user.uid).includes(winner?.player_wallet?.slice(0, 6) || '')
        );
        if (winnerRemoteUser?.videoTrack) {
          const mainContainer = document.getElementById(`winner-main-remote-video-${winnerRemoteUser.uid}`);
          if (mainContainer) {
            winnerRemoteUser.videoTrack.play(mainContainer);
          }
        }
      }

      // Play small loser videos
      if (winner?.player_wallet === playerWallet) {
        // Current user won - play remote users in small containers
        remoteUsers.forEach(user => {
          if (user.videoTrack) {
            const container = document.getElementById(`winner-remote-video-${user.uid}`);
            if (container) {
              user.videoTrack.play(container);
            }
          }
        });
      } else {
        // Remote user won - play local video in small container if current user is in losers
        const localTracks = agoraService.getLocalTracks();
        if (localTracks.videoTrack && isVideoEnabled) {
          const localContainer = document.getElementById('winner-local-video');
          if (localContainer) {
            localTracks.videoTrack.play(localContainer);
          }
        }
        
        // Play other remote users (excluding winner) in small containers
        remoteUsers.forEach(user => {
          const isWinnerUser = String(user.uid).includes(winner?.player_wallet?.slice(0, 6) || '');
          if (!isWinnerUser && user.videoTrack) {
            const container = document.getElementById(`winner-remote-video-${user.uid}`);
            if (container) {
              user.videoTrack.play(container);
            }
          }
        });
      }
    };

    // Delay to ensure DOM elements are rendered
    setTimeout(playWinnerVideos, 100);
  }, [showCelebration, winner, playerWallet, isVideoEnabled, remoteUsers]);

  // Initialize competition
  useEffect(() => {
    if (!playerWallet) return;

    const initCompetition = async () => {
      try {
        console.log('🎮 Initializing competition...', { channelName, playerWallet });
        
        // Try to get user's actual display name from profile (with fallback)
        let displayName = `Player_${playerWallet.slice(0, 4)}`;
        try {
          const { getUserProfile } = await import('../lib/supabase');
          const userProfile = await getUserProfile(playerWallet);
          if (userProfile?.display_name) {
            displayName = userProfile.display_name;
          }
        } catch (profileError) {
          console.warn('⚠️ Could not fetch user profile, using fallback name:', profileError);
        }
        
        console.log('👤 Using player name:', displayName);
        
        const { competition: comp, playerScore } = await createOrJoinCompetition(
          channelName, 
          playerWallet, 
          displayName
        );
        
        console.log('✅ Competition created/joined:', comp);
        console.log('✅ Player score:', playerScore);
        
        // Charge entry fee if not already charged and not in local mode
        if (!comp.id.startsWith('local-') && !entryFeeCharged) {
          console.log('💰 Charging entry fee...');
          const feeResult = await chargeGameEntryFee(playerWallet, comp.id);
          if (feeResult.success) {
            console.log('✅ Entry fee charged successfully:', feeResult);
            setEntryFeeCharged(true);
            // Refresh token info
            try {
              const updatedTokenInfo = await getUserTokenInfo(playerWallet);
              setTokenInfo(updatedTokenInfo);
            } catch (error) {
              console.error('Error refreshing token info:', error);
            }
          } else {
            console.error('❌ Failed to charge entry fee:', feeResult.error);
            if (feeResult.error?.includes('Insufficient tokens')) {
              setInsufficientTokens(true);
              alert(`❌ Insufficient Tokens!\n\nYou need 20,000 Chump Tokens to play.\nCurrent balance: ${tokenInfo?.balance || 0}\n\nGo to the Tokens page to claim your free hourly tokens!`);
              onBack();
              return;
            }
          }
        }
        
        setCompetition(comp);
        setMyScore(playerScore);
        setGameActive(comp.game_status === 'active');
        setIsReady(playerScore.is_ready);
        setLoading(false);

        const players = await getCompetitionPlayers(comp.id);
        console.log('✅ Competition players:', players);
        setScores(players);
        
        // Auto-ready for testing if not already ready
        if (!playerScore.is_ready) {
          console.log('🚀 Auto-setting player as ready...');
          await setPlayerReady(comp.id, playerWallet, true);
          setIsReady(true);
        }
      } catch (error) {
        console.error('❌ Error initializing competition:', error);
        setLoading(false);
        
        // Create local fallback competition for testing
        console.log('🔄 Creating local fallback competition...');
        const fallbackCompetition = {
          id: 'local-' + Date.now(),
          channel_name: channelName,
          game_status: 'waiting' as const,
          timer_remaining: 60,
          max_players: 4,
          created_at: new Date().toISOString()
        };
        
        const fallbackScore = {
          id: 'local-score-' + Date.now(),
          competition_id: fallbackCompetition.id,
          player_wallet: playerWallet,
          player_name: `Player_${playerWallet.slice(0, 4)}`,
          current_score: 0,
          is_ready: true,
          is_active: true,
          bricks_broken: 0,
          level_reached: 1,
          updated_at: new Date().toISOString()
        };
        
        setCompetition(fallbackCompetition);
        setMyScore(fallbackScore);
        setScores([fallbackScore]);
        setIsReady(true);
        setGameActive(false);
        
        console.log('✅ Local fallback competition created');
        alert(`⚠️ Database connection failed, running in LOCAL MODE

🎮 You can still play the game locally!
🔧 To fix: Click "🔍 TEST DATABASE" then "🔧 AUTO-SETUP DB"`);
      }
    };

    initCompetition();
  }, [channelName, playerWallet]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!competition) return;

    const competitionSub = subscribeToCompetition(competition.id, (updatedComp) => {
      setCompetition(updatedComp);
      setGameActive(updatedComp.game_status === 'active');
      
      if (updatedComp.game_status === 'finished') {
        handleGameFinished();
      }
    });

    const scoresSub = subscribeToScores(competition.id, async (updatedScores) => {
      console.log('📊 Scores updated:', updatedScores);
      setScores(updatedScores);
      const myUpdatedScore = updatedScores.find(s => s.player_wallet === playerWallet);
      if (myUpdatedScore) {
        console.log('👤 My updated score:', myUpdatedScore);
        setMyScore(myUpdatedScore);
        setIsReady(myUpdatedScore.is_ready);
      } else {
        // If no score found, refresh from database
        console.log('⚠️ No score found in update, refreshing...');
        try {
          const freshScores = await getCompetitionPlayers(competition.id);
          console.log('🔄 Fresh scores from DB:', freshScores);
          setScores(freshScores);
          const myFreshScore = freshScores.find(s => s.player_wallet === playerWallet);
          if (myFreshScore) {
            setMyScore(myFreshScore);
          }
        } catch (error) {
          console.error('❌ Error refreshing scores:', error);
        }
      }
    });

    return () => {
      competitionSub.unsubscribe();
      scoresSub.unsubscribe();
    };
  }, [competition, playerWallet]);

  // Game timer - precise 1-second countdown
  useEffect(() => {
    if (!gameActive || !competition) return;

    console.log('🕐 Starting game timer at:', timeLeft, 'seconds');
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        console.log('⏰ Timer tick:', prev, '→', newTime);
        
        if (newTime <= 0) {
          console.log('🏁 Time up! Finishing game...');
          clearInterval(timer);
          handleTimeUp();
          return 0;
        }
        return newTime;
      });
    }, 1000); // Exactly 1000ms = 1 second

    return () => {
      console.log('🛑 Cleaning up timer');
      clearInterval(timer);
    };
  }, [gameActive, competition]); // Removed dependencies that could cause re-creation

  // Separate score refresh effect
  useEffect(() => {
    if (!gameActive || !competition) return;

    const scoreRefresh = setInterval(async () => {
      if (competition && gameActive) {
        try {
          const freshScores = await getCompetitionPlayers(competition.id);
          console.log('🔄 Periodic score refresh:', freshScores);
          setScores(freshScores);
          const myFreshScore = freshScores.find(s => s.player_wallet === playerWallet);
          if (myFreshScore && myFreshScore.current_score > (myScore?.current_score || 0)) {
            setMyScore(myFreshScore);
            setMyBricksCount(myFreshScore.bricks_broken);
          }
        } catch (error) {
          console.error('❌ Error in periodic score refresh:', error);
        }
      }
    }, 5000);

    return () => {
      clearInterval(scoreRefresh);
    };
  }, [gameActive, competition, playerWallet, myScore]);

  const handleReady = async () => {
    if (!competition || !playerWallet) return;
    
    try {
      await setPlayerReady(competition.id, playerWallet, !isReady);
      setIsReady(!isReady);
    } catch (error) {
      console.error('Error setting ready status:', error);
    }
  };

  const handleStartGame = async () => {
    console.log('🚀 START GAME clicked!');
    console.log('Competition:', competition);
    console.log('Player wallet:', playerWallet);
    
    if (!competition) {
      alert('❌ No competition found! Please refresh the page.');
      console.error('No competition found');
      return;
    }

    // 🚀 NEW: Check if all players are ready
    const allReady = scores.length > 0 && scores.every(s => s.is_ready);
    const hasPlayers = scores.length >= 1;
    
    if (!hasPlayers) {
      alert('❌ Need at least 1 player to start!');
      return;
    }
    
    if (!allReady) {
      alert('❌ All players must be ready before starting!\n\nWaiting for:\n' + 
        scores.filter(s => !s.is_ready).map(s => s.player_name).join('\n'));
      return;
    }
    
    // 🎵 Start the epic countdown sequence!
    await startCountdown();
  };

  const handleBrickBreak = async (brickId: string, playerWallet: string) => {
    console.log('🎯 handleBrickBreak called:', { brickId, playerWallet, gameActive, competitionId: competition?.id, myScore });
    
    if (!gameActive || !competition || !myScore) {
      console.log('❌ Cannot break brick - missing requirements:', { gameActive, competition: !!competition, myScore: !!myScore });
      return;
    }

    const newBricks = myBricksCount + 1;
    const newScore = newBricks * 10;

    console.log('🧱 Brick broken!', { 
      brickId, 
      oldBricks: myBricksCount, 
      newBricks, 
      oldScore: myScore.current_score,
      newScore, 
      playerWallet 
    });
    
    setMyBricksCount(newBricks);

    // Update local score immediately for responsive UI
    setMyScore(prev => {
      const updated = prev ? {
        ...prev,
        current_score: newScore,
        bricks_broken: newBricks
      } : prev;
      console.log('📈 Local score updated:', updated);
      return updated;
    });

    // Update scores array for leaderboard
    setScores(prevScores => 
      prevScores.map(score => 
        score.player_wallet === playerWallet 
          ? { ...score, current_score: newScore, bricks_broken: newBricks }
          : score
      )
    );

    // Try to update database if not in local mode
    if (!competition.id.startsWith('local-')) {
      try {
        console.log('💾 Updating score in database...', {
          competitionId: competition.id,
          playerWallet,
          newScore,
          newBricks,
          level: Math.floor(newBricks / 50) + 1
        });
        
        await updatePlayerScore(
          competition.id,
          playerWallet,
          newScore,
          newBricks,
          Math.floor(newBricks / 50) + 1
        );
        
        console.log('✅ Score updated in database successfully:', { newScore, newBricks });
      } catch (error) {
        console.error('❌ Error updating score in database (local mode continues):', error);
        // Don't revert in local mode, just continue
        console.log('🏠 Continuing in local mode...');
      }
    } else {
      console.log('🏠 Local mode - score updated locally only');
    }
  };

  const handleTimeUp = async () => {
    console.log('🏁 handleTimeUp called');
    if (!competition) {
      console.log('❌ No competition in handleTimeUp');
      return;
    }
    
    try {
      console.log('Finishing competition:', competition.id);
      
      if (competition.id.startsWith('local-')) {
        console.log('🏠 Finishing local competition...');
        // Local mode - use current scores
        const sortedScores = scores.sort((a, b) => b.current_score - a.current_score);
        const actualWinner = sortedScores[0];
        
        console.log('🎯 Local winner determined:', actualWinner);
        setWinner(actualWinner || myScore);
        setGameActive(false);
        
        // Update competition status locally
        setCompetition(prev => prev ? { 
          ...prev, 
          game_status: 'finished', 
          winner_wallet: actualWinner?.player_wallet 
        } : prev);
        
        console.log('✅ Local game finished successfully');
      } else {
        console.log('💾 Finishing database competition...');
        // Database mode - refresh scores and call API
        const latestScores = await getCompetitionPlayers(competition.id);
        console.log('📊 Latest scores before finishing:', latestScores);
        setScores(latestScores);
        
        // Update my score with latest data
        const myLatestScore = latestScores.find(s => s.player_wallet === playerWallet);
        if (myLatestScore) {
          setMyScore(myLatestScore);
          setMyBricksCount(myLatestScore.bricks_broken);
        }
        
        // Finish competition and get winner
        const winnerData = await finishCompetition(competition.id);
        console.log('🏆 Winner data from finishCompetition:', winnerData);
        
        // Determine actual winner from scores if finishCompetition doesn't return proper data
        const sortedScores = latestScores.sort((a, b) => b.current_score - a.current_score);
        const actualWinner = sortedScores[0];
        
        console.log('🎯 Actual winner determined:', actualWinner);
        setWinner(winnerData || actualWinner || myLatestScore);
        setGameActive(false);
        
        console.log('✅ Database game finished successfully');
      }
      
      // Award XP and show celebration
      await handleGameFinished();
      
    } catch (error) {
      console.error('❌ Error finishing competition:', error);
      // Fallback: still end the game with current scores
      console.log('🔄 Falling back to local finish...');
      const sortedScores = scores.sort((a, b) => b.current_score - a.current_score);
      const fallbackWinner = sortedScores[0] || myScore;
      setWinner(fallbackWinner);
      setGameActive(false);
      await handleGameFinished();
    }
  };

  const handleGameFinished = async () => {
    if (!playerWallet) return;

    try {
      console.log('🎊 handleGameFinished called', { 
        winner, 
        playerWallet, 
        scores: scores.map(s => ({ name: s.player_name, score: s.current_score, wallet: s.player_wallet }))
      });
      
      const isWinner = winner?.player_wallet === playerWallet;
      const xpAmount = isWinner ? 100 : 25;
      
      console.log('🏆 Player status:', { isWinner, xpAmount });
      
      // Distribute token winnings to winner
      if (competition && !competition.id.startsWith('local-') && isWinner && !winningsDistributed) {
        console.log('🏆 Distributing winnings to winner...');
        try {
          const winningsResult = await distributeWinnings(competition.id, playerWallet);
          if (winningsResult.success) {
            console.log('✅ Winnings distributed successfully:', winningsResult);
            setWinningsDistributed(true);
            // Refresh token info
            try {
              const updatedTokenInfo = await getUserTokenInfo(playerWallet);
              setTokenInfo(updatedTokenInfo);
            } catch (error) {
              console.error('Error refreshing token info after winning:', error);
            }
          } else {
            console.error('❌ Failed to distribute winnings:', winningsResult.error);
          }
        } catch (error) {
          console.error('❌ Error distributing winnings:', error);
        }
      }

      // Try to award XP if not in local mode
      if (competition && !competition.id.startsWith('local-')) {
        console.log('💾 Awarding XP in database mode...');
        try {
          const { leveledUp: didLevelUp, newLevel } = await awardXP(playerWallet, xpAmount, isWinner);
          setXpGained(xpAmount);
          setLeveledUp(didLevelUp);
          console.log('✅ XP awarded successfully');
          
          // 🏆 UPDATE LEADERBOARD STATS
          console.log('🏆 Updating leaderboard stats...');
          await updatePlayerLeaderboardStats(playerWallet, {
            score: myScore?.current_score || 0,
            bricksDestroyed: myScore?.bricks_broken || 0,
            bossesDefeated: playerStats.bossesDefeated || 0,
            maxStreak: playerStats.maxStreak || 0,
            achievements: playerStats.achievements || 0
          });
          console.log('✅ Leaderboard stats updated successfully');
        } catch (xpError) {
          console.error('❌ XP award failed, showing local celebration:', xpError);
          setXpGained(xpAmount); // Show XP locally even if DB fails
          setLeveledUp(false);
        }
      } else {
        console.log('🏠 Local mode - showing XP without database update');
        setXpGained(xpAmount); // Show XP amount even in local mode
        setLeveledUp(false); // No level up in local mode
      }
      
      setShowCelebration(true);
      console.log('✅ Celebration screen should now show with updated scores');
    } catch (error) {
      console.error('❌ Error in handleGameFinished:', error);
      // Still show celebration even if everything fails
      const isWinner = winner?.player_wallet === playerWallet;
      setXpGained(isWinner ? 100 : 25);
      setLeveledUp(false);
      setShowCelebration(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-green-400 text-lg">Joining competition...</p>
        </div>
      </div>
    );
  }

  // Celebration Screen
  if (showCelebration) {
    const isWinner = winner?.player_wallet === playerWallet;
    
    // Get the latest scores and find winner's score
    const sortedScores = scores.sort((a, b) => b.current_score - a.current_score);
    const actualWinner = sortedScores[0]; // Highest scorer is the real winner
    const winnerScore = isWinner 
      ? (myScore || actualWinner) // Use local score if current player won
      : actualWinner; // Use actual winner's score
    
    const loserScores = sortedScores.slice(1); // Everyone except the winner
    
    console.log('🏆 Winner screen data:', { 
      isWinner, 
      winnerScore, 
      loserScores, 
      myScore, 
      allScores: scores 
    });

    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
        {/* Confetti Animation */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-green-400 rounded animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random()}s`
              }}
            />
          ))}
        </div>

        <div className="text-center z-10 max-w-6xl mx-auto p-4">
          {/* Winner's Camera - Large */}
          <div className="mb-6">
            <div className="relative w-80 h-60 mx-auto bg-gray-900 rounded-xl overflow-hidden border-4 border-yellow-400 shadow-xl">
              {isWinner ? (
                <>
                  <div className="w-full h-full" id="winner-main-local-video" />
                  <div className="absolute top-4 left-4 bg-yellow-400 text-black px-3 py-1 rounded-full font-bold text-sm">
                    🏆 WINNER!
                  </div>
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded">
                    You - {myScore?.current_score || 0} pts
                  </div>
                </>
              ) : (
                <>
                  {(() => {
                    const winnerRemoteUser = remoteUsers.find(user => 
                      String(user.uid).includes(winner?.player_wallet?.slice(0, 6) || '')
                    );
                    return winnerRemoteUser ? (
                      <div className="w-full h-full" id={`winner-main-remote-video-${winnerRemoteUser.uid}`} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-gray-500">Winner's Camera</span>
                      </div>
                    );
                  })()}
                  <div className="absolute top-4 left-4 bg-yellow-400 text-black px-3 py-1 rounded-full font-bold text-sm">
                    🏆 WINNER!
                  </div>
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded">
                    {winnerScore?.player_name} - {winnerScore?.current_score || 0} pts
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Shared Winner Announcement */}
          <div className="mb-6">
            <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 animate-bounce" />
            <h1 className="text-4xl font-bold text-yellow-400 mb-2">🏆 WINNER 🏆</h1>
            <h2 className="text-3xl font-bold text-white mb-2">{winnerScore?.player_name || 'Unknown Player'}</h2>
            <p className="text-xl text-green-400 font-bold">
              {winnerScore?.current_score || 0} Points - {winnerScore?.bricks_broken || 0} Bricks
            </p>
            {isWinner ? (
              <p className="text-lg text-yellow-400 mt-2">🎉 That's you! Congratulations! 🎉</p>
            ) : (
              <p className="text-lg text-red-400 mt-2">💪 Better luck next time!</p>
            )}
          </div>

          {/* Losing Players' Cameras - Small */}
          {loserScores.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-red-400 mb-4">Players Who Lost</h3>
              <div className="flex justify-center gap-4 flex-wrap">
                {loserScores.map((score, index) => {
                  const remoteUser = remoteUsers.find(user => String(user.uid).includes(score.player_wallet.slice(0, 6)));
                  return (
                    <div key={score.id} className="relative w-40 h-28 bg-gray-900 rounded-lg overflow-hidden border-2 border-red-500">
                      {score.player_wallet === playerWallet ? (
                        <div className="w-full h-full" id={`winner-local-video`} />
                      ) : remoteUser ? (
                        <div className="w-full h-full" id={`winner-remote-video-${remoteUser.uid}`} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-gray-500 text-xs">Player Camera</span>
                        </div>
                      )}
                      <div className="absolute top-1 right-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                        LOST
                      </div>
                      <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                        {score.player_name} - {score.current_score} pts
                        {score.player_wallet === playerWallet && <span className="text-yellow-400"> (You)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Final Leaderboard */}
          <div className="bg-gray-900 border-2 border-blue-400 rounded-xl p-6 mb-6 max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-blue-400 mb-4 text-center">🏁 Final Results</h3>
            <div className="space-y-2">
              {scores.sort((a, b) => b.current_score - a.current_score).map((score, index) => {
                // Use latest score data, prioritizing myScore for current player
                const displayScore = score.player_wallet === playerWallet && myScore 
                  ? myScore.current_score 
                  : score.current_score;
                const displayBricks = score.player_wallet === playerWallet && myScore 
                  ? myScore.bricks_broken 
                  : score.bricks_broken;
                
                return (
                  <div 
                    key={score.id} 
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index === 0 
                        ? 'bg-yellow-400 bg-opacity-20 border border-yellow-400' 
                        : 'bg-gray-800 border border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${index === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        #{index + 1}
                      </span>
                      {index === 0 && <Trophy className="w-5 h-5 text-yellow-400" />}
                      <span className={`font-bold ${
                        score.player_wallet === playerWallet ? 'text-green-400' : 'text-white'
                      }`}>
                        {score.player_name}
                        {score.player_wallet === playerWallet && <span className="text-yellow-400"> (You)</span>}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${index === 0 ? 'text-yellow-400' : 'text-white'}`}>
                        {displayScore || 0} pts
                      </div>
                      <div className="text-sm text-gray-400">
                        {displayBricks || 0} bricks
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Personal XP & Token Rewards */}
          <div className="bg-gray-900 border-2 border-green-400 rounded-xl p-6 mb-6 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Zap className="w-6 h-6 text-yellow-400" />
              <span className="text-2xl font-bold text-yellow-400">+{xpGained} XP</span>
              <span className="text-sm text-gray-400">
                ({isWinner ? 'Winner Bonus' : 'Participation'})
              </span>
            </div>

            {/* Token Winnings */}
            {!competition?.id.startsWith('local-') && isWinner && (
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">🪙</span>
                  <span className="text-2xl font-bold text-yellow-300">
                    +{scores.length * 20000} Tokens
                  </span>
                </div>
                <p className="text-green-400 text-sm">🏆 Winner takes all entry fees!</p>
                <p className="text-gray-400 text-xs">
                  ({scores.length} players × 20,000 tokens each)
                </p>
              </div>
            )}
            
            {competition?.id.startsWith('local-') && (
              <div className="text-center mb-3">
                <p className="text-orange-400 text-sm">🏠 Local Mode - Rewards not saved to database</p>
              </div>
            )}
            
            {leveledUp && (
              <div className="text-center">
                <p className="text-green-400 text-xl font-bold mb-2">🎉 LEVEL UP! 🎉</p>
                <p className="text-white">You reached a new level!</p>
              </div>
            )}
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={onBack}
              className="px-12 py-4 bg-green-400 text-black font-bold text-lg rounded-lg hover:bg-green-300 transition-all transform hover:scale-105 shadow-lg"
            >
              🎮 Back to Stream
            </button>
            <button
              onClick={() => setShowLeaderboard(true)}
              className="px-8 py-4 bg-purple-600 text-white font-bold text-lg rounded-lg hover:bg-purple-500 transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
            >
              <Trophy className="w-5 h-5" />
              🏆 LEADERBOARD
            </button>
          </div>
        </div>

        {/* Leaderboard Modal */}
        {showLeaderboard && (
          <Leaderboard
            onClose={() => setShowLeaderboard(false)}
            currentPlayer={{
              name: winnerScore?.player_name || myScore?.player_name || `Player_${playerWallet.slice(0, 4)}`,
              wallet: playerWallet,
              score: myScore?.current_score || 0,
              bricksDestroyed: playerStats.bricksDestroyed,
              bossesDefeated: playerStats.bossesDefeated,
              maxStreak: playerStats.maxStreak,
              achievements: playerStats.achievements,
              level: playerStats.level
            }}
          />
        )}
      </div>
    );
  }

  // Waiting/Ready Screen
  if (!gameActive) {
    const allReady = scores.length > 0 && scores.every(s => s.is_ready);
    const canStart = scores.length >= 1 && allReady; // Allow single player for testing

    return (
      <div className="min-h-screen bg-black text-white p-4 relative">
        {/* 🎵 COUNTDOWN OVERLAY */}
        {showCountdown && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="text-9xl font-bold text-yellow-400 mb-8 animate-pulse">
                {countdownText}
              </div>
              {countdownNumber > 0 && countdownNumber <= 5 && (
                <div className="text-6xl font-bold text-white mb-4">
                  {countdownNumber}
                </div>
              )}
              <div className="text-2xl text-green-400 animate-bounce">
                {countdownText === 'GO!' ? '🚀 GAME STARTING!' : '🎮 Get Ready!'}
              </div>
              
              {/* Countdown visual effects */}
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-4 h-4 bg-yellow-400 rounded-full animate-ping"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 2}s`,
                      animationDuration: `${1 + Math.random()}s`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-green-400">🎮 Competition Lobby</h1>
                {competition?.id.startsWith('local-') && (
                  <div className="mt-1 px-3 py-1 bg-orange-600 text-white text-sm rounded-full inline-block">
                    🏠 LOCAL MODE (Database Offline)
                  </div>
                )}
                {/* Token Status */}
                {tokenInfo && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <div className="px-3 py-1 bg-yellow-600/20 border border-yellow-400/50 rounded-full text-sm">
                      🪙 {tokenInfo.balance.toLocaleString()} tokens
                    </div>
                    {entryFeeCharged && (
                      <div className="px-3 py-1 bg-red-600/20 border border-red-400/50 rounded-full text-sm">
                        💰 Entry fee paid (-20,000)
                      </div>
                    )}
                    {insufficientTokens && (
                      <div className="px-3 py-1 bg-red-600 text-white text-sm rounded-full">
                        ❌ Need 20,000 tokens to play
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-gray-400">
                  <Users className="w-5 h-5" />
                  <span>{scores.length}/{competition?.max_players || 4} players</span>
                </div>
                <button
                  onClick={onBack}
                  className="p-2 rounded bg-gray-700 text-white hover:bg-gray-600 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Player List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {scores.map((score) => (
                <div
                  key={score.id}
                  className={`p-4 rounded-lg border-2 ${
                    score.is_ready ? 'border-green-400 bg-green-400/10' : 'border-gray-600 bg-gray-800'
                  } ${score.player_wallet === playerWallet ? 'ring-2 ring-blue-400' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{score.player_name}</span>
                    <span className={`text-sm ${score.is_ready ? 'text-green-400' : 'text-red-400'}`}>
                      {score.is_ready ? '✓ Ready' : '⏳ Waiting'}
                    </span>
                  </div>
                  {score.player_wallet === playerWallet && (
                    <div className="text-xs text-blue-400 mt-1">You</div>
                  )}
                </div>
              ))}
            </div>

            {/* Game Instructions */}
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-bold text-green-400 mb-2">🎯 How to Play:</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Break as many bricks as possible in 60 seconds</li>
                <li>• Each brick = 10 points</li>
                <li>• Entry fee: 20,000 Chump Tokens 🪙</li>
                <li>• Winner takes all entry fees from other players!</li>
                <li>• Highest score wins 100 XP + bragging rights!</li>
                <li>• All participants get 25 XP</li>
                <li>• Level up to unlock new features!</li>
              </ul>
              {!competition?.id.startsWith('local-') && (
                <div className="mt-3 p-3 bg-yellow-600/20 border border-yellow-400/50 rounded-lg">
                  <div className="text-yellow-300 font-bold text-sm">💰 Token Economics:</div>
                  <div className="text-yellow-200 text-xs mt-1">
                    {scores.length} players × 20,000 tokens = {scores.length * 20000} total pot
                  </div>
                  <div className="text-yellow-200 text-xs">
                    Winner gets all {scores.length * 20000} tokens!
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-6 mb-4 flex-wrap">
              {/* 🚀 NEW: Start button only enabled when all players ready */}
              <button
                onClick={handleStartGame}
                disabled={!canStart}
                className={`px-12 py-4 font-bold text-lg rounded-lg transition-all transform hover:scale-105 shadow-lg ${
                  canStart 
                    ? 'bg-yellow-400 text-black hover:bg-yellow-300 animate-pulse cursor-pointer'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                }`}
              >
                {canStart ? '🚀 START COUNTDOWN!' : '⏳ WAITING FOR READY...'}
              </button>
              
              <button
                onClick={handleReady}
                className={`px-8 py-4 font-bold text-lg rounded-lg transition-all transform hover:scale-105 shadow-lg ${
                  isReady
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : 'bg-green-400 text-black hover:bg-green-300'
                }`}
              >
                {isReady ? '❌ Cancel Ready' : '✅ Ready to Play!'}
              </button>
            </div>

            {/* 🎯 NEW: Ready Status Display */}
            <div className="text-center mb-4">
              {canStart ? (
                <div className="text-green-400 font-bold text-lg animate-pulse">
                  🎉 ALL PLAYERS READY! Click START to begin countdown! 🎉
                </div>
              ) : scores.length > 0 ? (
                <div className="text-yellow-400">
                  Waiting for {scores.filter(s => !s.is_ready).length} player(s) to get ready...
                </div>
              ) : (
                <div className="text-gray-400">
                  Loading players...
                </div>
              )}
            </div>

            {/* Leaderboard Button */}
            <div className="flex justify-center">
              <button
                onClick={() => setShowLeaderboard(true)}
                className="px-6 py-3 bg-purple-600/20 border-2 border-purple-400/50 rounded-lg text-purple-400 font-bold hover:bg-purple-600/30 transition-all flex items-center gap-2"
              >
                <Trophy className="w-5 h-5" />
                🏆 VIEW LEADERBOARD
              </button>
            </div>

            {!canStart && scores.length >= 1 && (
              <p className="text-center text-gray-400 text-sm mt-4">
                Waiting for all players to be ready...
              </p>
            )}

            {scores.length < 1 && (
              <p className="text-center text-gray-400 text-sm mt-4">
                Loading competition... Please wait!
              </p>
            )}
          </div>
        </div>

        {/* Leaderboard Modal */}
        {showLeaderboard && (
          <Leaderboard
            onClose={() => setShowLeaderboard(false)}
            currentPlayer={{
              name: myScore?.player_name || `Player_${playerWallet.slice(0, 4)}`,
              wallet: playerWallet,
              score: myScore?.current_score || 0,
              bricksDestroyed: playerStats.bricksDestroyed,
              bossesDefeated: playerStats.bossesDefeated,
              maxStreak: playerStats.maxStreak,
              achievements: playerStats.achievements,
              level: playerStats.level
            }}
          />
        )}
      </div>
    );
  }

  // Active Game Screen
  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Game Header - Fixed Height */}
      <div className="bg-gray-900 border-b border-gray-700 p-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Clock className="w-6 h-6 text-red-400" />
            <span className="text-2xl font-bold text-red-400">{timeLeft}s</span>
          </div>
          
          <div className="text-center">
            <h1 className="text-lg font-bold text-green-400">🏆 LIVE COMPETITION</h1>
            {competition?.id.startsWith('local-') && (
              <div className="text-xs text-orange-400">🏠 LOCAL MODE</div>
            )}
          </div>
          
          <div className="text-right">
            <div className="text-lg font-bold text-white">
              Score: <span className="text-green-400">{myScore?.current_score || 0}</span>
            </div>
            <div className="text-sm text-gray-400">
              Bricks: <span className="text-yellow-400 font-bold">{myScore?.bricks_broken || 0}</span>
            </div>
            {/* Leaderboard Button */}
            <button
              onClick={() => setShowLeaderboard(true)}
              className="mt-1 px-2 py-1 bg-yellow-400/20 border border-yellow-400/50 rounded text-yellow-400 text-xs font-bold hover:bg-yellow-400/30 transition-colors flex items-center gap-1"
            >
              <Trophy className="w-3 h-3" />
              LEADERBOARD
            </button>
          </div>
        </div>
      </div>

      {/* Live Video Streams - Compact */}
      <div className="bg-gray-800 border-b border-gray-700 p-2 flex-shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          {/* Local Video */}
          <div className="relative bg-gray-900 rounded-lg aspect-video overflow-hidden">
            <div ref={localVideoRef} className="w-full h-full" />
            <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
              You ({myScore?.current_score || 0})
            </div>
            <div className="absolute top-1 right-1 flex gap-1">
              <button
                onClick={toggleVideo}
                className={`p-1 rounded ${isVideoEnabled ? 'bg-green-500' : 'bg-red-500'}`}
              >
                {isVideoEnabled ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
              </button>
              <button
                onClick={toggleAudio}
                className={`p-1 rounded ${isAudioEnabled ? 'bg-green-500' : 'bg-red-500'}`}
              >
                {isAudioEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Remote Users */}
          {remoteUsers.slice(0, 3).map((user) => (
            <div key={user.uid} className="relative bg-gray-900 rounded-lg aspect-video overflow-hidden">
              <div id={`remote-video-${user.uid}`} className="w-full h-full" />
              <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 py-1 rounded">
                {String(user.uid).slice(0, 4)}
              </div>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 3 - remoteUsers.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
              <span className="text-gray-500 text-xs">Waiting...</span>
            </div>
          ))}
        </div>

        {/* Live Leaderboard - Compact */}
        <div className="flex items-center justify-center gap-4 overflow-x-auto">
          {scores
            .sort((a, b) => b.current_score - a.current_score)
            .slice(0, 4).map((score, index) => {
              const displayScore = score.player_wallet === playerWallet 
                ? (myScore?.current_score || score.current_score || 0)
                : (score.current_score || 0);
              const displayBricks = score.player_wallet === playerWallet 
                ? (myScore?.bricks_broken || score.bricks_broken || 0)
                : (score.bricks_broken || 0);
              
              return (
                <div
                  key={score.id}
                  className={`text-center min-w-0 ${
                    score.player_wallet === playerWallet ? 'ring-2 ring-green-400 rounded-lg p-1' : ''
                  }`}
                >
                  <div className={`text-xs font-bold ${index === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    #{index + 1} {index === 0 ? '🏆' : ''}
                  </div>
                  <div className="font-bold text-white text-sm truncate">{score.player_name}</div>
                  <div className={`text-sm font-bold ${index === 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {displayScore}
                  </div>
                  <div className="text-xs text-gray-400">{displayBricks} bricks</div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Brick Game - Takes remaining space */}
      <div className="flex-1 overflow-hidden">
        <BrickWall
          playerWallet={playerWallet}
          onBrickBreak={handleBrickBreak}
          onGameWin={() => {}}
          onStatsUpdate={(stats) => setPlayerStats(stats)}
        />
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <Leaderboard
          onClose={() => setShowLeaderboard(false)}
          currentPlayer={{
            name: myScore?.player_name || `Player_${playerWallet.slice(0, 4)}`,
            wallet: playerWallet,
            score: myScore?.current_score || 0,
            bricksDestroyed: playerStats.bricksDestroyed,
            bossesDefeated: playerStats.bossesDefeated,
            maxStreak: playerStats.maxStreak,
            achievements: playerStats.achievements,
            level: playerStats.level
          }}
        />
      )}
    </div>
  );
}; 