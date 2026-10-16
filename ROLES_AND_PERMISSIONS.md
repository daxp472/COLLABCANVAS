# CollabCanvas Roles and Permission Matrix

This document defines the core roles, capability boundaries, authorization rules, and server-enforced permission mappings across the CollabCanvas platform.

---

## 1. Core Roles Overview

CollabCanvas supports 6 distinct roles:

| Role | Target Persona | Primary Responsibilities |
|---|---|---|
| **Guest** (`guest`) | Anonymous attendee with invite link | View, participate, draw (if allowed), chat, play games without saving persistent personal profile. |
| **Registered User** (`registered_user`) | Authenticated member | Create rooms, save persistent boards, access dashboard, customize profile & avatar, export permitted content. |
| **Room Owner** (`room_owner`) | Room creator or transferee | Full lifecycle governance: room access policy, passwords, role assignments, lock/archive room, transfer ownership. |
| **Presenter / Teacher** (`presenter`) | Instructor, speaker, facilitator | Controls lesson/presentation view, spotlight, follows-mode, toggles student drawing lock, runs polls/quizzes. |
| **Student / Participant** (`student`) | Learner, audience member | Follows presenter view, raises hand, asks questions in queue, annotates when unlocked, submits quiz answers. |
| **Moderator** (`moderator`) | Community/classroom assistant | Mutes chat, kicks disruptive participants, removes inappropriate whiteboard items, stops abusive games. |

---

## 2. Granular Permission Definitions

Permissions are defined as atomic strings with namespace domains:

### Room & Member Domain
- `room.view`: View room metadata and basic info.
- `room.join`: Enter the room and listen to real-time events.
- `room.manage`: Update room settings, change name/visibility/passwords, archive or delete room.
- `room.invite`: Generate and share room invitation links or invite codes.
- `member.view`: See list of active participants, avatars, and status.
- `member.promote`: Assign or change roles of participants (e.g. promote to presenter or moderator).
- `member.moderate`: Kick, ban, or mute participants.

### Board & Page Domain
- `board.view`: Read and render board pages and canvas objects.
- `board.edit`: Create, modify, move, resize, and delete unlocked canvas objects.
- `board.lock_objects`: Lock specific canvas objects so other users cannot move or edit them.
- `board.clear`: Clear all annotations or objects on a canvas page.
- `board.export`: Export canvas to PNG, SVG, PDF, or JSON backup.
- `page.manage`: Add, rename, duplicate, reorder, or delete canvas pages.

### Presenter & Classroom Domain
- `presenter.control`: Initiate presentation mode, broadcast viewport coordinates, change pages for all followers.
- `presenter.spotlight`: Cast a spotlight or laser pointer on specific canvas regions.
- `presenter.toggle_student_draw`: Lock or unlock canvas editing for student participants.
- `classroom.quiz_create`: Create and launch live quizzes, polls, and classroom challenges.
- `classroom.quiz_reveal`: Reveal correct answers and publish scoreboards.
- `classroom.hand_raise`: Raise virtual hand to request speaking/drawing permission.
- `classroom.question_submit`: Post a question to the instructor's question queue.
- `classroom.question_manage`: Mark questions as answered, dismissed, or highlighted.

### Game Domain
- `game.create`: Initiate a new game session in the room lobby.
- `game.manage`: Start rounds, pause timer, skip rounds, cancel game.
- `game.participate`: Join waiting room, submit guesses, cast votes, draw secret prompts.
- `game.view_secret`: Permission granted *only* to the designated round drawer to receive the secret word.

### Chat Domain
- `chat.view`: Read room chat messages.
- `chat.send`: Send text chat messages and emoji reactions.
- `chat.moderate`: Delete inappropriate messages, mute chat channel.

---

## 3. Explicit Role-Permission Mapping Matrix

| Permission | Guest | Registered User | Student | Presenter | Moderator | Room Owner |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `room.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `room.join` | ✅* | ✅ | ✅ | ✅ | ✅ | ✅ |
| `room.manage` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `room.invite` | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `member.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `member.promote` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `member.moderate`| ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `board.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `board.edit` | ✅* | ✅ | ✅* | ✅ | ✅ | ✅ |
| `board.lock_objects` | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `board.clear` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `board.export` | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `page.manage` | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `presenter.control` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `presenter.spotlight` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `presenter.toggle_student_draw` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `classroom.quiz_create` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `classroom.quiz_reveal` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `classroom.hand_raise` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `classroom.question_submit` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `classroom.question_manage` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `game.create` | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `game.manage` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `game.participate` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `chat.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `chat.send` | ✅* | ✅ | ✅* | ✅ | ✅ | ✅ |
| `chat.moderate` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

*\* Conditional permissions: Guest and Student permissions can be dynamically locked or unlocked by Room Owner or Presenter.*

---

## 4. Server-Side Enforcement Rules

1. **Dual Validation**:
   - Every Express HTTP endpoint calls `requirePermission(perm)`.
   - Every Socket.IO incoming message calls `socketRequirePermission(socket, roomId, perm)`.
2. **Dynamic Room Overrides**:
   - Room-level settings can override default permissions (e.g., `room.settings.allowGuestsToDraw = false`, `room.settings.chatMuted = true`, or `room.settings.studentEditingLocked = true`).
3. **Anti-Tampering**:
   - Identity, role, and permissions are determined from the verified session/JWT on the server.
   - Socket payloads cannot supply self-asserted roles or bypass checks.
