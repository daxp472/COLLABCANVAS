# CollabCanvas Security Architecture

## 1. Authentication Security
- **Passwords**: Hashed with `bcryptjs` using 12 salt rounds. No plaintext passwords stored.
- **Tokens**: JWT signed with secret HMAC-SHA256 (`JWT_SECRET`). Configured with sensible TTL (7 days) and strict claims verification.
- **Guest Access**: Ephemeral guest sessions receive signed tokens prefixed with `guest_` and strict permission boundaries.
- **Room Passwords**: If a room is protected by a password, it is hashed with bcrypt before storing in `rooms.passwordHash`.

## 2. Server-Enforced RBAC
- Permissions are evaluated on the server for every HTTP route and Socket.IO event handler.
- Client cannot supply its own roles or bypass permission guards.
- Sensitive game answers, quiz keys, and drawer secret words are withheld from non-authorized client payloads.

## 3. Input Validation & XSS Defense
- All incoming payloads are validated against strict structural constraints.
- Chat messages and user display names are escaped to prevent Cross-Site Scripting (XSS).
- Rich canvas text content is rendered via Canvas 2D text primitives or sanitized DOM nodes.

## 4. Rate Limiting & Throttling
- Socket cursor updates are throttled to 20-30Hz client-side to prevent socket buffer exhaustion.
- HTTP authentication endpoints are protected against brute force.
- Reaction and chat spam is rate-limited per user session.
