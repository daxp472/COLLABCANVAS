class Store {
  constructor() {
    this.token = localStorage.getItem('collabcanvas_token') || null;
    this.user = JSON.parse(localStorage.getItem('collabcanvas_user') || 'null');

    this.activeRoom = null;
    this.roomMembers = [];
    this.activeBoard = null;
    this.pages = [];
    this.activePageId = null;

    // Map: objectId -> CanvasObject
    this.objects = new Map();

    // Tool state
    this.activeTool = 'pen'; // 'pan', 'select', 'pen', 'highlighter', 'eraser', 'rectangle', 'circle', 'line', 'arrow', 'text', 'sticky', 'laser'
    this.toolProps = {
      strokeColor: '#6366f1',
      strokeWidth: 3,
      fillColor: 'transparent',
      fontSize: 18,
      stickyColor: '#fef08a'
    };

    // Selection & transform
    this.selectedObjectIds = new Set();

    // Live Presence & Cursors: userId -> { x, y, displayName, color }
    this.remoteCursors = new Map();
    this.remoteTransientStrokes = new Map(); // userId -> { points, color, width }

    // Presenter & Follow State
    this.presenterState = { active: false };
    this.isFollowingPresenter = false;

    // Classroom state
    this.questionQueue = [];
    this.studentEditingLocked = false;

    // Games state
    this.activeGame = null;

    // Undo / Redo
    this.undoStack = [];
    this.redoStack = [];

    this.listeners = new Set();
  }

  setAuth(user, token) {
    this.user = user;
    this.token = token;
    if (token) localStorage.setItem('collabcanvas_token', token);
    else localStorage.removeItem('collabcanvas_token');

    if (user) localStorage.setItem('collabcanvas_user', JSON.stringify(user));
    else localStorage.removeItem('collabcanvas_user');

    this.notify();
  }

  setRoom(room, board, pages = []) {
    this.activeRoom = room;
    this.activeBoard = board;
    this.pages = pages;
    this.activePageId = pages[0]?.pageId || null;
    this.studentEditingLocked = !!room.settings?.studentEditingLocked;
    this.notify();
  }

  setObjects(objectList) {
    this.objects.clear();
    for (const obj of objectList) {
      this.objects.set(obj.objectId, obj);
    }
    this.notify();
  }

  upsertObject(obj) {
    this.objects.set(obj.objectId, obj);
    this.notify();
  }

  removeObject(objectId) {
    this.objects.delete(objectId);
    this.selectedObjectIds.delete(objectId);
    this.notify();
  }

  setTool(tool) {
    this.activeTool = tool;
    this.notify();
  }

  setToolProps(props) {
    this.toolProps = { ...this.toolProps, ...props };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try { listener(this); } catch (e) { console.error(e); }
    }
  }
}

export const store = new Store();
