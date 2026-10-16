export class Viewport {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1.0;
    this.minZoom = 0.15;
    this.maxZoom = 4.0;
  }

  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.x) / this.zoom,
      y: (screenY - this.y) / this.zoom
    };
  }

  worldToScreen(worldX, worldY) {
    return {
      x: (worldX * this.zoom) + this.x,
      y: (worldY * this.zoom) + this.y
    };
  }

  pan(deltaX, deltaY) {
    this.x += deltaX;
    this.y += deltaY;
  }

  zoomAt(screenX, screenY, factor) {
    const newZoom = Math.min(Math.max(this.zoom * factor, this.minZoom), this.maxZoom);
    if (newZoom === this.zoom) return;

    // Zoom centering on cursor position
    this.x = screenX - (screenX - this.x) * (newZoom / this.zoom);
    this.y = screenY - (screenY - this.y) * (newZoom / this.zoom);
    this.zoom = newZoom;
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1.0;
  }
}
