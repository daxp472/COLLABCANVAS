import express from 'express';
import { registerUser, loginUser, createGuestSession, getUserProfile } from '../services/userService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, displayName, avatarUrl } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Email, password, and displayName are required' }
      });
    }
    const result = await registerUser({ email, password, displayName, avatarUrl });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Email and password are required' }
      });
    }
    const result = await loginUser({ email, password });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/guest', async (req, res, next) => {
  try {
    const { displayName } = req.body;
    const result = await createGuestSession({ displayName });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.isGuest) {
      return res.json({ user: req.user });
    }
    const profile = await getUserProfile(req.user.userId);
    res.json({ user: profile || req.user });
  } catch (err) {
    next(err);
  }
});

export default router;
