import express from 'express';
import { getBoard, getPageObjects, addPage, updatePage, deletePage, applyBoardOperation } from '../services/boardService.js';
import { getBoardRecoveryState, createSnapshot } from '../services/snapshotService.js';
import { authMiddleware } from '../middleware/auth.js';
import { getDB } from '../config/db.js';

const router = express.Router();

// Get board details and page hierarchy
router.get('/:boardId', authMiddleware, async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const board = await getBoard(boardId);
    if (!board) {
      return res.status(404).json({
        error: { code: 'BOARD_NOT_FOUND', message: 'Board not found' }
      });
    }
    res.json({ board });
  } catch (err) {
    next(err);
  }
});

// Get objects for a specific page
router.get('/:boardId/pages/:pageId/objects', authMiddleware, async (req, res, next) => {
  try {
    const { boardId, pageId } = req.params;
    const objects = await getPageObjects(boardId, pageId);
    res.json({ objects });
  } catch (err) {
    next(err);
  }
});

// Snapshot + Delta recovery endpoint
router.get('/:boardId/recovery', authMiddleware, async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const sinceVersion = parseInt(req.query.sinceVersion || '0', 10);
    const recoveryState = await getBoardRecoveryState(boardId, sinceVersion);
    res.json(recoveryState);
  } catch (err) {
    next(err);
  }
});

// Trigger a manual snapshot checkpoint
router.post('/:boardId/snapshot', authMiddleware, async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const snapshot = await createSnapshot(boardId);
    res.status(201).json({ snapshot });
  } catch (err) {
    next(err);
  }
});

// Add a page
router.post('/:boardId/pages', authMiddleware, async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const { name, background } = req.body;
    const page = await addPage({ boardId, name, background });
    res.status(201).json({ page });
  } catch (err) {
    next(err);
  }
});

// Update a page
router.patch('/pages/:pageId', authMiddleware, async (req, res, next) => {
  try {
    const { pageId } = req.params;
    const updated = await updatePage(pageId, req.body);
    res.json({ page: updated });
  } catch (err) {
    next(err);
  }
});

// Delete a page
router.delete('/:boardId/pages/:pageId', authMiddleware, async (req, res, next) => {
  try {
    const { boardId, pageId } = req.params;
    const result = await deletePage(boardId, pageId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Export board as JSON backup or aggregated object tree
router.get('/:boardId/export', authMiddleware, async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const db = getDB();
    const board = await db.collection('boards').findOne({ boardId });
    if (!board) {
      return res.status(404).json({ error: { code: 'BOARD_NOT_FOUND', message: 'Board not found' } });
    }

    const [pages, objects] = await Promise.all([
      db.collection('pages').find({ boardId }).sort({ order: 1 }).toArray(),
      db.collection('canvasObjects').find({ boardId, deletedAt: { $exists: false } }).toArray()
    ]);

    res.json({
      exportedAt: new Date(),
      board: {
        boardId: board.boardId,
        name: board.name,
        version: board.currentVersion
      },
      pages,
      objects
    });
  } catch (err) {
    next(err);
  }
});

export default router;
