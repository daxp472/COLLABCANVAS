import { nanoid } from 'nanoid';
import { getDB } from '../config/db.js';

// In-memory active game state instances (synced to MongoDB on transitions)
const activeGameSessions = new Map();

// Curated Word Dictionary for Draw & Guess
export const WORD_DICTIONARY = [
  { word: 'PIZZA', category: 'Food', difficulty: 'easy' },
  { word: 'GUITAR', category: 'Music', difficulty: 'easy' },
  { word: 'DOLPHIN', category: 'Animals', difficulty: 'easy' },
  { word: 'CASTLE', category: 'Architecture', difficulty: 'medium' },
  { word: 'TELESCOPE', category: 'Science', difficulty: 'medium' },
  { word: 'VOLCANO', category: 'Nature', difficulty: 'medium' },
  { word: 'SUBMARINE', category: 'Vehicles', difficulty: 'medium' },
  { word: 'HELICOPTER', category: 'Vehicles', difficulty: 'medium' },
  { word: 'ASTRONAUT', category: 'Space', difficulty: 'hard' },
  { word: 'LABYRINTH', category: 'Mythology', difficulty: 'hard' },
  { word: 'ROLLERCOASTER', category: 'Theme Park', difficulty: 'hard' },
  { word: 'RAINBOW', category: 'Weather', difficulty: 'easy' },
  { word: 'CAMPFIRE', category: 'Outdoors', difficulty: 'easy' }
];

// Curated Quiz Decks for Educational Quiz Battle
export const QUIZ_DECKS = [
  {
    question: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Mercury'],
    correctIndex: 1,
    timeLimit: 20
  },
  {
    question: 'What is the chemical symbol for Gold?',
    options: ['Au', 'Ag', 'Fe', 'Gd'],
    correctIndex: 0,
    timeLimit: 20
  },
  {
    question: 'Which data structure follows the First In, First Out (FIFO) principle?',
    options: ['Stack', 'Tree', 'Queue', 'Graph'],
    correctIndex: 2,
    timeLimit: 20
  },
  {
    question: 'How many bits are in a single byte?',
    options: ['4', '8', '16', '32'],
    correctIndex: 1,
    timeLimit: 15
  },
  {
    question: 'What is the speed of light in vacuum approximately?',
    options: ['300,000 km/s', '150,000 km/s', '30,000 km/s', '1,000,000 km/s'],
    correctIndex: 0,
    timeLimit: 20
  }
];

export async function createGameSession({ roomId, type = 'draw_and_guess', hostId, config = {} }) {
  const db = getDB();
  const gameId = `gm_${nanoid(8)}`;

  const session = {
    gameId,
    roomId,
    type,
    hostId,
    status: 'WAITING', // WAITING | STARTING | IN_PROGRESS | ROUND_RESULTS | FINISHED
    currentRound: 0,
    totalRounds: config.totalRounds || (type === 'quiz_battle' ? QUIZ_DECKS.length : 3),
    roundDuration: config.roundDuration || 60,
    remainingSeconds: 0,
    participants: new Map(), // userId -> { userId, displayName, avatarUrl, score, streak }
    activeDrawerId: null,
    currentWord: null, // Secret, never leaked to guessers
    currentCategory: '',
    hintMask: '',
    guessedUsers: new Set(),
    quizQuestionIndex: 0,
    votes: new Map(), // voterId -> targetId
    submissions: new Map(), // userId -> submissionPayload
    timerInterval: null
  };

  activeGameSessions.set(gameId, session);

  // Persist game in DB
  await db.collection('games').insertOne({
    gameId,
    roomId,
    type,
    hostId,
    status: 'waiting',
    currentRound: 0,
    totalRounds: session.totalRounds,
    config,
    scoreboard: {},
    createdAt: new Date()
  });

  return sanitizeGameState(session);
}

export function getGameSession(gameId) {
  return activeGameSessions.get(gameId);
}

export function joinGameParticipant(gameId, user) {
  const session = activeGameSessions.get(gameId);
  if (!session) return null;

  if (!session.participants.has(user.userId)) {
    session.participants.set(user.userId, {
      userId: user.userId,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || '',
      score: 0,
      streak: 0,
      isReady: true
    });
  }

  return sanitizeGameState(session);
}

export function startGame(gameId, io) {
  const session = activeGameSessions.get(gameId);
  if (!session) return null;

  session.status = 'STARTING';
  session.currentRound = 0;

  // Broadcast starting state
  io.to(`room:${session.roomId}`).emit('game:state', sanitizeGameState(session));

  setTimeout(() => {
    startNextRound(gameId, io);
  }, 2500);

  return sanitizeGameState(session);
}

export function startNextRound(gameId, io) {
  const session = activeGameSessions.get(gameId);
  if (!session) return;

  if (session.timerInterval) {
    clearInterval(session.timerInterval);
    session.timerInterval = null;
  }

  session.currentRound += 1;
  if (session.currentRound > session.totalRounds) {
    finishGame(gameId, io);
    return;
  }

  session.status = 'IN_PROGRESS';
  session.guessedUsers.clear();
  session.votes.clear();
  session.submissions.clear();

  const participantIds = Array.from(session.participants.keys());

  if (session.type === 'draw_and_guess') {
    // Select drawer round-robin
    const drawerIndex = (session.currentRound - 1) % participantIds.length;
    session.activeDrawerId = participantIds[drawerIndex] || session.hostId;

    // Pick secret word
    const wordObj = WORD_DICTIONARY[Math.floor(Math.random() * WORD_DICTIONARY.length)];
    session.currentWord = wordObj.word.toUpperCase();
    session.currentCategory = wordObj.category;
    session.hintMask = session.currentWord.split('').map(c => (c === ' ' ? ' ' : '_')).join(' ');
    session.remainingSeconds = session.roundDuration;

    // Send secret word ONLY to drawer socket
    const roomSockets = io.sockets.adapter.rooms.get(`room:${session.roomId}`);
    if (roomSockets) {
      for (const socketId of roomSockets) {
        const s = io.sockets.sockets.get(socketId);
        if (s && s.user && s.user.userId === session.activeDrawerId) {
          s.emit('game:drawer:word', {
            secretWord: session.currentWord,
            category: session.currentCategory
          });
        }
      }
    }
  } else if (session.type === 'quiz_battle') {
    const qIndex = (session.currentRound - 1) % QUIZ_DECKS.length;
    session.quizQuestionIndex = qIndex;
    const q = QUIZ_DECKS[qIndex];
    session.remainingSeconds = q.timeLimit || 20;
  } else if (session.type === 'quick_draw') {
    const prompts = ['A Flying Robot', 'Cyberpunk City', 'Tropical Island Paradise', 'Giant Monster attacking bridge', 'Futuristic Bicycle'];
    session.currentCategory = 'Quick Draw Challenge';
    session.currentWord = prompts[(session.currentRound - 1) % prompts.length];
    session.remainingSeconds = 45;
  } else {
    session.remainingSeconds = session.roundDuration;
  }

  // Broadcast round start to room
  io.to(`room:${session.roomId}`).emit('game:round:started', {
    roundNumber: session.currentRound,
    totalRounds: session.totalRounds,
    ...sanitizeGameState(session)
  });

  // Start Server-Authoritative Timer
  session.timerInterval = setInterval(() => {
    session.remainingSeconds -= 1;

    // Timer tick broadcast
    io.to(`room:${session.roomId}`).emit('game:timer:tick', {
      remainingSeconds: Math.max(0, session.remainingSeconds)
    });

    // Mask revelation hint at halfway point for draw_and_guess
    if (session.type === 'draw_and_guess' && session.remainingSeconds === Math.floor(session.roundDuration / 2)) {
      revealHintMaskLetter(session);
      io.to(`room:${session.roomId}`).emit('game:hint:update', { hintMask: session.hintMask });
    }

    if (session.remainingSeconds <= 0) {
      clearInterval(session.timerInterval);
      session.timerInterval = null;
      endRound(gameId, io);
    }
  }, 1000);
}

function revealHintMaskLetter(session) {
  if (!session.currentWord) return;
  const chars = session.currentWord.split('');
  const maskChars = session.hintMask.split(' ');
  const hiddenIndices = [];
  for (let i = 0; i < chars.length; i++) {
    if (maskChars[i] === '_') hiddenIndices.push(i);
  }
  if (hiddenIndices.length > 1) {
    const pick = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
    maskChars[pick] = chars[pick];
    session.hintMask = maskChars.join(' ');
  }
}

export function submitGuess(gameId, userId, guessText, io) {
  const session = activeGameSessions.get(gameId);
  if (!session || session.status !== 'IN_PROGRESS') return { correct: false };

  if (session.type === 'draw_and_guess') {
    if (userId === session.activeDrawerId) return { correct: false, isDrawer: true };
    if (session.guessedUsers.has(userId)) return { correct: true, alreadyGuessed: true };

    const normalizedGuess = guessText.trim().toUpperCase();
    if (normalizedGuess === session.currentWord) {
      session.guessedUsers.add(userId);

      // Scoring formula: Base + speed bonus
      const speedBonus = Math.floor(400 * (session.remainingSeconds / session.roundDuration));
      const firstGuesserBonus = session.guessedUsers.size === 1 ? 50 : 0;
      const points = 100 + speedBonus + firstGuesserBonus;

      const p = session.participants.get(userId);
      if (p) p.score += points;

      // Drawer also receives points for players guessing
      const drawer = session.participants.get(session.activeDrawerId);
      if (drawer) drawer.score += 75;

      // Broadcast correct guess announcement WITHOUT revealing the word
      io.to(`room:${session.roomId}`).emit('game:guess:correct', {
        userId,
        displayName: p?.displayName || 'A player',
        pointsAwarded: points,
        scores: getScoresObject(session)
      });

      // If all guessers got it, end round early!
      const totalGuessers = Math.max(1, session.participants.size - 1);
      if (session.guessedUsers.size >= totalGuessers) {
        clearInterval(session.timerInterval);
        session.timerInterval = null;
        endRound(gameId, io);
      }

      return { correct: true, points };
    }
  }

  return { correct: false };
}

export function submitQuizAnswer(gameId, userId, optionIndex, io) {
  const session = activeGameSessions.get(gameId);
  if (!session || session.status !== 'IN_PROGRESS' || session.type !== 'quiz_battle') return null;

  if (session.submissions.has(userId)) return null; // Only 1 submission allowed

  const q = QUIZ_DECKS[session.quizQuestionIndex];
  const isCorrect = optionIndex === q.correctIndex;
  const p = session.participants.get(userId);

  let points = 0;
  if (isCorrect && p) {
    p.streak += 1;
    const speedRatio = Math.max(0, session.remainingSeconds / (q.timeLimit || 20));
    const streakBonus = Math.min(1.5, 1 + (p.streak - 1) * 0.1);
    points = Math.floor((500 + 500 * speedRatio) * streakBonus);
    p.score += points;
  } else if (p) {
    p.streak = 0;
  }

  session.submissions.set(userId, { optionIndex, isCorrect, points });

  // If everyone submitted, end round immediately
  if (session.submissions.size >= session.participants.size) {
    clearInterval(session.timerInterval);
    session.timerInterval = null;
    endRound(gameId, io);
  }

  return { isCorrect, points };
}

export function endRound(gameId, io) {
  const session = activeGameSessions.get(gameId);
  if (!session) return;

  session.status = 'ROUND_RESULTS';

  const roundResult = {
    roundNumber: session.currentRound,
    revealedWord: session.currentWord,
    correctQuizIndex: session.type === 'quiz_battle' ? QUIZ_DECKS[session.quizQuestionIndex]?.correctIndex : null,
    scores: getScoresObject(session)
  };

  io.to(`room:${session.roomId}`).emit('game:round:ended', roundResult);

  // Transition to next round after 5 seconds
  setTimeout(() => {
    startNextRound(gameId, io);
  }, 5000);
}

export async function finishGame(gameId, io) {
  const session = activeGameSessions.get(gameId);
  if (!session) return;

  session.status = 'FINISHED';
  const finalScores = getScoresObject(session);

  // Determine winners
  const leaderboard = Array.from(session.participants.values())
    .sort((a, b) => b.score - a.score);

  const results = {
    gameId,
    leaderboard,
    winner: leaderboard[0] || null,
    totalRounds: session.totalRounds
  };

  io.to(`room:${session.roomId}`).emit('game:results', results);

  // Update DB
  const db = getDB();
  await db.collection('games').updateOne(
    { gameId },
    {
      $set: {
        status: 'finished',
        scoreboard: finalScores,
        endedAt: new Date()
      }
    }
  );
}

function getScoresObject(session) {
  const scores = {};
  for (const [uid, p] of session.participants.entries()) {
    scores[uid] = p.score;
  }
  return scores;
}

export function sanitizeGameState(session) {
  const participants = Array.from(session.participants.values()).map(p => ({
    userId: p.userId,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    score: p.score,
    streak: p.streak
  }));

  const state = {
    gameId: session.gameId,
    roomId: session.roomId,
    type: session.type,
    status: session.status,
    currentRound: session.currentRound,
    totalRounds: session.totalRounds,
    remainingSeconds: session.remainingSeconds,
    participants,
    activeDrawerId: session.activeDrawerId,
    category: session.currentCategory,
    hintMask: session.hintMask,
    // Do NOT include secretWord!
    scores: getScoresObject(session)
  };

  if (session.type === 'quiz_battle' && session.status === 'IN_PROGRESS') {
    const q = QUIZ_DECKS[session.quizQuestionIndex];
    state.quizQuestion = {
      question: q.question,
      options: q.options
      // Do NOT include correctIndex!
    };
  }

  return state;
}
