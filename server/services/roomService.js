import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { getDB } from '../config/db.js';

export async function createRoom({
  name,
  description = '',
  ownerId,
  ownerName,
  ownerAvatar,
  visibility = 'public',
  password = null,
  maxParticipants = 50,
  settings = {},
  template = 'blank'
}) {
  const db = getDB();
  const roomId = nanoid(8).toLowerCase();
  const boardId = `brd_${nanoid(10)}`;
  const initialPageId = `pg_${nanoid(8)}`;

  let passwordHash = null;
  if (password && password.trim().length > 0) {
    passwordHash = await bcrypt.hash(password.trim(), 10);
  }

  const room = {
    roomId,
    name: name.trim(),
    description: description.trim(),
    ownerId,
    visibility, // 'public', 'unlisted', 'private'
    passwordHash,
    hasPassword: !!passwordHash,
    maxParticipants: parseInt(maxParticipants, 10) || 50,
    settings: {
      allowGuests: settings.allowGuests !== false,
      allowGuestDrawing: settings.allowGuestDrawing !== false,
      allowGuestChat: settings.allowGuestChat !== false,
      studentEditingLocked: false,
      chatMuted: false,
      defaultRole: settings.defaultRole || 'student',
      ...settings
    },
    template,
    status: 'active',
    boardId,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.collection('rooms').insertOne(room);

  // Create initial Board
  const board = {
    boardId,
    roomId,
    name: `${room.name} Board`,
    currentVersion: 0,
    latestSnapshotVersion: 0,
    latestSnapshotId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await db.collection('boards').insertOne(board);

  // Create initial Page
  const page = {
    pageId: initialPageId,
    boardId,
    name: 'Page 1',
    order: 0,
    background: {
      type: 'dots',
      color: '#0f172a'
    },
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await db.collection('pages').insertOne(page);

  // Create Owner member record
  const ownerMember = {
    roomId,
    userId: ownerId,
    displayName: ownerName || 'Room Owner',
    avatarUrl: ownerAvatar || '',
    role: 'room_owner',
    permissions: [],
    isMuted: false,
    isBanned: false,
    joinedAt: new Date(),
    lastSeenAt: new Date()
  };
  await db.collection('roomMembers').insertOne(ownerMember);

  // Populate template starter items if applicable
  if (template === 'brainstorming') {
    await populateBrainstormingTemplate(boardId, initialPageId, ownerId);
  } else if (template === 'classroom') {
    await populateClassroomTemplate(boardId, initialPageId, ownerId);
  }

  return {
    ...room,
    passwordHash: undefined,
    initialPageId
  };
}

export async function getRoomById(roomId, requesterUserId = null) {
  const db = getDB();
  const room = await db.collection('rooms').findOne({ roomId });
  if (!room) return null;

  let member = null;
  if (requesterUserId) {
    member = await db.collection('roomMembers').findOne({ roomId, userId: requesterUserId });
  }

  return {
    roomId: room.roomId,
    name: room.name,
    description: room.description,
    ownerId: room.ownerId,
    visibility: room.visibility,
    hasPassword: !!room.passwordHash,
    maxParticipants: room.maxParticipants,
    settings: room.settings,
    status: room.status,
    boardId: room.boardId,
    createdAt: room.createdAt,
    userRole: member ? member.role : (room.ownerId === requesterUserId ? 'room_owner' : null)
  };
}

export async function listPublicRooms({ limit = 20, search = '' }) {
  const db = getDB();
  const query = {
    visibility: 'public',
    status: 'active'
  };

  if (search && search.trim().length > 0) {
    query.name = { $regex: search.trim(), $options: 'i' };
  }

  const rooms = await db.collection('rooms')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return rooms.map(r => ({
    roomId: r.roomId,
    name: r.name,
    description: r.description,
    hasPassword: !!r.passwordHash,
    maxParticipants: r.maxParticipants,
    settings: r.settings,
    createdAt: r.createdAt
  }));
}

export async function joinRoom({ roomId, user, password = null }) {
  const db = getDB();
  const room = await db.collection('rooms').findOne({ roomId });
  if (!room) {
    const error = new Error('Room not found');
    error.status = 404;
    error.code = 'ROOM_NOT_FOUND';
    throw error;
  }

  if (room.status !== 'active') {
    const error = new Error('Room is not active');
    error.status = 403;
    error.code = 'ROOM_INACTIVE';
    throw error;
  }

  // Check guest permissions
  if (user.isGuest && room.settings.allowGuests === false) {
    const error = new Error('Guests are not permitted in this room');
    error.status = 403;
    error.code = 'GUESTS_NOT_ALLOWED';
    throw error;
  }

  // Check room password if requester is not owner
  if (room.passwordHash && room.ownerId !== user.userId) {
    if (!password) {
      const error = new Error('Room password required');
      error.status = 401;
      error.code = 'PASSWORD_REQUIRED';
      throw error;
    }
    const match = await bcrypt.compare(password, room.passwordHash);
    if (!match) {
      const error = new Error('Incorrect room password');
      error.status = 401;
      error.code = 'INVALID_ROOM_PASSWORD';
      throw error;
    }
  }

  // Check member count
  const currentMembersCount = await db.collection('roomMembers').countDocuments({ roomId, isBanned: false });
  const existingMember = await db.collection('roomMembers').findOne({ roomId, userId: user.userId });

  if (!existingMember && currentMembersCount >= room.maxParticipants) {
    const error = new Error('Room has reached maximum capacity');
    error.status = 403;
    error.code = 'ROOM_FULL';
    throw error;
  }

  if (existingMember && existingMember.isBanned) {
    const error = new Error('You have been banned from this room');
    error.status = 403;
    error.code = 'MEMBER_BANNED';
    throw error;
  }

  let role = room.ownerId === user.userId ? 'room_owner' : (user.isGuest ? 'guest' : (room.settings.defaultRole || 'student'));
  if (existingMember) {
    role = existingMember.role;
  }

  const memberRecord = {
    roomId,
    userId: user.userId,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || '',
    role,
    isMuted: existingMember ? existingMember.isMuted : false,
    isBanned: false,
    lastSeenAt: new Date()
  };

  await db.collection('roomMembers').updateOne(
    { roomId, userId: user.userId },
    {
      $set: memberRecord,
      $setOnInsert: { joinedAt: new Date() }
    },
    { upsert: true }
  );

  return {
    roomId: room.roomId,
    name: room.name,
    boardId: room.boardId,
    settings: room.settings,
    member: memberRecord
  };
}

export async function updateRoomSettings(roomId, updates) {
  const db = getDB();
  const allowedUpdates = {};

  if (updates.name) allowedUpdates.name = updates.name.trim();
  if (updates.description !== undefined) allowedUpdates.description = updates.description.trim();
  if (updates.settings) {
    for (const [key, val] of Object.entries(updates.settings)) {
      allowedUpdates[`settings.${key}`] = val;
    }
  }

  allowedUpdates.updatedAt = new Date();

  await db.collection('rooms').updateOne(
    { roomId },
    { $set: allowedUpdates }
  );

  return await db.collection('rooms').findOne({ roomId }, { projection: { passwordHash: 0 } });
}

// Starter template helpers
async function populateBrainstormingTemplate(boardId, pageId, actorId) {
  const db = getDB();
  const cards = [
    { text: '🎯 Problem Statement: What problem are we solving today?', color: '#fef08a', x: 200, y: 150 },
    { text: '💡 Ideas & Opportunities: Rapid idea generation', color: '#bbf7d0', x: 500, y: 150 },
    { text: '⚡ Challenges & Risks: What could go wrong?', color: '#fecaca', x: 800, y: 150 },
    { text: '🚀 Action Items: Next steps and key owners', color: '#bae6fd', x: 1100, y: 150 }
  ];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const objectId = `sticky_${nanoid(8)}`;
    await db.collection('canvasObjects').insertOne({
      objectId,
      boardId,
      pageId,
      type: 'sticky',
      data: {
        x: card.x,
        y: card.y,
        width: 240,
        height: 200,
        text: card.text,
        color: card.color,
        fontSize: 16,
        votes: 0,
        voters: []
      },
      version: 1,
      zIndex: i + 1,
      isLocked: false,
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
}

async function populateClassroomTemplate(boardId, pageId, actorId) {
  const db = getDB();
  const objectId = `text_${nanoid(8)}`;
  await db.collection('canvasObjects').insertOne({
    objectId,
    boardId,
    pageId,
    type: 'text',
    data: {
      x: 300,
      y: 100,
      text: '📚 Welcome to Today\'s Lesson!\nPresenter controls active. Follow along and raise hand to ask questions.',
      fontSize: 24,
      fontFamily: 'Inter, sans-serif',
      color: '#f8fafc',
      align: 'center'
    },
    version: 1,
    zIndex: 1,
    isLocked: true,
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}
