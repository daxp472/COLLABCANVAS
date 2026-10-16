import { store } from './state/store.js';
import { api } from './api/apiClient.js';
import { socketClient } from './socket/socketClient.js';
import { CanvasEngine } from './engine/canvasEngine.js';
import { sound } from './utils/audio.js';
import { launchConfetti } from './utils/confetti.js';

let canvasEngineInstance = null;

// Global Toast helper
window.showToast = function (message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>✨</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
};

window.addEventListener('canvas:toast', (e) => window.showToast(e.detail));

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function init() {
  // Check auth
  if (store.token && !store.user) {
    try {
      const { user } = await api.getMe();
      store.setAuth(user, store.token);
    } catch (e) {
      store.setAuth(null, null);
    }
  }

  // Handle URL Routing: e.g. /#room/canvas-xyz
  const hash = window.location.hash;
  if (hash.startsWith('#room/')) {
    const roomId = hash.replace('#room/', '');
    openRoom(roomId);
  } else {
    renderDashboard();
  }

  window.addEventListener('hashchange', () => {
    const h = window.location.hash;
    if (h.startsWith('#room/')) {
      openRoom(h.replace('#room/', ''));
    } else {
      renderDashboard();
    }
  });

  // Listen for correct guess celebration
  window.addEventListener('game:correct_guess', (e) => {
    const { displayName, pointsAwarded } = e.detail;
    sound.playCorrect();
    launchConfetti();
    window.showToast(`🎉 ${displayName} guessed correctly! +${pointsAwarded} pts`);
  });
}

// ==========================================================================
// Dashboard View
// ==========================================================================
async function renderDashboard() {
  if (socketClient.socket) {
    socketClient.disconnect();
  }

  const container = document.getElementById('view-container');
  const user = store.user;

  container.innerHTML = `
    <div class="dashboard-layout">
      <!-- Nav -->
      <nav class="dashboard-nav">
        <div class="brand-badge">
          <div class="brand-logo-icon">🎨</div>
          <span>CollabCanvas</span>
        </div>
        <div class="dashboard-nav-actions">
          <button id="sound-toggle-btn" class="btn-secondary" title="Toggle audio feedback">
            ${sound.muted ? '🔇 Muted' : '🔊 Sound'}
          </button>
          <button id="theme-toggle-btn" class="btn-secondary" title="Toggle theme">🌓 Theme</button>
          ${user ? `
            <div style="display:flex;align-items:center;gap:10px;">
              <img src="${user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.userId}`}" style="width:36px;height:36px;border-radius:50%;border:2px solid var(--primary);" />
              <div style="text-align:left;">
                <div style="font-weight:700;font-size:0.9rem;">${escapeHtml(user.displayName)}</div>
                <div style="font-size:0.75rem;color:var(--primary);font-weight:600;">${user.isGuest ? 'Guest User' : 'Registered Member'}</div>
              </div>
              <button id="logout-btn" class="btn-secondary" style="padding:6px 14px;font-size:0.8rem;">Sign Out</button>
            </div>
          ` : `
            <button id="guest-btn" class="btn-secondary">Instant Guest</button>
            <button id="auth-btn" class="btn-primary">Sign In / Register</button>
          `}
        </div>
      </nav>

      <!-- Hero Banner -->
      <section class="dashboard-hero">
        <div class="hero-pill">⚡ Real-time Multiplayer Whiteboard & Party Games</div>
        <h1 class="hero-title">Create, Teach & Play<br/>Together in Real-Time</h1>
        <p class="hero-subtitle">
          Infinite collaborative canvas with fine-grained delta sync, presentation spotlight, classroom question queues, and multiplayer games with zero lag.
        </p>
        <div class="hero-cta-group">
          <button id="hero-create-room-btn" class="btn-primary" style="padding:14px 28px;font-size:1.05rem;">
            <span>✨ Create New Room</span>
          </button>
          <button id="hero-join-code-btn" class="btn-secondary" style="padding:14px 28px;font-size:1.05rem;">
            <span>🔑 Join with Room Code</span>
          </button>
        </div>
      </section>

      <!-- Templates Section -->
      <section class="section-container">
        <div class="section-header">
          <h2 class="section-title">Start from a Template</h2>
        </div>
        <div class="template-grid">
          <div class="template-card" data-template="blank">
            <div class="template-icon-wrap" style="background:rgba(99,102,241,0.15);color:var(--primary);">📐</div>
            <h3>Blank Infinite Canvas</h3>
            <p>A fresh, unbounded canvas for diagramming, wireframing, and brainstorming.</p>
          </div>
          <div class="template-card" data-template="brainstorming">
            <div class="template-icon-wrap" style="background:rgba(245,158,11,0.15);color:var(--accent-amber);">💡</div>
            <h3>Agile Brainstorming</h3>
            <p>Problem statement, sticky notes, risk analysis columns, and dot voting.</p>
          </div>
          <div class="template-card" data-template="classroom">
            <div class="template-icon-wrap" style="background:rgba(16,185,129,0.15);color:var(--accent-emerald);">📚</div>
            <h3>Classroom Lesson</h3>
            <p>Presenter-led board with student question queues and drawing locks.</p>
          </div>
          <div class="template-card" data-template="game">
            <div class="template-icon-wrap" style="background:rgba(236,72,153,0.15);color:var(--accent-pink);">🎮</div>
            <h3>Party Game Night</h3>
            <p>Draw & Guess, Quick Draw, and Quiz Battles ready for multiplayer fun.</p>
          </div>
        </div>
      </section>

      <!-- Explore Public Rooms -->
      <section class="section-container">
        <div class="section-header">
          <h2 class="section-title">Explore Active Public Rooms</h2>
          <input type="text" id="rooms-search-input" placeholder="Search rooms..." style="width:260px;" />
        </div>
        <div id="public-rooms-container" class="rooms-grid">
          <div style="color:var(--text-muted);font-size:0.9rem;">Loading rooms...</div>
        </div>
      </section>
    </div>
  `;

  // Attach Dashboard Event Listeners
  document.getElementById('sound-toggle-btn')?.addEventListener('click', () => {
    const isMuted = sound.toggleMute();
    document.getElementById('sound-toggle-btn').textContent = isMuted ? '🔇 Muted' : '🔊 Sound';
    if (!isMuted) sound.playClick();
  });

  document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);

  document.getElementById('auth-btn')?.addEventListener('click', () => showAuthModal('login'));
  document.getElementById('guest-btn')?.addEventListener('click', () => showAuthModal('guest'));

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    store.setAuth(null, null);
    sound.playPop();
    window.showToast('Signed out successfully');
    renderDashboard();
  });

  document.getElementById('hero-create-room-btn')?.addEventListener('click', () => {
    sound.playClick();
    showCreateRoomModal('blank');
  });

  document.getElementById('hero-join-code-btn')?.addEventListener('click', () => {
    sound.playClick();
    const code = prompt('Enter room code (e.g. 7x89q):');
    if (code && code.trim()) {
      window.location.hash = `#room/${code.trim().toLowerCase()}`;
    }
  });

  // Template clicks
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      sound.playClick();
      const tmpl = card.getAttribute('data-template');
      showCreateRoomModal(tmpl);
    });
  });

  // Search input
  const searchInput = document.getElementById('rooms-search-input');
  searchInput?.addEventListener('input', (e) => loadPublicRooms(e.target.value));

  loadPublicRooms();
}

async function loadPublicRooms(search = '') {
  const container = document.getElementById('public-rooms-container');
  if (!container) return;

  try {
    const { rooms } = await api.listPublicRooms(search);
    if (!rooms || rooms.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px 0;">No active public rooms found. Be the first to create one!</div>`;
      return;
    }

    container.innerHTML = rooms.map(r => `
      <div class="room-card" onclick="window.location.hash='#room/${r.roomId}'">
        <div>
          <div class="room-card-header">
            <span class="room-badge">${r.hasPassword ? '🔒 Protected' : '🌐 Public'}</span>
            <span style="font-size:0.75rem;color:var(--text-subtle);">${new Date(r.createdAt).toLocaleDateString()}</span>
          </div>
          <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">${escapeHtml(r.name)}</h3>
          <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;">${escapeHtml(r.description || 'Interactive whiteboard room')}</p>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid var(--border-subtle);">
          <span style="font-size:0.8rem;color:var(--text-muted);">Capacity: ${r.maxParticipants}</span>
          <span style="font-size:0.85rem;font-weight:600;color:var(--primary);">Join Room →</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div style="color:var(--accent-rose);">Failed to load rooms: ${err.message}</div>`;
  }
}

// ==========================================================================
// Canvas Room View
// ==========================================================================
async function openRoom(roomId) {
  // Ensure user has identity
  if (!store.user) {
    const guestRes = await api.createGuest(`Guest-${Math.floor(Math.random() * 8999 + 1000)}`);
    store.setAuth(guestRes.user, guestRes.token);
  }

  const container = document.getElementById('view-container');
  container.innerHTML = `
    <div class="canvas-layout">
      <!-- HTML5 Canvas Viewport -->
      <canvas id="canvas-viewport"></canvas>

      <!-- Top Navigation Bar -->
      <header class="canvas-topbar">
        <div class="topbar-left">
          <button id="exit-room-btn" class="back-home-btn" title="Back to Dashboard">←</button>
          <div class="room-info">
            <div class="room-title-text" id="canvas-room-title">Loading Room...</div>
            <div class="sync-status-indicator">
              <span class="status-dot" id="sync-dot"></span>
              <span id="sync-text">Live Sync</span>
            </div>
          </div>
        </div>

        <!-- Center: Page Navigator -->
        <div class="topbar-center">
          <button id="prev-page-btn" class="page-btn">‹</button>
          <span id="page-indicator" style="font-size:0.85rem;font-weight:700;padding:0 8px;">Page 1</span>
          <button id="next-page-btn" class="page-btn">›</button>
          <button id="add-page-btn" class="page-btn" title="Add Page">+</button>
        </div>

        <!-- Right: Actions & Avatars -->
        <div class="topbar-right">
          <!-- Avatars Stack -->
          <div class="avatar-stack" id="room-avatars-stack"></div>

          <button id="sound-btn-canvas" class="action-pill-btn" title="Toggle Sound">
            <span>${sound.muted ? '🔇' : '🔊'}</span>
          </button>
          <button id="follow-toggle-btn" class="action-pill-btn" title="Follow Presenter">
            <span>👁️</span><span id="follow-btn-label">Follow</span>
          </button>
          <button id="classroom-hud-btn" class="action-pill-btn" title="Classroom Tools">
            <span>🎓</span><span>Classroom</span>
          </button>
          <button id="game-lobby-btn" class="action-pill-btn" title="Multiplayer Games">
            <span>🎮</span><span>Games</span>
          </button>
          <button id="search-modal-btn" class="action-pill-btn" title="Search">
            <span>🔍</span>
          </button>
          <button id="export-board-btn" class="action-pill-btn" title="Export">
            <span>💾</span>
          </button>
          <button id="toggle-chat-btn" class="action-pill-btn" title="Room Chat">
            <span>💬</span>
          </button>
        </div>
      </header>

      <!-- Floating Tool Dock (Left) -->
      <nav class="floating-tool-dock">
        <button class="tool-btn" data-tool="select" title="Select & Move (V)">
          <span>↖</span><span class="tooltip">Select</span>
        </button>
        <button class="tool-btn active" data-tool="pen" title="Freehand Pen (P)">
          <span>✏️</span><span class="tooltip">Pen</span>
        </button>
        <button class="tool-btn" data-tool="highlighter" title="Highlighter (H)">
          <span>🖍️</span><span class="tooltip">Highlighter</span>
        </button>
        <button class="tool-btn" data-tool="eraser" title="Eraser (E)">
          <span>🧹</span><span class="tooltip">Eraser</span>
        </button>
        <button class="tool-btn" data-tool="rectangle" title="Rectangle (R)">
          <span>⬜</span><span class="tooltip">Rectangle</span>
        </button>
        <button class="tool-btn" data-tool="circle" title="Circle (C)">
          <span>⚪</span><span class="tooltip">Circle</span>
        </button>
        <button class="tool-btn" data-tool="arrow" title="Arrow (A)">
          <span>➡️</span><span class="tooltip">Arrow</span>
        </button>
        <button class="tool-btn" data-tool="sticky" title="Sticky Note (S)">
          <span>📝</span><span class="tooltip">Sticky Note</span>
        </button>
        <button class="tool-btn" data-tool="text" title="Text Box (T)">
          <span>🔤</span><span class="tooltip">Text</span>
        </button>
        <button class="tool-btn" data-tool="pan" title="Hand Pan (Space)">
          <span>✋</span><span class="tooltip">Pan</span>
        </button>
      </nav>

      <!-- Contextual Properties Floating Bar (Bottom) -->
      <div class="contextual-properties-bar">
        <div class="color-swatch-list">
          <div class="color-swatch active" style="background:#6366f1;" data-color="#6366f1"></div>
          <div class="color-swatch" style="background:#ec4899;" data-color="#ec4899"></div>
          <div class="color-swatch" style="background:#10b981;" data-color="#10b981"></div>
          <div class="color-swatch" style="background:#f59e0b;" data-color="#f59e0b"></div>
          <div class="color-swatch" style="background:#06b6d4;" data-color="#06b6d4"></div>
          <div class="color-swatch" style="background:#ffffff;" data-color="#ffffff"></div>
        </div>
        <div class="width-slider-wrap">
          <span>Width</span>
          <input type="range" class="width-slider" id="stroke-width-slider" min="1" max="24" value="3" />
        </div>
        <div class="width-slider-wrap" style="gap:4px;">
          <button id="clear-page-btn" style="font-size:0.8rem;padding:4px 8px;border-radius:var(--radius-sm);background:rgba(244,63,94,0.15);color:var(--accent-rose);">Clear</button>
        </div>
      </div>

      <!-- Zoom Controls (Bottom Right) -->
      <div class="zoom-controls">
        <button class="zoom-btn" id="zoom-out-btn">−</button>
        <span id="zoom-level-text">100%</span>
        <button class="zoom-btn" id="zoom-in-btn">+</button>
        <button class="zoom-btn" id="zoom-reset-btn" title="Reset">⟲</button>
      </div>

      <!-- Slide-Out Chat Drawer -->
      <aside class="chat-drawer hidden" id="room-chat-drawer">
        <div class="chat-header">
          <span>Room Discussion</span>
          <button id="close-chat-btn" style="font-size:1.2rem;color:var(--text-muted);">×</button>
        </div>
        <div class="chat-messages-container" id="chat-messages-list"></div>
        <form class="chat-input-area" id="chat-form">
          <input type="text" class="chat-input" id="chat-input-text" placeholder="Type a message or guess..." />
          <button type="submit" class="chat-send-btn">➤</button>
        </form>
      </aside>

      <!-- Active Game HUD (Dynamically shown during rounds) -->
      <div id="game-hud-container"></div>
    </div>
  `;

  // Initialize Canvas Engine
  const canvasEl = document.getElementById('canvas-viewport');
  canvasEngineInstance = new CanvasEngine(canvasEl);

  // Join Room via API & Socket
  try {
    const joinRes = await api.joinRoom(roomId);
    const board = await api.getBoard(joinRes.boardId);
    store.setRoom(joinRes, board.board, board.board.pages);

    document.getElementById('canvas-room-title').textContent = escapeHtml(joinRes.name);

    // Load initial objects
    const initialObjects = await api.getPageObjects(board.board.boardId, store.activePageId);
    store.setObjects(initialObjects.objects);

    // Connect Socket.IO
    socketClient.connect(roomId);

    updatePageIndicator();
    setupCanvasUIListeners();
  } catch (err) {
    window.showToast(`Failed to join room: ${err.message}`);
    window.location.hash = '';
  }
}

function setupCanvasUIListeners() {
  document.getElementById('exit-room-btn')?.addEventListener('click', () => {
    sound.playClick();
    window.location.hash = '';
  });

  // Sound toggle on canvas
  document.getElementById('sound-btn-canvas')?.addEventListener('click', () => {
    const isMuted = sound.toggleMute();
    document.getElementById('sound-btn-canvas').innerHTML = `<span>${isMuted ? '🔇' : '🔊'}</span>`;
    if (!isMuted) sound.playClick();
  });

  // Tools Selection
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tool = btn.getAttribute('data-tool');
      store.setTool(tool);
    });
  });

  // Color Swatches
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      sound.playClick();
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      const color = swatch.getAttribute('data-color');
      store.setToolProps({ strokeColor: color });
    });
  });

  // Stroke Width Slider
  document.getElementById('stroke-width-slider')?.addEventListener('input', (e) => {
    store.setToolProps({ strokeWidth: parseInt(e.target.value, 10) });
  });

  // Clear page
  document.getElementById('clear-page-btn')?.addEventListener('click', async () => {
    sound.playPop();
    if (confirm('Clear all objects on this page?')) {
      for (const obj of store.objects.values()) {
        if (obj.pageId === store.activePageId) {
          await canvasEngineInstance.deleteObject(obj.objectId);
        }
      }
      window.showToast('Page cleared');
    }
  });

  // Zoom controls
  document.getElementById('zoom-in-btn')?.addEventListener('click', () => {
    sound.playClick();
    if (canvasEngineInstance) {
      canvasEngineInstance.viewport.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.2);
      updateZoomText();
    }
  });

  document.getElementById('zoom-out-btn')?.addEventListener('click', () => {
    sound.playClick();
    if (canvasEngineInstance) {
      canvasEngineInstance.viewport.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 0.83);
      updateZoomText();
    }
  });

  document.getElementById('zoom-reset-btn')?.addEventListener('click', () => {
    sound.playClick();
    if (canvasEngineInstance) {
      canvasEngineInstance.viewport.reset();
      updateZoomText();
    }
  });

  // Page Navigation
  document.getElementById('prev-page-btn')?.addEventListener('click', () => {
    sound.playClick();
    switchPage(-1);
  });
  document.getElementById('next-page-btn')?.addEventListener('click', () => {
    sound.playClick();
    switchPage(1);
  });
  document.getElementById('add-page-btn')?.addEventListener('click', async () => {
    sound.playPop();
    const page = await api.addPage(store.activeBoard.boardId, `Page ${store.pages.length + 1}`);
    store.pages.push(page.page);
    store.activePageId = page.page.pageId;
    const objs = await api.getPageObjects(store.activeBoard.boardId, store.activePageId);
    store.setObjects(objs.objects);
    updatePageIndicator();
    window.showToast(`Created Page ${store.pages.length}`);
  });

  // Chat toggle
  const chatDrawer = document.getElementById('room-chat-drawer');
  document.getElementById('toggle-chat-btn')?.addEventListener('click', () => {
    sound.playClick();
    chatDrawer.classList.toggle('hidden');
  });
  document.getElementById('close-chat-btn')?.addEventListener('click', () => {
    sound.playClick();
    chatDrawer.classList.add('hidden');
  });

  // Chat Submit
  document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input-text');
    const text = input.value?.trim();
    if (!text) return;
    input.value = '';

    try {
      sound.playClick();
      await socketClient.sendChatMessage(text);
    } catch (err) {
      window.showToast(err.message);
    }
  });

  // New Chat Message listener
  window.addEventListener('chat:new_message', (e) => {
    const msg = e.detail;
    const list = document.getElementById('chat-messages-list');
    if (!list) return;

    const isOwn = msg.senderId === store.user?.userId;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isOwn ? 'own' : ''}`;
    bubble.innerHTML = `
      <span class="chat-bubble-author">${escapeHtml(msg.senderName)}</span>
      <div class="chat-bubble-content">${escapeHtml(msg.content)}</div>
    `;
    list.appendChild(bubble);
    list.scrollTop = list.scrollHeight;
  });

  // Modals
  document.getElementById('classroom-hud-btn')?.addEventListener('click', () => {
    sound.playClick();
    showClassroomModal();
  });
  document.getElementById('game-lobby-btn')?.addEventListener('click', () => {
    sound.playClick();
    showGameLobbyModal();
  });
  document.getElementById('search-modal-btn')?.addEventListener('click', () => {
    sound.playClick();
    showSearchModal();
  });
  document.getElementById('export-board-btn')?.addEventListener('click', () => {
    sound.playClick();
    showExportModal();
  });

  // Presenter follow
  document.getElementById('follow-toggle-btn')?.addEventListener('click', () => {
    sound.playClick();
    store.isFollowingPresenter = !store.isFollowingPresenter;
    const btn = document.getElementById('follow-toggle-btn');
    if (store.isFollowingPresenter) {
      btn.classList.add('active');
      window.showToast('Following Presenter Viewport');
    } else {
      btn.classList.remove('active');
      window.showToast('Unfollowed Presenter');
    }
  });

  // Store subscription for live avatars & Game HUD
  store.subscribe(() => {
    updateAvatars();
    renderGameHUD();
  });
}

function updateZoomText() {
  const el = document.getElementById('zoom-level-text');
  if (el && canvasEngineInstance) {
    el.textContent = `${Math.round(canvasEngineInstance.viewport.zoom * 100)}%`;
  }
}

async function switchPage(delta) {
  const currentIndex = store.pages.findIndex(p => p.pageId === store.activePageId);
  const nextIndex = currentIndex + delta;
  if (nextIndex >= 0 && nextIndex < store.pages.length) {
    store.activePageId = store.pages[nextIndex].pageId;
    const objs = await api.getPageObjects(store.activeBoard.boardId, store.activePageId);
    store.setObjects(objs.objects);
    updatePageIndicator();
  }
}

function updatePageIndicator() {
  const ind = document.getElementById('page-indicator');
  if (ind && store.pages.length > 0) {
    const currentIndex = store.pages.findIndex(p => p.pageId === store.activePageId);
    ind.textContent = `Page ${currentIndex + 1} / ${store.pages.length}`;
  }
}

function updateAvatars() {
  const container = document.getElementById('room-avatars-stack');
  if (!container) return;

  container.innerHTML = store.roomMembers.slice(0, 5).map(m => `
    <div class="avatar-bubble" style="background-image:url('${m.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.userId}`}')" title="${escapeHtml(m.displayName)} (${m.role})"></div>
  `).join('');
}

// ==========================================================================
// Interactive Game HUD Overlay
// ==========================================================================
let lastWarnedSecond = null;

function renderGameHUD() {
  const container = document.getElementById('game-hud-container');
  if (!container) return;

  const game = store.activeGame;
  if (!game || game.status === 'WAITING') {
    container.innerHTML = '';
    return;
  }

  // End of Game Victory Podium
  if (game.status === 'FINISHED') {
    showVictoryPodiumModal(game);
    return;
  }

  // Round Results Screen
  if (game.status === 'ROUND_RESULTS') {
    container.innerHTML = `
      <div class="game-hud-overlay" style="min-width:380px;">
        <div style="font-size:0.8rem;text-transform:uppercase;color:var(--text-subtle);font-weight:700;">Round ${game.currentRound} Results</div>
        <div style="font-size:1.35rem;font-weight:800;color:var(--accent-emerald);">
          Secret Word: ${escapeHtml(game.revealedWord || 'COMPLETED')}
        </div>
        <div style="font-size:0.85rem;color:var(--text-muted);">Next round starts in 5 seconds...</div>
      </div>
    `;
    return;
  }

  const isDrawer = game.activeDrawerId === store.user?.userId;
  const isHurry = (game.remainingSeconds || 0) <= 10;

  // Sound effect warning on low timer
  if (isHurry && game.remainingSeconds > 0 && game.remainingSeconds !== lastWarnedSecond) {
    lastWarnedSecond = game.remainingSeconds;
    sound.playTimerHurry();
  }

  if (game.type === 'draw_and_guess') {
    container.innerHTML = `
      <div class="game-hud-overlay">
        <div class="game-hud-main-row">
          <div class="game-timer-badge ${isHurry ? 'hurry' : ''}">
            <span>⏱️</span><span>${game.remainingSeconds || 0}s</span>
          </div>
          <div style="text-align:center;">
            <div style="font-size:0.75rem;text-transform:uppercase;color:var(--text-subtle);font-weight:700;">
              Round ${game.currentRound} / ${game.totalRounds} • Category: ${escapeHtml(game.category || 'General')}
            </div>
            ${isDrawer ? `
              <div class="game-secret-banner">Draw this secret word: <strong>${escapeHtml(game.secretWord || 'SECRET')}</strong></div>
            ` : `
              <div class="game-word-hint">${escapeHtml(game.hintMask || '_ _ _ _')}</div>
            `}
          </div>
          <div style="font-size:0.85rem;font-weight:700;color:var(--primary);">
            ${isDrawer ? '🎨 You are Drawing' : '🔍 You are Guessing'}
          </div>
        </div>

        ${!isDrawer ? `
          <form class="game-quick-guess-bar" id="game-quick-guess-form">
            <input type="text" class="game-quick-guess-input" id="quick-guess-input" placeholder="Type your guess and hit Enter..." autofocus />
            <button type="submit" class="game-quick-guess-btn">Guess</button>
          </form>
        ` : ''}
      </div>
    `;

    document.getElementById('game-quick-guess-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('quick-guess-input');
      const val = input.value?.trim();
      if (!val) return;
      input.value = '';

      const res = await socketClient.submitGameGuess(val);
      if (res.correct) {
        sound.playCorrect();
        launchConfetti();
        window.showToast('🎉 Bravo! You guessed correctly!');
      } else {
        sound.playClick();
        window.showToast(`"${val}" is not quite right. Keep guessing!`);
      }
    });
  } else if (game.type === 'quiz_battle') {
    const q = game.quizQuestion;
    container.innerHTML = `
      <div class="game-hud-overlay" style="max-width:580px;width:100%;">
        <div class="game-hud-main-row">
          <div class="game-timer-badge ${isHurry ? 'hurry' : ''}">
            <span>⏱️</span><span>${game.remainingSeconds || 0}s</span>
          </div>
          <div style="font-size:0.9rem;font-weight:800;color:var(--accent-purple);">
            Question ${game.currentRound} of ${game.totalRounds}
          </div>
        </div>
        <div style="font-size:1.25rem;font-weight:800;text-align:center;margin:8px 0;">
          ${escapeHtml(q?.question || 'Quiz Question')}
        </div>
        <div class="quiz-options-grid">
          ${(q?.options || []).map((opt, idx) => `
            <button class="quiz-option-btn quiz-opt-${idx}" data-idx="${idx}">
              ${escapeHtml(opt)}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    document.querySelectorAll('.quiz-option-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        sound.playClick();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const res = await socketClient.submitQuizAnswer(idx);
        if (res && res.isCorrect) {
          sound.playCorrect();
          launchConfetti();
          window.showToast(`🔥 Correct Answer! +${res.points} points!`);
        } else {
          sound.playPop();
          window.showToast('Incorrect answer. Good try!');
        }
      });
    });
  } else if (game.type === 'quick_draw') {
    container.innerHTML = `
      <div class="game-hud-overlay">
        <div class="game-timer-badge ${isHurry ? 'hurry' : ''}">
          <span>⏱️</span><span>${game.remainingSeconds || 0}s</span>
        </div>
        <div style="text-align:center;">
          <div style="font-size:0.75rem;text-transform:uppercase;color:var(--text-subtle);font-weight:700;">Quick Draw Blitz</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--accent-cyan);">Theme: "${escapeHtml(game.currentWord || 'Rapid Sketch')}"</div>
          <div style="font-size:0.8rem;color:var(--text-muted);">Everyone draws simultaneously! Voting starts when time runs out.</div>
        </div>
      </div>
    `;
  }
}

// ==========================================================================
// Victory Podium Celebration Modal
// ==========================================================================
function showVictoryPodiumModal(game) {
  const modalContainer = document.getElementById('modal-container');
  sound.playFanfare();
  launchConfetti();

  const leaderboard = game.leaderboard || [];
  const first = leaderboard[0] || { displayName: 'Player 1', score: 0 };
  const second = leaderboard[1] || { displayName: 'Player 2', score: 0 };
  const third = leaderboard[2] || { displayName: 'Player 3', score: 0 };

  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-content podium-modal-content">
        <h2 style="font-family:var(--font-heading);font-size:2rem;font-weight:800;margin-bottom:8px;">🏆 Victory Podium!</h2>
        <p style="color:var(--text-muted);font-size:0.95rem;">Game completed! Outstanding performance by everyone.</p>

        <div class="podium-container">
          <!-- 2nd Place -->
          <div class="podium-step podium-second">
            <img class="podium-avatar" src="${second.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${second.userId || '2'}`}" />
            <div style="font-size:0.85rem;margin-top:28px;">🥈 2nd</div>
            <div style="font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">${escapeHtml(second.displayName)}</div>
            <div style="font-size:0.8rem;color:#e2e8f0;">${second.score} pts</div>
          </div>

          <!-- 1st Place Champion -->
          <div class="podium-step podium-first">
            <img class="podium-avatar" src="${first.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${first.userId || '1'}`}" style="border-color:#f59e0b;" />
            <div style="font-size:0.95rem;margin-top:28px;">👑 1st</div>
            <div style="font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:95px;">${escapeHtml(first.displayName)}</div>
            <div style="font-size:0.85rem;color:#fef3c7;">${first.score} pts</div>
          </div>

          <!-- 3rd Place -->
          <div class="podium-step podium-third">
            <img class="podium-avatar" src="${third.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${third.userId || '3'}`}" />
            <div style="font-size:0.8rem;margin-top:28px;">🥉 3rd</div>
            <div style="font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:85px;">${escapeHtml(third.displayName)}</div>
            <div style="font-size:0.75rem;color:#fde68a;">${third.score} pts</div>
          </div>
        </div>

        <div style="display:flex;justify-content:center;gap:16px;">
          <button class="btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">
            Return to Canvas
          </button>
          <button class="btn-primary" onclick="document.getElementById('modal-container').innerHTML=''; showGameLobbyModal();">
            Play Another Game 🎮
          </button>
        </div>
      </div>
    </div>
  `;
}

// ==========================================================================
// Upgraded Multiplayer Game Lobby & "How to Play" Hub
// ==========================================================================
function showGameLobbyModal() {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-content" style="max-width:620px;">
        <div class="modal-header">
          <h2 class="modal-title">🎮 Multiplayer Room Games Hub</h2>
          <button class="modal-close-btn" onclick="document.getElementById('modal-container').innerHTML=''">✕</button>
        </div>
        <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:16px;">
          Select a multiplayer activity. All room members will be transitioned into the game.
        </p>

        <!-- Game Selector Cards -->
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
          <div class="template-card" id="select-game-draw" style="border-color:var(--primary);cursor:pointer;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <h3 style="color:var(--primary);">🎨 Draw & Guess (Pictionary)</h3>
              <span class="room-badge">Popular</span>
            </div>
            <p>One player is given a secret word to sketch on the canvas while everyone else races to guess it in chat or the Quick Guess bar!</p>
          </div>

          <div class="template-card" id="select-game-quiz" style="cursor:pointer;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <h3>🧠 Educational Quiz Battle</h3>
              <span class="room-badge" style="background:rgba(236,72,153,0.15);color:var(--accent-pink);">Kahoot Style</span>
            </div>
            <p>Rapid-fire multiple choice question rounds. Earn points for accuracy, speed, and consecutive answer streaks!</p>
          </div>

          <div class="template-card" id="select-game-quick" style="cursor:pointer;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <h3>⚡ Quick Draw Challenge</h3>
              <span class="room-badge" style="background:rgba(6,182,212,0.15);color:var(--accent-cyan);">Party</span>
            </div>
            <p>45-second synchronized sketch sprint on the same prompt. Everyone votes on the best artwork at the end!</p>
          </div>
        </div>

        <!-- How to Play & Rules Guide -->
        <div class="game-guide-box" id="game-guide-content">
          <div class="game-guide-title">📖 How to Play & Rules: Draw & Guess</div>
          <ul class="game-guide-list">
            <li><span>🎨</span><strong>If you are the Drawer:</strong> You'll privately receive a secret word. Use pen and shapes to draw it. Do not write text, numbers, or letters!</li>
            <li><span>🔍</span><strong>If you are a Guesser:</strong> Watch the live drawing and type guesses into the Quick Guess bar. Early guesses get up to +450 speed bonus!</li>
            <li><span>💡</span><strong>Hint Revelation:</strong> At the halfway mark, a hidden letter will automatically be unveiled to help you.</li>
          </ul>
        </div>

        <!-- Start Controls -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding-top:16px;border-top:1px solid var(--border-subtle);">
          <div style="display:flex;align-items:center;gap:10px;">
            <label style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">Rounds:</label>
            <select id="game-rounds-select" style="padding:6px 10px;font-size:0.85rem;">
              <option value="2">2 Rounds</option>
              <option value="3" selected>3 Rounds</option>
              <option value="5">5 Rounds</option>
            </select>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
            <button id="start-chosen-game-btn" class="btn-primary">Start Game Now 🚀</button>
          </div>
        </div>
      </div>
    </div>
  `;

  let chosenType = 'draw_and_guess';

  const guideContent = document.getElementById('game-guide-content');

  document.getElementById('select-game-draw')?.addEventListener('click', () => {
    sound.playClick();
    chosenType = 'draw_and_guess';
    resetCards();
    document.getElementById('select-game-draw').style.borderColor = 'var(--primary)';
    guideContent.innerHTML = `
      <div class="game-guide-title">📖 How to Play & Rules: Draw & Guess</div>
      <ul class="game-guide-list">
        <li><span>🎨</span><strong>If you are the Drawer:</strong> You'll privately receive a secret word. Use pen and shapes to draw it. Do not write text, numbers, or letters!</li>
        <li><span>🔍</span><strong>If you are a Guesser:</strong> Watch the live drawing and type guesses into the Quick Guess bar. Early guesses get up to +450 speed bonus!</li>
        <li><span>💡</span><strong>Hint Revelation:</strong> At the halfway mark, a hidden letter will automatically be unveiled to help you.</li>
      </ul>
    `;
  });

  document.getElementById('select-game-quiz')?.addEventListener('click', () => {
    sound.playClick();
    chosenType = 'quiz_battle';
    resetCards();
    document.getElementById('select-game-quiz').style.borderColor = 'var(--accent-pink)';
    guideContent.innerHTML = `
      <div class="game-guide-title">📖 How to Play & Rules: Educational Quiz Battle</div>
      <ul class="game-guide-list">
        <li><span>⚡</span><strong>Timed Questions:</strong> 20 seconds on the clock per question. Tap the correct colored option before time runs out.</li>
        <li><span>🔥</span><strong>Streak Multiplier:</strong> Consecutive correct answers grant a multiplier up to 1.5x on your points!</li>
        <li><span>📊</span><strong>Live Leaderboards:</strong> Real-time rankings update after every round.</li>
      </ul>
    `;
  });

  document.getElementById('select-game-quick')?.addEventListener('click', () => {
    sound.playClick();
    chosenType = 'quick_draw';
    resetCards();
    document.getElementById('select-game-quick').style.borderColor = 'var(--accent-cyan)';
    guideContent.innerHTML = `
      <div class="game-guide-title">📖 How to Play & Rules: Quick Draw Challenge</div>
      <ul class="game-guide-list">
        <li><span>⏱️</span><strong>45-Second Sprint:</strong> Everyone receives the exact same drawing prompt and sketches simultaneously.</li>
        <li><span>🗳️</span><strong>Community Voting:</strong> View all participants' sketches in a side-by-side gallery and cast your vote for the best artist!</li>
        <li><span>🏆</span><strong>Podium Ceremony:</strong> The sketch with the most votes wins the round trophy.</li>
      </ul>
    `;
  });

  function resetCards() {
    ['select-game-draw', 'select-game-quiz', 'select-game-quick'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.borderColor = 'var(--border-subtle)';
    });
  }

  document.getElementById('start-chosen-game-btn')?.addEventListener('click', async () => {
    sound.playPop();
    const rounds = parseInt(document.getElementById('game-rounds-select').value, 10) || 3;
    modalContainer.innerHTML = '';
    try {
      const res = await api.createGame(store.activeRoom.roomId, chosenType, { totalRounds: rounds });
      socketClient.socket.emit('game:join', { gameId: res.game.gameId });
      socketClient.socket.emit('game:start', { gameId: res.game.gameId });
      window.showToast(`Starting ${chosenType} match!`);
    } catch (err) {
      window.showToast(err.message);
    }
  });
}

// ==========================================================================
// Upgraded Auth Modal (Sign In / Register / Instant Guest)
// ==========================================================================
function showAuthModal(defaultTab = 'login') {
  const modalContainer = document.getElementById('modal-container');
  sound.playClick();

  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-content" style="max-width:460px;">
        <div class="modal-header" style="margin-bottom:12px;">
          <h2 class="modal-title">CollabCanvas Identity</h2>
          <button class="modal-close-btn" onclick="document.getElementById('modal-container').innerHTML=''">✕</button>
        </div>

        <div class="auth-tabs">
          <div class="auth-tab ${defaultTab === 'login' ? 'active' : ''}" id="tab-login">Sign In</div>
          <div class="auth-tab ${defaultTab === 'register' ? 'active' : ''}" id="tab-register">Create Account</div>
          <div class="auth-tab ${defaultTab === 'guest' ? 'active' : ''}" id="tab-guest">Instant Guest</div>
        </div>

        <form id="auth-main-form">
          <!-- Live Avatar Preview (for Register & Guest) -->
          <div class="auth-avatar-row ${defaultTab === 'login' ? 'hidden' : ''}" id="auth-avatar-row">
            <img class="avatar-preview-img" id="avatar-preview" src="https://api.dicebear.com/7.x/bottts/svg?seed=CanvasFan" />
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.85rem;">Generated Avatar</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">Updates automatically with your name</div>
            </div>
            <button type="button" class="btn-secondary" id="randomize-avatar-btn" style="padding:4px 10px;font-size:0.75rem;">🎲 Random</button>
          </div>

          <div style="margin-bottom:14px;" id="auth-name-container" class="${defaultTab === 'login' ? 'hidden' : ''}">
            <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px;">Display Name</label>
            <input type="text" id="auth-input-name" placeholder="e.g. Maya Chen" style="width:100%;" />
          </div>

          <div style="margin-bottom:14px;" id="auth-email-container" class="${defaultTab === 'guest' ? 'hidden' : ''}">
            <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px;">Email Address</label>
            <input type="email" id="auth-input-email" placeholder="maya@example.com" style="width:100%;" />
          </div>

          <div style="margin-bottom:20px;" id="auth-pass-container" class="${defaultTab === 'guest' ? 'hidden' : ''}">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <label style="font-size:0.85rem;font-weight:600;">Password</label>
              <span id="toggle-pass-visibility" style="font-size:0.8rem;color:var(--primary);cursor:pointer;">👁️ Show</span>
            </div>
            <input type="password" id="auth-input-pass" placeholder="••••••••" style="width:100%;" />
          </div>

          <button type="submit" class="btn-primary" id="auth-submit-btn" style="width:100%;justify-content:center;padding:12px;">
            ${defaultTab === 'login' ? 'Sign In' : defaultTab === 'register' ? 'Create Account' : 'Join as Guest'}
          </button>
        </form>
      </div>
    </div>
  `;

  let currentTab = defaultTab;
  let avatarSeed = 'CanvasFan';

  const avatarImg = document.getElementById('avatar-preview');
  const nameInput = document.getElementById('auth-input-name');

  nameInput?.addEventListener('input', (e) => {
    avatarSeed = e.target.value?.trim() || 'CanvasFan';
    avatarImg.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`;
  });

  document.getElementById('randomize-avatar-btn')?.addEventListener('click', () => {
    sound.playClick();
    avatarSeed = `Seed_${Math.floor(Math.random() * 99999)}`;
    avatarImg.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`;
  });

  // Password visibility
  let passVisible = false;
  document.getElementById('toggle-pass-visibility')?.addEventListener('click', () => {
    passVisible = !passVisible;
    const passInput = document.getElementById('auth-input-pass');
    passInput.type = passVisible ? 'text' : 'password';
    document.getElementById('toggle-pass-visibility').textContent = passVisible ? '🙈 Hide' : '👁️ Show';
  });

  // Tab switching
  const tabs = {
    login: document.getElementById('tab-login'),
    register: document.getElementById('tab-register'),
    guest: document.getElementById('tab-guest')
  };

  function setTab(tab) {
    sound.playClick();
    currentTab = tab;
    Object.values(tabs).forEach(t => t.classList.remove('active'));
    tabs[tab].classList.add('active');

    document.getElementById('auth-avatar-row').classList.toggle('hidden', tab === 'login');
    document.getElementById('auth-name-container').classList.toggle('hidden', tab === 'login');
    document.getElementById('auth-email-container').classList.toggle('hidden', tab === 'guest');
    document.getElementById('auth-pass-container').classList.toggle('hidden', tab === 'guest');

    document.getElementById('auth-submit-btn').textContent =
      tab === 'login' ? 'Sign In' : tab === 'register' ? 'Create Account' : 'Join as Guest';
  }

  tabs.login?.addEventListener('click', () => setTab('login'));
  tabs.register?.addEventListener('click', () => setTab('register'));
  tabs.guest?.addEventListener('click', () => setTab('guest'));

  document.getElementById('auth-main-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    sound.playClick();

    const email = document.getElementById('auth-input-email').value;
    const pass = document.getElementById('auth-input-pass').value;
    const name = document.getElementById('auth-input-name').value;
    const avatarUrl = avatarImg.src;

    try {
      let res;
      if (currentTab === 'login') {
        res = await api.login(email, pass);
      } else if (currentTab === 'register') {
        res = await api.register(email, pass, name || 'User');
      } else {
        res = await api.createGuest(name || 'Guest');
      }

      store.setAuth(res.user, res.token);
      sound.playCorrect();
      modalContainer.innerHTML = '';
      window.showToast(`Welcome, ${res.user.displayName}!`);
      renderDashboard();
    } catch (err) {
      window.showToast(err.message);
    }
  });
}

function showCreateRoomModal(defaultTemplate = 'blank') {
  const modalContainer = document.getElementById('modal-container');
  sound.playClick();

  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Create Whiteboard Room</h2>
          <button class="modal-close-btn" onclick="document.getElementById('modal-container').innerHTML=''">✕</button>
        </div>
        <form id="create-room-form">
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px;">Room Name</label>
            <input type="text" id="cr-name" required placeholder="e.g. Design Architecture Sync" style="width:100%;" />
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px;">Visibility</label>
            <select id="cr-vis" style="width:100%;">
              <option value="public">🌐 Public (Discoverable in Explore)</option>
              <option value="unlisted">🔗 Unlisted (Only via direct link)</option>
              <option value="private">🔒 Private (Password protected)</option>
            </select>
          </div>
          <div style="margin-bottom:16px;" id="cr-pass-group">
            <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px;">Room Password (Optional)</label>
            <input type="password" id="cr-pass" placeholder="Leave empty for open access" style="width:100%;" />
          </div>
          <div style="margin-bottom:24px;">
            <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px;">Starter Template</label>
            <select id="cr-tmpl" style="width:100%;">
              <option value="blank" ${defaultTemplate === 'blank' ? 'selected' : ''}>Blank Canvas</option>
              <option value="brainstorming" ${defaultTemplate === 'brainstorming' ? 'selected' : ''}>Agile Brainstorming</option>
              <option value="classroom" ${defaultTemplate === 'classroom' ? 'selected' : ''}>Classroom Lesson</option>
              <option value="game" ${defaultTemplate === 'game' ? 'selected' : ''}>Party Game Night</option>
            </select>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:12px;">
            <button type="button" class="btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
            <button type="submit" class="btn-primary">Create & Join Room</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('create-room-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    sound.playClick();
    const name = document.getElementById('cr-name').value;
    const visibility = document.getElementById('cr-vis').value;
    const password = document.getElementById('cr-pass').value;
    const template = document.getElementById('cr-tmpl').value;

    try {
      const res = await api.createRoom({ name, visibility, password, template });
      modalContainer.innerHTML = '';
      window.location.hash = `#room/${res.room.roomId}`;
      window.showToast('Room created successfully!');
    } catch (err) {
      window.showToast(err.message);
    }
  });
}

function showClassroomModal() {
  const modalContainer = document.getElementById('modal-container');
  const isTeacher = store.user?.role === 'room_owner' || store.user?.role === 'presenter';

  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-content" style="max-width:580px;">
        <div class="modal-header">
          <h2 class="modal-title">🎓 Classroom & Presenter Hub</h2>
          <button class="modal-close-btn" onclick="document.getElementById('modal-container').innerHTML=''">✕</button>
        </div>

        ${isTeacher ? `
          <div style="background:var(--bg-surface-elevated);border-radius:var(--radius-md);padding:14px;margin-bottom:20px;border:1px solid var(--border-subtle);">
            <h4 style="font-size:0.95rem;margin-bottom:10px;">Teacher Controls</h4>
            <div style="display:flex;gap:12px;align-items:center;">
              <button id="toggle-student-lock-btn" class="btn-secondary" style="font-size:0.85rem;">
                ${store.studentEditingLocked ? '🔓 Unlock Student Drawing' : '🔒 Lock Student Drawing'}
              </button>
              <button id="broadcast-viewport-btn" class="btn-primary" style="font-size:0.85rem;">
                Broadcast Viewport to Students
              </button>
            </div>
          </div>
        ` : `
          <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px;">
            <button id="raise-hand-btn" class="btn-primary">
              ✋ Raise Hand to Speak
            </button>
          </div>
        `}

        <h4 style="font-size:0.95rem;margin-bottom:12px;">Student Question Queue (${store.questionQueue.length})</h4>
        <div id="modal-question-list" style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
          ${store.questionQueue.map(q => `
            <div style="background:var(--bg-surface-elevated);padding:10px;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:space-between;">
              <div>
                <span style="font-size:0.8rem;color:var(--text-subtle);">${escapeHtml(q.displayName)}</span>
                <p style="font-size:0.9rem;">${escapeHtml(q.text)}</p>
              </div>
              ${isTeacher && !q.answered ? `
                <button class="btn-secondary mark-answered-btn" data-qid="${q.questionId}" style="padding:4px 10px;font-size:0.75rem;">Mark Answered</button>
              ` : q.answered ? '<span style="color:var(--accent-emerald);font-size:0.8rem;">✓ Answered</span>' : ''}
            </div>
          `).join('') || '<div style="color:var(--text-muted);font-size:0.85rem;">No active questions in queue.</div>'}
        </div>

        <div style="display:flex;gap:8px;">
          <input type="text" id="new-question-input" placeholder="Ask the instructor a question..." style="flex:1;" />
          <button id="submit-question-btn" class="btn-primary">Submit</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('toggle-student-lock-btn')?.addEventListener('click', () => {
    sound.playClick();
    socketClient.socket.emit('presenter:toggle_draw_lock', { locked: !store.studentEditingLocked });
    modalContainer.innerHTML = '';
  });

  document.getElementById('broadcast-viewport-btn')?.addEventListener('click', () => {
    sound.playPop();
    if (canvasEngineInstance) {
      socketClient.socket.emit('presenter:viewport', {
        pageId: store.activePageId,
        x: canvasEngineInstance.viewport.x,
        y: canvasEngineInstance.viewport.y,
        zoom: canvasEngineInstance.viewport.zoom
      });
      window.showToast('Viewport broadcasted to all followers');
      modalContainer.innerHTML = '';
    }
  });

  document.getElementById('raise-hand-btn')?.addEventListener('click', () => {
    sound.playPop();
    socketClient.socket.emit('classroom:hand_raise', { raised: true });
    window.showToast('Hand raised! Presenter notified.');
    modalContainer.innerHTML = '';
  });

  document.getElementById('submit-question-btn')?.addEventListener('click', () => {
    sound.playClick();
    const text = document.getElementById('new-question-input').value;
    if (text?.trim()) {
      socketClient.socket.emit('classroom:question_submit', { text: text.trim() });
      modalContainer.innerHTML = '';
      window.showToast('Question submitted to instructor');
    }
  });

  document.querySelectorAll('.mark-answered-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const qid = btn.getAttribute('data-qid');
      socketClient.socket.emit('classroom:question_answered', { questionId: qid });
      modalContainer.innerHTML = '';
    });
  });
}

function showSearchModal() {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-content" style="max-width:540px;">
        <div class="modal-header">
          <h2 class="modal-title">🔍 Search Board & Canvas</h2>
          <button class="modal-close-btn" onclick="document.getElementById('modal-container').innerHTML=''">✕</button>
        </div>
        <input type="text" id="board-search-input" placeholder="Search sticky notes, text, page names..." style="width:100%;margin-bottom:16px;" autofocus />
        <div id="board-search-results" style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
          <div style="color:var(--text-muted);font-size:0.85rem;">Type to search current board...</div>
        </div>
      </div>
    </div>
  `;

  const input = document.getElementById('board-search-input');
  input?.addEventListener('input', async (e) => {
    const q = e.target.value?.trim();
    const resBox = document.getElementById('board-search-results');
    if (!q) {
      resBox.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;">Type to search current board...</div>';
      return;
    }

    try {
      const { results } = await api.searchInBoard(store.activeBoard.boardId, q);
      if (results.length === 0) {
        resBox.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;">No results found.</div>';
        return;
      }

      resBox.innerHTML = results.map(r => `
        <div style="background:var(--bg-surface-elevated);padding:10px;border-radius:var(--radius-sm);cursor:pointer;" onclick="jumpToSearchResult(${r.position?.x || 0}, ${r.position?.y || 0}, '${r.pageId}')">
          <div style="font-weight:700;font-size:0.85rem;">${escapeHtml(r.title)}</div>
          <div style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(r.snippet)}</div>
        </div>
      `).join('');
    } catch (err) {}
  });
}

window.jumpToSearchResult = function (x, y, pageId) {
  if (canvasEngineInstance) {
    sound.playPop();
    if (pageId && pageId !== store.activePageId) {
      store.activePageId = pageId;
      updatePageIndicator();
    }
    canvasEngineInstance.viewport.x = (window.innerWidth / 2) - x * canvasEngineInstance.viewport.zoom;
    canvasEngineInstance.viewport.y = (window.innerHeight / 2) - y * canvasEngineInstance.viewport.zoom;
    document.getElementById('modal-container').innerHTML = '';
  }
};

function showExportModal() {
  const modalContainer = document.getElementById('modal-container');
  sound.playClick();

  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-content" style="max-width:480px;">
        <div class="modal-header">
          <h2 class="modal-title">💾 Export Board</h2>
          <button class="modal-close-btn" onclick="document.getElementById('modal-container').innerHTML=''">✕</button>
        </div>
        <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:20px;">
          Choose your desired export format for this collaborative board.
        </p>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <button id="export-png-btn" class="btn-primary" style="justify-content:center;">
            Download as PNG Image
          </button>
          <button id="export-json-btn" class="btn-secondary" style="justify-content:center;">
            Download JSON Backup
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('export-png-btn')?.addEventListener('click', () => {
    sound.playCorrect();
    if (canvasEngineInstance) {
      const link = document.createElement('a');
      link.download = `${store.activeRoom.name || 'board'}.png`;
      link.href = canvasEngineInstance.canvas.toDataURL('image/png');
      link.click();
      modalContainer.innerHTML = '';
      window.showToast('Board exported as PNG!');
    }
  });

  document.getElementById('export-json-btn')?.addEventListener('click', async () => {
    sound.playPop();
    try {
      const res = await api.request(`/boards/${store.activeBoard.boardId}/export`);
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${store.activeRoom.name || 'board'}_backup.json`;
      link.href = url;
      link.click();
      modalContainer.innerHTML = '';
      window.showToast('JSON backup exported!');
    } catch (err) {
      window.showToast(err.message);
    }
  });
}

function toggleTheme() {
  sound.playClick();
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  window.showToast(`Switched to ${next} theme`);
}

// Start Application
init();
