import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { getDB } from '../config/db.js';
import { signToken } from '../middleware/auth.js';

export async function registerUser({ email, password, displayName, avatarUrl }) {
  const db = getDB();
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await db.collection('users').findOne({ email: normalizedEmail });
  if (existing) {
    const error = new Error('Email is already registered');
    error.status = 409;
    error.code = 'EMAIL_ALREADY_EXISTS';
    throw error;
  }

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const userId = `usr_${nanoid(10)}`;
  const newUser = {
    userId,
    email: normalizedEmail,
    displayName: displayName.trim(),
    passwordHash,
    avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`,
    preferences: {
      theme: 'dark',
      defaultTool: 'pen',
      penColor: '#6366f1',
      penWidth: 3
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.collection('users').insertOne(newUser);
  const token = signToken({ userId, email: normalizedEmail, displayName: newUser.displayName, isGuest: false });

  return {
    user: {
      userId,
      email: normalizedEmail,
      displayName: newUser.displayName,
      avatarUrl: newUser.avatarUrl,
      preferences: newUser.preferences
    },
    token
  };
}

export async function loginUser({ email, password }) {
  const db = getDB();
  const normalizedEmail = email.toLowerCase().trim();

  const user = await db.collection('users').findOne({ email: normalizedEmail });
  if (!user) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const token = signToken({
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    isGuest: false
  });

  return {
    user: {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      preferences: user.preferences
    },
    token
  };
}

export async function createGuestSession({ displayName }) {
  const name = displayName?.trim() || `Guest-${nanoid(4)}`;
  const guestId = `guest_${nanoid(8)}`;
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`;

  const token = signToken({
    userId: guestId,
    displayName: name,
    avatarUrl,
    isGuest: true
  }, '1d');

  return {
    user: {
      userId: guestId,
      displayName: name,
      avatarUrl,
      isGuest: true,
      preferences: {
        theme: 'dark',
        defaultTool: 'pen',
        penColor: '#10b981',
        penWidth: 3
      }
    },
    token
  };
}

export async function getUserProfile(userId) {
  const db = getDB();
  const user = await db.collection('users').findOne({ userId });
  if (!user) return null;

  return {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    preferences: user.preferences
  };
}
