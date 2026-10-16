import { io } from 'socket.io-client';
import { store } from '../state/store.js';
import { api } from '../api/apiClient.js';

class SocketClient {
  constructor() {
    this.socket = null;
    this.lastCursorTime = 0;
    this.cursorThrottleMs = 30; // 33Hz
  }

  connect(roomId) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io({
      auth: { token: store.token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to server with ID:', this.socket.id);

      // Join the designated room
      this.socket.emit('room:join', { roomId, pageId: store.activePageId }, (response) => {
        if (response.error) {
          console.error('[Socket] room:join error:', response.error);
          return;
        }

        if (response.activeMembers) {
          store.roomMembers = response.activeMembers;
        }
        if (response.presenterState) {
          store.presenterState = response.presenterState;
        }
        if (response.questionQueue) {
          store.questionQueue = response.questionQueue;
        }
        store.notify();
      });
    });

    // Reconnection handling: Catch up on delta operations since current version!
    this.socket.on('reconnect', async () => {
      console.log('[Socket] Reconnected. Reconciling board state...');
      if (store.activeBoard) {
        try {
          const recovery = await api.getRecoveryState(store.activeBoard.boardId, store.activeBoard.currentVersion || 0);
          if (recovery.snapshot) {
            store.setObjects(recovery.snapshot.objects);
          }
          if (recovery.deltaOperations) {
            for (const op of recovery.deltaOperations) {
              this.applyRemoteOperation(op);
            }
          }
          store.activeBoard.currentVersion = recovery.currentVersion;
        } catch (e) {
          console.error('[Socket] Reconnect recovery error:', e);
        }
      }
    });

    // Remote peer joined
    this.socket.on('room:member:joined', ({ member }) => {
      const existing = store.roomMembers.find(m => m.userId === member.userId);
      if (!existing) {
        store.roomMembers.push(member);
        store.notify();
      }
    });

    // Remote peer left
    this.socket.on('room:member:left', ({ userId }) => {
      store.roomMembers = store.roomMembers.filter(m => m.userId !== userId);
      store.remoteCursors.delete(userId);
      store.remoteTransientStrokes.delete(userId);
      store.notify();
    });

    // Delta Operation accepted
    this.socket.on('board:operation:accepted', (op) => {
      this.applyRemoteOperation(op);
    });

    // Transient drawing in progress
    this.socket.on('board:transient:draw', (data) => {
      if (data.pageId === store.activePageId) {
        store.remoteTransientStrokes.set(data.userId, data);
        store.notify();
      }
    });

    // Live Cursor updated
    this.socket.on('cursor:updated', (data) => {
      if (data.pageId === store.activePageId) {
        store.remoteCursors.set(data.userId, {
          x: data.x,
          y: data.y,
          displayName: data.displayName,
          color: getRandomColorForUser(data.userId)
        });
        store.notify();
      }
    });

    // Presenter viewport updates
    this.socket.on('presenter:state', (state) => {
      store.presenterState = state;
      if (store.isFollowingPresenter && state.active) {
        window.dispatchEvent(new CustomEvent('canvas:follow_viewport', { detail: state }));
      }
      store.notify();
    });

    // Teacher toggle draw lock
    this.socket.on('presenter:draw_locked', ({ locked }) => {
      store.studentEditingLocked = locked;
      store.notify();
    });

    // Classroom events
    this.socket.on('classroom:hand_raise', (data) => {
      window.dispatchEvent(new CustomEvent('classroom:hand_raised', { detail: data }));
    });

    this.socket.on('classroom:question_added', (q) => {
      store.questionQueue.push(q);
      store.notify();
    });

    this.socket.on('classroom:question_updated', (updatedQ) => {
      const idx = store.questionQueue.findIndex(q => q.questionId === updatedQ.questionId);
      if (idx !== -1) {
        store.questionQueue[idx] = updatedQ;
        store.notify();
      }
    });

    // Chat
    this.socket.on('chat:message', (msg) => {
      window.dispatchEvent(new CustomEvent('chat:new_message', { detail: msg }));
    });

    // Game updates
    this.socket.on('game:state', (gameState) => {
      store.activeGame = gameState;
      store.notify();
    });

    this.socket.on('game:round:started', (data) => {
      store.activeGame = { ...store.activeGame, ...data };
      store.remoteTransientStrokes.clear();
      store.notify();
    });

    this.socket.on('game:timer:tick', ({ remainingSeconds }) => {
      if (store.activeGame) {
        store.activeGame.remainingSeconds = remainingSeconds;
        store.notify();
      }
    });

    this.socket.on('game:hint:update', ({ hintMask }) => {
      if (store.activeGame) {
        store.activeGame.hintMask = hintMask;
        store.notify();
      }
    });

    this.socket.on('game:drawer:word', (data) => {
      if (store.activeGame) {
        store.activeGame.secretWord = data.secretWord;
        store.activeGame.category = data.category;
        store.notify();
      }
    });

    this.socket.on('game:guess:correct', (data) => {
      window.dispatchEvent(new CustomEvent('game:correct_guess', { detail: data }));
    });

    this.socket.on('game:round:ended', (data) => {
      store.activeGame = { ...store.activeGame, status: 'ROUND_RESULTS', ...data };
      store.notify();
    });

    this.socket.on('game:results', (data) => {
      store.activeGame = { ...store.activeGame, status: 'FINISHED', ...data };
      store.notify();
    });
  }

  submitGameGuess(guess) {
    return new Promise((resolve) => {
      if (!this.socket || !store.activeGame) return resolve({ correct: false });
      this.socket.emit('game:submit', { gameId: store.activeGame.gameId, guess }, (res) => {
        resolve(res || { correct: false });
      });
    });
  }

  submitQuizAnswer(optionIndex) {
    return new Promise((resolve) => {
      if (!this.socket || !store.activeGame) return resolve(null);
      this.socket.emit('game:quiz:answer', { gameId: store.activeGame.gameId, optionIndex }, (res) => {
        resolve(res);
      });
    });
  }

  emitOperation(opData) {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Socket not connected'));
      this.socket.emit('board:operation', opData, (res) => {
        if (res && res.status === 'committed') {
          resolve(res);
        } else {
          reject(new Error(res?.message || 'Operation rejected'));
        }
      });
    });
  }

  emitTransientDraw(points, color, width) {
    if (!this.socket) return;
    this.socket.emit('board:transient:draw', {
      points,
      color,
      width,
      pageId: store.activePageId
    });
  }

  emitCursor(x, y) {
    const now = Date.now();
    if (now - this.lastCursorTime < this.cursorThrottleMs) return;
    this.lastCursorTime = now;

    if (this.socket) {
      this.socket.emit('cursor:update', { x, y, pageId: store.activePageId });
    }
  }

  sendChatMessage(content, contextReference = null) {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Socket not connected'));
      this.socket.emit('chat:send', { content, contextReference }, (res) => {
        if (res?.error) reject(new Error(res.error));
        else resolve(res);
      });
    });
  }

  applyRemoteOperation(op) {
    if (op.type === 'object:create') {
      store.upsertObject({
        objectId: op.targetId,
        boardId: op.boardId,
        pageId: op.pageId,
        type: op.payload.type,
        data: op.payload.data,
        version: op.objectVersion || 1,
        zIndex: op.sequence
      });
    } else if (op.type === 'object:update') {
      const existing = store.objects.get(op.targetId);
      if (existing) {
        const mergedData = { ...existing.data };
        if (op.payload.data) {
          Object.assign(mergedData, op.payload.data);
        }
        store.upsertObject({
          ...existing,
          data: mergedData,
          version: op.objectVersion || (existing.version + 1)
        });
      }
    } else if (op.type === 'object:delete') {
      store.removeObject(op.targetId);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

function getRandomColorForUser(userId) {
  const colors = ['#f43f5e', '#ec4899', '#8b5cf6', '#6366f1', '#06b6d4', '#10b981', '#f59e0b'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const socketClient = new SocketClient();
