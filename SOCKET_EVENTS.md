# CollabCanvas Real-Time Socket.IO Contracts

CollabCanvas uses Socket.IO v4 for real-time collaboration channels. Each room corresponds to a Socket.IO room channel `room:<roomId>`.

---

## 1. Connection & Room Lifecycle

### `room:join` (Client -> Server)
Payload:
```json
{
  "roomId": "canvas-xyz",
  "token": "JWT_TOKEN_OR_GUEST_TOKEN",
  "pageId": "page-1"
}
```
Ack Callback:
```json
{
  "success": true,
  "room": { "roomId": "canvas-xyz", "name": "Sprint Design" },
  "member": { "userId": "u123", "role": "room_owner", "permissions": ["..."] },
  "board": { "boardId": "b1", "currentVersion": 42 },
  "activeMembers": [ ... ],
  "presenterState": { "isPresenterActive": false }
}
```

### `room:member:joined` (Server -> Broadcast)
Emitted to room members when a new participant enters.
```json
{
  "member": {
    "userId": "u456",
    "displayName": "Alex Rivera",
    "avatarUrl": "...",
    "role": "student"
  }
}
```

### `room:member:left` (Server -> Broadcast)
Emitted when a client disconnects or leaves.

---

## 2. Canvas Operations & Delta Sync

### `board:operation` (Client -> Server)
Dispatched when a user creates, updates, moves, or deletes a board object.
Payload:
```json
{
  "operationId": "op_9f81a7b",
  "boardId": "b1",
  "pageId": "p1",
  "type": "object:update",
  "targetId": "obj_stickynote_4",
  "baseVersion": 41,
  "payload": {
    "data.position": { "x": 450, "y": 280 }
  }
}
```
Ack Callback:
```json
{
  "status": "committed",
  "sequence": 42,
  "objectVersion": 5
}
```

### `board:operation:accepted` (Server -> Broadcast)
Emitted to all other participants in the room:
```json
{
  "operationId": "op_9f81a7b",
  "sequence": 42,
  "actorId": "u123",
  "pageId": "p1",
  "type": "object:update",
  "targetId": "obj_stickynote_4",
  "payload": {
    "data.position": { "x": 450, "y": 280 }
  }
}
```

### `board:transient:draw` (Client -> Server -> Broadcast)
High-frequency ephemeral points for live pencil strokes being drawn in real time. Not saved to database until pointer-up emits the committed `object:create`.

---

## 3. Presence & Cursors

### `cursor:update` (Client -> Server -> Broadcast with throttling)
```json
{
  "pageId": "p1",
  "x": 620.5,
  "y": 140.2
}
```

---

## 4. Presenter & Classroom Controls

### `presenter:viewport` (Presenter -> Server -> Broadcast to followers)
```json
{
  "pageId": "p1",
  "x": 200,
  "y": 150,
  "zoom": 1.25,
  "spotlight": { "active": true, "x": 400, "y": 300, "radius": 120 }
}
```

### `presenter:lock_draw` (Presenter -> Server -> Broadcast)
```json
{
  "locked": true
}
```

### `classroom:hand_raise` (Student -> Server -> Broadcast to presenter)
```json
{
  "userId": "u456",
  "displayName": "Alex",
  "raised": true
}
```

---

## 5. Game Mode Events

### `game:action` (Host -> Server)
Actions: `start`, `pause`, `skip_round`, `finish`.

### `game:state` (Server -> Broadcast)
```json
{
  "gameId": "g1",
  "type": "draw_and_guess",
  "state": "IN_PROGRESS",
  "currentRound": 1,
  "totalRounds": 3,
  "drawerId": "u123",
  "drawerName": "Maya",
  "category": "Animals",
  "wordLength": 6,
  "hintMask": "_ _ P H _ N",
  "remainingSeconds": 45,
  "scores": { "u123": 200, "u456": 150 }
}
```

### `game:drawer:word` (Server -> Drawer Socket ONLY)
```json
{
  "secretWord": "DOLPHIN",
  "category": "Animals"
}
```

### `game:submit` (Guesser -> Server)
```json
{
  "gameId": "g1",
  "guess": "dolphin"
}
```
Server checks guess. If correct, awards points and emits `game:guess:correct` without revealing the word in public chat.
