import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { connectDB, closeDB, getDB } from '../../server/config/db.js';
import { createApp } from '../../server/app.js';

describe('Auth & Room Management Integration Tests', () => {
  let app;
  let testUserToken;
  let testUserId;
  let testRoomId;

  before(async () => {
    await connectDB();
    app = createApp();
  });

  after(async () => {
    // Cleanup test artifacts
    try {
      const db = getDB();
      if (testUserId) {
        await db.collection('users').deleteOne({ userId: testUserId });
      }
      if (testRoomId) {
        await db.collection('rooms').deleteOne({ roomId: testRoomId });
        await db.collection('boards').deleteMany({ roomId: testRoomId });
        await db.collection('roomMembers').deleteMany({ roomId: testRoomId });
      }
    } catch (e) {}
    await closeDB();
  });

  it('POST /api/auth/register creates a new user and returns JWT token', async () => {
    const uniqueEmail = `test_${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: uniqueEmail,
        password: 'Password123!',
        displayName: 'Test Canvas User'
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.email, uniqueEmail);
    assert.strictEqual(res.body.user.displayName, 'Test Canvas User');

    testUserToken = res.body.token;
    testUserId = res.body.user.userId;
  });

  it('POST /api/auth/guest issues an ephemeral guest token', async () => {
    const res = await request(app)
      .post('/api/auth/guest')
      .send({ displayName: 'Friendly Guest' });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.isGuest, true);
    assert.strictEqual(res.body.user.displayName, 'Friendly Guest');
  });

  it('GET /api/auth/me returns profile for authenticated user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${testUserToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.userId, testUserId);
  });

  it('POST /api/rooms creates a new room with board and page', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        name: 'Sprint Planning Whiteboard',
        description: 'Room for architecture design',
        visibility: 'public',
        maxParticipants: 25,
        settings: { allowGuests: true }
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.room.roomId);
    assert.ok(res.body.room.boardId);
    assert.strictEqual(res.body.room.name, 'Sprint Planning Whiteboard');

    testRoomId = res.body.room.roomId;
  });

  it('GET /api/rooms/:roomId fetches room metadata', async () => {
    const res = await request(app)
      .get(`/api/rooms/${testRoomId}`)
      .set('Authorization', `Bearer ${testUserToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.room.roomId, testRoomId);
    assert.strictEqual(res.body.room.userRole, 'room_owner');
  });

  it('POST /api/rooms/:roomId/join joins room and returns membership info', async () => {
    const res = await request(app)
      .post(`/api/rooms/${testRoomId}/join`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({});

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.roomId, testRoomId);
    assert.strictEqual(res.body.member.role, 'room_owner');
  });
});
