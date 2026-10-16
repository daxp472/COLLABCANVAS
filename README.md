# CollabCanvas 🎨🚀

CollabCanvas is an enterprise-grade, real-time multiplayer whiteboard, classroom presentation, and competitive party gaming platform.

## Features
- **Real-Time Multiplayer Canvas**: Low-latency freehand drawing, shapes, connectors, rich text, and sticky notes with live peer cursors and presence.
- **Delta Operation Log & Partial Persistence**: Moving or modifying one object updates only that specific document in MongoDB without serializing the full board.
- **Snapshot Recovery**: Fast crash recovery and late-joining reconciliation using periodic state checkpoints and sequence delta replay.
- **Presenter & Teaching Mode**: Viewport broadcasting, follow-mode, laser pointer/spotlight, classroom question queue, and teacher-controlled student drawing locks.
- **Server-Authoritative Room Games**: Integrated Draw & Guess (Pictionary), Quick Draw, Quiz Battles, Word Association, and Brainstorming Battles with anti-cheat secret isolation.
- **Enterprise RBAC**: Clear role boundaries (Guest, Registered User, Student, Presenter, Moderator, Room Owner) with server-side validation on every HTTP route and Socket event.
- **Modern Responsive Design**: Glassmorphic UI, dark/light themes, touch-enabled gestures, and accessible keyboard shortcuts.

---

## Architecture & Documentation Links
- [System Architecture](file:///d:/1work/YT/COLLABCANVAS/ARCHITECTURE.md)
- [Roles & Permission Matrix](file:///d:/1work/YT/COLLABCANVAS/ROLES_AND_PERMISSIONS.md)
- [Room Games Specification](file:///d:/1work/YT/COLLABCANVAS/ROOM_GAMES_SPEC.md)
- [Database Schema & Strategy](file:///d:/1work/YT/COLLABCANVAS/DATABASE.md)
- [REST API Contracts](file:///d:/1work/YT/COLLABCANVAS/API.md)
- [Socket.IO Event Contracts](file:///d:/1work/YT/COLLABCANVAS/SOCKET_EVENTS.md)
- [Security Guidelines](file:///d:/1work/YT/COLLABCANVAS/SECURITY.md)
- [Implementation Plan](file:///d:/1work/YT/COLLABCANVAS/IMPLEMENTATION_PLAN.md)
- [Testing Guide](file:///d:/1work/YT/COLLABCANVAS/TESTING.md)

---

## Quickstart

### Prerequisites
- Node.js v20+ (Tested on v24)
- MongoDB running locally on `mongodb://127.0.0.1:27017`

### Setup & Run
```bash
# Install dependencies
npm install

# Run backend & frontend concurrently in dev mode
npm run dev

# Run automated tests
npm test
```
