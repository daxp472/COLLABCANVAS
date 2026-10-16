# CollabCanvas Database Schema & Persistence Strategy

CollabCanvas uses MongoDB via the official native driver (`mongodb` v6+) for low-overhead, fine-grained document manipulation. Mongoose is intentionally avoided to eliminate ODM overhead and schema mutation latency.

---

## 1. MongoDB Collections and Indexes

### 1.1 `users`
Stores user profile, authentication credentials, and preferences.
```javascript
{
  _id: ObjectId,
  email: String,          // Unique, lowercase
  displayName: String,
  passwordHash: String,   // bcrypt hash (salt rounds: 12)
  avatarUrl: String,
  preferences: {
    theme: String,        // 'dark' | 'light' | 'system'
    defaultTool: String,  // 'pen' | 'select' | 'sticky'
    penColor: String,
    penWidth: Number
  },
  createdAt: Date,
  updatedAt: Date
}
// Indexes:
// - { email: 1 } (unique, sparse)
```

### 1.2 `rooms`
Rooms represent collaborative spaces.
```javascript
{
  _id: ObjectId,
  roomId: String,         // Human-friendly unique slug or nano-id (e.g. "canvas-7x89q")
  name: String,
  description: String,
  ownerId: ObjectId | String, // User ID
  visibility: String,     // 'public' | 'unlisted' | 'private'
  passwordHash: String,   // Optional hashed room passcode
  maxParticipants: Number,// Default 50
  settings: {
    allowGuests: Boolean,
    allowGuestDrawing: Boolean,
    allowGuestChat: Boolean,
    requireApprovalToJoin: Boolean,
    defaultRole: String   // 'student' | 'editor' | 'viewer'
  },
  status: String,         // 'active' | 'archived' | 'locked'
  createdAt: Date,
  updatedAt: Date
}
// Indexes:
// - { roomId: 1 } (unique)
// - { visibility: 1, status: 1 }
// - { ownerId: 1 }
```

### 1.3 `roomMembers`
Active and historical participant records per room.
```javascript
{
  _id: ObjectId,
  roomId: String,
  userId: String,         // ObjectId string or guestId
  displayName: String,
  avatarUrl: String,
  role: String,           // 'room_owner' | 'presenter' | 'moderator' | 'student' | 'guest'
  permissions: [String],  // Explicit permission overrides if any
  isMuted: Boolean,
  isBanned: Boolean,
  joinedAt: Date,
  lastSeenAt: Date
}
// Indexes:
// - { roomId: 1, userId: 1 } (unique)
```

### 1.4 `boards`
Top-level board container for a room.
```javascript
{
  _id: ObjectId,
  boardId: String,        // Unique ID
  roomId: String,
  name: String,
  currentVersion: Number, // Monotonic increment per committed operation
  latestSnapshotVersion: Number,
  latestSnapshotId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
// Indexes:
// - { boardId: 1 } (unique)
// - { roomId: 1 }
```

### 1.5 `pages`
Ordered pages inside a board.
```javascript
{
  _id: ObjectId,
  pageId: String,         // Stable page ID
  boardId: String,
  name: String,
  order: Number,
  background: {
    type: String,         // 'dots' | 'grid' | 'blank' | 'ruled'
    color: String
  },
  createdAt: Date,
  updatedAt: Date
}
// Indexes:
// - { boardId: 1, order: 1 }
// - { pageId: 1 } (unique)
```

### 1.6 `canvasObjects` (Delta Target Entity)
Every shape, stroke, sticky note, connector, and text item is stored as an independent document.
```javascript
{
  _id: ObjectId,
  objectId: String,       // Stable client/server object ID (UUID)
  boardId: String,
  pageId: String,
  type: String,           // 'path' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'text' | 'sticky' | 'image'
  data: Object,           // Specific geometry, points, style, text, strokeWidth, colors
  version: Number,        // Incremented on every object edit
  zIndex: Number,
  isLocked: Boolean,
  createdBy: String,
  updatedBy: String,
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date         // Soft deletion tombstone
}
// Indexes:
// - { boardId: 1, pageId: 1, deletedAt: 1 }
// - { objectId: 1 } (unique)
// - { boardId: 1, updatedAt: -1 }
```

### 1.7 `boardOperations` (Durable Append-Only Delta Log)
Every verified mutation is appended to this log for conflict auditing and gap recovery.
```javascript
{
  _id: ObjectId,
  operationId: String,    // Unique client-generated UUID for idempotency
  boardId: String,
  pageId: String,
  sequence: Number,       // Monotonic server sequence
  actorId: String,
  type: String,           // 'object:create' | 'object:update' | 'object:delete' | 'page:add' ...
  targetId: String,       // objectId
  baseVersion: Number,
  payload: Object,        // Diff payload
  createdAt: Date
}
// Indexes:
// - { boardId: 1, sequence: 1 } (unique)
// - { operationId: 1 } (unique)
```

### 1.8 `boardSnapshots` (Periodic Checkpoints)
Snapshots compiled every 50-100 operations or on explicit checkpoint requests.
```javascript
{
  _id: ObjectId,
  boardId: String,
  version: Number,        // Board currentVersion at snapshot time
  objects: [Object],      // Full state of all active canvasObjects
  pages: [Object],        // Full state of all pages
  checksum: String,
  createdAt: Date
}
// Indexes:
// - { boardId: 1, version: -1 }
```

### 1.9 `chatMessages`
Chat and context-linked messages.
```javascript
{
  _id: ObjectId,
  roomId: String,
  senderId: String,
  senderName: String,
  senderAvatar: String,
  content: String,
  contextReference: {
    pageId: String,
    objectId: String,
    canvasPosition: { x: Number, y: Number }
  },
  reactions: Object,      // { '👍': ['userId1'], '❤️': ['userId2'] }
  createdAt: Date
}
// Indexes:
// - { roomId: 1, createdAt: -1 }
```

### 1.10 `games` & `gameRounds`
Game state and round history.
```javascript
{
  _id: ObjectId,
  gameId: String,
  roomId: String,
  type: String,           // 'draw_and_guess' | 'quick_draw' | 'quiz_battle' ...
  hostId: String,
  status: String,         // 'waiting' | 'in_progress' | 'finished'
  currentRound: Number,
  totalRounds: Number,
  config: Object,
  scoreboard: Object,     // { [userId]: score }
  createdAt: Date,
  endedAt: Date
}
```

---

## 2. Targeted Atomic Update & Snapshot Logic

When an update operation occurs:
1. An atomic `$inc` on `boards.currentVersion` generates the new sequence.
2. An `updateOne` on `canvasObjects` where `{ objectId: targetId }` updates only the specified fields:
   ```javascript
   await db.collection('canvasObjects').updateOne(
     { objectId: targetId },
     {
       $set: {
         ...updateFields,
         version: nextVersion,
         updatedBy: actorId,
         updatedAt: new Date()
       }
     }
   );
   ```
3. Insert into `boardOperations`.
4. Trigger async snapshot if `sequence % 50 === 0`.
