import express from 'express';
import { searchGlobal, searchInBoard } from '../services/searchService.js';
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Global search (rooms, templates, boards)
router.get('/', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const { q, limit } = req.query;
    const results = await searchGlobal({
      query: q,
      userId: req.user?.userId,
      limit: parseInt(limit, 10) || 20
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// In-board search
router.get('/boards/:boardId', authMiddleware, async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const { q, limit } = req.query;
    const results = await searchInBoard({
      boardId,
      query: q,
      limit: parseInt(limit, 10) || 30
    });
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

export default router;
