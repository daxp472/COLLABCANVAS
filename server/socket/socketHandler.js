import { verifyToken } from '../middleware/auth.js';
import { getDB } from '../config/db.js';
import { hasPermission } from '../middleware/rbac.js';
import { applyBoardOperation } from '../services/boardService.js';
import {
  getGameSession,
  joinGameParticipant,
  startGame,
  submitGuess,
  submitQuizAnswer
} from '../services/gameEngine.js';

// In-memory active presence map: roomId -> Map(socketId -> { userId, displayName, avatarUrl, role, cursor })
const roomPresence = new Map();

// In-memory presenter state: roomId -> { presenterId, isLocked, viewport, spotlight }
const presenterStates = new Map();

// In-memory question queue: roomId -> [ { questionId, userId, displayName, text, answered, timestamp } ]
const questionQueues = new Map();

export function setupSocketIO(io) {
  // Handshake authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return next(new Error('Invalid or expired authentication token'));
    }

    socket.user = decoded;
    next();
  });

  io.on('connection', (socket) => {
    let currentRoomId = null;

    // Join room channel
    socket.on('room:join', async (data, callback) => {
      try {
        const { roomId, pageId } = data || {};
        if (!roomId) {
          if (callback) callback({ error: 'Room ID required' });
          return;
        }

        const db = getDB();
        const room = await db.collection('rooms').findOne({ roomId });
        if (!room) {
          if (callback) callback({ error: 'Room not found' });
          return;
        }

        currentRoomId = roomId;
        socket.join(`room:${roomId}`);

        // Fetch user membership and role
        let member = await db.collection('roomMembers').findOne({ roomId, userId: socket.user.userId });
        let role = room.ownerId === socket.user.userId ? 'room_owner' : (socket.user.isGuest ? 'guest' : (room.settings.defaultRole || 'student'));

        if (member) {
          role = member.role;
        } else {
          // Auto-register member
          member = {
            roomId,
            userId: socket.user.userId,
            displayName: socket.user.displayName,
            avatarUrl: socket.user.avatarUrl || '',
            role,
            isMuted: false,
            isBanned: false,
            joinedAt: new Date(),
            lastSeenAt: new Date()
          };
          await db.collection('roomMembers').insertOne(member);
        }

        socket.role = role;
        socket.roomMember = member;

        // Add to active presence
        if (!roomPresence.has(roomId)) {
          roomPresence.set(roomId, new Map());
        }
        const roomMembersMap = roomPresence.get(roomId);
        const presenceInfo = {
          userId: socket.user.userId,
          displayName: socket.user.displayName,
          avatarUrl: socket.user.avatarUrl || '',
          role,
          pageId: pageId || 'pg_1',
          cursor: { x: 0, y: 0 }
        };
        roomMembersMap.set(socket.id, presenceInfo);

        // Broadcast to existing room members
        socket.to(`room:${roomId}`).emit('room:member:joined', { member: presenceInfo });

        // Retrieve active game session if any
        const activeGame = await db.collection('games').findOne({ roomId, status: { $in: ['waiting', 'starting', 'in_progress'] } });

        // Acknowledge join
        if (callback) {
          callback({
            success: true,
            room: {
              roomId: room.roomId,
              name: room.name,
              boardId: room.boardId,
              settings: room.settings,
              ownerId: room.ownerId
            },
            member: presenceInfo,
            activeMembers: Array.from(roomMembersMap.values()),
            presenterState: presenterStates.get(roomId) || { active: false },
            activeGameId: activeGame ? activeGame.gameId : null,
            questionQueue: questionQueues.get(roomId) || []
          });
        }
      } catch (err) {
        console.error('[Socket] room:join error:', err.message);
        if (callback) callback({ error: err.message });
      }
    });

    // Delta Board Operation (create, update, delete objects)
    socket.on('board:operation', async (data, callback) => {
      try {
        if (!currentRoomId) throw new Error('Not connected to a room');

        const db = getDB();
        const room = await db.collection('rooms').findOne({ roomId: currentRoomId });
        if (!room) throw new Error('Room not found');

        // Check board.edit permission
        const canEdit = hasPermission(socket.role, 'board.edit', room.settings || {}, socket.roomMember || {});
        if (!canEdit) {
          if (callback) {
            return callback({
              status: 'rejected',
              code: 'PERMISSION_DENIED',
              message: 'You do not have permission to edit this board'
            });
          }
          return;
        }

        // Apply targeted incremental mutation
        const result = await applyBoardOperation({
          operationId: data.operationId,
          boardId: data.boardId,
          pageId: data.pageId,
          type: data.type,
          targetId: data.targetId,
          baseVersion: data.baseVersion || 0,
          payload: data.payload || {},
          actorId: socket.user.userId
        });

        // Broadcast accepted operation to room peers
        socket.to(`room:${currentRoomId}`).emit('board:operation:accepted', {
          operationId: data.operationId,
          sequence: result.sequence,
          actorId: socket.user.userId,
          pageId: data.pageId,
          type: data.type,
          targetId: data.targetId,
          payload: data.payload,
          objectVersion: result.objectVersion
        });

        // Acknowledge to caller
        if (callback) {
          callback(result);
        }
      } catch (err) {
        console.error('[Socket] board:operation error:', err.message);
        if (callback) {
          callback({
            status: 'rejected',
            code: err.code || 'OPERATION_FAILED',
            message: err.message
          });
        }
      }
    });

    // In-flight transient drawing points (pencil/brush while dragging)
    socket.on('board:transient:draw', (data) => {
      if (!currentRoomId) return;
      socket.to(`room:${currentRoomId}`).emit('board:transient:draw', {
        userId: socket.user.userId,
        points: data.points,
        color: data.color,
        width: data.width,
        pageId: data.pageId
      });
    });

    // Live Cursor updates (throttled by client)
    socket.on('cursor:update', (data) => {
      if (!currentRoomId) return;
      const roomMembersMap = roomPresence.get(currentRoomId);
      if (roomMembersMap && roomMembersMap.has(socket.id)) {
        const info = roomMembersMap.get(socket.id);
        info.cursor = { x: data.x, y: data.y };
        info.pageId = data.pageId;
      }

      socket.to(`room:${currentRoomId}`).emit('cursor:updated', {
        userId: socket.user.userId,
        displayName: socket.user.displayName,
        x: data.x,
        y: data.y,
        pageId: data.pageId
      });
    });

    // Chat Message
    socket.on('chat:send', async (data, callback) => {
      try {
        if (!currentRoomId) return;
        const db = getDB();
        const room = await db.collection('rooms').findOne({ roomId: currentRoomId });
        if (!room) return;

        // Check chat permission
        const canChat = hasPermission(socket.role, 'chat.send', room.settings || {}, socket.roomMember || {});
        if (!canChat) {
          if (callback) callback({ error: 'Chat is disabled or muted' });
          return;
        }

        const content = data.content?.trim();
        if (!content) return;

        // Check if an active game is in progress (Draw & Guess word interception)
        const activeGame = await db.collection('games').findOne({
          roomId: currentRoomId,
          status: { $in: ['waiting', 'starting', 'in_progress'] }
        });

        if (activeGame) {
          const gameSession = getGameSession(activeGame.gameId);
          if (gameSession && gameSession.status === 'IN_PROGRESS' && gameSession.type === 'draw_and_guess') {
            const guessResult = submitGuess(activeGame.gameId, socket.user.userId, content, io);
            if (guessResult.correct) {
              // Intercept secret word: Do NOT broadcast the answer to public chat!
              if (callback) callback({ success: true, isCorrectGuess: true });
              return;
            }
          }
        }

        const messageRecord = {
          roomId: currentRoomId,
          senderId: socket.user.userId,
          senderName: socket.user.displayName,
          senderAvatar: socket.user.avatarUrl || '',
          content,
          contextReference: data.contextReference || null,
          createdAt: new Date()
        };

        await db.collection('chatMessages').insertOne(messageRecord);

        // Broadcast to room
        io.to(`room:${currentRoomId}`).emit('chat:message', messageRecord);

        if (callback) callback({ success: true, message: messageRecord });
      } catch (err) {
        console.error('[Socket] chat:send error:', err.message);
        if (callback) callback({ error: err.message });
      }
    });

    // Chat Reactions
    socket.on('chat:reaction', (data) => {
      if (!currentRoomId) return;
      io.to(`room:${currentRoomId}`).emit('chat:reaction', {
        userId: socket.user.userId,
        emoji: data.emoji,
        messageId: data.messageId
      });
    });

    // Presenter Viewport & Spotlight
    socket.on('presenter:viewport', (data) => {
      if (!currentRoomId) return;
      if (socket.role !== 'presenter' && socket.role !== 'room_owner') return;

      presenterStates.set(currentRoomId, {
        active: true,
        presenterId: socket.user.userId,
        presenterName: socket.user.displayName,
        pageId: data.pageId,
        x: data.x,
        y: data.y,
        zoom: data.zoom,
        spotlight: data.spotlight || null
      });

      socket.to(`room:${currentRoomId}`).emit('presenter:state', presenterStates.get(currentRoomId));
    });

    // Teacher toggle student drawing lock
    socket.on('presenter:toggle_draw_lock', async (data, callback) => {
      try {
        if (!currentRoomId) return;
        if (socket.role !== 'presenter' && socket.role !== 'room_owner') return;

        const locked = !!data.locked;
        const db = getDB();
        await db.collection('rooms').updateOne(
          { roomId: currentRoomId },
          { $set: { 'settings.studentEditingLocked': locked } }
        );

        io.to(`room:${currentRoomId}`).emit('presenter:draw_locked', { locked });
        if (callback) callback({ success: true, locked });
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    // Student Hand Raise
    socket.on('classroom:hand_raise', (data) => {
      if (!currentRoomId) return;
      io.to(`room:${currentRoomId}`).emit('classroom:hand_raise', {
        userId: socket.user.userId,
        displayName: socket.user.displayName,
        raised: !!data.raised
      });
    });

    // Student Question Submit
    socket.on('classroom:question_submit', (data, callback) => {
      if (!currentRoomId) return;
      const text = data.text?.trim();
      if (!text) return;

      if (!questionQueues.has(currentRoomId)) {
        questionQueues.set(currentRoomId, []);
      }
      const queue = questionQueues.get(currentRoomId);
      const questionItem = {
        questionId: `q_${Date.now()}`,
        userId: socket.user.userId,
        displayName: socket.user.displayName,
        text,
        answered: false,
        timestamp: new Date()
      };
      queue.push(questionItem);

      io.to(`room:${currentRoomId}`).emit('classroom:question_added', questionItem);
      if (callback) callback({ success: true, question: questionItem });
    });

    // Question Answered
    socket.on('classroom:question_answered', (data) => {
      if (!currentRoomId) return;
      if (socket.role !== 'presenter' && socket.role !== 'room_owner' && socket.role !== 'moderator') return;

      const queue = questionQueues.get(currentRoomId) || [];
      const item = queue.find(q => q.questionId === data.questionId);
      if (item) {
        item.answered = true;
        io.to(`room:${currentRoomId}`).emit('classroom:question_updated', item);
      }
    });

    // Games: Join, Start, Submit
    socket.on('game:join', (data, callback) => {
      try {
        const { gameId } = data;
        const state = joinGameParticipant(gameId, socket.user);
        if (state) {
          io.to(`room:${currentRoomId}`).emit('game:state', state);

          // If joining user is the drawer, send secret word
          const session = getGameSession(gameId);
          if (session && session.activeDrawerId === socket.user.userId && session.currentWord) {
            socket.emit('game:drawer:word', {
              secretWord: session.currentWord,
              category: session.currentCategory
            });
          }

          if (callback) callback({ success: true, state });
        }
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    socket.on('game:start', (data, callback) => {
      try {
        const { gameId } = data;
        const state = startGame(gameId, io);
        if (callback) callback({ success: true, state });
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    socket.on('game:submit', (data, callback) => {
      try {
        const { gameId, guess } = data;
        const result = submitGuess(gameId, socket.user.userId, guess, io);
        if (callback) callback(result);
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    socket.on('game:quiz:answer', (data, callback) => {
      try {
        const { gameId, optionIndex } = data;
        const result = submitQuizAnswer(gameId, socket.user.userId, optionIndex, io);
        if (callback) callback(result);
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      if (currentRoomId && roomPresence.has(currentRoomId)) {
        const roomMembersMap = roomPresence.get(currentRoomId);
        roomMembersMap.delete(socket.id);

        io.to(`room:${currentRoomId}`).emit('room:member:left', {
          userId: socket.user.userId,
          displayName: socket.user.displayName
        });

        if (roomMembersMap.size === 0) {
          roomPresence.delete(currentRoomId);
          presenterStates.delete(currentRoomId);
        }
      }
    });
  });
}
