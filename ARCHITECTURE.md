# CollabCanvas Architecture & System Design

## 1. System Overview

CollabCanvas is an enterprise-grade, real-time multiplayer collaborative drawing, teaching, and game platform built for speed, resilience, and rich interactive experiences.

### Key Architectural Pillars
1. **Delta Operation Log + Snapshot Persistence**:
   - The server maintains a strict, sequentially ordered operation log (`boardOperations`) per board.
   - Fine-grained object mutations: moving or editing an object updates only that specific document in `canvasObjects`, rather than serializing and rewriting the entire page or board.
   - Periodic snapshots (`boardSnapshots`) store complete checkpoint states every $N$ operations or time interval, enabling instant recovery without replaying thousands of operations.
   - Reconnecting or late-joining clients receive the latest snapshot plus only the delta operations since that snapshot's version.

2. **Server-Authoritative Real-time Sync**:
   - Built on Express.js and Socket.IO.
   - Operations are submitted by clients with a client sequence and base version.
   - The server verifies session identity, role permissions, object lock state, and concurrency tokens before assigning a monotonically increasing sequence number and broadcasting `board:operation:accepted`.
   - Ephemeral data (live cursor coordinates, transient dragging coordinates, hover highlights, typing indicators) is throttled and broadcast without database overhead.

3. **Role-Based Access Control (RBAC)**:
   - Built-in granular permissions matrix enforced strictly on both HTTP endpoints and WebSocket event dispatchers.
   - Roles: `guest`, `registered_user`, `room_owner`, `presenter`, `student`, `moderator`.

4. **Server-Authoritative Multiplayer Game Framework**:
   - Deterministic finite state machine: `WAITING` -> `STARTING` -> `IN_PROGRESS` -> `ROUND_RESULTS` -> `NEXT_ROUND` -> `FINISHED`.
   - Secret words, answer keys, and timers are managed strictly on the server and never leaked to guesser/student sockets.

5. **Modern, High-Performance Canvas Engine**:
   - HTML5 Canvas with smooth 60fps local rendering, logical coordinate projection (independent of DPR and viewport dimensions), bezier-curve stroke smoothing, multi-layer rendering (Grid / Objects / Transient Drawing / Cursors & Spotlights).
   - Undo/Redo via inverse operation generator without wiping remote concurrent changes.

---

## 2. Technology Stack

- **Runtime**: Node.js v24+
- **Backend**: Express.js, Socket.IO v4+, Native MongoDB Driver (`mongodb` v6+)
- **Database**: MongoDB (Server running on `mongodb://127.0.0.1:27017/collabcanvas`)
- **Frontend**: Vite + Modern Modular JavaScript (ES Modules) + Vanilla CSS Design System with CSS Custom Properties, Glassmorphism, Dark/Light theme, Google Fonts (`Plus Jakarta Sans` / `Outfit`).
- **Security**: `bcryptjs` for password hashing, `jsonwebtoken` / cryptographically signed session tokens, input sanitization, rate-limiting.
- **Testing**: Node test runner / Vitest for unit & integration tests.

---

## 3. High-Level System Architecture Diagram

```
+-----------------------------------------------------------------------+
|                            Client Browser                             |
|  +--------------------+  +------------------+  +-------------------+  |
|  | Modern HTML5 Canvas|  | State Store      |  | Socket.IO Client  |  |
|  | - Logical Layers   |  | - In-memory tree |  | - Ack & Retries   |  |
|  | - Tool Controllers |  | - Undo/Redo stack|  | - Live Cursors    |  |
|  +--------------------+  +------------------+  +-------------------+  |
+-----------------------------------^-----------------------------------+
                                    | HTTP / WSS
+-----------------------------------v-----------------------------------+
|                     CollabCanvas Server (Node.js)                     |
|  +--------------------+  +-------------------+  +-------------------+ |
|  | Express REST API   |  | Socket.IO Engine  |  | Game State Engine | |
|  | - Auth & Sessions  |  | - Room Channel Mgt|  | - Word generator  | |
|  | - Rooms & Boards   |  | - Event Dispatcher|  | - Timers & Scores | |
|  | - Search & Export  |  | - RBAC Guards     |  | - Anti-cheat      | |
|  +---------+----------+  +---------+---------+  +---------+---------+ |
|            |                       |                      |           |
|  +---------v-----------------------v----------------------v---------+ |
|  |                  Persistence & Snapshot Manager                  | |
|  | - Monotonic Version Sequencer                                    | |
|  | - Object Delta Writer (Direct canvasObjects partial updates)     | |
|  | - Operation Log Appender                                         | |
|  | - Periodic Snapshot Creator & Log Compaction                     | |
|  +---------------------------------+--------------------------------+ |
+------------------------------------|----------------------------------+
                                     | Native Driver
+------------------------------------v----------------------------------+
|                           MongoDB Database                            |
|  [users] [rooms] [roomMembers] [boards] [pages] [canvasObjects]       |
|  [boardOperations] [boardSnapshots] [chatMessages] [games]            |
+-----------------------------------------------------------------------+
```

---

## 4. Canvas Coordinate & Rendering Architecture

1. **Logical Coordinates**:
   - The world space is unbounded or fixed to board boundaries $(x, y) \in [-\infty, +\infty]$.
   - Screen coordinates are mapped via transformation matrix:
     $$\text{screenX} = (x - \text{viewport.x}) \times \text{viewport.zoom}$$
     $$\text{screenY} = (y - \text{viewport.y}) \times \text{viewport.zoom}$$
   - Pointer events convert `(clientX, clientY)` to world `(worldX, worldY)` before storing or emitting.

2. **Layering Pipeline**:
   - **Background Layer**: Dot grid / isometric grid / solid background / whiteboard template.
   - **Committed Object Layer**: Shapes, freehand paths, sticky notes, connectors, text, images.
   - **Transient Drawing Layer**: Active freehand stroke being drawn by local user or remote users.
   - **Interaction & Overlay Layer**: Selection bounding boxes, rotation handles, connector magnetic snaps, laser pointers, spotlight, remote presence cursors.

---

## 5. Incremental Persistence & Snapshot Cycle

1. **Client Action**: User creates, updates, or deletes an object.
2. **Optimistic Local Update**: Rendered immediately with temporary status.
3. **Socket Emission**: Emits `board:operation` with `{ operationId, boardId, pageId, type, targetId, baseVersion, payload }`.
4. **Server Validation**:
   - Validates socket user has `board.edit` permission.
   - Checks if target object is locked or conflicting.
   - Increments board sequence counter atomically.
   - Inserts into `boardOperations`.
   - Applies targeted update to `canvasObjects` (or soft delete).
5. **Server Ack & Broadcast**:
   - Acknowledges to the sender: `{ operationId, status: 'committed', sequence, objectVersion }`.
   - Broadcasts `board:operation:accepted` to room peers.
6. **Snapshot Interval**:
   - If operations count since last snapshot $\ge 50$ (configurable), the snapshot manager triggers a snapshot generation job: compiles all active non-deleted `canvasObjects` for the board/page and writes a `boardSnapshots` record, updating `boards.latestSnapshotId`.
