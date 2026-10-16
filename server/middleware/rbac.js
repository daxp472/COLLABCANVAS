import { getDB } from '../config/db.js';

export const ROLE_PERMISSIONS = {
  room_owner: [
    'room.view', 'room.join', 'room.manage', 'room.invite',
    'member.view', 'member.promote', 'member.moderate',
    'board.view', 'board.edit', 'board.lock_objects', 'board.clear', 'board.export',
    'page.manage', 'presenter.control', 'presenter.spotlight', 'presenter.toggle_student_draw',
    'classroom.quiz_create', 'classroom.quiz_reveal', 'classroom.question_manage',
    'game.create', 'game.manage', 'game.participate', 'game.view_secret',
    'chat.view', 'chat.send', 'chat.moderate'
  ],
  presenter: [
    'room.view', 'room.join', 'room.invite', 'member.view',
    'board.view', 'board.edit', 'board.lock_objects', 'board.clear', 'board.export',
    'page.manage', 'presenter.control', 'presenter.spotlight', 'presenter.toggle_student_draw',
    'classroom.quiz_create', 'classroom.quiz_reveal', 'classroom.question_manage',
    'game.create', 'game.manage', 'game.participate', 'game.view_secret',
    'chat.view', 'chat.send'
  ],
  moderator: [
    'room.view', 'room.join', 'room.invite', 'member.view', 'member.moderate',
    'board.view', 'board.edit', 'board.lock_objects', 'board.clear', 'board.export',
    'page.manage', 'classroom.question_manage',
    'game.create', 'game.manage', 'game.participate',
    'chat.view', 'chat.send', 'chat.moderate'
  ],
  registered_user: [
    'room.view', 'room.join', 'room.invite', 'member.view',
    'board.view', 'board.edit', 'board.lock_objects', 'board.export', 'page.manage',
    'classroom.hand_raise', 'classroom.question_submit',
    'game.create', 'game.participate',
    'chat.view', 'chat.send'
  ],
  student: [
    'room.view', 'room.join', 'member.view',
    'board.view', 'board.edit',
    'classroom.hand_raise', 'classroom.question_submit',
    'game.participate',
    'chat.view', 'chat.send'
  ],
  guest: [
    'room.view', 'room.join', 'member.view',
    'board.view', 'board.edit',
    'classroom.hand_raise', 'classroom.question_submit',
    'game.participate',
    'chat.view', 'chat.send'
  ]
};

export function hasPermission(role, permission, roomSettings = {}, memberRecord = {}) {
  // Check member explicit permissions first
  if (memberRecord.permissions && memberRecord.permissions.includes(permission)) {
    return true;
  }

  // Check role defaults
  const permissions = ROLE_PERMISSIONS[role] || [];
  if (!permissions.includes(permission)) {
    return false;
  }

  // Dynamic Room Overrides
  if (role === 'guest') {
    if (permission === 'board.edit' && roomSettings.allowGuestDrawing === false) return false;
    if (permission === 'chat.send' && roomSettings.allowGuestChat === false) return false;
  }

  if (role === 'student' || role === 'guest') {
    if (permission === 'board.edit' && roomSettings.studentEditingLocked === true) return false;
  }

  if (permission === 'chat.send' && roomSettings.chatMuted === true && role !== 'room_owner' && role !== 'moderator') {
    return false;
  }

  return true;
}

export function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const roomId = req.params.roomId || req.body.roomId;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'User authentication required' }
        });
      }

      const db = getDB();
      const room = await db.collection('rooms').findOne({ roomId });
      if (!room) {
        return res.status(404).json({
          error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' }
        });
      }

      // Check if user is room owner
      if (room.ownerId === userId) {
        req.room = room;
        req.memberRole = 'room_owner';
        return next();
      }

      const member = await db.collection('roomMembers').findOne({ roomId, userId });
      const role = member ? member.role : (req.user.isGuest ? 'guest' : 'registered_user');

      if (!hasPermission(role, permission, room.settings || {}, member || {})) {
        return res.status(403).json({
          error: { code: 'PERMISSION_DENIED', message: `Missing required permission: ${permission}` }
        });
      }

      req.room = room;
      req.roomMember = member;
      req.memberRole = role;
      next();
    } catch (err) {
      next(err);
    }
  };
}
