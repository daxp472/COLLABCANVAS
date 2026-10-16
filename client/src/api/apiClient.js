import { store } from '../state/store.js';

class ApiClient {
  constructor() {
    this.baseUrl = '/api';
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (store.token) {
      headers['Authorization'] = `Bearer ${store.token}`;
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.error?.message || `Request failed with status ${res.status}`);
      err.code = data.error?.code;
      err.status = res.status;
      throw err;
    }

    return data;
  }

  // Auth
  async register(email, password, displayName) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName })
    });
  }

  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async createGuest(displayName) {
    return this.request('/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ displayName })
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Rooms
  async listPublicRooms(search = '') {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/rooms${query}`);
  }

  async createRoom(payload) {
    return this.request('/rooms', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getRoom(roomId) {
    return this.request(`/rooms/${roomId}`);
  }

  async joinRoom(roomId, password = null) {
    return this.request(`/rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  }

  async updateRoom(roomId, updates) {
    return this.request(`/rooms/${roomId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  // Boards & Pages
  async getBoard(boardId) {
    return this.request(`/boards/${boardId}`);
  }

  async getPageObjects(boardId, pageId) {
    return this.request(`/boards/${boardId}/pages/${pageId}/objects`);
  }

  async getRecoveryState(boardId, sinceVersion = 0) {
    return this.request(`/boards/${boardId}/recovery?sinceVersion=${sinceVersion}`);
  }

  async addPage(boardId, name, background) {
    return this.request(`/boards/${boardId}/pages`, {
      method: 'POST',
      body: JSON.stringify({ name, background })
    });
  }

  async deletePage(boardId, pageId) {
    return this.request(`/boards/${boardId}/pages/${pageId}`, {
      method: 'DELETE'
    });
  }

  // Search
  async searchGlobal(q) {
    return this.request(`/search?q=${encodeURIComponent(q)}`);
  }

  async searchInBoard(boardId, q) {
    return this.request(`/search/boards/${boardId}?q=${encodeURIComponent(q)}`);
  }

  // Games
  async createGame(roomId, type, config = {}) {
    return this.request(`/games/rooms/${roomId}`, {
      method: 'POST',
      body: JSON.stringify({ type, config })
    });
  }

  async getGame(gameId) {
    return this.request(`/games/${gameId}`);
  }
}

export const api = new ApiClient();
