import React, { useState, useEffect, useRef } from 'react';
import { Users, Copy, Check, RefreshCw, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { db, ref, set, get, update, onValue, remove } from './firebase';

import bearAvatar from './assets/avatars/bear.png';
import catAvatar from './assets/avatars/cat.png';
import dogAvatar from './assets/avatars/dog.png';
import foxAvatar from './assets/avatars/fox.png';
import lionAvatar from './assets/avatars/lion.png';
import monkeyAvatar from './assets/avatars/monkey.png';
import owlAvatar from './assets/avatars/owl.png';
import pandaAvatar from './assets/avatars/panda.png';
import rabbitAvatar from './assets/avatars/rabbit.png';
import tigerAvatar from './assets/avatars/tiger.png';

const AVATARS = [
  bearAvatar, catAvatar, dogAvatar, foxAvatar, lionAvatar,
  monkeyAvatar, owlAvatar, pandaAvatar, rabbitAvatar, tigerAvatar
];

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

const HAND_RANKINGS = [
  { name: 'High Card', value: 1 },
  { name: 'Pair', value: 2 },
  { name: 'Two Pair', value: 3 },
  { name: 'Three of a Kind', value: 4 },
  { name: 'Straight', value: 5 },
  { name: 'Flush', value: 6 },
  { name: 'Full House', value: 7 },
  { name: 'Four of a Kind', value: 8 },
  { name: 'Straight Flush', value: 9 },
  { name: 'Royal Flush', value: 10 }
];

const BOT_NAMES = [
  'Dealer', 'Raven', 'Ace', 'Bluff', 'Switch', 'Nova', 'Cipher', 'Joker', 'Spade', 'Lucky'
];

const DEFAULT_TURN_TIME_SECONDS = 120;

export default function BullshitPoker() {
  console.log("♠️ Bullshit Poker Loaded - Version: v2.3 (" + new Date().toISOString() + ")");
  const [screen, setScreen] = useState('home');
  const [playerName, setPlayerName] = useState('');
  const [gamePin, setGamePin] = useState('');
  // const [gamePassword, setGamePassword] = useState(''); // Removed in favor of prefix check
  const [playerId, setPlayerId] = useState('');
  const [copied, setCopied] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [selectedHand, setSelectedHand] = useState(null);
  const [selectedRank, setSelectedRank] = useState(null);
  const [selectedRank2, setSelectedRank2] = useState(null);
  const [selectedSuit, setSelectedSuit] = useState(null);
  const [error, setError] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [showRoundResult, setShowRoundResult] = useState(false);
  const [showAvatarPopup, setShowAvatarPopup] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false); // New state for claim popup
  const [isMaximized, setIsMaximized] = useState(false); // Smart Fullscreen/Rotation Toggle
  const [turnTimeSeconds, setTurnTimeSeconds] = useState(120);
  
  // Track the last result timestamp to prevent re-showing
  const lastResultTimestamp = useRef(0);
  // Track if modal was manually closed for current result
  const closedResultTimestamp = useRef(0);
  const timeoutInProgressRef = useRef(false);
  const botActionRef = useRef(null);
  const gameStateRef = useRef(null);

  // New Helper: Verify Deck Uniqueness
  const verifyUniqueDeck = (deck) => {
    const ids = new Set();
    for (const card of deck) {
      if (ids.has(card.id)) return false;
      ids.add(card.id);
    }
    return true;
  };

  // Show round result modal when a NEW result appears
  useEffect(() => {
    if (gameState?.lastResult) {
      // Use a simple timestamp to identify unique results
      const currentTimestamp = gameState.lastResult.timestamp || Date.now();
      
      // Only show if this is a new result AND it hasn't been manually closed
      if (currentTimestamp > lastResultTimestamp.current && currentTimestamp !== closedResultTimestamp.current) {
        lastResultTimestamp.current = currentTimestamp;
        setShowRoundResult(true);
      }
    }
  }, [gameState]);

  useEffect(() => {
    if (screen !== 'home') {
      setError('');
    }
  }, [screen]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Handle closing the modal
  const handleCloseModal = () => {
    setShowRoundResult(false);
    // Remember this result was closed so it doesn't re-open
    if (gameState?.lastResult?.timestamp) {
      closedResultTimestamp.current = gameState.lastResult.timestamp;
    }
  };

  const generateDeck = () => {
    const deck = [];
    for (let suit of SUITS) {
      for (let rank of RANKS) {
        deck.push({ rank, suit, id: `${rank}${suit}` });
      }
    }
    // Double check uniqueness (sanity check)
    if (!verifyUniqueDeck(deck)) {
       console.error("CRITICAL: Generated deck has duplicates! Retrying...");
       return generateDeck(); // Recursive retry
    }
    return deck.sort(() => Math.random() - 0.5);
  };

  const generatePIN = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createFullDeck = () => {
    const deck = [];
    for (let suit of SUITS) {
      for (let rank of RANKS) {
        deck.push({ rank, suit, id: `${rank}${suit}` });
      }
    }
    return deck;
  };

  const getHandValue = (handName) => {
    return HAND_RANKINGS.find(h => h.name === handName)?.value || 0;
  };

  const isClaimHigher = (claim, prevClaim) => {
    if (!prevClaim) return true;
    if (claim.handValue > prevClaim.handValue) return true;
    if (claim.handValue < prevClaim.handValue) return false;

    if (claim.hand === 'Flush') {
      return RANK_VALUES[claim.rank] < RANK_VALUES[prevClaim.rank];
    }
    if (claim.hand === 'Straight' || claim.hand === 'Straight Flush') {
      return RANK_VALUES[claim.rank] > RANK_VALUES[prevClaim.rank];
    }
    if (claim.hand === 'Royal Flush') {
      return false;
    }
    return RANK_VALUES[claim.rank] > RANK_VALUES[prevClaim.rank];
  };

  const buildAllClaims = () => {
    const claims = [];

    // High Card, Pair, Three, Four
    ['High Card', 'Pair', 'Three of a Kind', 'Four of a Kind'].forEach(hand => {
      RANKS.forEach(rank => {
        claims.push({ hand, handValue: getHandValue(hand), rank, rank2: null, suit: null });
      });
    });

    // Two Pair (rank = higher pair)
    for (let i = 0; i < RANKS.length; i++) {
      for (let j = i + 1; j < RANKS.length; j++) {
        const r1 = RANKS[i];
        const r2 = RANKS[j];
        const rankValue1 = RANK_VALUES[r1];
        const rankValue2 = RANK_VALUES[r2];
        const high = rankValue1 >= rankValue2 ? r1 : r2;
        const low = high === r1 ? r2 : r1;
        claims.push({ hand: 'Two Pair', handValue: getHandValue('Two Pair'), rank: high, rank2: low, suit: null });
      }
    }

    // Full House (rank = triplet)
    for (let i = 0; i < RANKS.length; i++) {
      for (let j = 0; j < RANKS.length; j++) {
        if (i === j) continue;
        claims.push({ hand: 'Full House', handValue: getHandValue('Full House'), rank: RANKS[i], rank2: RANKS[j], suit: null });
      }
    }

    // Straight (high card 5 to A)
    Object.entries(RANK_VALUES).forEach(([rank, value]) => {
      if (value >= 5) {
        claims.push({ hand: 'Straight', handValue: getHandValue('Straight'), rank, rank2: null, suit: null });
      }
    });

    // Flush
    SUITS.forEach(suit => {
      RANKS.forEach(rank => {
        claims.push({ hand: 'Flush', handValue: getHandValue('Flush'), rank, rank2: null, suit });
      });
    });

    // Straight Flush
    SUITS.forEach(suit => {
      Object.entries(RANK_VALUES).forEach(([rank, value]) => {
        if (value >= 5) {
          claims.push({ hand: 'Straight Flush', handValue: getHandValue('Straight Flush'), rank, rank2: null, suit });
        }
      });
    });

    // Royal Flush
    SUITS.forEach(suit => {
      claims.push({ hand: 'Royal Flush', handValue: getHandValue('Royal Flush'), rank: 'A', rank2: null, suit });
    });

    return claims;
  };

  const allClaimsRef = useRef(null);
  if (!allClaimsRef.current) {
    allClaimsRef.current = buildAllClaims();
  }

  const sampleCards = (deck, count) => {
    if (count <= 0) return [];
    const copy = deck.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
  };

  const estimateClaimProbability = (claim, botCards, totalCards, samples = 120) => {
    const unknownCount = Math.max(0, totalCards - botCards.length);
    if (unknownCount === 0) {
      return checkClaim(claim, botCards) ? 1 : 0;
    }

    const fullDeck = createFullDeck();
    const botIds = new Set(botCards.map(card => card.id));
    const remainingDeck = fullDeck.filter(card => !botIds.has(card.id));
    if (unknownCount > remainingDeck.length) return 0;

    let trueCount = 0;
    for (let i = 0; i < samples; i++) {
      const sampled = sampleCards(remainingDeck, unknownCount);
      const hypothetical = botCards.concat(sampled);
      if (checkClaim(claim, hypothetical)) trueCount += 1;
    }

    return trueCount / samples;
  };

  const checkClaim = (claim, allCards) => {
    const rankCounts = {};
    const suitCounts = {};
    const cardsBySuit = {};
    
    allCards.forEach(card => {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
      if (!cardsBySuit[card.suit]) cardsBySuit[card.suit] = [];
      cardsBySuit[card.suit].push(card.rank);
    });

    const claimRank = claim.rank;
    const claimRank2 = claim.rank2;
    const claimSuit = claim.suit;
    const actualCount = rankCounts[claimRank] || 0;
    const actualCount2 = claimRank2 ? (rankCounts[claimRank2] || 0) : 0;

    switch(claim.hand) {
      case 'High Card':
        return actualCount >= 1;
        
      case 'Pair':
        return actualCount >= 2;
        
      case 'Two Pair':
        return actualCount >= 2 && actualCount2 >= 2;
        
      case 'Three of a Kind':
        return actualCount >= 3;
        
      case 'Full House':
        return actualCount >= 3 && actualCount2 >= 2;
        
      case 'Four of a Kind':
        return actualCount >= 4;
        
      case 'Straight': {
        const highValue = RANK_VALUES[claimRank];
        if (highValue < 5) return false;
        
        const neededRanks = [];
        for (let i = 0; i < 5; i++) {
          const value = highValue - i;
          const rank = Object.keys(RANK_VALUES).find(r => RANK_VALUES[r] === value);
          if (rank) neededRanks.push(rank);
        }
        
        return neededRanks.every(rank => rankCounts[rank] >= 1);
      }
        
      case 'Flush': {
        if (!claimSuit) return false;
        const cardsInSuit = cardsBySuit[claimSuit] || [];
        if (cardsInSuit.length < 5) return false;
        
        if (!cardsInSuit.includes(claimRank)) return false;
        
        // New Logic: Check if there are at least 4 cards LOWER than the claimed rank
        // This allows claiming a Q-Flush even if a King exists, as long as you have Q + 4 lower cards (e.g. Q, 10, 8, 5, 2)
        const claimValue = RANK_VALUES[claimRank];
        const lowerCardsCount = cardsInSuit.filter(rank => RANK_VALUES[rank] < claimValue).length;
        
        return lowerCardsCount >= 4;
      }
        
      case 'Straight Flush': {
        if (!claimSuit) return false;
        const highValue = RANK_VALUES[claimRank];
        if (highValue < 5) return false;
        
        const cardsInSuit = cardsBySuit[claimSuit] || [];
        const neededRanks = [];
        for (let i = 0; i < 5; i++) {
          const value = highValue - i;
          const rank = Object.keys(RANK_VALUES).find(r => RANK_VALUES[r] === value);
          if (rank) neededRanks.push(rank);
        }
        
        return neededRanks.every(rank => cardsInSuit.includes(rank));
      }
        
      case 'Royal Flush': {
        if (!claimSuit) return false;
        const cardsInSuit = cardsBySuit[claimSuit] || [];
        const royalRanks = ['10', 'J', 'Q', 'K', 'A'];
        return royalRanks.every(rank => cardsInSuit.includes(rank));
      }
        
      default:
        return actualCount >= 1;
    }
  };

  const describeCards = (allCards) => {
    return allCards.map(card => `${card.rank}${card.suit}`).join(', ');
  };

  const formatTime = (totalSeconds) => {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Firebase Realtime Listener
  useEffect(() => {
    if (gamePin) {
      const gameRef = ref(db, `rooms/${gamePin}`);
     
      const unsubscribe = onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setGameState(data);
          
          // Auto-redirect to game screen if started and we are in lobby
          if (data.started && screen === 'lobby') {
            setScreen('game');
          }
          
          // Redirect back to lobby if game resets? (optional, for now keep simple)
        } else {
          // Game info null (maybe deleted), could handle this
        }
      });
      
      return () => unsubscribe();
    }
  }, [gamePin, screen]); // Listen to changes in gamePin

  const cleanupOldGames = async () => {
    try {
      const roomsRef = ref(db, 'rooms');
      const snapshot = await get(roomsRef);
      if (snapshot.exists()) {
        const rooms = snapshot.val();
        const now = Date.now();
        const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
        
        Object.keys(rooms).forEach((key) => {
          const room = rooms[key];
          // Check if room is older than 5 hours
          // Fallback to timestamp in ID if createdAt is missing
          const createdAt = room.createdAt || (room.host ? parseInt(room.host.split('-')[0]) : 0);
          
          if (now - createdAt > FIVE_HOURS_MS) {
            remove(ref(db, `rooms/${key}`));
            console.log(`Cleaned up old room: ${key}`);
          }
        });
      }
    } catch (err) {
      console.error("Cleanup failed:", err);
    }
  };

  const createGame = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    const pin = generatePIN();
    const id = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 15);
    const finalName = playerName.trim();

    const newGame = {
      createdAt: Date.now(),
      pin,
      // password: gamePassword.trim(), // Removed
      turnTimeSeconds: turnTimeSeconds || DEFAULT_TURN_TIME_SECONDS,
      turnStartedAt: null,
      players: [{
        id,
        name: finalName,
        avatarId: Math.floor(Math.random() * 10),
        cards: [],
        cardCount: 1,
        eliminated: false
      }],
      host: id,
      started: false,
      roundActive: false,
      currentPlayer: 0,
      startingPlayer: 0,
      currentClaim: null,
      claimHistory: [],
      allCards: [],
      winner: null
    };

    // Firebase: Set the new game in 'rooms/'
    try {
      // Trigger lazy cleanup (don't await, let it run in background)
      cleanupOldGames();

      await set(ref(db, 'rooms/' + pin), newGame);
      setGamePin(pin);
      setPlayerId(id);
      setGameState(newGame);
      setTurnTimeSeconds(newGame.turnTimeSeconds);
      setScreen('lobby');
    } catch (e) {
      console.error(e);
      setError("Could not create game. Check Firebase config.");
    }
  };

  const updateTurnTime = async (value) => {
    const seconds = Number(value) || DEFAULT_TURN_TIME_SECONDS;
    setTurnTimeSeconds(seconds);
    if (gameState && playerId === gameState.host && !gameState.started) {
      await update(ref(db, `rooms/${gamePin}`), { turnTimeSeconds: seconds });
    }
  };

  const joinGame = async () => {
    if (!playerName.trim() || !gamePin.trim()) {
      setError('Please enter name and PIN');
      return;
    }

    try {
      const pinUpper = gamePin.toUpperCase();
      // Firebase: Read once to check existence and get current state
      const snapshot = await get(ref(db, `rooms/${pinUpper}`));
      // const result = await window.storage.get(`game:${pinUpper}`, true);
      
      if (!snapshot.exists()) {
        setError('Game not found');
        return;
      }

      const game = snapshot.val();
      
      // Verify Password - Removed
      // if (game.password && game.password !== gamePassword.trim()) {
      //   setError('Incorrect password');
      //   return;
      // }
      const trimmedName = playerName.trim();
      
      const existingPlayer = game.players.find(p => p.name.toLowerCase() === trimmedName.toLowerCase());
      
      if (existingPlayer) {
        // Reconnection Logic
        const newId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 15);
        
        game.players = game.players.map(p => 
          p.name.toLowerCase() === trimmedName.toLowerCase() 
            ? { ...p, id: newId }
            : p
        );
        
        if (game.host === existingPlayer.id) {
          game.host = newId;
        }
        
        if (game.started) {
          const activePlayers = game.players.filter(p => !p.eliminated);
          const activeIndex = activePlayers.findIndex(p => p.id === newId);
          if (activeIndex !== -1 && game.currentPlayer >= activePlayers.length) {
            game.currentPlayer = 0;
          }
        }
        
        // Firebase: Update game state with new player ID
        await set(ref(db, `rooms/${pinUpper}`), game);
        // await window.storage.set(`game:${pinUpper}`, JSON.stringify(game), true);
        
        setGamePin(pinUpper);
        setPlayerId(newId);
        setGameState(game);
        setTurnTimeSeconds(game.turnTimeSeconds || DEFAULT_TURN_TIME_SECONDS);
        setScreen(game.started ? 'game' : 'lobby');
        setError('');
        return;
      }
      
      if (game.started) {
        setError('Game already started. Use an existing player name to reconnect.');
        return;
      }

      if (game.players.length >= 10) {
        setError('Game is full (max 10 players)');
        return;
      }
      
      const id = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 15);
      
      const existingAvatarIds = game.players.map(p => p.avatarId);
      const allAvatarIds = Array.from({ length: 10 }, (_, i) => i);
      const availableAvatarIds = allAvatarIds.filter(id => !existingAvatarIds.includes(id));
      
      const newAvatarId = availableAvatarIds.length > 0
        ? availableAvatarIds[Math.floor(Math.random() * availableAvatarIds.length)]
        : Math.floor(Math.random() * 10);
      
      game.players.push({
        id,
        name: trimmedName,
        avatarId: newAvatarId,
        cards: [],
        cardCount: 1,
        eliminated: false
      });

      // Firebase: Write updated game state
      await set(ref(db, `rooms/${pinUpper}`), game);
      // await window.storage.set(`game:${pinUpper}`, JSON.stringify(game), true);
      
      setGamePin(pinUpper);
      setPlayerId(id);
      setGameState(game);
      setTurnTimeSeconds(game.turnTimeSeconds || DEFAULT_TURN_TIME_SECONDS);
      setScreen('lobby');
      setError('');
    } catch (err) {
      setError('Error joining game: ' + err.message);
    }
  };

  const addBot = async () => {
    if (!gameState || gameState.started) return;
    if (gameState.players.length >= 10) {
      setError('Game is full (max 10 players)');
      return;
    }

    const existingNames = new Set(gameState.players.map(p => p.name.toLowerCase()));
    const baseName = BOT_NAMES.find(n => !existingNames.has(n.toLowerCase())) || `Bot ${gameState.players.length + 1}`;
    const botId = `bot-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    const existingAvatarIds = gameState.players.map(p => p.avatarId);
    const allAvatarIds = Array.from({ length: 10 }, (_, i) => i);
    const availableAvatarIds = allAvatarIds.filter(id => !existingAvatarIds.includes(id));
    const avatarId = availableAvatarIds.length > 0
      ? availableAvatarIds[Math.floor(Math.random() * availableAvatarIds.length)]
      : Math.floor(Math.random() * 10);

    const botPlayer = {
      id: botId,
      name: baseName,
      avatarId,
      cards: [],
      cardCount: 1,
      eliminated: false,
      isBot: true
    };

    const updatedGame = {
      ...gameState,
      players: [...gameState.players, botPlayer]
    };

    await set(ref(db, `rooms/${gamePin}`), updatedGame);
    setGameState(updatedGame);
  };

  const removeBot = async (botId) => {
    if (!gameState || gameState.started) return;
    const updatedGame = {
      ...gameState,
      players: gameState.players.filter(p => p.id !== botId)
    };
    await set(ref(db, `rooms/${gamePin}`), updatedGame);
    setGameState(updatedGame);
  };

  const startGame = async () => {
    const deck = generateDeck();
    
    const updatedPlayers = gameState.players.map((player, idx) => ({
      ...player,
      cards: [deck[idx]],
      cardCount: 1
    }));

    const updatedGame = {
      ...gameState,
      players: updatedPlayers,
      started: true,
      roundActive: true,
      currentPlayer: 0,
      startingPlayer: 0,
      turnStartedAt: Date.now(),
      allCards: updatedPlayers.map(p => p.cards[0]),
      deck: deck.slice(updatedPlayers.length)
    };

    // Firebase: Update game
    await set(ref(db, `rooms/${gamePin}`), updatedGame);
    // await window.storage.set(`game:${gamePin}`, JSON.stringify(updatedGame), true);
    setGameState(updatedGame);
  };

  const submitClaim = async (actorId, claim) => {
    const activePlayers = gameState.players.filter(p => !p.eliminated);
    const currentIdx = activePlayers.findIndex(p => p.id === actorId);
    const isStartingPlayer = currentIdx === gameState.startingPlayer;

    if (isStartingPlayer && gameState.currentClaim) {
      await makeEndingClaim(actorId, claim);
      return;
    }

    const nextIdx = (currentIdx + 1) % activePlayers.length;

    const updatedGame = {
      ...gameState,
      currentClaim: claim,
      claimHistory: [...(gameState.claimHistory || []), claim],
      currentPlayer: nextIdx,
      turnStartedAt: Date.now()
    };

    await set(ref(db, `rooms/${gamePin}`), updatedGame);
    setGameState(updatedGame);
  };

  const makeClaim = async () => {
    if (!selectedHand) {
      setError('Select a poker hand');
      return;
    }

    if (!selectedRank) {
      setError('Select a rank');
      return;
    }

    if ((selectedHand.name === 'Two Pair' || selectedHand.name === 'Full House') && !selectedRank2) {
      setError('Select both ranks for ' + selectedHand.name);
      return;
    }

    if ((selectedHand.name === 'Flush' || selectedHand.name === 'Straight Flush' || selectedHand.name === 'Royal Flush') && !selectedSuit) {
      setError('Select a suit for ' + selectedHand.name);
      return;
    }

    if ((selectedHand.name === 'Two Pair' || selectedHand.name === 'Full House') && selectedRank === selectedRank2) {
      setError('Two ranks must be different!');
      return;
    }

    if (selectedHand.name === 'Straight' && RANK_VALUES[selectedRank] < 5) {
      setError('Straight requires highest card to be 5 or higher!');
      return;
    }

    if (selectedHand.name === 'Straight Flush' && RANK_VALUES[selectedRank] < 5) {
      setError('Straight Flush requires highest card to be 5 or higher!');
      return;
    }

    if (gameState.currentClaim) {
      const prevValue = gameState.currentClaim.handValue;
      const newValue = selectedHand.value;
      
      if (newValue < prevValue) {
        setError('Must claim a HIGHER poker hand!');
        return;
      } else if (newValue === prevValue) {
        if (selectedHand.name === 'Flush') {
          if (RANK_VALUES[selectedRank] >= RANK_VALUES[gameState.currentClaim.rank]) {
            setError('For Flush, must claim LOWER highest card (harder to get)!');
            return;
          }
        } else if (selectedHand.name === 'Straight Flush') {
          if (RANK_VALUES[selectedRank] <= RANK_VALUES[gameState.currentClaim.rank]) {
            setError('For Straight Flush, must claim HIGHER straight!');
            return;
          }
        } else if (selectedHand.name === 'Straight') {
          if (RANK_VALUES[selectedRank] <= RANK_VALUES[gameState.currentClaim.rank]) {
            setError('For Straight, must claim HIGHER straight!');
            return;
          }
        } else {
          if (RANK_VALUES[selectedRank] <= RANK_VALUES[gameState.currentClaim.rank]) {
            setError('Must claim a HIGHER rank!');
            return;
          }
        }
      }
    }

    const claim = {
      playerId,
      playerName: gameState.players.find(p => p.id === playerId).name,
      hand: selectedHand.name,
      rank: selectedRank,
      rank2: (selectedHand.name === 'Two Pair' || selectedHand.name === 'Full House') ? selectedRank2 : null,
      suit: (selectedHand.name === 'Flush' || selectedHand.name === 'Straight Flush' || selectedHand.name === 'Royal Flush') ? selectedSuit : null,
      handValue: selectedHand.value
    };

    await submitClaim(playerId, claim);
    setSelectedHand(null);
    setSelectedRank(null);
    setSelectedRank2(null);
    setSelectedSuit(null);
    setError('');
  };

  const makeEndingClaim = async (actorId, claim) => {
    try {
      const allCards = gameState.allCards;
      const isTrue = checkClaim(claim, allCards);
      const isCorrect = isTrue;
      const actualDesc = describeCards(allCards);
      
      const rankCounts = {};
      allCards.forEach(card => {
        rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
      });
      const actualCount = rankCounts[claim.rank] || 0;
      const actualCount2 = claim.rank2 ? (rankCounts[claim.rank2] || 0) : 0;

      const currentPlayer = gameState.players.find(p => p.id === actorId);

      if (!isCorrect) {
        const updatedPlayers = gameState.players.map(p => {
          if (p.id === actorId) {
            const newCount = p.cardCount + 1;
            return {
              ...p,
              cardCount: newCount,
              eliminated: newCount > 5
            };
          }
          return p;
        });

        const active = updatedPlayers.filter(p => !p.eliminated);
        
        if (active.length === 1) {
          const updatedGame = {
            ...gameState,
            players: updatedPlayers,
            winner: active[0].name,
            roundActive: false,
            lastResult: {
              endingClaim: claim,
              actualDesc: actualDesc,
              actualCount: actualCount,
              actualCount2: actualCount2,
              wasCorrect: false,
              loser: currentPlayer.name,
              allCardsInRound: allCards,
              timestamp: Date.now()
            }
          };
          
          await set(ref(db, `rooms/${gamePin}`), updatedGame);
          // await window.storage.set(`game:${gamePin}`, JSON.stringify(updatedGame), true);
          setGameState(updatedGame);
          setSelectedHand(null);
          setSelectedRank(null);
          setSelectedRank2(null);
          setSelectedSuit(null);
          return;
        }

        const newDeck = generateDeck();
        const activePlayers = updatedPlayers.filter(p => !p.eliminated);
        const newStartIdx = (gameState.startingPlayer + 1) % activePlayers.length;
        
        let deckIndex = 0;
        const nextRoundPlayers = updatedPlayers.map(p => {
          if (p.eliminated) {
            return { ...p, cards: [] };
          } else {
            const playerCards = newDeck.slice(deckIndex, deckIndex + p.cardCount);
            deckIndex += p.cardCount;
            return { ...p, cards: playerCards };
          }
        });

        const updatedGame = {
          ...gameState,
          players: nextRoundPlayers,
          currentPlayer: newStartIdx,
          startingPlayer: newStartIdx,
          turnStartedAt: Date.now(),
          currentClaim: null,
          claimHistory: [],
          roundActive: true,
          allCards: nextRoundPlayers.filter(p => !p.eliminated).flatMap(p => p.cards),
          deck: newDeck.slice(deckIndex),
          deckVersion: Date.now(), // Force UI update
          lastResult: {
            endingClaim: claim,
            actualDesc: actualDesc,
            actualCount: actualCount,
            actualCount2: actualCount2,
            wasCorrect: false,
            loser: currentPlayer.name,
            allCardsInRound: allCards,
            timestamp: Date.now()
          }
        };

        await set(ref(db, `rooms/${gamePin}`), updatedGame);
        // await window.storage.set(`game:${gamePin}`, JSON.stringify(updatedGame), true);
        setGameState(updatedGame);
        setSelectedHand(null);
        setSelectedRank(null);
        setSelectedRank2(null);
        setSelectedSuit(null);
      } else {
        const newDeck = generateDeck();
        const activePlayers = gameState.players.filter(p => !p.eliminated);
        const newStartIdx = (gameState.startingPlayer + 1) % activePlayers.length;
        
        let deckIndex = 0;
        const nextRoundPlayers = gameState.players.map(p => {
          if (p.eliminated) {
            return { ...p, cards: [] };
          } else {
            const playerCards = newDeck.slice(deckIndex, deckIndex + p.cardCount);
            deckIndex += p.cardCount;
            return { ...p, cards: playerCards };
          }
        });

        const updatedGame = {
          ...gameState,
          players: nextRoundPlayers,
          currentPlayer: newStartIdx,
          startingPlayer: newStartIdx,
          turnStartedAt: Date.now(),
          currentClaim: null,
          claimHistory: [],
          roundActive: true,
          allCards: nextRoundPlayers.filter(p => !p.eliminated).flatMap(p => p.cards),
          deck: newDeck.slice(deckIndex),
          deckVersion: Date.now(), // Force UI update
          lastResult: {
            endingClaim: claim,
            actualDesc: actualDesc,
            actualCount: actualCount,
            actualCount2: actualCount2,
            wasCorrect: true,
            winner: currentPlayer.name,
            allCardsInRound: allCards,
            timestamp: Date.now()
          }
        };

        await set(ref(db, `rooms/${gamePin}`), updatedGame);
        // await window.storage.set(`game:${gamePin}`, JSON.stringify(updatedGame), true);
        setGameState(updatedGame);
        setSelectedHand(null);
        setSelectedRank(null);
        setSelectedRank2(null);
        setSelectedSuit(null);
      }
    } catch (err) {
      console.error(err);
      setError("Error processing claim result: " + err.message);
    }
  };

  const callBullshitAs = async (callerId) => {
    try {
      const claim = gameState.currentClaim;
      if (!claim) return;
      
      const allCards = gameState.allCards;
      const isTrue = checkClaim(claim, allCards);
      const isLying = !isTrue;
      const actualDesc = describeCards(allCards);
      
      const rankCounts = {};
      allCards.forEach(card => {
        rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
      });
      const actualCount = rankCounts[claim.rank] || 0;
      const actualCount2 = claim.rank2 ? (rankCounts[claim.rank2] || 0) : 0;

      const loser = isLying ? claim.playerId : callerId;
      
      const updatedPlayers = gameState.players.map(p => {
        if (p.id === loser) {
          const newCount = p.cardCount + 1;
          return {
            ...p,
            cardCount: newCount,
            eliminated: newCount > 5
          };
        }
        return p;
      });

      const active = updatedPlayers.filter(p => !p.eliminated);
      
      if (active.length === 1) {
        const updatedGame = {
          ...gameState,
          players: updatedPlayers,
          winner: active[0].name,
          roundActive: false,
          lastResult: {
            caller: gameState.players.find(p => p.id === callerId).name,
            claim: claim,
            actualDesc: actualDesc,
            actualCount: actualCount,
            actualCount2: actualCount2,
            wasLying: isLying,
            loser: gameState.players.find(p => p.id === loser).name,
            allCardsInRound: allCards,
            timestamp: Date.now()
          }
        };
        await set(ref(db, `rooms/${gamePin}`), updatedGame);
        // await window.storage.set(`game:${gamePin}`, JSON.stringify(updatedGame), true);
        setGameState(updatedGame);
        return;
      }

      const newDeck = generateDeck();
      const newStartIdx = (gameState.startingPlayer + 1) % active.length;
      
      let deckIndex = 0;
      const nextRoundPlayers = updatedPlayers.map(p => {
        if (p.eliminated) {
          return { ...p, cards: [] };
        } else {
          const playerCards = newDeck.slice(deckIndex, deckIndex + p.cardCount);
          deckIndex += p.cardCount;
          return {
            ...p,
            cards: playerCards
          };
        }
      });

      const updatedGame = {
        ...gameState,
        players: nextRoundPlayers,
        currentPlayer: newStartIdx,
        startingPlayer: newStartIdx,
        turnStartedAt: Date.now(),
        currentClaim: null,
        claimHistory: [],
        roundActive: true,
        allCards: nextRoundPlayers.filter(p => !p.eliminated).flatMap(p => p.cards),
        deck: newDeck.slice(deckIndex),
        deckVersion: Date.now(), // Force UI update
        lastResult: {
          caller: gameState.players.find(p => p.id === callerId).name,
          claim: claim,
          actualDesc: actualDesc,
          actualCount: actualCount,
          actualCount2: actualCount2,
          wasLying: isLying,
          loser: gameState.players.find(p => p.id === loser).name,
          allCardsInRound: allCards,
          timestamp: Date.now()
        }
      };

      await set(ref(db, `rooms/${gamePin}`), updatedGame);
      // await window.storage.set(`game:${gamePin}`, JSON.stringify(updatedGame), true);
      setGameState(updatedGame);
    } catch (err) {
      console.error('BS error:', err);
      setError('Error: ' + err.message);
    }
  };

  const callBullshit = async () => {
    await callBullshitAs(playerId);
  };

  const chooseBotAction = (botPlayer) => {
    const activePlayers = gameState.players.filter(p => !p.eliminated);
    const totalCards = activePlayers.reduce((sum, p) => sum + p.cardCount, 0);
    const botCards = botPlayer.cards || [];
    const prevClaim = gameState.currentClaim;
    const riskFactor = Math.min(1, (botPlayer.cardCount - 1) / 4);

    if (prevClaim) {
      const truthProb = estimateClaimProbability(prevClaim, botCards, totalCards, 120);
      const callThreshold = 0.28 - (riskFactor * 0.08);
      if (truthProb < callThreshold) {
        return { type: 'call' };
      }
    }

    const candidates = allClaimsRef.current.filter(c => isClaimHigher(c, prevClaim));
    if (candidates.length === 0) {
      return prevClaim ? { type: 'call' } : { type: 'claim', claim: null };
    }

    const safeThreshold = 0.45 + (riskFactor * 0.08);
    let best = null;

    candidates.forEach((claim) => {
      const probability = estimateClaimProbability(claim, botCards, totalCards, 120);
      const rankValue = RANK_VALUES[claim.rank] || 0;
      let rankPenalty = 0;
      if (claim.hand === 'Flush') {
        rankPenalty = (15 - rankValue) * 0.3;
      } else if (claim.hand === 'Straight' || claim.hand === 'Straight Flush') {
        rankPenalty = rankValue * 0.25;
      } else {
        rankPenalty = rankValue * 0.2;
      }
      const score = (probability * 100)
        - (claim.handValue * 3)
        - rankPenalty
        + (Math.random() * 2);

      if (!best || score > best.score) {
        best = { claim, probability, score };
      }
    });

    if (!best) return { type: prevClaim ? 'call' : 'claim', claim: null };
    if (prevClaim && best.probability < 0.18 && Math.random() < 0.6) {
      return { type: 'call' };
    }

    if (best.probability < safeThreshold && prevClaim && Math.random() < 0.3) {
      return { type: 'call' };
    }

    return { type: 'claim', claim: best.claim };
  };

  const performBotTurn = async (botPlayer) => {
    if (!gameState?.started || gameState?.winner) return;
    const activePlayers = gameState.players.filter(p => !p.eliminated);
    const currentActive = activePlayers[gameState.currentPlayer];
    if (!currentActive || currentActive.id !== botPlayer.id) return;

    const action = chooseBotAction(botPlayer);
    if (action.type === 'call' && gameState.currentClaim) {
      await callBullshitAs(botPlayer.id);
      return;
    }

    if (!action.claim) return;

    const claim = {
      ...action.claim,
      playerId: botPlayer.id,
      playerName: botPlayer.name
    };

    await submitClaim(botPlayer.id, claim);
  };

  const handleTurnTimeout = async () => {
    try {
      if (!gameState?.started || gameState?.winner) return;

      const activePlayers = gameState.players.filter(p => !p.eliminated);
      const currentActive = activePlayers[gameState.currentPlayer];
      if (!currentActive) return;

      const timeoutPlayerId = currentActive.id;
      const timeoutPlayerName = currentActive.name;

      const updatedPlayers = gameState.players.map(p => {
        if (p.id === timeoutPlayerId) {
          const newCount = p.cardCount + 1;
          return {
            ...p,
            cardCount: newCount,
            eliminated: newCount > 5
          };
        }
        return p;
      });

      const activeAfter = updatedPlayers.filter(p => !p.eliminated);

      const lastResult = {
        timeout: true,
        reason: 'Time expired',
        claim: gameState.currentClaim || null,
        loser: timeoutPlayerName,
        allCardsInRound: gameState.allCards,
        timestamp: Date.now()
      };

      if (activeAfter.length === 1) {
        const updatedGame = {
          ...gameState,
          players: updatedPlayers,
          winner: activeAfter[0].name,
          roundActive: false,
          lastResult
        };
        await set(ref(db, `rooms/${gamePin}`), updatedGame);
        setGameState(updatedGame);
        return;
      }

      const newDeck = generateDeck();
      const newStartIdx = (gameState.startingPlayer + 1) % activeAfter.length;

      let deckIndex = 0;
      const nextRoundPlayers = updatedPlayers.map(p => {
        if (p.eliminated) {
          return { ...p, cards: [] };
        }
        const playerCards = newDeck.slice(deckIndex, deckIndex + p.cardCount);
        deckIndex += p.cardCount;
        return { ...p, cards: playerCards };
      });

      const updatedGame = {
        ...gameState,
        players: nextRoundPlayers,
        currentPlayer: newStartIdx,
        startingPlayer: newStartIdx,
        turnStartedAt: Date.now(),
        currentClaim: null,
        claimHistory: [],
        roundActive: true,
        allCards: nextRoundPlayers.filter(p => !p.eliminated).flatMap(p => p.cards),
        deck: newDeck.slice(deckIndex),
        deckVersion: Date.now(),
        lastResult
      };

      await set(ref(db, `rooms/${gamePin}`), updatedGame);
      setGameState(updatedGame);
    } catch (err) {
      console.error('Turn timeout error:', err);
      setError('Timeout error: ' + err.message);
    }
  };

  useEffect(() => {
    if (!playerId || playerId !== gameState?.host) return;

    const id = setInterval(() => {
      const gs = gameStateRef.current;
      if (!gs?.started || gs?.winner || !gs.turnStartedAt) return;
      if (playerId !== gs.host) return;

      const limitSeconds = gs.turnTimeSeconds || DEFAULT_TURN_TIME_SECONDS;
      const remainingMs = (limitSeconds * 1000) - (Date.now() - gs.turnStartedAt);
      if (remainingMs > 0) return;
      if (timeoutInProgressRef.current) return;

      timeoutInProgressRef.current = true;
      handleTurnTimeout().finally(() => {
        timeoutInProgressRef.current = false;
      });
    }, 500);

    return () => clearInterval(id);
  }, [playerId, gameState?.host]);

  useEffect(() => {
    if (!gameState?.started || gameState?.winner) return;
    if (playerId !== gameState.host) return;

    const activePlayers = gameState.players.filter(p => !p.eliminated);
    const currentActive = activePlayers[gameState.currentPlayer];
    if (!currentActive?.isBot) return;

    const turnKey = `${gameState.turnStartedAt || 0}:${currentActive.id}`;
    if (botActionRef.current?.turnKey === turnKey) return;

    if (botActionRef.current?.timeoutId) {
      clearTimeout(botActionRef.current.timeoutId);
    }

    const delay = 900 + Math.random() * 1100;
    const timeoutId = setTimeout(() => {
      performBotTurn(currentActive);
    }, delay);

    botActionRef.current = { turnKey, timeoutId };
  }, [gameState, playerId]);

  useEffect(() => {
    return () => {
      if (botActionRef.current?.timeoutId) {
        clearTimeout(botActionRef.current.timeoutId);
      }
    };
  }, []);

  const copyPIN = () => {
    navigator.clipboard.writeText(gamePin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetGame = () => {
    setScreen('home');
    setPlayerName('');
    setGamePin('');
    setPlayerId('');
    setGameState(null);
    setError('');
  };

  // Format claim with simplified details (e.g. "HC - 9")
  const formatClaim = (claim) => {
    if (!claim) return null;
    
    // Helper for consistency
    const ClaimText = ({ type, detail }) => (
      <span>
        <strong className="font-black text-black">{type}</strong>
        <span className="font-medium text-gray-800"> - {detail}</span>
      </span>
    );
    
    switch(claim.hand) {
      case 'High Card':       return <ClaimText type="HC" detail={claim.rank} />;
      case 'Pair':            return <ClaimText type="Pair" detail={claim.rank} />;
      case 'Three of a Kind': return <ClaimText type="3K" detail={claim.rank} />;
      case 'Four of a Kind':  return <ClaimText type="4K" detail={claim.rank} />;
      case 'Two Pair':        return <ClaimText type="2P" detail={`${claim.rank} & ${claim.rank2}`} />;
      case 'Full House':      return <ClaimText type="FH" detail={`${claim.rank} & ${claim.rank2}`} />;
      case 'Straight':        return <ClaimText type="Str" detail={claim.rank} />;
      case 'Flush':           return <ClaimText type="Fl" detail={`${claim.suit} ${claim.rank}`} />;
      case 'Straight Flush':  return <ClaimText type="SF" detail={`${claim.suit} ${claim.rank}`} />;
      case 'Royal Flush':     return <ClaimText type="RF" detail={claim.suit} />;
      default:                return <span>{claim.hand}</span>;
    }
  };

  // ANIMATED COMPONENTS
  
  function PlayingCard({ rank, suit, delay = 0 }) {
    const isRed = ['♥', '♦'].includes(suit);
    const color = isRed ? '#dc2626' : '#1f2937';
    
    return (
      <motion.div
        className="relative bg-white rounded-lg shadow-xl"
        style={{
          width: '80px',
          height: '112px',
          border: `2px solid ${isRed ? '#ef4444' : '#374151'}`,
          backgroundColor: '#ffffff',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 260, 
          damping: 20,
          delay 
        }}
        whileHover={{ 
          scale: 1.05,
          y: -3,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
          transition: { duration: 0.2 }
        }}
      >
        {/* Top-left corner */}
        <div 
          className="absolute font-bold"
          style={{
            top: '4px',
            left: '6px',
            lineHeight: '1',
            color: color
          }}
        >
          <div style={{ fontSize: '16px', marginBottom: '2px' }}>{rank}</div>
          <div style={{ fontSize: '14px' }}>{suit}</div>
        </div>
        
        {/* Center large suit */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: color }}
        >
          <div style={{ fontSize: '48px' }}>{suit}</div>
        </div>
        
        {/* Bottom-right corner (upside down) */}
        <div 
          className="absolute font-bold"
          style={{
            bottom: '4px',
            right: '6px',
            lineHeight: '1',
            color: color,
            transform: 'rotate(180deg)'
          }}
        >
          <div style={{ fontSize: '16px', marginBottom: '2px' }}>{rank}</div>
          <div style={{ fontSize: '14px' }}>{suit}</div>
        </div>
        
        {/* Subtle inner border for depth */}
        <div 
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            border: '1px solid rgba(0, 0, 0, 0.05)',
            margin: '3px'
          }}
        />
      </motion.div>
    );
  }

  // Small Playing Card for modal display (fits 50+ cards)
  function SmallPlayingCard({ rank, suit }) {
    const isRed = ['♥', '♦'].includes(suit);
    const color = isRed ? '#dc2626' : '#1f2937';
    
    return (
      <div
        className="relative bg-white rounded shadow-md"
        style={{
          width: '48px',
          height: '68px',
          border: `1px solid ${isRed ? '#ef4444' : '#374151'}`,
          backgroundColor: '#ffffff'
        }}
      >
        {/* Top-left corner */}
        <div 
          className="absolute font-bold"
          style={{
            top: '2px',
            left: '3px',
            lineHeight: '1',
            color: color
          }}
        >
          <div style={{ fontSize: '10px' }}>{rank}</div>
          <div style={{ fontSize: '10px' }}>{suit}</div>
        </div>
        
        {/* Center suit */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: color }}
        >
          <div style={{ fontSize: '24px' }}>{suit}</div>
        </div>
        
        {/* Bottom-right corner */}
        <div 
          className="absolute font-bold"
          style={{
            bottom: '2px',
            right: '3px',
            lineHeight: '1',
            color: color,
            transform: 'rotate(180deg)'
          }}
        >
          <div style={{ fontSize: '10px' }}>{rank}</div>
          <div style={{ fontSize: '10px' }}>{suit}</div>
        </div>
      </div>
    );
  }

  // Game Controls Component - Extracted for reuse in Popup and Sidebar
  // 1. HandDisplay Component - Shows players cards horizontally
  function HandDisplay({ player }) {
    return (
      <div className="flex flex-col items-center">
        <h3 className="text-white/80 font-bold text-shadow-sm text-sm mb-2 uppercase tracking-wider">Your Hand</h3>
        <div className="flex justify-center -space-x-4 hover:space-x-1 transition-all duration-300 px-4 py-2 bg-black/20 rounded-xl backdrop-blur-sm border border-white/5 mx-auto">
          {[...player.cards].sort((a, b) => {
             const suitOrder = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 };
             if (suitOrder[a.suit] !== suitOrder[b.suit]) {
               return suitOrder[a.suit] - suitOrder[b.suit];
             }
             const rankOrder = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
             return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
          }).map((card, idx) => (
             <div key={card.id} className="relative transition-transform hover:-translate-y-4 duration-200 z-10 hover:z-20">
               <PlayingCard rank={card.rank} suit={card.suit} delay={idx * 0.05} />
             </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. ClaimForm Component - Inside the Popup
  function ClaimForm({ 
    selectedHand, setSelectedHand,
    selectedRank, setSelectedRank,
    selectedRank2, setSelectedRank2,
    selectedSuit, setSelectedSuit,
    makeClaim,
    error
  }) {
    return (
      <div className="space-y-4 text-gray-800">
        <AnimatePresence>
          {error && (
            <motion.div 
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hand Selection */}
        <div>
          <label className="block font-bold text-sm mb-1 text-gray-700">Hand Type</label>
          <div className="relative">
            <select
              value={selectedHand?.name || ''}
              onChange={(e) => {
                const hand = HAND_RANKINGS.find(h => h.name === e.target.value);
                setSelectedHand(hand);
                setSelectedRank(null);
                setSelectedRank2(null);
                setSelectedSuit(null);
              }}
              className="w-full appearance-none select-field"
            >
              <option value="" disabled>Select a hand...</option>
              {HAND_RANKINGS.map(h => (
                <option key={h.value} value={h.name}>{h.name}</option>
              ))}
            </select>
            {/* Custom Arrow */}
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
        </div>

        {/* Dynamic Inputs based on Hand Selection */}
        {selectedHand && (
          <div className="space-y-4 mt-4">
            
            <div className="flex gap-4">
                {/* Primary Rank */}
                <div className="flex-1">
                  <label className="block font-bold text-sm mb-1 text-gray-700">
                    {selectedHand.name === 'Full House' ? 'Three of:' : (selectedHand.name === 'Two Pair' ? 'First Pair:' : 'Rank')}
                  </label>
                  <select
                    value={selectedRank || ''}
                    onChange={(e) => setSelectedRank(e.target.value)}
                    className="w-full select-field"
                  >
                     <option value="" disabled>Select Rank</option>
                     {RANKS.map(r => (
                       <option key={r} value={r}>{r}</option>
                     ))}
                  </select>
                </div>

                {/* Secondary Rank (Two Pair / Full House) */}
                {(selectedHand.name === 'Two Pair' || selectedHand.name === 'Full House') && (
                  <div className="flex-1">
                    <label className="block font-bold text-sm mb-1 text-gray-700">
                      {selectedHand.name === 'Full House' ? 'Two of:' : 'Second Pair:'}
                    </label>
                    <select
                      value={selectedRank2 || ''}
                      onChange={(e) => setSelectedRank2(e.target.value)}
                      className="w-full select-field"
                    >
                       <option value="" disabled>Select Rank</option>
                       {RANKS.map(r => (
                         <option key={r} value={r}>{r}</option>
                       ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Suit Selection */}
              {['Flush', 'Straight Flush', 'Royal Flush'].includes(selectedHand.name) && (
                <div>
                  <label className="block font-bold text-sm mb-1 text-gray-700">Suit</label>
                  <select
                    value={selectedSuit || ''}
                    onChange={(e) => setSelectedSuit(e.target.value)}
                    className={`w-full select-field ${
                       selectedSuit === '♥' || selectedSuit === '♦' ? 'text-red-600' : 'text-gray-800'
                    }`}
                  >
                     <option value="" disabled>Select Suit</option>
                     {['♠', '♥', '♦', '♣'].map(s => (
                       <option key={s} value={s} className={s === '♥' || s === '♦' ? 'text-red-600' : 'text-gray-800'}>
                         {s} {s === '♠' ? 'Spades' : s === '♥' ? 'Hearts' : s === '♦' ? 'Diamonds' : 'Clubs'}
                       </option>
                     ))}
                  </select>
                </div>
              )}

            {/* Confirm Button */}
            <motion.button
                onClick={makeClaim}
                disabled={
                  !selectedHand || 
                  !selectedRank || 
                  ((selectedHand.name === 'Two Pair' || selectedHand.name === 'Full House') && !selectedRank2) || 
                  ((['Flush', 'Straight Flush', 'Royal Flush'].includes(selectedHand.name)) && !selectedSuit)
                }
                className="w-full py-3 rounded-xl font-bold text-lg shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4 btn-primary"
                whileHover={{ scale: 1.02 }}
            >
                📢 Announce Claim
            </motion.button>
          </div>
        )}
      </div>
    );
  }

  // Avatar Popup Component
  function AvatarPopup({ isOpen, onClose, children }) {
    if (!isOpen) return null;

    return (
      <AnimatePresence>
        <motion.div
           className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           onClick={onClose}
        >
          <motion.div
             className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[80vh]"
             initial={{ scale: 0.9, y: 20 }}
             animate={{ scale: 1, y: 0 }}
             onClick={e => e.stopPropagation()}
          >
             <div className="sticky top-0 bg-white border-b p-3 flex items-center justify-center z-10 relative">
               <button 
                 onClick={onClose} 
                 className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-gray-100 rounded-full hover:bg-gray-200"
               >
                 ❌
               </button>
               <h3 className="font-bold text-lg">My Controls</h3>
             </div>
             {children}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  function TurnTimerRing({ active, turnStartedAt, totalSeconds }) {
    const safeTotal = Math.max(1, totalSeconds);
    const [secondsLeft, setSecondsLeft] = useState(active ? safeTotal : safeTotal);

    useEffect(() => {
      if (!active || !turnStartedAt) {
        setSecondsLeft(safeTotal);
        return;
      }

      const tick = () => {
        const elapsedMs = Date.now() - turnStartedAt;
        const remaining = Math.max(0, Math.ceil((safeTotal * 1000 - elapsedMs) / 1000));
        setSecondsLeft(remaining);
      };

      tick();
      const id = setInterval(tick, 250);
      return () => clearInterval(id);
    }, [active, turnStartedAt, safeTotal]);

    const safeLeft = Math.max(0, Math.min(secondsLeft, safeTotal));
    const progress = safeLeft / safeTotal;
    const degrees = Math.round(progress * 360);
    const danger = safeLeft <= 10;

    return (
      <div
        className={`timer-ring ${active ? 'timer-active' : 'timer-idle'} ${danger ? 'timer-danger' : ''}`}
        style={{ '--timer-deg': `${degrees}deg` }}
        title={active ? `${formatTime(safeLeft)} remaining` : `Turn limit ${formatTime(safeTotal)}`}
      >
        <div className="timer-core">
          <span className="timer-text">{active ? formatTime(safeLeft) : ''}</span>
        </div>
      </div>
    );
  }

  function TurnTimerPill({ active, turnStartedAt, totalSeconds }) {
    const safeTotal = Math.max(1, totalSeconds);
    const [secondsLeft, setSecondsLeft] = useState(safeTotal);

    useEffect(() => {
      if (!active || !turnStartedAt) {
        setSecondsLeft(safeTotal);
        return;
      }

      const tick = () => {
        const elapsedMs = Date.now() - turnStartedAt;
        const remaining = Math.max(0, Math.ceil((safeTotal * 1000 - elapsedMs) / 1000));
        setSecondsLeft(remaining);
      };

      tick();
      const id = setInterval(tick, 250);
      return () => clearInterval(id);
    }, [active, turnStartedAt, safeTotal]);

    const danger = secondsLeft <= 10;

    return (
      <div className={`turn-timer-pill ${danger ? 'turn-timer-danger' : ''}`}>
        <span className="turn-timer-label">Turn</span>
        <span className="turn-timer-value">{formatTime(secondsLeft)}</span>
        <span className="turn-timer-total">/ {formatTime(safeTotal)}</span>
      </div>
    );
  }

  function PlayerAvatar({ player, position, isActive, isStarter, delay = 0, currentClaim, formatClaim, isMe, onClick, turnStartedAt, turnTotalSeconds }) {
    return (
      <div
        className="absolute"
        style={{ left: `${position.x}%`, top: `${position.y}%`, transform: 'translate(-50%, -50%)', transition: 'all 0.5s ease-out' }}
      >
        {/* Speech Bubble for Current Claim */}
        {currentClaim && (
          <div
            className="absolute pointer-events-none z-50 whitespace-nowrap"
            style={{
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '12px'
            }}
          >
            <div className="relative bg-white rounded-xl shadow-xl px-4 py-2 border-2 border-gray-800">
              {/* Tail */}
              <div 
                className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-gray-800"
              />
              <div 
                className="absolute top-full left-1/2 -translate-x-1/2 -mt-[2px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white"
              />
              
              {/* Content */}
              <div className="text-center">
                <div className="text-sm text-gray-900 leading-tight">
                  {formatClaim(currentClaim)}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Star for starting player */}
        {isStarter && !player.eliminated && (
          <div
            className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl"
          >
            ⭐
          </div>
        )}
        
      {/* Self Highlight Background */}
      {isMe && !player.eliminated && (
        <div
          className="absolute rounded-full bg-blue-500 blur-xl -z-20"
          style={{
            width: '60px',
            height: '60px',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.15
          }}
        />
      )}

      {/* Clean animation for active player */}
      {isActive && !player.eliminated && (
        <>
            {/* Subtle inner glow - Static */}
            <div
              className="absolute rounded-full bg-yellow-400 blur-md -z-10"
              style={{
                width: '45px',
                height: '45px',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                opacity: 0.6
              }}
            />
          </>
        )}
        
        {/* Avatar Image */}
        <div className="flex flex-col items-center">
          <div className={`relative ${player.eliminated ? 'opacity-50 grayscale' : ''}`}>
             <motion.div 
               className={`rounded-full border-2 overflow-hidden bg-gray-800 ${
                isActive 
                  ? 'border-yellow-300' // Brighter border
                  : isMe ? 'border-blue-400 cursor-pointer hover:ring-2 hover:ring-blue-300' : 'border-gray-700 shadow-sm'
              }`}
               style={{
                 width: '32px', 
                 height: '32px',
                 boxShadow: isActive ? '0 0 15px rgba(250,204,21,0.9)' : isMe ? '0 0 10px rgba(59, 130, 246, 0.5)' : undefined,
                 borderColor: isActive ? '#facc15' : undefined,
                 transition: 'all 0.3s ease'
               }}
               animate={isActive ? { scale: [1, 1.15, 1] } : {}}
               whileHover={isMe && !player.eliminated ? { scale: 1.1 } : {}}
               onClick={onClick}
               transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
            >
             <img 
              src={AVATARS[player.avatarId] || AVATARS[0]} 
              alt="Avatar" 
              className="w-full h-full object-cover" 
             />
           </motion.div>
           <div className="absolute" style={{ left: '100%', top: '50%', transform: 'translate(10px, -50%)' }}>
             <TurnTimerRing
               active={isActive}
               turnStartedAt={turnStartedAt}
               totalSeconds={turnTotalSeconds}
             />
           </div>
           {/* ME Badge Removed */}
           {player.eliminated && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
               <span className="text-lg">❌</span>
             </div>
           )}
        </div>
          
          {/* Name plate */}
          {/* Name plate */}
          <div className="mt-1 flex items-center shadow-lg rounded-full overflow-hidden border border-gray-600" style={{ height: '16px' }}>
            {/* Name: Dark */}
            <div className="bg-gray-900 px-2 h-full flex items-center justify-center hover:bg-gray-800 transition-colors">
              <span className="text-[9px] font-bold text-white leading-none whitespace-nowrap max-w-[60px] truncate">{player.name}</span>
            </div>
            {/* Count: White */}
            {!player.eliminated && (
              <div className="bg-white pl-1.5 pr-1 h-full flex items-center justify-center border-l border-gray-300">
                <span className="text-[9px] font-extrabold text-blue-900 leading-none">{player.cardCount}</span>
                <span className="text-[8px] ml-0.5 leading-none opacity-80">🃏</span>
              </div>
            )}
            {/* Eliminated: Red */}
            {player.eliminated && (
              <div className="bg-red-600 px-1.5 h-full flex items-center justify-center border-l border-red-500">
                 <span className="text-[8px] font-bold text-white leading-none">OUT</span>
              </div>
            )}
          </div>
          
          {/* Danger Bar - Visualizes cards 0-5 */}
          {/* Danger Bar - Visualizes cards 0-5 */}
          {!player.eliminated && (
            <div className="mt-1 flex gap-0.5 bg-black/40 p-0.5 rounded backdrop-blur-sm">
              {[1, 2, 3, 4, 5].map((level) => {
                const filled = player.cardCount >= level;
                // Color logic:
                // 1-2: Cyan/Blue (Safe - High Contrast)
                // 3: Yellow (Warning)
                // 4: Orange (Danger)
                // 5: Red (Critical)
                let bgColor = 'bg-gray-400'; // Empty state - Lighter for visibility
                if (filled) {
                  if (player.cardCount <= 2) bgColor = 'bg-cyan-400 border border-cyan-200';
                  else if (player.cardCount === 3) bgColor = 'bg-yellow-400 border border-yellow-200';
                  else if (player.cardCount === 4) bgColor = 'bg-orange-500 border border-orange-300';
                  else bgColor = 'bg-red-600 border border-red-400';
                }
                
                return (
                  <div 
                    key={level}
                    className={`w-2.5 h-1.5 rounded-sm ${bgColor} ${filled ? 'shadow-[0_0_4px_rgba(0,0,0,0.8)] opacity-100' : 'opacity-40'}`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Round Result Modal - Shows when round ends
  function RoundResultModal({ result, allCards, onClose }) {
    if (!result) return null;
    
    const isTimeout = result.timeout === true;
    const wasHonest = result.wasLying === false || result.wasCorrect === true;
    const bgColor = isTimeout
      ? 'rgba(234, 88, 12, 0.95)'
      : (wasHonest ? 'rgba(22, 163, 74, 0.95)' : 'rgba(220, 38, 38, 0.95)');
    const borderColor = isTimeout
      ? '#ea580c'
      : (wasHonest ? '#16a34a' : '#dc2626');
    
    // Sort cards by rank first (A to 2), then by suit
    const sortedCards = allCards ? [...allCards].sort((a, b) => {
      const rankOrder = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
      const rankA = rankOrder.indexOf(a.rank);
      const rankB = rankOrder.indexOf(b.rank);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      const suitOrder = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 };
      return suitOrder[a.suit] - suitOrder[b.suit];
    }) : [];
    
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with result */}
            <div
              className="p-6 rounded-t-xl text-white text-center"
              style={{ backgroundColor: bgColor, borderBottom: `4px solid ${borderColor}` }}
            >
              <div className="text-6xl font-bold mb-2">
                {isTimeout ? '⏱ TIMEOUT' : (wasHonest ? '✅ HONEST!' : '🚨 BULLSHIT!')}
              </div>
              <div className="text-xl font-semibold">
                {isTimeout ? 'Turn Time Expired' : 'Round Complete'}
              </div>
            </div>

            {/* Body with cards and claim */}
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {/* The Claim */}
              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">Final Claim:</div>
                {result.claim || result.endingClaim ? (
                  <>
                    <div className="text-xl text-gray-900">
                      {formatClaim(result.claim || result.endingClaim)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      by {(result.claim || result.endingClaim)?.playerName}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500">No claim recorded (timer expired).</div>
                )}
              </div>

              {/* All Cards in Round - Sorted by Rank */}
              <div>
                <div className="text-sm font-semibold text-gray-600 mb-2">All Cards in Round (sorted by rank A to 2):</div>
                <div className="flex flex-wrap gap-1 justify-center bg-gray-50 p-4 rounded-lg">
                  {sortedCards.map((card, idx) => (
                    <div key={card.id || `${card.rank}-${card.suit}-${idx}`}>
                      <SmallPlayingCard rank={card.rank} suit={card.suit} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Result Details */}
              <div className="text-center p-4 bg-gray-100 rounded-lg">
                <div className="text-lg font-bold text-gray-900">
                  {result.loser && <span className="text-red-600">{result.loser}</span>}
                  {result.winner && <span className="text-green-600">{result.winner}</span>}
                  {result.loser ? ' gets +1 card' : ' wins the round!'}
                </div>
                {isTimeout && (
                  <div className="text-xs text-gray-600 mt-2">Reason: {result.reason || 'Time expired'}</div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold text-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // RENDER SCREENS

  if (showRules) {
    return (
      <motion.div 
        className="screen-shell"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div 
          className="panel p-6 max-w-2xl"
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <h1 className="text-3xl font-extrabold mb-6 text-center text-gray-900 border-b pb-4 app-title">📜 How to Play Bullshit Poker</h1>
          
          <div className="space-y-6 text-gray-700 max-h-[60vh] overflow-y-auto pr-2">
            
            <section>
              <h3 className="font-bold text-lg text-blue-600 mb-2">🏆 The Goal</h3>
              <p className="text-sm leading-relaxed">
                Be the last player standing! You lose cards when you make a wrong claim or a wrong "Bullshit" call. 
                If you get more than 5 cards, you are eliminated.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-lg text-green-600 mb-2">🃏 The Setup</h3>
              <p className="text-sm leading-relaxed">
                Every player starts with 1 card. The deck is distributed among all players. 
                You can only see <strong>YOUR</strong> cards, but you need to guess what poker hands can be made using <strong>EVERYONE'S</strong> cards combined.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-lg text-orange-600 mb-2">🗣️ Making Claims</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>On your turn, you must make a claim that is <strong>HIGHER</strong> than the previous claim.</li>
                <li>Example: If someone claims "Three 5s", you must claim something better, like "Three 6s" or a "Straight".</li>
                <li>You are claiming that this hand exists within <strong>ALL</strong> cards on the table (yours + everyone else's).</li>
                <li>You can lie! You don't need to have the cards you claim.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg text-red-600 mb-2">🚨 Calling Bullshit</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>If you think the previous player is lying (or just wrong), call <strong>BULLSHIT!</strong></li>
                <li>If they were <span className="text-red-600 font-bold">WRONG</span> (the hand doesn't exist), <strong>THEY</strong> draw a card.</li>
                <li>If they were <span className="text-green-600 font-bold">RIGHT</span> (the hand actually exists), <strong>YOU</strong> draw a card.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg text-amber-600 mb-2">⏱️ Turn Timer</h3>
              <p className="text-sm leading-relaxed">
                Each turn has a time limit. If the timer hits zero, that player gets +1 card and the round ends immediately.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-lg text-purple-600 mb-2">📈 Hand Rankings (Low to High)</h3>
              <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded border">
                <div>1. High Card</div>
                <div>6. Flush (5 cards same suit)</div>
                <div>2. Pair (2 same rank)</div>
                <div>7. Full House (3 same + 2 same)</div>
                <div>3. Two Pair</div>
                <div>8. Four of a Kind</div>
                <div>4. Three of a Kind</div>
                <div>9. Straight Flush</div>
                <div>5. Straight (5 in row)</div>
                <div>10. Royal Flush</div>
              </div>
            </section>

          </div>
          <motion.button 
            onClick={() => setShowRules(false)} 
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded w-full font-bold"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Got It
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }

  if (screen === 'home') {
    return (
      <div className="screen-shell">
        <motion.div 
          className="panel p-8 max-w-md w-full"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <motion.h1 
            className="text-3xl font-bold text-center mb-2 app-title"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Bullshit Poker
          </motion.h1>
          <motion.p 
            className="text-center mb-6 app-subtitle"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Bluff Your Way to Victory
          </motion.p>
          
          <motion.button 
            onClick={() => setShowRules(true)} 
            className="w-full mb-4 py-2 rounded font-medium btn-ghost"
            whileHover={{ scale: 1.02, backgroundColor: '#e5e7eb' }}
            whileTap={{ scale: 0.98 }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            How to Play
          </motion.button>
          
          <motion.input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full mb-4 outline-none input-field"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          />

          <div className="mb-4">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Turn Time Limit</label>
            <div className="relative">
              <select
                value={turnTimeSeconds}
                onChange={(e) => updateTurnTime(e.target.value)}
                className="w-full appearance-none select-field"
              >
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={90}>1.5 minutes</option>
                <option value={120}>2 minutes (default)</option>
                <option value={180}>3 minutes</option>
                <option value={240}>4 minutes</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">If the timer hits zero, the player gets +1 card and the round ends.</div>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div 
                className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Password Inputs Removed */}

          <motion.button 
            onClick={createGame} 
            className="w-full py-3 rounded mb-3 font-bold btn-primary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Create New Game
          </motion.button>
          
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span className="text-gray-500 text-sm">OR</span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>
          
          <motion.input
            type="text"
            placeholder="Enter Game PIN"
            value={gamePin}
            onChange={(e) => setGamePin(e.target.value.toUpperCase())}
            className="w-full mb-4 outline-none input-field"
            transition={{ delay: 0.75 }}
          />

          {/* Join Password Input Removed */}

          <motion.button 
            onClick={joinGame} 
            className="w-full py-3 rounded font-bold btn-secondary"
            whileHover={{ scale: 1.02, backgroundColor: '#1f2937' }}
            whileTap={{ scale: 0.98 }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.85 }}
          >
            Join Game
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (screen === 'lobby' && gameState && !gameState.started) {
    const isHost = playerId === gameState.host;
    const turnSeconds = gameState.turnTimeSeconds || DEFAULT_TURN_TIME_SECONDS;
    
    return (
      <div className="screen-shell">
        <motion.div 
          className="panel p-8 max-w-md w-full"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <h2 className="text-2xl font-bold text-center mb-4 app-title">Game Lobby</h2>
          
          <div className="bg-blue-50 p-4 rounded mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Game PIN</p>
              <p className="text-2xl font-bold">{gamePin}</p>
            </div>
            <motion.button 
              onClick={copyPIN} 
              className="p-2"
              whileTap={{ scale: 0.9 }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={copied ? 'check' : 'copy'}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 180 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {copied ? <Check className="text-green-600" /> : <Copy />}
                </motion.div>
              </AnimatePresence>
            </motion.button>
          </div>

          <div className="bg-gray-50 p-4 rounded mb-6">
            <div className="text-sm text-gray-600 mb-2">Turn Time Limit</div>
            {isHost ? (
              <div className="relative">
                <select
                  value={turnSeconds}
                  onChange={(e) => updateTurnTime(e.target.value)}
                  className="w-full appearance-none select-field"
                >
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={90}>1.5 minutes</option>
                  <option value={120}>2 minutes (default)</option>
                  <option value={180}>3 minutes</option>
                  <option value={240}>4 minutes</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            ) : (
              <div className="text-lg font-bold text-gray-900">{formatTime(turnSeconds)} per turn</div>
            )}
            <div className="text-xs text-gray-500 mt-2">Timer expiry gives +1 card and ends the round.</div>
          </div>
          
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Users />
              <span className="font-semibold">Players ({gameState.players.length}/10)</span>
            </div>
            <AnimatePresence>
              {gameState.players.map((player, idx) => (
                <motion.div 
                  key={player.id} 
                  className="bg-gray-50 p-3 rounded mb-2"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-300">
                      <img 
                        src={AVATARS[player.avatarId] || AVATARS[0]} 
                        alt="Avatar" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div>
                      <span className="font-bold text-gray-800">{player.name}</span>
                      {player.isBot && <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">BOT</span>}
                      {player.id === gameState.host && <span className="ml-2 text-yellow-500 text-sm">⭐ HOST</span>}
                    </div>
                    {isHost && player.isBot && (
                      <button
                        onClick={() => removeBot(player.id)}
                        className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-semibold hover:bg-red-200"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {isHost && gameState.players.length < 10 && (
            <motion.button 
              onClick={addBot} 
              className="w-full py-2 rounded mb-3 font-bold btn-secondary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Add Bot
            </motion.button>
          )}
          
          {isHost && gameState.players.length >= 2 && (
            <motion.button 
              onClick={startGame} 
              className="w-full py-3 rounded mb-3 font-bold btn-primary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              Start Game
            </motion.button>
          )}
          
          <motion.button 
            onClick={resetGame} 
            className="w-full py-2 rounded text-sm btn-ghost"
            whileHover={{ backgroundColor: '#d1d5db' }}
            whileTap={{ scale: 0.98 }}
          >
            Leave Game
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (gameState && gameState.started) {
    const player = gameState.players.find(p => p.id === playerId);
    const activePlayers = gameState.players.filter(p => !p.eliminated);
    const currentActiveIndex = activePlayers.findIndex(p => p.id === playerId);
    const isMyTurn = activePlayers[gameState.currentPlayer]?.id === playerId;
    const isStartingPlayer = currentActiveIndex === gameState.startingPlayer;
    const isEndingTurn = isStartingPlayer && isMyTurn && gameState.currentClaim;
    const turnTimeLimitSeconds = gameState.turnTimeSeconds || DEFAULT_TURN_TIME_SECONDS;

    if (gameState.winner) {
      return (
        <div className="screen-shell">
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={500}
          />
          <motion.div 
            className="panel p-8 max-w-md w-full text-center"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 0.5,
                repeat: Infinity,
                repeatDelay: 1
              }}
            >
              <h1 className="text-4xl mb-4">🏆</h1>
            </motion.div>
            
            <motion.h2 
              className="text-3xl font-bold mb-2"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Game Over!
            </motion.h2>
            
            <motion.p 
              className="text-xl mb-6"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {gameState.winner} wins! 🎉
            </motion.p>
            
            <motion.button 
              onClick={resetGame} 
              className="bg-blue-600 text-white px-6 py-3 rounded font-bold"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              New Game
            </motion.button>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="h-screen bg-gray-100 flex flex-col">
        {/* Round Result Modal */}
        {showRoundResult && gameState.lastResult && (
          <RoundResultModal
            result={gameState.lastResult}
            allCards={gameState.lastResult.allCardsInRound || gameState.allCards}
            onClose={handleCloseModal}
          />
        )}
        
        {/* Header */}
        <motion.div 
          className="bg-white shadow px-4 py-3 flex justify-between items-center"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <h1 className="text-xl font-bold">Bullshit Poker <span className="text-sm font-normal ml-2 bg-gray-100 px-2 py-1 rounded">PIN: {gamePin}</span></h1>
          <div className="flex items-center gap-3">
            <TurnTimerPill
              active={Boolean(gameState.turnStartedAt)}
              turnStartedAt={gameState.turnStartedAt}
              totalSeconds={turnTimeLimitSeconds}
            />
            {gameState.lastResult && (
              <motion.button 
                onClick={() => setShowRoundResult(true)} 
                className="text-sm bg-amber-400 text-gray-900 px-4 py-2 rounded-full font-bold shadow-lg border-2 border-amber-300 flex items-center gap-2"
                whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(251, 191, 36, 0.5)" }}
                whileTap={{ scale: 0.95 }}
              >
                <span>📊</span> View Last Round
              </motion.button>
            )}
            <motion.button 
              onClick={() => setShowRules(true)} 
              className="text-sm bg-white text-blue-600 border-2 border-blue-600 px-4 py-2 rounded-full font-bold shadow-sm hover:bg-blue-50"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              📜 Rules
            </motion.button>
          </div>
        </motion.div>



        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* Maximize Toggle - Fixed to Screen Top-Right via Inline Style */}
          {gameState && !gameState.winner && (
             <button
              onClick={() => setIsMaximized(!isMaximized)}
              style={{
                position: isMaximized ? 'fixed' : 'absolute',
                top: '16px',
                right: '16px',
                zIndex: isMaximized ? 10000 : 40 
              }}
              className="bg-blue-600 text-white p-3 rounded-full border-2 border-white hover:bg-blue-700 transition-all shadow-xl"
              title={isMaximized ? "Minimize" : "Maximize (Landscape Mode)"}
            >
              {isMaximized ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
            </button>
          )}

          {/* LEFT - Poker Table */}
          <div 
            className={isMaximized ? 'maximized-container' : 'w-full bg-green-950 flex items-center justify-center p-8 relative overflow-hidden transition-all duration-500'}
          >
             {/* Subtle pattern overlay - Global */}
             <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
               backgroundImage: 'radial-gradient(circle at 20px 20px, rgba(255,255,255,0.2) 2px, transparent 2px)',
               backgroundSize: '40px 40px'
             }} />
             <div className={isMaximized ? 'maximized-table-wrapper is-rotated' : 'w-full h-full flex items-center justify-center'}>
                 {/* Inner Content Wrapper to keep existing structure working */}
                 <div className="relative w-full h-full flex items-center justify-center">
                 

            
            <motion.div 
              className={`relative w-full h-full transition-all duration-500 ${
                isMaximized ? 'max-w-none w-[95%] h-[85%]' : 'max-w-[600px] max-h-[600px] aspect-square'
              }`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              {/* Stylized elliptical table surface */}
              <div 
                className="absolute inset-0 rounded-[100px] md:rounded-full shadow-2xl"
                style={{
                  background: 'radial-gradient(ellipse at center, #8B4513 0%, #5D4037 60%, #3E2723 100%)', // Brown gradient
                  boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5), 0 20px 60px rgba(0,0,0,0.5)',
                  borderRadius: isMaximized ? '40%' : '50%'
                }}
              />
              
              {/* Decorative border */}
              <div 
                className="absolute inset-0"
                style={{
                  border: '8px solid #92400e', // Solid color to respect radius
                  borderRadius: isMaximized ? '40%' : '50%',
                  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.4), 0 0 0 2px rgba(180, 83, 9, 0.5)', // Added outer glow for detail
                }}
              />
              
              {/* Center logo with better styling */}
              <motion.div
                className="absolute inset-0 m-auto w-32 h-32 rounded-full flex items-center justify-center border-4 shadow-xl"
                style={{
                  background: 'radial-gradient(circle, #14532d, #052e16)',
                  borderColor: '#ca8a04',
                  boxShadow: '0 0 30px rgba(202, 138, 4, 0.3), inset 0 0 20px rgba(0,0,0,0.5)',
                }}
              >
                <div className="text-yellow-500 text-center font-bold text-sm" style={{textShadow: '0 2px 4px rgba(0,0,0,0.5)'}}>
                  BULLSHIT<br/>POKER <span className="text-[10px] opacity-60">v2.3</span>
                </div>
              </motion.div>
              
              {/* Players */}
              <AnimatePresence>
                {gameState.players.map((p, idx) => {
                  const isStarter = activePlayers[gameState.startingPlayer]?.id === p.id;
                  const isCurrent = activePlayers[gameState.currentPlayer]?.id === p.id;
                  
                  // ROTATION LOGIC:
                  // 1. Find the index of "ME" (the viewing player)
                  // 2. We want "ME" to be at 90 degrees (Bottom of circle)
                  // 3. rawAngle = (idx * 360) / total
                  // 4. offset = 90 - ((myIndex * 360) / total)
                  // 5. finalAngle = rawAngle + offset
                  
                  const total = gameState.players.length;
                  const myIndex = gameState.players.findIndex(pl => pl.id === player.id);
                  const rawAngle = (idx * 360) / total;
                  const offset = myIndex !== -1 ? (90 - ((myIndex * 360) / total)) : -90; // Default to -90 if not found (standard layout)
                  
                  const angle = rawAngle + offset;
                  const rad = (angle * Math.PI) / 180;
                  
                  // Radius (percentage of container size)
                  // Use slightly different radii for x and y to create oval effect if desired, 
                  // but circle is fine for now. 
                  // 40% radius keeps them inside the 100% box with padding.
                  const x = 50 + 40 * Math.cos(rad);
                  const y = 50 + 40 * Math.sin(rad);
                  
                  // Find the latest claim made by this player in the current round history
                  // We reverse the history to find the most recent one first
                  const playerLatestClaim = [...(gameState.claimHistory || [])].reverse().find(c => c.playerId === p.id);
                  // Use either the active current claim (if matches) or the history claim
                  const claimDisplay = (gameState.currentClaim && gameState.currentClaim.playerId === p.id) 
                    ? gameState.currentClaim 
                    : playerLatestClaim;
                  
                  return (
                    <PlayerAvatar
                      key={p.id}
                      player={p}
                      position={{ x, y }}
                      isActive={isCurrent}
                      isStarter={isStarter}
                      delay={idx * 0.1}
                      currentClaim={claimDisplay}
                      formatClaim={formatClaim}
                      isMe={p.id === player.id}
                      turnStartedAt={gameState.turnStartedAt}
                      turnTotalSeconds={turnTimeLimitSeconds}
                      // onClick={() => p.id === player.id && setShowAvatarPopup(true)}
                    />
                  );
                })}
              </AnimatePresence>
            </motion.div>

            {/* BS Button - Moved to Control Bar */}
            <AnimatePresence>
               {/* Button removed from here */}
            </AnimatePresence>

            {/* On-Table Controls Overlay */}
            {!player.eliminated && (
              <motion.div 
                className={`absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col items-center z-30 pointer-events-auto transition-all duration-300 ${
                  isMaximized ? 'pb-8 scale-90 origin-bottom portrait:pb-8 portrait:scale-90 portrait:origin-bottom landscape:pb-6' : ''
                }`}
                initial={{ y: 200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, type: 'spring', damping: 20 }}
              >
                 <div className="max-w-2xl w-full flex flex-col gap-4">
                    {/* 1. Hand Display */}
                    <HandDisplay player={player} />
                    
                    {/* 2. Control Bar */}
                    <div className="flex items-center justify-center gap-48">
                       {/* Make Claim Button */}
                       {isMyTurn && (
                         <motion.button
                           onClick={() => {
                             setError('');
                             setShowClaimModal(true);
                           }}
                           className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg hover:bg-blue-500 border-2 border-blue-400"
                           whileHover={{ scale: 1.05 }}
                           whileTap={{ scale: 0.95 }}
                           animate={{ 
                             boxShadow: ['0 0 0px rgba(37, 99, 235, 0)', '0 0 20px rgba(37, 99, 235, 0.5)', '0 0 0px rgba(37, 99, 235, 0)'] 
                           }}
                           transition={{ duration: 2, repeat: Infinity }}
                         >
                           👋 Make a Claim
                         </motion.button>
                       )}

                       {/* Call Bullshit Button */}
                       <AnimatePresence>
                        {gameState.currentClaim && gameState.currentClaim.playerId !== player.id && (
                            <motion.button 
                            onClick={callBullshit} 
                            className="bg-red-600 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg hover:bg-red-500 border-2 border-red-400 flex items-center gap-2"
                            initial={{ scale: 0, width: 0 }}
                            animate={{ scale: 1, width: 'auto' }}
                            exit={{ scale: 0, width: 0 }}
                            whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(220, 38, 38, 0.8)" }}
                            whileTap={{ scale: 0.95 }}
                            >
                            <span>🚨</span> BULLSHIT!
                            </motion.button>
                        )}
                        </AnimatePresence>
                    </div>

                    {/* Waiting Indicator - Overlay */}
                    {!isMyTurn && (
                         <div className="text-white/60 text-sm font-medium text-center bg-black/30 px-4 py-1 rounded-full mx-auto">
                            Waiting for {gameState.players[gameState.currentPlayer]?.name}...
                         </div>
                    )}
                 </div>
              </motion.div>
            )}

            {/* Claim Modal Popup */}
            <AnimatePresence>
              {showClaimModal && (
                <motion.div
                  className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowClaimModal(false)}
                >
                  <motion.div
                    className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 relative overflow-hidden"
                    initial={{ scale: 0.9, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 50 }}
                    onClick={e => e.stopPropagation()}
                  >
                     <button 
                       onClick={() => setShowClaimModal(false)}
                       className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
                     >
                       ✕
                     </button>
                     
                     <h2 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-2">Make Your Claim</h2>
                     
                     <ClaimForm 
                        selectedHand={selectedHand} setSelectedHand={setSelectedHand}
                        selectedRank={selectedRank} setSelectedRank={setSelectedRank}
                        selectedRank2={selectedRank2} setSelectedRank2={setSelectedRank2}
                        selectedSuit={selectedSuit} setSelectedSuit={setSelectedSuit}
                        makeClaim={() => {
                             makeClaim();
                             setShowClaimModal(false);
                        }}
                        error={error}
                     />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
                 </div>
             </div>
          </div>
          
          {/* Avatar Popup - KEEP as requested, but simplified or functional?
              User said "claim button will open the pop". I interpreted that as the NEW pop.
              The AvatarPopup logic reused GameControls. I removed GameControls.
              So I must update AvatarPopup usage to use HandDisplay or just hide it?
              Wait, the previous `AvatarPopup` usage at line 2098...
              I will assume I need to Fix that too or maybe I should just define AvatarPopup to use HandDisplay + ClaimForm as well?
              
              Actually, the user said "we can keep the pop up also".
              So I should fix the AvatarPopup usage below.
          */} 
          
          <AvatarPopup isOpen={showAvatarPopup} onClose={() => setShowAvatarPopup(false)}>
             {/* Re-implement simplified controls in popup or just HandDisplay? 
                 Let's put HandDisplay and a button to open Claim Modal? 
                 Or simply replicate the on-table layout?
                 For now, let's put HandDisplay + ClaimForm again so it's fully functional. 
             */}
             <div className="p-4">
               <HandDisplay player={player} />
               <div className="mt-4">
                 {isMyTurn && (
                     <ClaimForm 
                        selectedHand={selectedHand} setSelectedHand={setSelectedHand}
                        selectedRank={selectedRank} setSelectedRank={setSelectedRank}
                        selectedRank2={selectedRank2} setSelectedRank2={setSelectedRank2}
                        selectedSuit={selectedSuit} setSelectedSuit={setSelectedSuit}
                        makeClaim={() => {
                             makeClaim();
                             setShowAvatarPopup(false);
                        }}
                        error={error}
                     />
                 )}
               </div>
             </div>
          </AvatarPopup>
        </div>
      </div>
    );
  }

  return null;
}
