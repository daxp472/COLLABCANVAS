# CollabCanvas Testing & Verification Guide

This document outlines the testing strategy, test suites, and instructions for verifying CollabCanvas.

---

## 1. Testing Framework
- **Test Runner**: Node Test Runner (`node --test`) or Vitest for fast, native test execution without heavy external dependencies.
- **Integration Tests**: Supertest for Express API endpoints, Socket.IO Client for real-time collaboration tests.

---

## 2. Test Suites

### 2.1 Unit Tests (`/tests/unit`)
- `versioning.test.js`: Monotonic sequence incrementing, optimistic version checks, conflict detection.
- `permissions.test.js`: Resolution of roles to permission sets, dynamic room overrides (student lock, guest disable).
- `games.test.js`: Draw & Guess secret word isolation, scoring formula verification, quiz streak bonuses.
- `diff.test.js`: Object delta extraction and partial update generation.

### 2.2 Integration Tests (`/tests/integration`)
- `auth.test.js`: Registration, login, password hashing, guest token issuance, invalid credentials.
- `rooms.test.js`: Room creation, invite link resolution, password verification, permissions check.
- `canvas_persistence.test.js`: Object creation, targeted partial updates, soft deletion, snapshot creation, delta replay after reconnection.
- `socket_collaboration.test.js`: Multi-client socket connection, real-time stroke broadcast, live cursor dispatch.

---

## 3. Running Tests
```bash
npm test
```
