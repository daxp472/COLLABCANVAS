import express from 'express';
import { createGameSession, getGameSession, sanitizeGameState } from '../services/gameEngine.js';
import { authMiddleware } from '../middleware/auth.js';
import { getDB } from '../config/db.js';

const router = express.Router();

// Create game session
router.post('/rooms/:roomId', authMiddleware, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { type, config } = req.body;
    const gameState = await createGameSession({
      roomId,
      type: type || 'draw_and_guess',
      hostId: req.user.userId,
      config: config || {}
    });
    res.status(201).json({ game: gameState });
  } catch (err) {
    next(err);
  }
});

// Get active game status
router.get('/:gameId', authMiddleware, async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const session = getGameSession(gameId);
    if (!session) {
      // Check database for finished games
      const db = getDB();
      const dbGame = await db.collection('games').findOne({ gameId });
      if (!dbGame) {
        return res.status(404).json({ error: { code: 'GAME_NOT_FOUND', message: 'Game session not found' } });
      }
      return res.json({ game: dbGame });
    }
    res.json({ game: sanitizeGameState(session) });
  } catch (err) {
    next(err);
  }
});

export default router;
