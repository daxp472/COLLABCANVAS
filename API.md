# CollabCanvas API Contracts

This document specifies the RESTful HTTP API contracts, schemas, authentication conventions, and error codes for CollabCanvas.

---

## 1. Authentication & Session Conventions

- Endpoints authenticate via standard `Authorization: Bearer <token>` or session cookie.
- Passwords are encrypted with `bcrypt` (12 salt rounds).
- Anonymous guests use `/api/auth/guest` which issues a scoped Guest JWT containing `{ userId: 'guest_<id>', isGuest: true, displayName }`.

### Error Format
All errors follow RFC 7807 JSON conventions:
```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to modify this room.",
    "details": null
  }
}
```

---

## 2. Endpoints Summary

### 2.1 Auth
- `POST /api/auth/register` — Body: `{ email, password, displayName }`
- `POST /api/auth/login` — Body: `{ email, password }`
- `POST /api/auth/guest` — Body: `{ displayName }`
- `GET /api/auth/me` — Returns authenticated user profile

### 2.2 Rooms
- `POST /api/rooms` — Body: `{ name, description, visibility, maxParticipants, settings, password }`
- `GET /api/rooms` — Query: `?visibility=public&search=...` (Explore page)
- `GET /api/rooms/:roomId` — Fetch room details (filtered by visibility/passcode)
- `PATCH /api/rooms/:roomId` — Update settings/name (requires `room.manage`)
- `POST /api/rooms/:roomId/join` — Body: `{ passcode }` -> validates access and returns room member ticket
- `GET /api/rooms/:roomId/members` — List current participants

### 2.3 Boards & Pages
- `GET /api/boards/:boardId` — Get board metadata and current version
- `GET /api/boards/:boardId/pages` — List pages in order
- `POST /api/boards/:boardId/pages` — Add page `{ name, background }`
- `PATCH /api/pages/:pageId` — Update page name, background, or order
- `DELETE /api/pages/:pageId` — Delete page
- `GET /api/boards/:boardId/snapshot` — Get latest snapshot + recent delta operations since version `?sinceVersion=N`
- `GET /api/boards/:boardId/operations` — Query operation log `?from=X&to=Y`
- `GET /api/boards/:boardId/export` — Query `?format=png|svg|json`

### 2.4 Search
- `GET /api/search` — Query `?q=term&scope=rooms|boards|all`
- `GET /api/boards/:boardId/search` — Query `?q=term` (searches text in sticky notes, labels, text objects)

### 2.5 Games
- `POST /api/rooms/:roomId/games` — Create game lobby `{ type, config }`
- `GET /api/games/:gameId` — Get game status, participants, scoreboard
- `GET /api/games/:gameId/results` — Final rankings and round records
