import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hasPermission, ROLE_PERMISSIONS } from '../../server/middleware/rbac.js';

describe('RBAC & Permission Matrix Unit Tests', () => {
  it('room_owner has all administrative permissions', () => {
    assert.strictEqual(hasPermission('room_owner', 'room.manage'), true);
    assert.strictEqual(hasPermission('room_owner', 'board.edit'), true);
    assert.strictEqual(hasPermission('room_owner', 'presenter.control'), true);
    assert.strictEqual(hasPermission('room_owner', 'classroom.quiz_create'), true);
    assert.strictEqual(hasPermission('room_owner', 'game.create'), true);
  });

  it('presenter can control presentation and classroom but cannot manage room', () => {
    assert.strictEqual(hasPermission('presenter', 'presenter.control'), true);
    assert.strictEqual(hasPermission('presenter', 'classroom.quiz_create'), true);
    assert.strictEqual(hasPermission('presenter', 'board.edit'), true);
    assert.strictEqual(hasPermission('presenter', 'room.manage'), false);
    assert.strictEqual(hasPermission('presenter', 'member.promote'), false);
  });

  it('student can view board and chat by default, but cannot control presentation', () => {
    assert.strictEqual(hasPermission('student', 'board.view'), true);
    assert.strictEqual(hasPermission('student', 'chat.send'), true);
    assert.strictEqual(hasPermission('student', 'presenter.control'), false);
    assert.strictEqual(hasPermission('student', 'page.manage'), false);
  });

  it('enforces dynamic room override: student editing locked by teacher', () => {
    const unlockedSettings = { studentEditingLocked: false };
    const lockedSettings = { studentEditingLocked: true };

    assert.strictEqual(hasPermission('student', 'board.edit', unlockedSettings), true);
    assert.strictEqual(hasPermission('student', 'board.edit', lockedSettings), false);
    // Room owner should still be allowed to edit even if student drawing is locked
    assert.strictEqual(hasPermission('room_owner', 'board.edit', lockedSettings), true);
  });

  it('enforces dynamic room override: guest drawing disabled', () => {
    const allowGuests = { allowGuestDrawing: true };
    const disallowGuests = { allowGuestDrawing: false };

    assert.strictEqual(hasPermission('guest', 'board.edit', allowGuests), true);
    assert.strictEqual(hasPermission('guest', 'board.edit', disallowGuests), false);
  });

  it('enforces dynamic room override: chat muted', () => {
    const muted = { chatMuted: true };
    assert.strictEqual(hasPermission('student', 'chat.send', muted), false);
    assert.strictEqual(hasPermission('guest', 'chat.send', muted), false);
    assert.strictEqual(hasPermission('moderator', 'chat.send', muted), true);
    assert.strictEqual(hasPermission('room_owner', 'chat.send', muted), true);
  });
});
