import express from 'express';
import { createRoom, getRoomById, listPublicRooms, joinRoom, updateRoomSettings } from '../services/roomService.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { getDB } from '../config/db.js';

const router = express.Router();

// List public rooms
router.get('/', async (req, res, next) => {
  try {
    const { search, limit } = req.query;
    const rooms = await listPublicRooms({ search, limit: parseInt(limit, 10) || 20 });
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
});

// Create a new room
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { name, description, visibility, password, maxParticipants, settings, template } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Room name is required' }
      });
    }

    const room = await createRoom({
      name,
      description,
      ownerId: req.user.userId,
      ownerName: req.user.displayName,
      ownerAvatar: req.user.avatarUrl,
      visibility,
      password,
      maxParticipants,
      settings,
      template
    });

    res.status(201).json({ room });
  } catch (err) {
    next(err);
  }
});

// Get room details
router.get('/:roomId', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const room = await getRoomById(roomId, req.user?.userId);
    if (!room) {
      return res.status(404).json({
        error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' }
      });
    }
    res.json({ room });
  } catch (err) {
    next(err);
  }
});

// Join room check & ticket issuance
router.post('/:roomId/join', authMiddleware, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { password } = req.body;
    const result = await joinRoom({ roomId, user: req.user, password });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Update room settings (requires room.manage)
router.patch('/:roomId', authMiddleware, requirePermission('room.manage'), async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const updated = await updateRoomSettings(roomId, req.body);
    res.json({ room: updated });
  } catch (err) {
    next(err);
  }
});

// Get room members
router.get('/:roomId/members', authMiddleware, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const db = getDB();
    const members = await db.collection('roomMembers')
      .find({ roomId, isBanned: false })
      .toArray();

    res.json({
      members: members.map(m => ({
        userId: m.userId,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl,
        role: m.role,
        isMuted: m.isMuted
      }))
    });
  } catch (err) {
    next(err);
  }
});

export default router;
