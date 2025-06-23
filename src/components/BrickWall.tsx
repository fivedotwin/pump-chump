import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trophy, ChevronDown, Zap, Target, Flame, Sparkles, Star } from 'lucide-react';

interface Brick {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isBroken: boolean;
  isBreaking?: boolean; // 🆕 NEW: Breaking animation state
  brokenBy?: string;
  brokenAt?: number;
  opacity: number;
  glowIntensity: number;
  isAnimating?: boolean;
  isFalling?: boolean;
  targetY?: number;
}

interface PowerUp {
  id: string;
  type: 'fire' | 'multiball' | 'lightning' | 'grandstreak';
  x: number;
  y: number;
  width: number;
  height: number;
  isActive: boolean;
  spawnTime: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  target: number;
}

interface Boss {
  id: string;
  name: string;
  level: number;
  maxHP: number;
  currentHP: number;
  phase: number;
  maxPhases: number;
  isActive: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  lastAttack: number;
  attackCooldown: number;
  specialAbilities: string[];
  rewards: {
    coins: number;
    xp: number;
    powerUps: number;
  };
}

interface BrickWallProps {
  playerWallet: string;
  onBrickBreak?: (brickId: string, playerWallet: string) => void;
  onGameWin?: (winner: string) => void;
  onStatsUpdate?: (stats: {
    bricksDestroyed: number;
    bossesDefeated: number;
    maxStreak: number;
    achievements: number;
    level: number;
  }) => void;
}

export const BrickWall: React.FC<BrickWallProps> = ({ 
  playerWallet, 
  onBrickBreak,
  onGameWin,
  onStatsUpdate 
}) => {
  const [bricks, setBricks] = useState<Brick[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [totalBrokenBricks, setTotalBrokenBricks] = useState(0);
  const [selectedBrick, setSelectedBrick] = useState<string | null>(null);
  const [isBreaking, setIsBreaking] = useState(false);
  const [gameWinner, setGameWinner] = useState<string | null>(null);
  const [playerStats, setPlayerStats] = useState<Map<string, number>>(new Map());
  const [currentLevel, setCurrentLevel] = useState(0);
  const [isLevelTransition, setIsLevelTransition] = useState(false);

  // 🔥 ADDICTION FEATURES
  const [comboCount, setComboCount] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [activePowerUp, setActivePowerUp] = useState<string | null>(null);
  const [powerUpEndTime, setPowerUpEndTime] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [lastBreakTime, setLastBreakTime] = useState(0);
  
  // 🚀 GRAND STREAK SYSTEM
  const [grandStreakActive, setGrandStreakActive] = useState(false);
  const [lastComboMilestone, setLastComboMilestone] = useState(0);
  
  // 👹 BOSS BATTLE SYSTEM
  const [currentBoss, setCurrentBoss] = useState<Boss | null>(null);
  const [isBossBattle, setIsBossBattle] = useState(false);
  const [bossAttacking, setBossAttacking] = useState(false);
  const [bossRewards, setBossRewards] = useState<{coins: number, xp: number, powerUps: number} | null>(null);
  const [showBossRewards, setShowBossRewards] = useState(false);
  const [bossesDefeated, setBossesDefeated] = useState(0);
  
  const gameAreaRef = useRef<HTMLDivElement>(null);

  // Configuration - Mobile responsive brick sizing
  const TOTAL_BRICKS = 999999; // Effectively unlimited
  const BRICKS_PER_LEVEL = 50;
  const ROWS_PER_LEVEL = 5;
  const BRICKS_PER_ROW = 10;
  
  // 📱 MOBILE RESPONSIVE: Dynamic sizing based on screen width
  const [gameArea, setGameArea] = useState({ width: 800, height: 600 });
  const [isMobile, setIsMobile] = useState(false);
  
  // 📱 Calculate responsive brick dimensions
  const calculateBrickDimensions = () => {
    const containerWidth = gameArea.width;
    const containerHeight = gameArea.height;
    const isMobileDevice = containerWidth < 768;
    
    setIsMobile(isMobileDevice);
    
    // Mobile: Bigger bricks, fewer per row for better touch targets
    const bricksPerRow = isMobileDevice ? 6 : 10;
    const spacing = isMobileDevice ? 4 : 2;
    const brickWidth = Math.floor((containerWidth - (spacing * (bricksPerRow + 1))) / bricksPerRow);
    const brickHeight = isMobileDevice ? 50 : 35; // Bigger on mobile
    
    return {
      brickWidth,
      brickHeight,
      bricksPerRow,
      spacing,
      isMobile: isMobileDevice
    };
  };

  // 📱 Handle window resize for responsive design
  const handleResize = () => {
    if (gameAreaRef.current) {
      const rect = gameAreaRef.current.getBoundingClientRect();
      setGameArea({ 
        width: rect.width || 800, 
        height: rect.height || 600 
      });
    }
  };

  // 📱 Set up responsive sizing
  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize achievements
  useEffect(() => {
    setAchievements([
      { id: 'first_blood', title: 'First Blood', description: 'Break your first brick', icon: '🎯', unlocked: false, progress: 0, target: 1 },
      { id: 'combo_master', title: 'Combo Master', description: 'Get a 10x combo streak', icon: '🔥', unlocked: false, progress: 0, target: 10 },
      { id: 'speed_demon', title: 'Speed Demon', description: 'Break 20 bricks in 30 seconds', icon: '⚡', unlocked: false, progress: 0, target: 20 },
      { id: 'multiball_master', title: 'Multi-Ball Maniac', description: 'Use Multi-Ball power-up', icon: '🎱', unlocked: false, progress: 0, target: 1 },
      { id: 'fire_starter', title: 'Fire Starter', description: 'Use Fire Ball power-up', icon: '🔥', unlocked: false, progress: 0, target: 1 },
      { id: 'lightning_lord', title: 'Lightning Lord', description: 'Use Lightning Strike power-up', icon: '⚡', unlocked: false, progress: 0, target: 1 },
      { id: 'brick_destroyer', title: 'Brick Destroyer', description: 'Break 100 bricks total', icon: '💥', unlocked: false, progress: 0, target: 100 },
      { id: 'unstoppable', title: 'Unstoppable', description: 'Get a 25 streak', icon: '🚀', unlocked: false, progress: 0, target: 25 },
      { id: 'boss_slayer', title: 'Boss Slayer', description: 'Defeat your first boss', icon: '👹', unlocked: false, progress: 0, target: 1 },
      { id: 'boss_master', title: 'Boss Master', description: 'Defeat 5 bosses', icon: '💀', unlocked: false, progress: 0, target: 5 },
    ]);
  }, []);

  // Play sound effects
  const playSound = useCallback((type: 'break' | 'powerup' | 'combo' | 'achievement' | 'megacombo' | 'grandstreak') => {
    // Create audio context for Web Audio API sound synthesis
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      switch (type) {
        case 'break':
          // Satisfying brick break sound
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
          break;
          
        case 'powerup':
          // Exciting power-up pickup sound
          oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.2);
          gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.2);
          break;
          
        case 'combo':
          // Combo multiplier sound
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.15);
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.15);
          break;
          
        case 'megacombo':
          // 🎵 EPIC MEGA COMBO SOUND - Multi-frequency epic fanfare
          const frequencies = [523, 659, 784, 1047]; // C5, E5, G5, C6
          frequencies.forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.5, audioContext.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
            osc.start(audioContext.currentTime + i * 0.1);
            osc.stop(audioContext.currentTime + 0.8);
          });
          break;
          
        case 'grandstreak':
          // 🚀 GRAND STREAK SOUND - Epic ascending sequence
          for (let i = 0; i < 8; i++) {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.frequency.setValueAtTime(440 + i * 110, audioContext.currentTime + i * 0.05);
            gain.gain.setValueAtTime(0.6, audioContext.currentTime + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.0);
            osc.start(audioContext.currentTime + i * 0.05);
            osc.stop(audioContext.currentTime + 1.0);
          }
          break;
          
        case 'achievement':
          // Achievement unlock fanfare
          oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
          oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E5
          oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2); // G5
          gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.4);
          break;
      }
    } catch (error) {
      console.log('Audio not available:', error);
    }
  }, []);

  // Check and unlock achievements
  const checkAchievements = useCallback(() => {
    setAchievements(prev => {
      const updated = prev.map(achievement => {
        if (achievement.unlocked) return achievement;
        
        let currentProgress = achievement.progress;
        
        switch (achievement.id) {
          case 'first_blood':
            currentProgress = totalBrokenBricks > 0 ? 1 : 0;
            break;
          case 'combo_master':
            currentProgress = Math.max(currentProgress, comboCount);
            break;
          case 'speed_demon':
            // Track speed in a separate effect
            break;
          case 'multiball_master':
            // Will be updated when power-up is used
            break;
          case 'fire_starter':
            // Will be updated when power-up is used
            break;
          case 'lightning_lord':
            // Will be updated when power-up is used
            break;
          case 'brick_destroyer':
            currentProgress = totalBrokenBricks;
            break;
          case 'unstoppable':
            currentProgress = Math.max(currentProgress, streak);
            break;
          case 'boss_slayer':
            currentProgress = bossesDefeated;
            break;
          case 'boss_master':
            currentProgress = bossesDefeated;
            break;
        }
        
        const shouldUnlock = currentProgress >= achievement.target && !achievement.unlocked;
        
        if (shouldUnlock) {
          playSound('achievement');
          setNewAchievement({ ...achievement, unlocked: true, progress: currentProgress });
          setTimeout(() => setNewAchievement(null), 2000); // Shorter duration
        }
        
        return {
          ...achievement,
          progress: currentProgress,
          unlocked: shouldUnlock || achievement.unlocked
        };
      });
      
      return updated;
    });
  }, [totalBrokenBricks, comboCount, streak, bossesDefeated, playSound]);

  // Spawn power-ups randomly
  const spawnPowerUp = useCallback(() => {
    if (powerUps.length >= 2 || !gameAreaRef.current) return; // Max 2 power-ups at once
    
    const gameArea = gameAreaRef.current;
    const containerWidth = gameArea.clientWidth;
    const containerHeight = gameArea.clientHeight;
    
    const powerUpTypes: PowerUp['type'][] = ['fire', 'multiball', 'lightning'];
    const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    
    const powerUpSize = 40;
    const x = Math.random() * (containerWidth - powerUpSize);
    const y = Math.random() * (containerHeight - powerUpSize - 100) + 50; // Avoid top/bottom
    
    const newPowerUp: PowerUp = {
      id: `powerup-${Date.now()}`,
      type: randomType,
      x,
      y,
      width: powerUpSize,
      height: powerUpSize,
      isActive: true,
      spawnTime: Date.now()
    };
    
    setPowerUps(prev => [...prev, newPowerUp]);
    
    // Remove power-up after 10 seconds if not collected
    setTimeout(() => {
      setPowerUps(prev => prev.filter(p => p.id !== newPowerUp.id));
    }, 10000);
  }, [powerUps.length]);

  // 🚀 Spawn GRAND STREAK power-up (ultra powerful)
  const spawnGrandStreakPowerUp = useCallback(() => {
    if (!gameAreaRef.current) return;
    
    const gameArea = gameAreaRef.current;
    const containerWidth = gameArea.clientWidth;
    const containerHeight = gameArea.clientHeight;
    
    const powerUpSize = 60; // Bigger than regular power-ups
    const x = Math.random() * (containerWidth - powerUpSize);
    const y = Math.random() * (containerHeight - powerUpSize - 100) + 50;
    
    const grandPowerUp: PowerUp = {
      id: `grandstreak-${Date.now()}`,
      type: 'grandstreak',
      x,
      y,
      width: powerUpSize,
      height: powerUpSize,
      isActive: true,
      spawnTime: Date.now()
    };
    
    setPowerUps(prev => [...prev, grandPowerUp]);
    
    // Remove after 15 seconds (longer than regular power-ups)
    setTimeout(() => {
      setPowerUps(prev => prev.filter(p => p.id !== grandPowerUp.id));
    }, 15000);
  }, []);

  // Power-up spawning timer
  useEffect(() => {
    if (gameWinner || isLevelTransition) return;
    
    const spawnTimer = setInterval(() => {
      if (Math.random() < 0.3) { // 30% chance every interval
        spawnPowerUp();
      }
    }, 15000); // Check every 15 seconds
    
    return () => clearInterval(spawnTimer);
  }, [spawnPowerUp, gameWinner, isLevelTransition]);

  // Update combo multiplier based on streak + EPIC SOUND SYSTEM
  useEffect(() => {
    if (streak >= 25) setComboMultiplier(5);
    else if (streak >= 15) setComboMultiplier(4);
    else if (streak >= 10) setComboMultiplier(3);
    else if (streak >= 5) setComboMultiplier(2);
    else setComboMultiplier(1);
    
    // 🎵 EPIC COMBO SOUND MILESTONES
    if (streak > lastComboMilestone) {
      if (streak >= 50) {
        // 🚀 GRAND STREAK ACTIVATED!
        playSound('grandstreak');
        setGrandStreakActive(true);
        setLastComboMilestone(50);
        
        // Spawn special GRAND STREAK power-up
        if (powerUps.length < 3) { // Allow one extra for grand streak
          spawnGrandStreakPowerUp();
        }
      } else if (streak >= 30) {
        playSound('megacombo');
        setLastComboMilestone(30);
      } else if (streak >= 20) {
        playSound('megacombo');
        setLastComboMilestone(20);
      } else if (streak >= 15) {
        playSound('megacombo');
        setLastComboMilestone(15);
      } else if (streak >= 10) {
        playSound('megacombo');
        setLastComboMilestone(10);
      } else if (streak >= 5) {
        playSound('combo');
        setLastComboMilestone(5);
      }
    }
    
    // Reset milestone tracking if streak resets
    if (streak < lastComboMilestone) {
      setLastComboMilestone(0);
      setGrandStreakActive(false);
    }
     }, [streak, playSound, lastComboMilestone, powerUps.length, spawnGrandStreakPowerUp]);

  // Update achievements
  useEffect(() => {
    checkAchievements();
  }, [checkAchievements]);

  // Send stats updates to parent
  useEffect(() => {
    if (onStatsUpdate) {
      const unlockedAchievements = achievements.filter(a => a.unlocked).length;
      onStatsUpdate({
        bricksDestroyed: totalBrokenBricks,
        bossesDefeated: bossesDefeated,
        maxStreak: maxStreak,
        achievements: unlockedAchievements,
        level: currentLevel + 1
      });
    }
  }, [onStatsUpdate, totalBrokenBricks, bossesDefeated, maxStreak, achievements, currentLevel]);

  // Timer to update power-up countdown display
  useEffect(() => {
    if (!activePowerUp || powerUpEndTime === 0) return;
    
    const timer = setInterval(() => {
      if (Date.now() >= powerUpEndTime) {
        setActivePowerUp(null);
        setPowerUpEndTime(0);
        clearInterval(timer);
      }
    }, 100); // Update every 100ms for smooth countdown

    return () => clearInterval(timer);
  }, [activePowerUp, powerUpEndTime]);

  // Auto-spawn first power-up after 10 seconds
  useEffect(() => {
    if (totalBrokenBricks === 0) return;
    
    const initialSpawn = setTimeout(() => {
      spawnPowerUp();
    }, 10000);

    return () => clearTimeout(initialSpawn);
  }, [totalBrokenBricks, spawnPowerUp]);

  // 👹 Create Boss for boss levels (every 5th level)
  const createBoss = useCallback((level: number) => {
    if (!gameAreaRef.current) return null;
    
    const gameArea = gameAreaRef.current;
    const containerWidth = gameArea.clientWidth;
    const containerHeight = gameArea.clientHeight;
    
    // Boss gets stronger each time - BALANCED DIFFICULTY!
    const bossLevel = Math.floor(level / 5);
    const baseHP = 300 + (bossLevel * 150); // 300, 450, 600, 750... FAIR CHALLENGE!
    
    // Boss names based on level
    const bossNames = [
      "🔥 Fire Lord",
      "⚡ Thunder King", 
      "❄️ Ice Emperor",
      "🌪️ Storm Master",
      "💀 Shadow Lord",
      "🌟 Cosmic Titan",
      "🐉 Dragon King",
      "👑 Ultimate Boss"
    ];
    
    const boss: Boss = {
      id: `boss-${level}`,
      name: bossNames[Math.min(bossLevel - 1, bossNames.length - 1)] || "👹 Mega Boss",
      level: level,
      maxHP: baseHP,
      currentHP: baseHP,
      phase: 1,
      maxPhases: Math.min(3, Math.ceil(bossLevel / 2)), // 1-3 phases
      isActive: true,
      x: containerWidth / 2 - 150, // Center horizontally
      y: 100, // Top area
      width: 300, // Much bigger than regular bricks
      height: 120,
      lastAttack: 0,
      attackCooldown: 4000, // 4 seconds between attacks - BALANCED!
      specialAbilities: [
        'meteor_shower',
        'lightning_strike', 
        'heal_bricks',
        'spawn_minions'
      ],
      rewards: {
        coins: 2000 + (bossLevel * 1000), // 2k, 3k, 4k... BALANCED REWARDS!
        xp: 800 + (bossLevel * 400), // 800, 1200, 1600... FAIR XP!
        powerUps: 3 + Math.floor(bossLevel / 2) // 3, 3, 4, 4... Reasonable power-ups!
      }
    };
    
    return boss;
  }, []);

  // 👹 Boss Attack System
  const performBossAttack = useCallback(() => {
    if (!currentBoss || !currentBoss.isActive || bossAttacking) return;
    
    setBossAttacking(true);
    const now = Date.now();
    
    if (now - currentBoss.lastAttack < currentBoss.attackCooldown) return;
    
    // Random boss attack
    const attacks = ['meteor_shower', 'lightning_strike', 'heal_bricks'];
    const randomAttack = attacks[Math.floor(Math.random() * attacks.length)];
    
    console.log(`👹 Boss using ${randomAttack}!`);
    
    switch (randomAttack) {
      case 'meteor_shower':
        // 🌧️ METEOR SHOWER - Removes some power-ups
        if (powerUps.length > 0) {
          setPowerUps(prev => prev.slice(0, Math.max(1, prev.length - 2))); // Remove max 2 power-ups
        }
        setStreak(prev => Math.max(0, prev - 3)); // Reduce streak by 3
        playSound('achievement'); // Epic sound for boss attack
        console.log('👹 Boss used METEOR SHOWER! Some power-ups lost!');
        break;
        
      case 'lightning_strike':
        // ⚡ LIGHTNING STRIKE - Minor penalties
        if (powerUps.length > 0 && Math.random() < 0.5) {
          setPowerUps(prev => prev.slice(1)); // Remove 1 power-up randomly
        }
        setTotalScore(prev => Math.max(0, prev - 50)); // Reduce score by 50
        playSound('megacombo');
        console.log('👹 Boss used LIGHTNING STRIKE! Minor damage!');
        break;
        
      case 'heal_bricks':
        // 💚 HEAL - Boss heals moderate amount
        const healPercent = currentBoss.phase === 1 ? 0.1 : currentBoss.phase === 2 ? 0.12 : 0.15;
        const healAmount = Math.floor(currentBoss.maxHP * healPercent);
        setCurrentBoss(prev => prev ? {
          ...prev,
          currentHP: Math.min(prev.maxHP, prev.currentHP + healAmount)
        } : null);
        playSound('powerup');
        console.log(`👹 Boss used HEAL! Restored ${healAmount} HP!`);
        break;
    }
    
    // Update boss last attack time
    setCurrentBoss(prev => prev ? {
      ...prev,
      lastAttack: now
    } : null);
    
    setTimeout(() => setBossAttacking(false), 1000);
  }, [currentBoss, bossAttacking, powerUps, playSound]);

  // Boss attack timer
  useEffect(() => {
    if (!currentBoss || !currentBoss.isActive || gameWinner) return;
    
    const attackTimer = setInterval(() => {
      performBossAttack();
    }, 5000); // Boss attacks every 5 seconds - BALANCED!
    
    return () => clearInterval(attackTimer);
  }, [currentBoss, performBossAttack, gameWinner]);

  // Handle power-up collection
  const collectPowerUp = useCallback((powerUpId: string) => {
    const powerUp = powerUps.find(p => p.id === powerUpId);
    if (!powerUp || !powerUp.isActive) return;
    
    playSound('powerup');
    setActivePowerUp(powerUp.type);
    // Grand streak power-up lasts longer
    const duration = powerUp.type === 'grandstreak' ? 20000 : 10000; // 20 seconds for grand streak, 10 for others
    setPowerUpEndTime(Date.now() + duration);
    
    // Update achievements
    setAchievements(prev => prev.map(achievement => {
      if (achievement.id === `${powerUp.type === 'fire' ? 'fire_starter' : powerUp.type === 'multiball' ? 'multiball_master' : powerUp.type === 'grandstreak' ? 'unstoppable' : 'lightning_lord'}`) {
        return { ...achievement, progress: 1 };
      }
      return achievement;
    }));
    
    // Remove collected power-up
    setPowerUps(prev => prev.filter(p => p.id !== powerUpId));
    
    // Auto-deactivate after duration
    setTimeout(() => {
      setActivePowerUp(null);
      setPowerUpEndTime(0);
    }, duration);
  }, [powerUps, playSound]);

  // Apply power-up effects
  const applyPowerUpEffect = useCallback((brickId: string) => {
    if (!activePowerUp) return [brickId];
    
    const brick = bricks.find(b => b.id === brickId);
    if (!brick) return [brickId];
    
    switch (activePowerUp) {
      case 'fire':
        // Fire Ball: Destroy 3 bricks in a line
        const fireBricks = bricks
          .filter(b => !b.isBroken && Math.abs(b.y - brick.y) < 10)
          .sort((a, b) => Math.abs(a.x - brick.x) - Math.abs(b.x - brick.x))
          .slice(0, 3)
          .map(b => b.id);
        return fireBricks;
        
      case 'multiball':
        // Multi-Ball: Destroy 3 random nearby bricks
        const nearbyBricks = bricks
          .filter(b => !b.isBroken && b.id !== brickId)
          .filter(b => Math.abs(b.x - brick.x) < 150 && Math.abs(b.y - brick.y) < 150)
          .sort(() => Math.random() - 0.5)
          .slice(0, 2)
          .map(b => b.id);
        return [brickId, ...nearbyBricks];
        
      case 'lightning':
        // Lightning Strike: Destroy 5 random bricks anywhere
        const randomBricks = bricks
          .filter(b => !b.isBroken && b.id !== brickId)
          .sort(() => Math.random() - 0.5)
          .slice(0, 4)
          .map(b => b.id);
        return [brickId, ...randomBricks];
        
      case 'grandstreak':
        // 🚀 GRAND STREAK: Destroy entire row + column (ULTRA POWERFUL)
        const clickedBrick = bricks.find(b => b.id === brickId);
        if (!clickedBrick) return [brickId];
        
        const gameArea = gameAreaRef.current;
        const containerWidth = gameArea?.clientWidth || window.innerWidth;
        const baseWidth = containerWidth / BRICKS_PER_ROW;
        const minBrickWidth = 60;
        const maxBrickWidth = 150;
        const brickWidth = Math.max(minBrickWidth, Math.min(maxBrickWidth, Math.floor(baseWidth)));
        const totalGridWidth = brickWidth * BRICKS_PER_ROW;
        const gridOffsetX = Math.max(0, (containerWidth - totalGridWidth) / 2);
        
        const clickedCol = Math.round((clickedBrick.x - gridOffsetX) / brickWidth);
        const clickedRow = Math.round((clickedBrick.y - 50) / clickedBrick.height); // Approximate row
        
        // Get entire row and column
        const rowAndColumnBricks = bricks
          .filter(b => !b.isBroken)
          .filter(b => {
            const brickCol = Math.round((b.x - gridOffsetX) / brickWidth);
            const brickRow = Math.round((b.y - 50) / b.height);
            return brickCol === clickedCol || brickRow === clickedRow;
          })
          .map(b => b.id);
          
        return rowAndColumnBricks;
        
      default:
        return [brickId];
    }
  }, [activePowerUp, bricks]);

  // 📱 Generate current level's bricks - MOBILE OPTIMIZED RESPONSIVE GRID
  const generateLevelBricks = useCallback((level: number) => {
    const newBricks: Brick[] = [];
    const startBrickIndex = level * BRICKS_PER_LEVEL;
    const endBrickIndex = Math.min(startBrickIndex + BRICKS_PER_LEVEL, TOTAL_BRICKS);
    
    // 📱 Use responsive brick calculations
    const { brickWidth, brickHeight, bricksPerRow, spacing, isMobile: isMobileDevice } = calculateBrickDimensions();
    
    // Calculate total grid dimensions with spacing
    const totalGridWidth = (brickWidth * bricksPerRow) + (spacing * (bricksPerRow - 1));
    const totalGridHeight = (brickHeight * ROWS_PER_LEVEL) + (spacing * (ROWS_PER_LEVEL - 1));
    
    // Center the grid both horizontally and vertically
    const gridOffsetX = Math.max(0, (gameArea.width - totalGridWidth) / 2);
    const gridOffsetY = Math.max(spacing, (gameArea.height - totalGridHeight) / 2);
    
    let brickCount = 0;
    
    console.log(`📱 Generating bricks for level ${level + 1}:`, {
      isMobile: isMobileDevice,
      brickSize: `${brickWidth}x${brickHeight}`,
      bricksPerRow,
      spacing,
      gridSize: `${totalGridWidth}x${totalGridHeight}`,
      gridOffset: `${gridOffsetX},${gridOffsetY}`
    });
    
    for (let row = 0; row < ROWS_PER_LEVEL && startBrickIndex + brickCount < endBrickIndex; row++) {
      for (let col = 0; col < bricksPerRow && startBrickIndex + brickCount < endBrickIndex; col++) {
        // 📱 Perfect responsive grid with spacing
        const x = gridOffsetX + (col * (brickWidth + spacing));
        const y = gridOffsetY + (row * (brickHeight + spacing));
        
        newBricks.push({
          id: `brick-${startBrickIndex + brickCount}`,
          x,
          y,
          targetY: y,
          width: brickWidth,
          height: brickHeight,
          isBroken: false,
          opacity: 0.9 + Math.random() * 0.1,
          glowIntensity: 0.6 + Math.random() * 0.4,
          isAnimating: false,
          isFalling: false
        });
        
        brickCount++;
      }
    }
    
    console.log(`✅ Generated ${newBricks.length} bricks for level ${level + 1}`);
    return newBricks;
  }, [calculateBrickDimensions, gameArea.width, gameArea.height]);

  // Apply gravity physics to make bricks fall down automatically
  const applyGravityPhysics = useCallback(() => {
    setBricks(prevBricks => {
      return prevBricks.map(brick => {
        if (brick.isBroken || !brick.isFalling) return brick;
        
        // Get current container dimensions
        const gameArea = gameAreaRef.current;
        const containerWidth = gameArea?.clientWidth || window.innerWidth;
        const containerHeight = gameArea?.clientHeight || Math.max(window.innerHeight - 300, 300);
        
        // Calculate current brick sizing (same logic as generateLevelBricks)
        const baseWidth = containerWidth / BRICKS_PER_ROW;
        const minBrickWidth = 60;
        const maxBrickWidth = 150;
        const brickWidth = Math.max(minBrickWidth, Math.min(maxBrickWidth, Math.floor(baseWidth)));
        
        const totalGridWidth = brickWidth * BRICKS_PER_ROW;
        const gridOffsetX = Math.max(0, (containerWidth - totalGridWidth) / 2);
        
        // Calculate which column this brick is in
        const brickCol = Math.round((brick.x - gridOffsetX) / brickWidth);
        
        // Find the lowest available position for this brick
        let lowestAvailableY = brick.targetY || brick.y;
        
        // Check for bricks below in the same column
        const bricksBelow = prevBricks.filter(otherBrick => {
          if (otherBrick.id === brick.id || otherBrick.isBroken) return false;
          
          const otherCol = Math.round((otherBrick.x - gridOffsetX) / brickWidth);
          return otherCol === brickCol && otherBrick.y > brick.y && !otherBrick.isFalling;
        });
        
        // If there are bricks below, stack on top of the highest one
        if (bricksBelow.length > 0) {
          const highestBrickBelow = bricksBelow.reduce((highest, current) => 
            current.y < highest.y ? current : highest
          );
          lowestAvailableY = highestBrickBelow.y - brick.height;
        }
        
        // Apply gravity - move brick down towards its target position
        if (brick.y < lowestAvailableY) {
          const fallSpeed = 8; // Pixels per frame
          const newY = Math.min(brick.y + fallSpeed, lowestAvailableY);
          
          return {
            ...brick,
            y: newY,
            isFalling: newY < lowestAvailableY,
            isAnimating: newY < lowestAvailableY
          };
        }
        
        return {
          ...brick,
          isFalling: false,
          isAnimating: false
        };
      });
    });
  }, []);

  // Gravity animation loop
  useEffect(() => {
    const gravityInterval = setInterval(() => {
      applyGravityPhysics();
    }, 16); // ~60fps

    return () => clearInterval(gravityInterval);
  }, [applyGravityPhysics]);

  // Initialize first level - wait for ref to be available
  useEffect(() => {
    if (!gameAreaRef.current) return;
    
    console.log('Initializing first level...');
    const initialBricks = generateLevelBricks(0);
    setBricks(initialBricks);
  }, [generateLevelBricks]);

  // Handle window resize to regenerate bricks
  useEffect(() => {
    const handleResize = () => {
      if (!gameAreaRef.current) return;
      
      console.log('Window resized, regenerating bricks...');
      // Small delay to ensure dimensions are updated
      setTimeout(() => {
        const updatedBricks = generateLevelBricks(currentLevel);
        setBricks(updatedBricks);
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [generateLevelBricks, currentLevel]);

  // Trigger initialization once component is mounted and ref is available
  useEffect(() => {
    if (gameAreaRef.current && bricks.length === 0) {
      console.log('Game area ref available, initializing bricks...');
      const initialBricks = generateLevelBricks(0);
      setBricks(initialBricks);
    }
  }, [generateLevelBricks, bricks.length]);

  // Debug: Log bricks state
  useEffect(() => {
    console.log(`Current bricks count: ${bricks.length}, Active: ${bricks.filter(b => !b.isBroken).length}`);
  }, [bricks]);

  // Check if current level is complete and load next level OR boss battle
  useEffect(() => {
    const activeBricks = bricks.filter(b => !b.isBroken);
    const totalBricks = bricks.length;
    
    console.log(`🎮 Level Check: Active: ${activeBricks.length}, Total: ${totalBricks}, Level: ${currentLevel + 1}, Transitioning: ${isLevelTransition}, Winner: ${!!gameWinner}, Boss: ${!!currentBoss}`);
    
    // Skip if boss battle is active
    if (currentBoss && currentBoss.isActive) return;
    
    if (activeBricks.length === 0 && totalBricks > 0 && !isLevelTransition && !gameWinner) {
      console.log(`🎯 Level ${currentLevel + 1} completed! Starting transition...`);
      const nextLevel = currentLevel + 1;
      const nextLevelStartIndex = nextLevel * BRICKS_PER_LEVEL;
      
      if (nextLevelStartIndex < TOTAL_BRICKS) {
        setIsLevelTransition(true);
        
        // 👹 CHECK FOR BOSS LEVEL (every 5th level)
        const isBossLevel = (nextLevel + 1) % 5 === 0; // Levels 5, 10, 15, etc.
        
        if (isBossLevel) {
          console.log(`👹 BOSS LEVEL ${nextLevel + 1}! Spawning boss...`);
          
        setTimeout(() => {
            const boss = createBoss(nextLevel + 1);
            if (boss) {
              setCurrentBoss(boss);
              setIsBossBattle(true);
              // Generate regular bricks but fewer for boss battle
              const bossLevelBricks = generateLevelBricks(nextLevel).slice(0, 20); // Only 20 bricks during boss
              setBricks(bossLevelBricks);
              setCurrentLevel(nextLevel);
              setIsLevelTransition(false);
              console.log(`👹 Boss battle started: ${boss.name}!`);
            }
          }, 2000);
        } else {
          console.log(`🚀 Loading next level: ${nextLevel + 1}`);
          
          setTimeout(() => {
            if (gameAreaRef.current) {
              console.log(`📦 Generating bricks for level ${nextLevel + 1}...`);
          const newBricks = generateLevelBricks(nextLevel);
          setBricks(newBricks);
          setCurrentLevel(nextLevel);
          setIsLevelTransition(false);
              console.log(`✅ Level ${nextLevel + 1} loaded with ${newBricks.length} bricks`);
            } else {
              console.error('❌ Game area ref not available during transition');
            }
          }, 2000);
        }
      } else {
        // Game completed!
        console.log(`🏆 Game completed after ${currentLevel + 1} levels!`);
        setGameWinner(playerWallet);
        onGameWin?.(playerWallet);
      }
    }
  }, [bricks, currentLevel, isLevelTransition, gameWinner, generateLevelBricks, playerWallet, onGameWin, currentBoss, createBoss]);

  // Handle brick breaking with gravity effect + ADDICTION FEATURES
  const breakBrick = useCallback(async (brickId: string) => {
    if (isBreaking || gameWinner || isLevelTransition) return;
    
    console.log(`Breaking brick: ${brickId}`);
    setIsBreaking(true);
    setSelectedBrick(brickId);
    
    // 🔥 APPLY POWER-UP EFFECTS
    const bricksToBreak = applyPowerUpEffect(brickId);
    console.log(`🎯 Breaking ${bricksToBreak.length} bricks:`, bricksToBreak);
    
    // 🔊 PLAY SOUND EFFECT
    playSound('break');
    
    // 🎬 Start breaking animation for all affected bricks
    setBricks(prevBricks => prevBricks.map(brick => 
      bricksToBreak.includes(brick.id) && !brick.isBroken
        ? { ...brick, isBreaking: true }
        : brick
    ));
    
    // Wait for breaking animation to play
    await new Promise(resolve => setTimeout(resolve, 400)); // Increased duration for better visual effect
    
    setBricks(prevBricks => {
      // Get current container dimensions
      const gameArea = gameAreaRef.current;
      const containerWidth = gameArea?.clientWidth || window.innerWidth;
      const containerHeight = gameArea?.clientHeight || Math.max(window.innerHeight - 300, 300);
      
      // Calculate current brick sizing (same logic as generateLevelBricks)
      const baseWidth = containerWidth / BRICKS_PER_ROW;
      const minBrickWidth = 60;
      const maxBrickWidth = 150;
      const brickWidth = Math.max(minBrickWidth, Math.min(maxBrickWidth, Math.floor(baseWidth)));
      
      const totalGridWidth = brickWidth * BRICKS_PER_ROW;
      const gridOffsetX = Math.max(0, (containerWidth - totalGridWidth) / 2);
      
              return prevBricks.map(brick => {
          // Break multiple bricks if power-up is active
          if (bricksToBreak.includes(brick.id) && !brick.isBroken) {
            // When a brick breaks, make bricks above it fall down
            const brokenBrickCol = Math.round((brick.x - gridOffsetX) / brickWidth);
            
            // Mark bricks above as falling
            prevBricks.forEach(otherBrick => {
              if (otherBrick.isBroken) return;
              
              const otherCol = Math.round((otherBrick.x - gridOffsetX) / brickWidth);
              
              // If brick is in same column and above the broken brick, make it fall
              if (otherCol === brokenBrickCol && otherBrick.y < brick.y) {
                otherBrick.isFalling = true;
                otherBrick.isAnimating = true;
              }
            });
            
            return {
              ...brick,
              isBroken: true,
              isBreaking: false, // 🎬 Clear breaking animation
              brokenBy: playerWallet,
              brokenAt: Date.now()
            };
          }
          return brick;
        });
    });
    
    // 🎯 UPDATE COMBO/STREAK SYSTEM
    const currentTime = Date.now();
    const timeSinceLastBreak = currentTime - lastBreakTime;
    
    if (timeSinceLastBreak < 3000) { // 3 seconds to maintain streak
      setStreak(prev => {
        const newStreak = prev + bricksToBreak.length;
        setMaxStreak(current => Math.max(current, newStreak));
        return newStreak;
      });
    } else {
      setStreak(bricksToBreak.length); // Reset streak
    }
    
    setLastBreakTime(currentTime);
    setComboCount(prev => prev + bricksToBreak.length);
    
    // 💯 UPDATE SCORE WITH MULTIPLIER
    const basePoints = bricksToBreak.length * 10;
    const bonusPoints = basePoints * (comboMultiplier - 1);
    const totalPoints = basePoints + bonusPoints;
    
    setTotalScore(prev => prev + totalPoints);
    
    // Update stats
    setPlayerStats(prev => {
      const newStats = new Map(prev);
      const currentCount = newStats.get(playerWallet) || 0;
      newStats.set(playerWallet, currentCount + bricksToBreak.length);
      return newStats;
    });
    
    setTotalBrokenBricks(prev => prev + bricksToBreak.length);
    
    // Call original callback for each brick
    bricksToBreak.forEach(breakBrickId => {
      onBrickBreak?.(breakBrickId, playerWallet);
    });
    
    setIsBreaking(false);
    setSelectedBrick(null);
  }, [isBreaking, gameWinner, isLevelTransition, playerWallet, onBrickBreak, applyPowerUpEffect, playSound, comboMultiplier, lastBreakTime]);

  // 👹 Handle Boss Click/Damage
  const handleBossClick = useCallback(() => {
    if (!currentBoss || !currentBoss.isActive || isBreaking) return;
    
    console.log(`👹 Attacking boss: ${currentBoss.name}`);
    setIsBreaking(true);
    
    // Calculate damage (BALANCED for fun boss fights)
    let baseDamage = 8 + Math.floor(comboMultiplier * 2); // Reasonable base damage
    
    // 🛡️ BALANCED BOSS ARMOR SYSTEM - Some reduction but not overwhelming
    const armorReduction = currentBoss.phase === 1 ? 0.8 : currentBoss.phase === 2 ? 0.7 : 0.6; // Moderate armor
    baseDamage = Math.floor(baseDamage * armorReduction);
    
    const maxDamagePerHit = 35; // Reasonable damage cap
    const damage = Math.max(2, Math.min(baseDamage, maxDamagePerHit)); // Minimum 2 damage
    const newHP = Math.max(0, currentBoss.currentHP - damage);
    
    console.log(`👹 Boss hit for ${damage} damage! (${currentBoss.currentHP} → ${newHP} HP)`);
    
    // Play attack sound
    playSound('break');
    
    // Update boss HP
    setCurrentBoss(prev => prev ? {
      ...prev,
      currentHP: newHP
    } : null);
    
    // Update combo system
    const currentTime = Date.now();
    const timeSinceLastBreak = currentTime - lastBreakTime;
    
    if (timeSinceLastBreak < 3000) {
      setStreak(prev => {
        const newStreak = prev + 1;
        setMaxStreak(current => Math.max(current, newStreak));
        return newStreak;
      });
    } else {
      setStreak(1);
    }
    
    setLastBreakTime(currentTime);
    setTotalScore(prev => prev + damage * 10); // Boss hits worth 10x more points!
    
    // Check if boss is defeated
    if (newHP <= 0) {
      console.log(`👹 Boss defeated! ${currentBoss.name} has fallen!`);
      setCurrentBoss(prev => prev ? { ...prev, isActive: false } : null);
      setIsBossBattle(false);
      
      // 💰 MASSIVE BOSS DEFEAT BONUS POINTS!
      const bossDefeatBonus = currentBoss.maxHP * 100; // 100 points per max HP! (Doubled!)
      const comboBonus = bossDefeatBonus * comboMultiplier; // Apply combo multiplier!
      const levelBonus = currentLevel * 1000; // 1000 bonus per level!
      const totalBossBonus = bossDefeatBonus + comboBonus + levelBonus;
      setTotalScore(prev => prev + totalBossBonus);
      console.log(`🏆 BOSS DEFEAT BONUS: +${totalBossBonus.toLocaleString()} points!`);
      
      // Update boss defeat counter and track for max streak
      setBossesDefeated(prev => {
        const newCount = prev + 1;
        console.log(`👹 Boss defeats updated: ${newCount}`);
        return newCount;
      });
      
      // Update max streak when boss is defeated
      if (streak > maxStreak) {
        setMaxStreak(streak);
        console.log(`🔥 New max streak record: ${streak}`);
      }
      
      // Show boss rewards
      setBossRewards(currentBoss.rewards);
      setShowBossRewards(true);
      playSound('grandstreak'); // Epic victory sound
      
      // Hide rewards after 3 seconds and continue to next level
      setTimeout(() => {
        setShowBossRewards(false);
        setBossRewards(null);
        setCurrentBoss(null);
        
        // Continue to next regular level
        const nextLevel = currentLevel + 1;
        if (gameAreaRef.current) {
          const newBricks = generateLevelBricks(nextLevel);
          setBricks(newBricks);
          setCurrentLevel(nextLevel);
        }
      }, 3000); // Shorter duration
    } else {
      // Check for phase transitions (every 33% HP)
      const hpPercent = (newHP / currentBoss.maxHP) * 100;
      const newPhase = Math.ceil((100 - hpPercent) / 33) + 1;
      
      if (newPhase > currentBoss.phase && newPhase <= currentBoss.maxPhases) {
        console.log(`👹 Boss entering phase ${newPhase}!`);
        setCurrentBoss(prev => prev ? { ...prev, phase: newPhase } : null);
        playSound('megacombo'); // Phase transition sound
      }
    }
    
    setTimeout(() => setIsBreaking(false), 300);
  }, [currentBoss, isBreaking, comboMultiplier, playSound, lastBreakTime, currentLevel, generateLevelBricks]);

  // Handle brick click/tap
  const handleBrickClick = (brickId: string) => {
    console.log('🔍 BRICK CLICK DEBUG:', {
      brickId,
      totalBricks: bricks.length,
      isBreaking,
      gameWinner,
      isLevelTransition,
      playerWallet
    });
    
    const brick = bricks.find(b => b.id === brickId);
    console.log('🔍 Found brick:', brick);
    
    if (!brick) {
      console.log('❌ Brick not found!');
      return;
    }
    
    if (brick.isBroken) {
      console.log('❌ Brick already broken!');
      return;
    }
    
    if (isBreaking) {
      console.log('❌ Already breaking another brick!');
      return;
    }
    
    if (gameWinner) {
      console.log('❌ Game is over, winner exists!');
      return;
    }
    
    if (isLevelTransition) {
      console.log('❌ Level transition in progress!');
      return;
    }
    
    console.log('✅ All checks passed, calling breakBrick...');
    breakBrick(brickId);
  };

  const progress = TOTAL_BRICKS > 0 ? (totalBrokenBricks / TOTAL_BRICKS) * 100 : 0;
  const activeBricks = bricks.filter(b => !b.isBroken);

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-gray-900 via-gray-800 to-black overflow-hidden flex flex-col">
      {/* Game Stats Header - Compact */}
      <div className="bg-black/95 backdrop-blur-sm p-2 border-b border-gray-600 flex-shrink-0 z-20">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded overflow-hidden border border-green-400/50 bg-gray-800 flex-shrink-0">
                <img 
                  src="https://i.imgur.com/RdENATy.png" 
                  alt="Pump Chump" 
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-green-400 font-bold text-sm">Chip Away to Win!</span>
            </div>
            <div className="text-white">
              {isBossBattle && currentBoss ? (
                <>
                  <span className="text-red-400 font-bold animate-pulse">👹 BOSS BATTLE</span>
                  <span className="text-gray-400 mx-2">•</span>
                  <span className="text-purple-400 font-bold">{currentBoss.name}</span>
                </>
              ) : (
                <>
                  <span className="text-yellow-400 font-bold">Stage {currentLevel + 1}</span>
                  <span className="text-gray-400 mx-2">•</span>
              <span className="text-green-400 font-bold">{totalBrokenBricks.toLocaleString()}</span>
                  <span className="text-gray-400 text-xs"> broken</span>
                </>
              )}
            </div>
            
            {/* 🔥 COMBO DISPLAY */}
            {streak > 1 && (
              <div className="flex items-center gap-1 bg-orange-500/20 border border-orange-400/50 rounded px-2 py-1">
                <Flame className="w-3 h-3 text-orange-400" />
                <span className="text-orange-400 font-bold text-xs">{streak}x STREAK!</span>
          </div>
            )}
            
            {/* 💥 MULTIPLIER DISPLAY */}
            {comboMultiplier > 1 && (
              <div className="flex items-center gap-1 bg-purple-500/20 border border-purple-400/50 rounded px-2 py-1">
                <Star className="w-3 h-3 text-purple-400" />
                <span className="text-purple-400 font-bold text-xs">{comboMultiplier}x COMBO!</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {gameWinner && (
              <div className="flex items-center gap-2 text-yellow-400 animate-pulse">
                <Trophy className="w-4 h-4" />
                <span className="font-bold text-sm">WINNER!</span>
              </div>
            )}
            
            {/* 💯 ENHANCED SCORE DISPLAY */}
            <div className="text-white">
              <span className="text-gray-400 text-xs">Score:</span> 
              <span className="text-green-400 font-bold">{totalScore.toLocaleString()}</span>
              {comboMultiplier > 1 && (
                <span className="text-purple-400 text-xs ml-1">(x{comboMultiplier})</span>
              )}
            </div>
            
            {/* 🎯 ACHIEVEMENTS COUNTER */}
            <div className="flex items-center gap-1">
              <Trophy className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-400 text-xs">{achievements.filter(a => a.unlocked).length}/{achievements.length}</span>
            </div>
          </div>
        </div>
        
        {/* ⚡ ACTIVE POWER-UP INDICATOR */}
        {activePowerUp && (
          <div className="mt-1 flex items-center justify-center">
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/50 rounded-full px-3 py-1 flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              <span className="text-yellow-400 font-bold text-xs uppercase">
                {activePowerUp === 'fire' ? '🔥 FIRE BALL' : 
                 activePowerUp === 'multiball' ? '🎯 MULTI-BALL' : 
                 activePowerUp === 'grandstreak' ? '🚀 GRAND STREAK' :
                 '⚡ LIGHTNING'} ACTIVE!
              </span>
              <span className="text-yellow-300 text-xs">
                {Math.max(0, Math.ceil((powerUpEndTime - Date.now()) / 1000))}s
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Brick Wall - Takes remaining space */}
      <div className="flex-1 relative overflow-hidden" ref={gameAreaRef}>
        <div 
          className="absolute inset-0 w-full h-full"
          style={{ cursor: gameWinner || isLevelTransition ? 'default' : 'crosshair' }}
        >

          
          {/* 👹 RENDER BOSS */}
          {currentBoss && currentBoss.isActive && (
            <div
              className="absolute border-4 border-red-500 rounded-lg cursor-pointer z-40 transition-all duration-300"
              style={{
                left: `${currentBoss.x}px`,
                top: `${currentBoss.y}px`,
                width: `${currentBoss.width}px`,
                height: `${currentBoss.height}px`,
                background: currentBoss.phase === 1 
                  ? 'linear-gradient(135deg, #8B0000, #FF0000, #FF4500)' 
                  : currentBoss.phase === 2
                  ? 'linear-gradient(135deg, #4B0082, #8B008B, #FF1493)'
                  : 'linear-gradient(135deg, #000000, #FF0000, #FFD700)',
                boxShadow: bossAttacking 
                  ? '0 0 50px rgba(255, 0, 0, 1.0)' 
                  : `0 0 30px rgba(255, 0, 0, 0.8)`,
                transform: bossAttacking ? 'scale(1.1)' : 'scale(1)',
                animation: 'pulse 2s infinite'
              }}
              onClick={handleBossClick}
            >
              {/* Boss Face */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-6xl animate-bounce">
                  {currentBoss.phase === 1 ? '👹' : currentBoss.phase === 2 ? '😈' : '💀'}
                </div>
              </div>
              
              {/* Boss Name */}
              <div className="absolute -top-8 left-0 right-0 text-center">
                <span className="text-red-300 font-bold text-lg bg-black/80 px-2 rounded">
                  {currentBoss.name}
                </span>
              </div>
              
              {/* Phase Indicator */}
              {currentBoss.maxPhases > 1 && (
                <div className="absolute -top-14 right-0">
                  <span className="text-purple-300 font-bold text-sm bg-purple-900/80 px-2 rounded">
                    Phase {currentBoss.phase}/{currentBoss.maxPhases}
                  </span>
            </div>
          )}
              
              {/* Boss HP Bar */}
              <div className="absolute -bottom-12 left-0 right-0">
                <div className="bg-gray-800 border-2 border-red-400 rounded-full h-4 mx-2">
                  <div 
                    className="bg-gradient-to-r from-red-500 to-red-300 h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${(currentBoss.currentHP / currentBoss.maxHP) * 100}%` 
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                    {currentBoss.currentHP} / {currentBoss.maxHP} HP
                  </div>
                </div>
              </div>
              
              {/* Attack Effect */}
              {bossAttacking && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-4xl animate-ping">💥</div>
                  <div className="absolute text-2xl animate-bounce">⚡</div>
                </div>
              )}
            </div>
          )}

          {/* 🎁 RENDER POWER-UPS */}
          {powerUps.map((powerUp) => (
            <div
              key={powerUp.id}
              className="absolute border-2 border-yellow-400 rounded-full cursor-pointer z-30 animate-pulse hover:scale-110 transition-transform"
              style={{
                left: `${powerUp.x}px`,
                top: `${powerUp.y}px`,
                width: `${powerUp.width}px`,
                height: `${powerUp.height}px`,
                background: powerUp.type === 'fire' 
                  ? 'linear-gradient(135deg, #ff4444, #ff6600)' 
                  : powerUp.type === 'multiball'
                  ? 'linear-gradient(135deg, #4444ff, #6600ff)'
                  : powerUp.type === 'grandstreak'
                  ? 'linear-gradient(135deg, #ff00ff, #00ffff, #ffff00)' // Rainbow gradient for grand streak
                  : 'linear-gradient(135deg, #ffff44, #ffaa00)',
                boxShadow: `0 0 ${powerUp.type === 'grandstreak' ? '30px' : '20px'} ${
                  powerUp.type === 'fire' 
                    ? 'rgba(255, 68, 68, 0.8)' 
                    : powerUp.type === 'multiball'
                    ? 'rgba(68, 68, 255, 0.8)'
                    : powerUp.type === 'grandstreak'
                    ? 'rgba(255, 255, 255, 1.0)' // Bright white glow for grand streak
                    : 'rgba(255, 255, 68, 0.8)'
                }`
              }}
              onClick={() => collectPowerUp(powerUp.id)}
            >
              <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">
                {powerUp.type === 'fire' && (
                  <>
                    <Flame className="w-5 h-5" />
                    <span className="absolute -bottom-6 text-xs bg-black/80 px-1 rounded">FIRE</span>
                  </>
                )}
                {powerUp.type === 'multiball' && (
                  <>
                    <Target className="w-5 h-5" />
                    <span className="absolute -bottom-6 text-xs bg-black/80 px-1 rounded">MULTI</span>
                  </>
                )}
                {powerUp.type === 'lightning' && (
                  <>
                    <Zap className="w-5 h-5" />
                    <span className="absolute -bottom-6 text-xs bg-black/80 px-1 rounded">BOLT</span>
                  </>
                )}
                {powerUp.type === 'grandstreak' && (
                  <>
                    <Sparkles className="w-6 h-6 animate-spin" />
                    <span className="absolute -bottom-6 text-xs bg-gradient-to-r from-purple-600 to-pink-600 px-1 rounded font-bold">
                      GRAND
                    </span>
                  </>
                )}
              </div>
              
              {/* Pulsing ring effect */}
              <div className="absolute inset-0 border-2 border-white/50 rounded-full animate-ping"></div>
            </div>
          ))}
          
          {/* Render bricks using absolute positioning for perfect control */}
          {bricks.map((brick) => (
            <div
              key={brick.id}
              className={`absolute border-2 rounded transition-all duration-300 ${
                !brick.isBroken && !brick.isBreaking && !gameWinner && !isLevelTransition ? 'hover:brightness-125 cursor-pointer' : ''
              } ${selectedBrick === brick.id ? 'animate-pulse brightness-150' : ''} ${
                brick.isFalling ? 'animate-pulse' : ''
              } ${brick.isBreaking ? 'animate-bounce' : ''}`} // 🎬 Breaking animation
              style={{
                left: `${brick.x}px`,
                top: `${brick.y}px`,
                width: `${brick.width}px`,
                height: `${brick.height}px`,
                background: brick.isBroken ? 'transparent' : 
                  brick.isBreaking 
                  ? 'linear-gradient(135deg, #ff6b6b, #ff8e53, #ff6b35)' // 🔥 Breaking effect - red/orange
                  : brick.isFalling 
                  ? 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)' 
                  : activePowerUp === 'fire'
                  ? 'linear-gradient(135deg, #ff4444, #ff6600, #22c55e)' // Fire effect
                  : activePowerUp === 'lightning'
                  ? 'linear-gradient(135deg, #ffff44, #ffaa00, #22c55e)' // Lightning effect
                  : activePowerUp === 'multiball'
                  ? 'linear-gradient(135deg, #4444ff, #6600ff, #22c55e)' // Multi-ball effect
                  : activePowerUp === 'grandstreak'
                  ? 'linear-gradient(135deg, #ff00ff, #00ffff, #ffff00, #22c55e)' // Grand streak rainbow effect
                  : 'linear-gradient(135deg, #22c55e, #16a34a, #15803d)',
                borderColor: brick.isBroken ? 'transparent' : 
                  brick.isBreaking 
                  ? '#ff4444' // 🔥 Red border when breaking
                  : brick.isFalling 
                  ? '#f59e0b' 
                  : activePowerUp === 'fire'
                  ? '#ff4444'
                  : activePowerUp === 'lightning'
                  ? '#ffff44'
                  : activePowerUp === 'multiball'
                  ? '#4444ff'
                  : activePowerUp === 'grandstreak'
                  ? '#ffffff' // White border for grand streak
                  : '#16a34a',
                opacity: brick.isBroken ? 0 : 
                  brick.isBreaking ? 0.7 : // 🎬 Fade during breaking
                  brick.opacity,
                boxShadow: brick.isBroken ? 'none' : 
                  brick.isBreaking 
                  ? '0 0 25px rgba(255, 68, 68, 1.0), inset 0 0 15px rgba(255, 255, 255, 0.5)' // 💥 Intense breaking glow + inner light
                  : brick.isFalling 
                  ? '0 0 15px rgba(251, 191, 36, 0.6)' 
                  : activePowerUp === 'fire'
                  ? '0 0 15px rgba(255, 68, 68, 0.8)'
                  : activePowerUp === 'lightning'
                  ? '0 0 15px rgba(255, 255, 68, 0.8)'
                  : activePowerUp === 'multiball'
                  ? '0 0 15px rgba(68, 68, 255, 0.8)'
                  : activePowerUp === 'grandstreak'
                  ? '0 0 25px rgba(255, 255, 255, 1.0)' // Intense white glow for grand streak
                  : '0 0 10px rgba(34, 197, 94, 0.4)',
                display: brick.isBroken ? 'none' : 'block',
                transform: brick.isBreaking ? 'scale(1.1) rotate(2deg)' : brick.isFalling ? 'scale(0.95)' : 'scale(1)', // 🎬 Scale and rotate when breaking
                zIndex: brick.isBreaking ? 20 : 10 // Higher z-index for breaking bricks
              }}
              onClick={() => handleBrickClick(brick.id)}
            >
              {/* Brick Highlight */}
              {!brick.isBroken && !brick.isBreaking && (
                <div
                  className="absolute top-1 left-1 right-1 rounded-t"
                  style={{
                    height: '8px',
                    background: brick.isFalling 
                      ? "rgba(255,255,255,0.6)" 
                      : "rgba(255,255,255,0.4)"
                  }}
                />
              )}
              
              {/* 💥 EPIC BREAKING ANIMATION */}
              {brick.isBreaking && (
                <>
                  {/* Crack patterns */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-2 left-2 w-0.5 h-4 bg-black/80 rotate-45 animate-pulse"></div>
                    <div className="absolute top-3 right-3 w-0.5 h-3 bg-black/80 -rotate-45 animate-pulse"></div>
                    <div className="absolute bottom-2 left-1/2 w-3 h-0.5 bg-black/80 animate-pulse"></div>
                    <div className="absolute top-1/2 left-1 w-2 h-0.5 bg-black/80 rotate-12 animate-pulse"></div>
                  </div>
                  
                  {/* Central explosion effect */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 bg-red-400 rounded-full animate-ping opacity-90" />
                    <div className="absolute w-4 h-4 bg-yellow-400 rounded-full animate-ping opacity-80" />
                    <div className="absolute text-lg animate-bounce">💥</div>
                  </div>
                  
                  {/* Particle effects */}
                  <div className="absolute inset-0 pointer-events-none">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-1 h-1 bg-yellow-400 rounded-full animate-ping"
                        style={{
                          left: `${20 + Math.random() * 60}%`,
                          top: `${20 + Math.random() * 60}%`,
                          animationDelay: `${Math.random() * 0.3}s`,
                          animationDuration: `${0.4 + Math.random() * 0.2}s`
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
              
              {/* Falling Effect Trail */}
              {brick.isFalling && !brick.isBroken && !brick.isBreaking && (
                <>
                  <div
                    className="absolute opacity-40 rounded"
                    style={{
                      left: `${brick.width / 4}px`,
                      top: '-20px',
                      width: `${brick.width / 2}px`,
                      height: '15px',
                      background: 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                    }}
                  />
                  <div
                    className="absolute opacity-20 rounded"
                    style={{
                      left: `${brick.width / 3}px`,
                      top: '-35px',
                      width: `${brick.width / 3}px`,
                      height: '10px',
                      background: 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                    }}
                  />
                </>
              )}
              
              {/* Legacy Breaking Animation (fallback) */}
              {selectedBrick === brick.id && isBreaking && !brick.isBreaking && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-yellow-400 rounded-full animate-ping opacity-80" />
                  <div className="absolute text-xl animate-bounce">💥</div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Level Transition Overlay - COMPACT */}
        {isLevelTransition && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30 pointer-events-none">
            <div className="bg-black/90 border border-gray-600 rounded-lg p-4 text-center max-w-sm">
              {(currentLevel + 2) % 5 === 0 ? (
                // Boss battle incoming
                <>
                  <div className="text-4xl mb-3 animate-pulse">👹</div>
                  <h2 className="text-xl font-bold text-red-400 mb-2">BOSS INCOMING!</h2>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-red-400 text-sm font-bold">Summoning...</span>
              </div>
                </>
              ) : (
                // Regular level transition
                <>
                  <ChevronDown className="w-8 h-8 text-green-400 mx-auto mb-3 animate-bounce" />
                  <h2 className="text-xl font-bold text-green-400 mb-2">STAGE {currentLevel + 1} COMPLETE!</h2>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-green-400 text-sm font-bold">Loading Stage {currentLevel + 2}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 👹 BOSS REWARDS POPUP - COMPACT CENTERED */}
        {showBossRewards && bossRewards && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-gradient-to-br from-yellow-400/95 to-red-500/95 border-2 border-yellow-300 rounded-lg p-4 max-w-sm text-center animate-pulse shadow-2xl">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="text-3xl">👹💀</div>
                <h2 className="text-xl font-bold text-white">BOSS DEFEATED!</h2>
              </div>
              
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">🪙</span>
                  <span className="text-yellow-200 text-sm font-bold">{bossRewards.coins.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">⭐</span>
                  <span className="text-blue-200 text-sm font-bold">{bossRewards.xp.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">🎁</span>
                  <span className="text-purple-200 text-sm font-bold">{bossRewards.powerUps} Power-ups</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">🏆</span>
                  <span className="text-green-200 text-sm font-bold">MEGA SCORE BONUS!</span>
                </div>
              </div>
              
              <p className="text-yellow-100 text-xs animate-pulse">
                Continuing...
              </p>
              
              {/* Compact confetti */}
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute text-sm animate-ping"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 1}s`,
                      animationDuration: `${0.5 + Math.random() * 0.5}s`
                    }}
                  >
                    {['🎉', '⭐', '💎'][Math.floor(Math.random() * 3)]}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Game Over Overlay */}
        {gameWinner && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-30">
            <div className="text-center">
              <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-6 animate-bounce" />
              <h2 className="text-5xl font-bold text-yellow-400 mb-4">🏆 INCREDIBLE! 🏆</h2>
              <p className="text-white text-2xl mb-4">
                You broke <span className="text-green-400 font-bold">{totalBrokenBricks.toLocaleString()}</span> bricks!
              </p>
              <div className="mt-6 text-yellow-400 text-lg animate-pulse">
                🎉 CONGRATULATIONS! YOU WON THE GRAND PRIZE! 🎉
              </div>
            </div>
          </div>
        )}
        
        {/* Breaking State - COMPACT TOP */}
        {isBreaking && (
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-black/80 px-3 py-2 rounded-lg text-sm text-green-400 flex items-center gap-2 border border-green-400/30 shadow-lg z-30 pointer-events-none">
            <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="font-bold">Breaking...</span>
          </div>
        )}

        {/* Instructions and controls */}
        {activeBricks.length === BRICKS_PER_LEVEL && totalBrokenBricks === 0 && !isBossBattle && (
          <div className="absolute bottom-2 left-2 right-2 bg-green-400/20 border border-green-400/50 rounded-lg p-2 text-center z-20">
            <p className="text-green-400 font-bold text-xs">
              🎯 Click any brick to break it! Break all {BRICKS_PER_LEVEL} to advance!
            </p>
            <p className="text-yellow-400 text-xs mt-1">
              💡 Collect glowing power-ups for special abilities!
            </p>
            <p className="text-red-400 text-xs mt-1">
              👹 Every 5th level = BOSS BATTLE with epic rewards!
            </p>
          </div>
        )}

        {/* Boss Battle Instructions */}
        {isBossBattle && currentBoss && (
          <div className="absolute bottom-2 left-2 right-2 bg-red-400/20 border border-red-400/50 rounded-lg p-2 text-center z-20">
            <p className="text-red-400 font-bold text-sm animate-pulse">
              👹 BOSS BATTLE! Click the boss to attack!
            </p>
            <p className="text-yellow-300 text-xs mt-1">
              💥 Deal {Math.min(8 + Math.floor(comboMultiplier * 2), 35)} damage per hit! Each hit = {(Math.min(8 + Math.floor(comboMultiplier * 2), 35) * 10).toLocaleString()} points!
            </p>
            <p className="text-green-300 text-xs mt-1">
              🏆 DEFEAT BONUS: {((currentBoss.maxHP * 50) * (1 + comboMultiplier)).toLocaleString()} points!
            </p>
          </div>
        )}

        {/* 🏆 ACHIEVEMENT NOTIFICATION - COMPACT TOP RIGHT */}
        {newAchievement && (
          <div className="absolute top-4 right-4 z-50 pointer-events-none">
            <div className="bg-gradient-to-br from-yellow-400/95 to-orange-500/95 border border-yellow-300 rounded-lg p-3 max-w-xs animate-pulse shadow-xl">
              <div className="flex items-center gap-2">
                <div className="text-2xl">{newAchievement.icon}</div>
                <div className="flex-1">
                  <h4 className="text-white font-bold text-sm">{newAchievement.title}</h4>
                  <p className="text-yellow-100 text-xs">{newAchievement.description}</p>
                </div>
              </div>
              
              {/* Small confetti effect */}
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 bg-yellow-300 rounded animate-ping"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 1}s`,
                      animationDuration: `${0.5 + Math.random() * 0.5}s`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 💥 COMBO EFFECT OVERLAY - COMPACT */}
        {streak >= 10 && !grandStreakActive && (
          <div className="absolute top-20 left-4 pointer-events-none z-40">
            <div className="bg-orange-500/20 border border-orange-400/50 rounded-lg px-3 py-2 animate-pulse">
              <div className="text-2xl font-bold text-orange-400 animate-bounce">
                {streak}x COMBO!
              </div>
            </div>
          </div>
        )}

        {/* 🚀 GRAND STREAK EFFECT OVERLAY - COMPACT */}
        {grandStreakActive && (
          <div className="absolute top-20 left-4 pointer-events-none z-40">
            <div className="bg-gradient-to-r from-purple-500/30 via-pink-500/30 to-yellow-500/30 border border-white/50 rounded-lg px-4 py-3 animate-pulse shadow-xl">
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent animate-bounce">
                🚀 GRAND STREAK!
              </div>
              <div className="text-lg font-bold text-white text-center mt-1">
                {streak}x EPIC!
              </div>
            </div>
            
            {/* Compact sparkle effects */}
            <div className="absolute inset-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute text-sm animate-ping"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${0.5 + Math.random()}s`
                  }}
                >
                  ✨
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};