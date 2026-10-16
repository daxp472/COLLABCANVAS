import { nanoid } from 'nanoid';
import { Viewport } from './logicalCoordinates.js';
import { store } from '../state/store.js';
import { socketClient } from '../socket/socketClient.js';

export class CanvasEngine {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.viewport = new Viewport();

    this.isPointerDown = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.activeStrokePoints = [];

    // Dragging / Moving objects
    this.isDraggingObject = false;
    this.dragTargetObject = null;
    this.dragOffset = { x: 0, y: 0 };

    this.initEvents();
    this.resize();
    this.renderLoop();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(dpr, dpr);
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    // Custom follow viewport event
    window.addEventListener('canvas:follow_viewport', (e) => {
      const { x, y, zoom } = e.detail;
      this.viewport.x = x;
      this.viewport.y = y;
      this.viewport.zoom = zoom;
    });
  }

  onPointerDown(e) {
    if (store.studentEditingLocked && store.user?.role === 'student') {
      window.dispatchEvent(new CustomEvent('canvas:toast', { detail: 'Teacher has locked whiteboard editing' }));
      return;
    }

    this.isPointerDown = true;
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = this.viewport.screenToWorld(screenX, screenY);

    this.startPoint = { ...world, screenX, screenY };
    this.currentPoint = { ...world, screenX, screenY };

    const tool = store.activeTool;

    if (tool === 'pan' || e.button === 1 || e.spaceKey) {
      return; // Handled in pointermove
    }

    if (tool === 'select') {
      // Hit test existing objects
      const hit = this.hitTest(world.x, world.y);
      if (hit) {
        store.selectedObjectIds.clear();
        store.selectedObjectIds.add(hit.objectId);
        this.isDraggingObject = true;
        this.dragTargetObject = hit;
        this.dragOffset = {
          x: world.x - (hit.data.x || 0),
          y: world.y - (hit.data.y || 0)
        };
      } else {
        store.selectedObjectIds.clear();
      }
      store.notify();
      return;
    }

    if (tool === 'eraser') {
      const hit = this.hitTest(world.x, world.y);
      if (hit) {
        this.deleteObject(hit.objectId);
      }
      return;
    }

    if (tool === 'sticky') {
      this.createStickyNote(world.x, world.y);
      this.isPointerDown = false;
      return;
    }

    if (tool === 'text') {
      this.createTextObject(world.x, world.y);
      this.isPointerDown = false;
      return;
    }

    if (tool === 'pen' || tool === 'highlighter') {
      this.activeStrokePoints = [{ x: world.x, y: world.y }];
    }
  }

  onPointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = this.viewport.screenToWorld(screenX, screenY);

    // Broadcast cursor position to peers (throttled)
    socketClient.emitCursor(world.x, world.y);

    if (!this.isPointerDown) return;

    const tool = store.activeTool;

    if (tool === 'pan' || e.buttons === 4 || e.spaceKey) {
      const dx = screenX - this.currentPoint.screenX;
      const dy = screenY - this.currentPoint.screenY;
      this.viewport.pan(dx, dy);
      this.currentPoint = { ...world, screenX, screenY };
      return;
    }

    if (tool === 'select' && this.isDraggingObject && this.dragTargetObject) {
      const newX = world.x - this.dragOffset.x;
      const newY = world.y - this.dragOffset.y;
      this.dragTargetObject.data.x = newX;
      this.dragTargetObject.data.y = newY;
      this.currentPoint = { ...world, screenX, screenY };
      return;
    }

    if (tool === 'pen' || tool === 'highlighter') {
      this.activeStrokePoints.push({ x: world.x, y: world.y });
      // Emit in-flight stroke to peers
      socketClient.emitTransientDraw(
        this.activeStrokePoints,
        store.toolProps.strokeColor,
        tool === 'highlighter' ? 18 : store.toolProps.strokeWidth
      );
    }

    this.currentPoint = { ...world, screenX, screenY };
  }

  onPointerUp(e) {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;

    const tool = store.activeTool;

    if (tool === 'select' && this.isDraggingObject && this.dragTargetObject) {
      this.isDraggingObject = false;
      // Emit committed position delta operation
      this.emitObjectUpdate(this.dragTargetObject.objectId, {
        x: this.dragTargetObject.data.x,
        y: this.dragTargetObject.data.y
      });
      this.dragTargetObject = null;
      return;
    }

    if (tool === 'pen' || tool === 'highlighter') {
      if (this.activeStrokePoints.length > 1) {
        this.createPathObject(
          this.activeStrokePoints,
          tool === 'highlighter' ? 18 : store.toolProps.strokeWidth,
          store.toolProps.strokeColor,
          tool === 'highlighter' ? 0.35 : 1.0
        );
      }
      this.activeStrokePoints = [];
      store.remoteTransientStrokes.delete(store.user?.userId);
      return;
    }

    if (['rectangle', 'circle', 'line', 'arrow'].includes(tool)) {
      if (this.startPoint && this.currentPoint) {
        this.createShapeObject(tool, this.startPoint, this.currentPoint);
      }
    }
  }

  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (e.ctrlKey) {
      // Zoom
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      this.viewport.zoomAt(screenX, screenY, factor);
    } else {
      // Pan
      this.viewport.pan(-e.deltaX, -e.deltaY);
    }
  }

  // Object Creation Helpers
  async createPathObject(points, strokeWidth, strokeColor, opacity) {
    const objectId = `path_${nanoid(8)}`;
    const opData = {
      operationId: `op_${nanoid(8)}`,
      boardId: store.activeBoard.boardId,
      pageId: store.activePageId,
      type: 'object:create',
      targetId: objectId,
      payload: {
        type: 'path',
        data: { points, strokeWidth, strokeColor, opacity }
      }
    };

    // Optimistic local add
    store.upsertObject({
      objectId,
      boardId: store.activeBoard.boardId,
      pageId: store.activePageId,
      type: 'path',
      data: { points, strokeWidth, strokeColor, opacity },
      version: 1
    });

    try {
      await socketClient.emitOperation(opData);
    } catch (err) {
      store.removeObject(objectId);
      console.error('[Canvas] Create path error:', err);
    }
  }

  async createShapeObject(shapeType, start, end) {
    const objectId = `shape_${nanoid(8)}`;
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    if (width < 5 && height < 5) return;

    const shapeData = {
      shapeType,
      x, y, width, height,
      startX: start.x, startY: start.y,
      endX: end.x, endY: end.y,
      strokeColor: store.toolProps.strokeColor,
      strokeWidth: store.toolProps.strokeWidth,
      fillColor: store.toolProps.fillColor
    };

    const opData = {
      operationId: `op_${nanoid(8)}`,
      boardId: store.activeBoard.boardId,
      pageId: store.activePageId,
      type: 'object:create',
      targetId: objectId,
      payload: {
        type: shapeType,
        data: shapeData
      }
    };

    store.upsertObject({
      objectId,
      boardId: store.activeBoard.boardId,
      pageId: store.activePageId,
      type: shapeType,
      data: shapeData,
      version: 1
    });

    try {
      await socketClient.emitOperation(opData);
    } catch (err) {
      store.removeObject(objectId);
    }
  }

  async createStickyNote(x, y) {
    const objectId = `sticky_${nanoid(8)}`;
    const data = {
      x, y,
      width: 220,
      height: 180,
      text: 'New Sticky Note\n(Click to edit)',
      color: store.toolProps.stickyColor || '#fef08a',
      fontSize: 16,
      votes: 0
    };

    const opData = {
      operationId: `op_${nanoid(8)}`,
      boardId: store.activeBoard.boardId,
      pageId: store.activePageId,
      type: 'object:create',
      targetId: objectId,
      payload: { type: 'sticky', data }
    };

    store.upsertObject({
      objectId,
      boardId: store.activeBoard.boardId,
      pageId: store.activePageId,
      type: 'sticky',
      data,
      version: 1
    });

    try {
      await socketClient.emitOperation(opData);
    } catch (err) {
      store.removeObject(objectId);
    }
  }

  async createTextObject(x, y) {
    const text = prompt('Enter text:');
    if (!text || !text.trim()) return;

    const objectId = `text_${nanoid(8)}`;
    const data = {
      x, y,
      text: text.trim(),
      fontSize: store.toolProps.fontSize || 20,
      color: store.toolProps.strokeColor || '#ffffff',
      fontFamily: 'Plus Jakarta Sans, sans-serif'
    };

    const opData = {
      operationId: `op_${nanoid(8)}`,
      boardId: store.activeBoard.boardId,
      pageId: store.activePageId,
      type: 'object:create',
      targetId: objectId,
      payload: { type: 'text', data }
    };

    store.upsertObject({
      objectId,
      boardId: store.activeBoard.boardId,
      pageId: store.activePageId,
      type: 'text',
      data,
      version: 1
    });

    try {
      await socketClient.emitOperation(opData);
    } catch (err) {
      store.removeObject(objectId);
    }
  }

  async emitObjectUpdate(objectId, partialData) {
    const opData = {
      operationId: `op_${nanoid(8)}`,
      boardId: store.activeBoard.boardId,
      pageId: store.activePageId,
      type: 'object:update',
      targetId: objectId,
      payload: { data: partialData }
    };

    try {
      await socketClient.emitOperation(opData);
    } catch (err) {
      console.error('[Canvas] Update error:', err);
    }
  }

  async deleteObject(objectId) {
    const opData = {
      operationId: `op_${nanoid(8)}`,
      boardId: store.activeBoard.boardId,
      pageId: store.activePageId,
      type: 'object:delete',
      targetId: objectId,
      payload: {}
    };

    store.removeObject(objectId);

    try {
      await socketClient.emitOperation(opData);
    } catch (err) {
      console.error('[Canvas] Delete error:', err);
    }
  }

  hitTest(worldX, worldY) {
    // Reverse iterate so top z-index objects are tested first
    const objects = Array.from(store.objects.values()).reverse();

    for (const obj of objects) {
      if (obj.pageId !== store.activePageId) continue;
      const d = obj.data;

      if (obj.type === 'sticky' || obj.type === 'rectangle') {
        if (worldX >= d.x && worldX <= d.x + d.width && worldY >= d.y && worldY <= d.y + d.height) {
          return obj;
        }
      } else if (obj.type === 'circle') {
        const radius = Math.max(d.width || 40, d.height || 40) / 2;
        const centerX = d.x + (d.width || 40) / 2;
        const centerY = d.y + (d.height || 40) / 2;
        const dist = Math.hypot(worldX - centerX, worldY - centerY);
        if (dist <= radius) return obj;
      } else if (obj.type === 'text') {
        if (worldX >= d.x && worldX <= d.x + 200 && worldY >= d.y - 20 && worldY <= d.y + 40) {
          return obj;
        }
      }
    }
    return null;
  }

  // 60fps Rendering Loop
  renderLoop() {
    this.render();
    requestAnimationFrame(() => this.renderLoop());
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    // Apply viewport transform (Pan & Zoom)
    ctx.translate(this.viewport.x, this.viewport.y);
    ctx.scale(this.viewport.zoom, this.viewport.zoom);

    // 1. Draw Infinite Dot Grid
    this.drawGrid(ctx);

    // 2. Render Board Committed Objects
    for (const obj of store.objects.values()) {
      if (obj.pageId === store.activePageId) {
        this.renderObject(ctx, obj);
      }
    }

    // 3. Render Active Stroke (In progress by local user)
    if (this.activeStrokePoints.length > 1) {
      this.renderStroke(
        ctx,
        this.activeStrokePoints,
        store.toolProps.strokeColor,
        store.activeTool === 'highlighter' ? 18 : store.toolProps.strokeWidth,
        store.activeTool === 'highlighter' ? 0.35 : 1.0
      );
    }

    // 4. Render Remote In-Flight Strokes
    for (const remote of store.remoteTransientStrokes.values()) {
      if (remote.points && remote.points.length > 1) {
        this.renderStroke(ctx, remote.points, remote.color, remote.width, 1.0);
      }
    }

    // 5. Render Shape Preview when dragging
    if (this.isPointerDown && ['rectangle', 'circle', 'line', 'arrow'].includes(store.activeTool)) {
      this.renderShapePreview(ctx, store.activeTool, this.startPoint, this.currentPoint);
    }

    // 6. Render Selection Highlight Box
    for (const selId of store.selectedObjectIds) {
      const selObj = store.objects.get(selId);
      if (selObj) this.renderSelectionBox(ctx, selObj);
    }

    // 7. Render Remote Live Cursors
    for (const [userId, cursor] of store.remoteCursors.entries()) {
      if (userId !== store.user?.userId) {
        this.renderRemoteCursor(ctx, cursor);
      }
    }

    ctx.restore();
  }

  drawGrid(ctx) {
    const zoom = this.viewport.zoom;
    const gridSize = 40;
    const startX = -this.viewport.x / zoom;
    const startY = -this.viewport.y / zoom;
    const endX = startX + this.width / zoom;
    const endY = startY + this.height / zoom;

    const firstX = Math.floor(startX / gridSize) * gridSize;
    const firstY = Math.floor(startY / gridSize) * gridSize;

    ctx.fillStyle = document.documentElement.getAttribute('data-theme') === 'light'
      ? 'rgba(0, 0, 0, 0.12)'
      : 'rgba(255, 255, 255, 0.12)';

    for (let x = firstX; x <= endX; x += gridSize) {
      for (let y = firstY; y <= endY; y += gridSize) {
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  }

  renderObject(ctx, obj) {
    const d = obj.data;
    ctx.save();

    if (obj.type === 'path') {
      this.renderStroke(ctx, d.points, d.strokeColor, d.strokeWidth, d.opacity || 1.0);
    } else if (obj.type === 'rectangle') {
      ctx.lineWidth = d.strokeWidth || 2;
      ctx.strokeStyle = d.strokeColor || '#6366f1';
      if (d.fillColor && d.fillColor !== 'transparent') {
        ctx.fillStyle = d.fillColor;
        ctx.fillRect(d.x, d.y, d.width, d.height);
      }
      ctx.strokeRect(d.x, d.y, d.width, d.height);
    } else if (obj.type === 'circle') {
      ctx.lineWidth = d.strokeWidth || 2;
      ctx.strokeStyle = d.strokeColor || '#6366f1';
      ctx.beginPath();
      const rx = (d.width || 40) / 2;
      const ry = (d.height || 40) / 2;
      ctx.ellipse(d.x + rx, d.y + ry, rx, ry, 0, 0, Math.PI * 2);
      if (d.fillColor && d.fillColor !== 'transparent') {
        ctx.fillStyle = d.fillColor;
        ctx.fill();
      }
      ctx.stroke();
    } else if (obj.type === 'line' || obj.type === 'arrow') {
      ctx.lineWidth = d.strokeWidth || 2;
      ctx.strokeStyle = d.strokeColor || '#6366f1';
      ctx.beginPath();
      ctx.moveTo(d.startX, d.startY);
      ctx.lineTo(d.endX, d.endY);
      ctx.stroke();

      if (obj.type === 'arrow') {
        this.drawArrowHead(ctx, d.startX, d.startY, d.endX, d.endY, d.strokeColor);
      }
    } else if (obj.type === 'sticky') {
      // Sticky Note Card with soft shadow & crisp typography
      ctx.fillStyle = d.color || '#fef08a';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.beginPath();
      ctx.roundRect(d.x, d.y, d.width, d.height, 10);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Text inside note
      ctx.fillStyle = '#0f172a';
      ctx.font = `${d.fontSize || 16}px 'Plus Jakarta Sans', sans-serif`;
      const lines = (d.text || '').split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, d.x + 16, d.y + 32 + (i * 22));
      });
    } else if (obj.type === 'text') {
      ctx.fillStyle = d.color || '#ffffff';
      ctx.font = `${d.fontSize || 20}px 'Plus Jakarta Sans', sans-serif`;
      const lines = (d.text || '').split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, d.x, d.y + (i * 24));
      });
    }

    ctx.restore();
  }

  renderStroke(ctx, points, color, width, opacity = 1.0) {
    if (!points || points.length === 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = opacity;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  renderShapePreview(ctx, shape, start, end) {
    ctx.save();
    ctx.strokeStyle = store.toolProps.strokeColor;
    ctx.lineWidth = store.toolProps.strokeWidth;
    ctx.setLineDash([6, 6]);

    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    if (shape === 'rectangle') {
      ctx.strokeRect(x, y, width, height);
    } else if (shape === 'circle') {
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape === 'line' || shape === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderSelectionBox(ctx, obj) {
    const d = obj.data;
    ctx.save();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    const pad = 6;
    const x = (d.x || 0) - pad;
    const y = (d.y || 0) - pad;
    const w = (d.width || 100) + pad * 2;
    const h = (d.height || 60) + pad * 2;

    ctx.strokeRect(x, y, w, h);

    // Corner resize handles
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#6366f1';
    ctx.setLineDash([]);
    const handleSize = 7;
    const handles = [
      { x, y }, { x: x + w, y },
      { x, y: y + h }, { x: x + w, y: y + h }
    ];
    handles.forEach(p => {
      ctx.fillRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
    });

    ctx.restore();
  }

  renderRemoteCursor(ctx, cursor) {
    ctx.save();
    const x = cursor.x;
    const y = cursor.y;

    // Cursor Arrow
    ctx.fillStyle = cursor.color || '#ec4899';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 12, y + 10);
    ctx.lineTo(x + 5, y + 12);
    ctx.closePath();
    ctx.fill();

    // Name Tag
    ctx.fillStyle = cursor.color || '#ec4899';
    ctx.font = '11px Plus Jakarta Sans, sans-serif';
    ctx.textBaseline = 'top';
    const tagWidth = ctx.measureText(cursor.displayName || 'Peer').width + 10;
    ctx.fillRect(x + 14, y + 4, tagWidth, 18);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(cursor.displayName || 'Peer', x + 19, y + 7);
    ctx.restore();
  }

  drawArrowHead(ctx, fromX, fromY, toX, toY, color) {
    const headlen = 14;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }
}
