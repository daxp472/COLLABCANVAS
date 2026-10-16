# COLLABCANVAS
## Product Requirements Document (PRD), System Architecture & IDE Implementation Specification

**Document version:** 1.0  
**Product type:** Real-time multiplayer collaborative drawing and communication platform  
**Status:** Implementation specification  
**Primary objective:** Build a functional, reliable, real-time collaboration platform with drawing, chat, rooms, presenter controls, classroom tools, search, and purposeful multiplayer games.

---

# 1. Product Vision

CollabCanvas is a shared interactive workspace where people can draw, write, teach, brainstorm, present, compete, and play together in real time.

The platform must not feel like a static drawing website with a chat panel attached. Every feature must serve a meaningful user goal and connect to the overall experience.

The platform will support four primary experiences:

1. **Collaborate:** Users create and edit a shared canvas with live synchronization.
2. **Teach and present:** A presenter guides participants through content, lessons, diagrams, and activities.
3. **Create and organize:** Teams use shapes, notes, text, connectors, voting, and search to turn ideas into useful outcomes.
4. **Play and learn:** Participants join drawing games, guessing rounds, educational challenges, and party activities.

## 1.1 Product principles

- Real-time interactions should feel immediate.
- A single user's change must never overwrite another user's unrelated work.
- Only the affected data should be persisted when an object changes.
- The last saved board must be recoverable after a crash or disconnection.
- Permissions must be enforced on the server, not merely hidden in the frontend.
- Every button, tool, game, and room setting must have a defined purpose and functional behavior.
- Users should be able to use the main collaboration experience without an AI service.
- The interface must remain understandable for first-time users.

## 1.2 Success criteria

The implementation should demonstrate that:

- Multiple users can draw simultaneously without losing one another's work.
- New users joining a room receive the correct current state.
- Editing one object does not require replacing the entire board document.
- Reconnecting users recover the latest committed board state.
- Teachers can conduct a lesson and manage student participation.
- Game rounds have clear rules, valid scoring, timers, and end conditions.
- Board search, export, permissions, and persistence work end to end.
- The application can be deployed and tested using documented instructions.

---

# 2. User Types and Audiences

## 2.1 Guest

A guest is a user who enters through an invitation link or permitted public room.

Capabilities:
- Enter a guest display name.
- Join a room if its access policy allows guests.
- View the board if viewing permissions permit.
- Draw, chat, or participate in games according to assigned permissions.
- See other participants and their live cursors.
- Leave the room at any time.

Restrictions:
- Guests cannot access account-only features.
- Guests cannot bypass room passwords, capacity limits, or bans.
- Guest identity must not be treated as proof of a verified real-world identity.

## 2.2 Registered user

Capabilities:
- Create and manage rooms.
- Save boards and return to previous work.
- Join rooms using invitation links.
- View recent rooms and accessible shared boards.
- Customize profile, avatar, display name, and preferences.
- Access their own board history and permitted shared content.
- Export boards when allowed by the room owner.

## 2.3 Room owner

The room owner controls the room's configuration and lifecycle.

Capabilities:
- Create, rename, archive, lock, and close rooms.
- Configure room visibility and access.
- Assign roles and permissions.
- Promote or demote moderators.
- Remove participants and ban users where supported.
- Start or stop sessions and game modes.
- Manage room templates, persistence, and export permissions.
- Transfer ownership through an explicit confirmation flow.

Ownership must be verified server-side for every privileged action.

## 2.4 Presenter or teacher

Capabilities:
- Start a presentation or teaching session.
- Control the presentation viewport.
- Enable follow-presenter mode.
- Navigate between board pages.
- Spotlight a selected object or region.
- Give students drawing permissions.
- Run polls, quizzes, and educational games.
- Monitor participation and review submitted work.
- Pause collaborative editing when needed.
- Save a lesson and its results.

A presenter is not automatically the owner. The room owner must explicitly grant the relevant presenter permissions.

## 2.5 Student or participant

Capabilities:
- Follow the presenter's viewport.
- View permitted pages and objects.
- Draw or annotate when permitted.
- Submit answers, votes, and quiz responses.
- Participate in breakout activities and team games.
- Ask questions through chat or a question queue.
- View feedback and results that the presenter chooses to share.

Students must not be able to change locked lesson content or reveal hidden quiz answers through client-side inspection.

## 2.6 Moderator

Capabilities:
- Remove disruptive participants when authorized.
- Moderate chat.
- Mute chat temporarily.
- Stop inappropriate game sessions.
- Manage participant access within the scope granted by the owner.

Moderators must not automatically receive access to private boards, hidden answers, or ownership-only settings.

---

# 3. Information Architecture and Application Navigation

The application should have a coherent navigation structure.

## 3.1 Main navigation

Provide the following areas:

1. **Home:** Recent boards, recent rooms, and quick actions.
2. **Create Room:** Start a room using a template or blank canvas.
3. **Join Room:** Enter an invite link, room code, or public room.
4. **Explore:** Discover public rooms and available activities.
5. **My Boards:** Saved boards and accessible shared workspaces.
6. **Templates:** Classroom, brainstorming, diagramming, and game templates.
7. **Profile:** Account settings, avatar, accessibility, and preferences.
8. **Help:** Tutorials, keyboard shortcuts, and troubleshooting.

The Explore area must show only public or explicitly discoverable rooms. Private room names and content must not leak into public search results.

## 3.2 Home page

The home page should include:
- Create a room.
- Join a room.
- Resume recent board.
- Recently joined rooms.
- Recent board activity, when authorized.
- Suggested templates.
- Recently played games.
- Basic connection status.
- Empty states for first-time users.

Every card and button must lead to a working destination.

---

# 4. Room Creation and Joining

## 4.1 Create room workflow

1. User selects Create Room.
2. User selects a room template or blank room.
3. User enters a room name.
4. User selects the intended purpose: collaboration, classroom, presentation, or games.
5. User configures access and participation settings.
6. Server validates the request.
7. Server creates the room and its initial board/page.
8. The owner joins as an authenticated room participant.
9. The application loads the room state and opens the canvas.
10. The owner can invite others.

## 4.2 Room configuration

Each room must support:

- Name and optional description.
- Unique room identifier.
- Public, unlisted, or private visibility.
- Invitation link or code.
- Optional room password, stored as a secure hash.
- Maximum participant count.
- Allowed guest access.
- Allowed drawing and chat permissions.
- Presenter assignment.
- Default template and initial pages.
- Room status.
- Created and updated timestamps.
- Optional expiration or archive policy.

The system must distinguish between public discoverability and authorization to enter. A public listing does not mean every action is permitted.

## 4.3 Join room workflow

When a user attempts to join:

1. Validate the room identifier.
2. Confirm that the room exists and is joinable.
3. Check its status, access policy, invite token, and password if applicable.
4. Verify capacity and ban status.
5. Assign the user's role and effective permissions.
6. Register the participant's active session.
7. Join the room's authorized real-time channel.
8. Send the latest snapshot reference and committed change version.
9. Load missing changes and initialize the board.
10. Publish a participant-joined event to authorized room members.

If validation fails, show a meaningful error, such as:
- Room not found.
- Invalid invitation.
- Password incorrect.
- Room is full.
- Room is locked.
- Room has ended.
- Access denied.

Do not connect an unauthorized user to the board's real-time channel before access checks pass.

## 4.4 Participant lifecycle

Support these states:

- Joining.
- Connected.
- Temporarily disconnected.
- Reconnecting.
- Left.
- Removed.
- Banned.

A temporary network interruption should not immediately be treated as an intentional departure.

Use a heartbeat or connection-liveness mechanism to detect stale participants. Rejoining should restore the participant's valid role, permissions, and board state, subject to current authorization.

---

# 5. Board, Pages, and Canvas Model

## 5.1 Board structure

A room may contain one or more boards. A board contains ordered pages, and each page contains independently identifiable objects.

The recommended hierarchy is:

Room → Board → Page → Object

A board may contain:
- Freehand strokes.
- Text.
- Shapes.
- Connectors and arrows.
- Sticky notes.
- Images.
- Imported diagrams.
- Grouped objects.
- Optional background elements.

## 5.2 Pages

Users must be able to:
- Create a page.
- Rename a page.
- Duplicate a page.
- Delete a page after confirmation.
- Reorder pages.
- Navigate between pages.
- Set a page background.
- Copy selected objects between pages.
- Apply page-specific access rules if supported.

Each page needs a stable ID. Do not use the current page index as its database identity.

Deleting a page must invalidate or archive its contained objects according to the chosen retention policy. It must not leave visible orphaned objects.

## 5.3 Canvas navigation

Support:
- Pan.
- Zoom in and out.
- Fit to content.
- Reset viewport.
- Minimap for large boards.
- Optional viewport coordinates.
- Presenter-controlled viewport.
- Follow-presenter toggle.

A user's personal zoom level should remain independent unless they explicitly follow the presenter or join a mode that synchronizes the viewport.

## 5.4 Coordinate system

Use a consistent logical canvas coordinate system.

Store object positions and dimensions independently of the browser's screen dimensions. The rendering layer converts logical coordinates to screen coordinates.

The canvas should handle different display sizes, browser zoom levels, and device pixel ratios without corrupting object positions.

---

# 6. Drawing and Editing Tools

Every tool must be functional and expose the relevant controls.

## 6.1 Freehand pen

Controls:
- Stroke color.
- Stroke width.
- Opacity.
- Optional pressure sensitivity.
- Optional smoothing.
- Optional highlighter mode.

The client should collect pointer samples and render locally for immediate feedback. It should transmit drawing data in bounded batches rather than sending an unthrottled event for every pointer movement.

## 6.2 Eraser

Support:
- Stroke erasing.
- Object erasing.
- Configurable eraser size.

For a collaborative board, erasing should produce an explicit deletion or edit operation. Do not permanently remove unrelated objects merely because their pixels overlap.

## 6.3 Selection and transformation

Users can:
- Select one or multiple objects.
- Move selected objects.
- Resize and rotate supported objects.
- Duplicate objects.
- Delete objects.
- Group and ungroup objects.
- Bring objects forward or send them backward.
- Lock or unlock objects if authorized.

Multi-selection must preserve the identities of the selected objects and apply transformations consistently.

## 6.4 Shape tools

Provide:
- Rectangle.
- Rounded rectangle.
- Circle and ellipse.
- Line.
- Arrow.
- Triangle.
- Polygon, if implemented.
- Freeform shape, if implemented.

Shape properties:
- Stroke color.
- Fill color.
- Stroke width.
- Opacity.
- Border style where supported.

## 6.5 Text and typography

Users must be able to create and edit text objects.

Required properties:
- Text content.
- Font family.
- Font size.
- Font weight.
- Italic.
- Underline.
- Text alignment.
- Text color.
- Optional background color.
- Line height.
- Letter spacing where supported.
- Text box dimensions.
- Vertical alignment where supported.

Provide a practical default font stack with widely available sans-serif fallbacks. If external fonts are loaded, handle loading failures and avoid shifting saved object dimensions unexpectedly.

The interface should include:
- Inline text editing.
- A contextual formatting toolbar.
- A readable font-size menu.
- Text resizing.
- Multiline support.
- Keyboard shortcuts.
- Accessible controls.

Changing a text style must update the affected text object, not replace the entire page.

## 6.6 Sticky notes

Support:
- Creating notes.
- Editing note text.
- Choosing note colors.
- Moving and resizing notes.
- Grouping notes.
- Voting on notes.
- Sorting or organizing selected notes.
- Converting notes into tasks when the feature is enabled.

Sticky notes are particularly useful in brainstorming and classroom activities.

## 6.7 Connectors and diagrams

Support lines and arrows that can connect to objects.

Where attachment points are supported, connectors must remain attached when their target objects move. Moving an object must update its dependent connectors as part of a coherent transaction or related set of operations.

## 6.8 Images and assets

Support:
- Uploading images.
- Inserting images into a page.
- Resizing and positioning images.
- Replacing or deleting images.
- Optional cropping.
- Upload progress and error feedback.

Store image binaries in object storage or an appropriate file service, not inside a repeatedly rewritten board JSON document. Persist only the asset reference and associated metadata in the board object.

Validate file type, file size, authorization, and upload access.

---

# 7. Core Architecture: Snapshot, Diff, and Partial Persistence

This is a mandatory architecture requirement.

## 7.1 Problem to solve

The application must not rewrite the entire board or page every time a user changes one object.

For example, if a board contains 1,000 objects and a participant moves one sticky note, the system should persist the sticky note's updated position, not serialize and replace all 1,000 objects.

The architecture must support:
- Local responsive rendering.
- Real-time event distribution.
- Object-level changes.
- Ordered synchronization.
- Snapshot-based recovery.
- Efficient database writes.
- Conflict handling.
- Reconnection.
- Version history.

## 7.2 Important distinction: visual diff versus data diff

Do not use a screenshot or pixel comparison as the primary source of truth for collaborative editing.

A visual diff cannot reliably identify whether a particular change was a text edit, a moved object, a deletion, or an overlap between objects.

Instead, maintain a structured application state and compare stable object IDs and object versions.

Use this process:

1. Load the last valid committed snapshot and its version.
2. Apply newer committed operations if necessary.
3. Keep the current client state as a structured representation.
4. Track user operations as they happen.
5. Compare affected objects with their previous state when preparing a persistence batch.
6. Persist only the inserted, changed, and deleted records.
7. Commit a new version or operation sequence.
8. Acknowledge the commit and update the recovery checkpoint when appropriate.

The snapshot is a recovery baseline, not a replacement for a structured change history.

## 7.3 Recommended synchronization model

Use three related mechanisms:

**A. Local state**

The current in-memory state used for rendering and interaction.

**B. Operation log**

A sequence of validated, versioned changes such as object creation, object updates, and object deletion.

**C. Snapshots**

Periodic checkpoints representing a complete committed board or page state at a particular version.

The operation log supports recovery between snapshots. Snapshots prevent recovery from requiring an indefinitely long replay.

## 7.4 Change lifecycle

When a user moves an object:

1. The client captures the previous position.
2. The client renders the new position immediately.
3. The client emits a movement operation or a temporary movement update.
4. The server verifies room membership and edit permission.
5. The server validates the operation and its target object.
6. The server orders or versions the accepted operation.
7. The server broadcasts the accepted update to other authorized participants.
8. The database persistence layer records the change.
9. The server acknowledges the committed version.
10. The client clears the corresponding pending state.

For a long drag, use transient position updates while dragging and commit the final position as a durable operation. If the implementation persists intermediate movement updates, batch them and avoid writing every pointer event.

A user should not have to wait for a database round trip before seeing their own drawing.

## 7.5 Snapshot recovery

When a client joins or reconnects:

1. Read the latest valid snapshot reference and version.
2. Load the snapshot.
3. Retrieve committed operations after that version.
4. Apply operations in the correct order.
5. Verify the resulting version.
6. Synchronize the client with the server's current version.
7. Resume live events.

If the operation log has been compacted, load a newer snapshot and replay only the remaining operations.

If a snapshot is invalid, incomplete, or corrupted, fall back to the most recent valid checkpoint and its available operation history. Report unrecoverable data problems rather than silently pretending the board is current.

## 7.6 Partial database updates

Use stable object IDs and targeted updates.

For example, moving a note should update only its relevant record:

- Object ID.
- Position.
- Version.
- Last-updated timestamp.
- Optional operation metadata.

Updating text should change the text property and version. Deleting an object should create a deletion record or tombstone as required by the recovery strategy.

Use transactions or atomic database operations where multiple related changes must succeed together.

## 7.7 Handling concurrent edits

Two users may modify the same object at nearly the same time.

Required safeguards:
- Every durable object update has a version or equivalent concurrency token.
- The server validates the base version when required.
- Stale updates cannot silently overwrite newer committed state.
- The system returns a conflict response or performs a defined merge.
- Unrelated objects must be independently editable.
- Dependent changes, such as moving a connected shape and its connectors, must remain consistent.

For the first version, use a server-authoritative operation sequence and explicit conflict handling. Do not claim that this is a fully conflict-free replicated data type unless an actual CRDT implementation is built and tested.

For text editing, choose a documented policy. A simple version can use optimistic concurrency and show a conflict/reload prompt. Advanced simultaneous text editing may later use OT or a text-specific CRDT.

## 7.8 Undo and redo

Undo must reverse the user's intended operation without rolling back unrelated users' newer changes.

Recommended design:
- Record reversible operations with the affected object IDs.
- Keep user and operation identity.
- Verify that the operation is still safe to reverse.
- Create a new inverse operation instead of deleting historical operations.
- Reject or explain an undo that would conflict with a later dependent edit.

The client must not implement shared undo by restoring an old complete-board snapshot.

## 7.9 Persistence reliability

The system must define when an operation is considered:
- Locally rendered.
- Sent to the server.
- Accepted by the server.
- Committed to durable storage.

Only durable operations may be treated as confirmed saved work.

If a database write fails, the system must not acknowledge the operation as durably committed. It should retry safely, report the saving status, and avoid duplicate effects through idempotency.

## 7.10 Snapshot frequency and compaction

Snapshots should be generated based on configurable thresholds such as:
- Number of committed operations since the last snapshot.
- Snapshot age.
- Operation-log size.
- Administrative checkpoint requests.

Choose thresholds using measurements rather than hardcoding an arbitrary universal interval.

Snapshot generation must not block normal collaboration for a long period. Use a consistent version boundary and retain the operations needed to recover concurrent changes that occur during snapshot creation.

---

# 8. Real-Time Collaboration

## 8.1 Live participant presence

Show:
- Display name.
- Avatar.
- Online status.
- Current role.
- Current activity where appropriate.
- Current page when allowed.
- Optional last-active indicator.

Presence data is ephemeral. It should not trigger a full board save.

## 8.2 Live cursors

Each participant should have a distinct cursor label or avatar.

Requirements:
- Broadcast cursor movement at a controlled rate.
- Avoid storing every cursor position in the durable board database.
- Clear stale cursor state when a participant disconnects.
- Render cursors independently from board objects.
- Do not treat cursor movement as an object-edit permission.
- Use logical canvas coordinates so cursor positions remain correct across different viewport sizes.

## 8.3 Collaborative editing

Users with edit permission can work on separate objects concurrently.

The platform must support:
- Multiple simultaneous drawing strokes.
- Multiple independent object edits.
- Remote object creation.
- Remote object movement.
- Remote deletion.
- Remote text and style changes.
- Clear feedback for rejected or conflicting operations.

## 8.4 Chat

Chat requirements:
- Text messages.
- Message timestamps.
- Sender identity.
- Message history.
- Replies or threads where supported.
- Emoji reactions.
- Unread indicators.
- Optional room announcements.
- Optional moderator controls.

Messages must be stored separately from canvas objects.

## 8.5 Context-aware chat

Where possible, allow a message to reference:
- A page ID.
- An object ID.
- A canvas position.
- An optional selected region.

Clicking a valid reference should navigate to the relevant page and focus the referenced object or region, subject to access permissions.

Deleted or inaccessible objects must not cause the chat interface to crash.

## 8.6 Reactions

Users may send reactions such as thumbs-up, clapping, celebration, and question marks.

Reactions should be temporary overlays or lightweight activity events unless the product explicitly saves them as board objects.

Rate-limit reaction events to prevent abuse.

## 8.7 Follow mode

A participant can follow the presenter or another permitted participant.

When follow mode is enabled:
- The participant's viewport follows the target's permitted viewport updates.
- The participant can see who they are following.
- The participant can stop following at any time unless the session explicitly requires locked presentation mode.
- Local viewport navigation can pause or disable following.
- Following a presenter does not grant additional editing or viewing permissions.

---

# 9. Presenter and Teaching Mode

## 9.1 Starting a teaching session

1. The teacher opens an authorized room.
2. The teacher selects Teaching Mode.
3. The system checks the teacher's permissions.
4. The teacher selects the lesson board and pages.
5. The teacher configures student access.
6. The teacher starts the session.
7. Participants receive the session status.
8. The teacher begins presenting, annotating, asking questions, or running activities.

## 9.2 Presenter controls

Provide:
- Start and end presentation.
- Next and previous page.
- Follow-presenter toggle.
- Spotlight or focus area.
- Annotation tools.
- Pause student editing.
- Enable student annotations.
- Allow selected students to present.
- Clear temporary annotations with confirmation.
- Launch polls or quizzes.
- Show or hide answers.
- Save session notes.

## 9.3 Teacher-student permissions

Teachers can choose among:
- View only.
- Annotation only.
- Full board editing.
- Selected-page editing.
- Team-based collaboration.
- Individual assignment mode.

The server must enforce these settings for every relevant operation.

## 9.4 Student participation

Students must be able to:
- Raise a hand or request to speak.
- Submit a question.
- Respond to a poll.
- Answer a quiz.
- Draw on a permitted page.
- Submit an assignment or solution.
- Receive feedback.
- See shared results.

## 9.5 Question queue

The question queue should:
- Accept questions from authorized participants.
- Display the sender and submission time.
- Allow teachers to mark a question as answered.
- Allow moderators to remove inappropriate submissions.
- Notify the sender when a response is posted, where appropriate.

## 9.6 Classroom activities

Support configurable activities such as:
- Label a diagram.
- Complete a flowchart.
- Solve a math problem.
- Sort sticky notes into categories.
- Collaboratively build a mind map.
- Vote on the best solution.
- Match terms and definitions.
- Draw an explanation of a concept.

The activity should define its instructions, available tools, expected output, time limit if any, and completion criteria.

---

# 10. Game Mode Framework

Games must be implemented as actual game systems with clear state transitions, not merely special-looking canvas templates.

Each game must define:
- Game ID and type.
- Host and participants.
- Game configuration.
- Waiting-room state.
- Start conditions.
- Round state.
- Timer.
- Scoring rules.
- Validation rules.
- End conditions.
- Results.
- Restart or return-to-room flow.

Use a server-authoritative state machine for competitive game outcomes.

Recommended states:

WAITING → STARTING → IN_PROGRESS → ROUND_RESULTS → NEXT_ROUND → FINISHED

A game can also enter CANCELLED or PAUSED where appropriate.

Clients must not be trusted to determine winners, timer completion, or final scores.

## 10.1 Draw & Guess

### Objective

One player draws a secret word while other players guess it through chat or a dedicated guessing interface.

### Workflow

1. Host starts the game.
2. Players join the waiting area.
3. Server validates the minimum participant requirement.
4. Server chooses or accepts a word set.
5. A drawer is selected.
6. The server privately sends the secret word to the drawer.
7. Other players receive the drawing prompt category or hint, if configured.
8. The timer starts.
9. The drawer draws using the allowed tools.
10. Guessers submit guesses.
11. The server validates guesses and awards points.
12. The round ends when the time expires or the configured completion condition is met.
13. Results are revealed.
14. The next drawer or round is selected.
15. The game ends after the configured rounds.

### Rules

- The secret word must never be included in public room events.
- Guess messages must be checked server-side.
- Correct answers should not be revealed to other players before the appropriate time.
- A player should not receive duplicate points for repeatedly submitting the same correct answer.
- The drawer should not receive guessing points for their own word.
- The scoring policy must be consistent and documented.

### Suggested scoring

Use configurable scoring based on correct guesses and time remaining. For example, a correct guess may earn a base score plus a small speed bonus.

The actual formula should be implemented in the server and covered by tests.

## 10.2 Pictionary teams

Divide participants into teams.

Features:
- Team assignment.
- Rotating drawers.
- Team-only guessing where configured.
- Round timer.
- Team scores.
- Match history.
- Optional tie-breaker round.

The server must prevent unauthorized players from viewing the secret word.

## 10.3 Quick Draw

A short-duration drawing challenge where participants draw the same prompt independently.

Workflow:
- Reveal the prompt.
- Start the timer.
- Allow drawing.
- Submit automatically when time expires.
- Display submissions.
- Vote on the best drawing.
- Reveal results.

Voting must prevent self-voting and duplicate votes. If voting is anonymous, the implementation must not reveal voters before the voting phase ends.

## 10.4 Collaborative Drawing Challenge

All players contribute to one shared drawing under a common goal.

Examples:
- Build a city together.
- Design a robot.
- Create a map.
- Illustrate a story.
- Complete a partially drawn object.

The host defines the objective and time limit. The team completes the challenge and reviews the result.

## 10.5 Educational Quiz Battle

Teachers or hosts create a sequence of questions.

Supported question types:
- Multiple choice.
- True or false.
- Short text answer.
- Match pairs.
- Label a diagram where implemented.

Rules:
- The server stores correct answers.
- The client does not receive hidden answers before reveal.
- Each participant's submission is associated with the correct question and round.
- Duplicate submissions are handled by an explicit policy.
- Scores are computed server-side.
- Results can be displayed individually or by team.

## 10.6 Word Association

Players contribute related words or ideas in turns.

The host configures:
- Turn duration.
- Whether repeated words are allowed.
- Individual or team play.
- Optional voting or scoring.

The goal is to encourage creative thinking rather than reward spam. Rate-limit submissions and use a clear turn state.

## 10.7 Brainstorming Battle

Teams receive a problem statement and a limited time to add sticky notes.

After submission:
1. The system closes or locks the brainstorming phase.
2. Teams organize their ideas.
3. Participants vote according to configured rules.
4. Results are calculated.
5. The host reviews the strongest ideas.

Do not allow a participant to cast more votes than the configured limit.

## 10.8 Game lobby and results

The lobby should display:
- Game title.
- Rules.
- Host.
- Participants.
- Ready status.
- Team assignment.
- Start button for authorized hosts.
- Leave-game action.

The results screen should display:
- Final ranking or team result.
- Round-by-round scores where applicable.
- Achievements if implemented.
- Play again.
- Return to room.

Game scores must remain separate from general room permissions. Winning a game must never grant administrator access.

---

# 11. Party Mode

Party Mode is a collection of casual activities for friends, classrooms, and team-building sessions.

## 11.1 Party room

Support:
- Quick room creation.
- Shareable invitation.
- Participant list.
- Game selection.
- Host controls.
- Ready checks.
- Optional spectator mode.
- Rematch flow.

## 11.2 Party activities

Include:
- Draw & Guess.
- Quick Draw.
- Collaborative Drawing Challenge.
- Word Association.
- Team Pictionary.
- Optional polls and icebreakers.

Each activity must have a defined start, participation, scoring or completion, and exit flow.

## 11.3 Host responsibilities

The host can:
- Select the activity.
- Configure duration and rounds.
- Start and stop games.
- Remove disruptive participants.
- Restart a completed game.
- Return everyone to the party lobby.

Host privileges should be server-enforced and must not bypass account or platform safety controls.

---

# 12. Search and Discovery

Search must help users find relevant rooms, boards, pages, objects, messages, and templates without exposing unauthorized content.

## 12.1 Global search

Provide a search interface with filters for:
- Room name.
- Board name.
- Template.
- Accessible shared boards.
- Own boards.
- Public rooms.
- Recent activity.

Results must be permission-filtered before they are returned to the client.

## 12.2 In-board search

Search within an accessible board for:
- Text objects.
- Sticky-note content.
- Page names.
- Object labels.
- Accessible chat messages, if chat search is enabled.

Selecting a result navigates to the relevant page and highlights the object.

## 12.3 Search implementation

Use database indexes appropriate to the chosen database and query patterns.

For MongoDB:
- Index room identifiers and visibility fields used for room discovery.
- Index board and page references.
- Index object type and searchable text where appropriate.
- Use a supported text-search strategy or a dedicated search service if advanced search becomes necessary.

Search must handle:
- Empty queries.
- No results.
- Partial text.
- Pagination.
- Unauthorized content.
- Deleted objects.
- Search failures.

Do not load every board into the browser merely to perform global search.

---

# 13. Database and Data Model

Use MongoDB with the native Node.js driver unless the implementation owner explicitly approves a different persistence layer. Mongoose is not required.

Use separate collections for entities with different update patterns and lifecycles.

## 13.1 Recommended collections

### users

Fields:
- `_id`
- `displayName`
- `email` where applicable
- `passwordHash` where password authentication is used
- `avatarUrl`
- `preferences`
- `createdAt`
- `updatedAt`
- `status`

Never store plaintext passwords.

### rooms

Fields:
- `_id`
- `name`
- `description`
- `ownerId`
- `visibility`
- `status`
- `settings`
- `maxParticipants`
- `createdAt`
- `updatedAt`
- `archivedAt` where applicable

### roomMembers

Fields:
- `_id`
- `roomId`
- `userId` or guest identity reference
- `role`
- `permissions`
- `joinedAt`
- `lastSeenAt`
- `status`

### boards

Fields:
- `_id`
- `roomId`
- `name`
- `currentVersion`
- `latestSnapshotId`
- `createdAt`
- `updatedAt`

### pages

Fields:
- `_id`
- `boardId`
- `name`
- `order`
- `background`
- `version`
- `createdAt`
- `updatedAt`

### canvasObjects

Fields:
- `_id`
- `boardId`
- `pageId`
- `type`
- `data`
- `version`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`
- `deletedAt` where soft deletion is used

The `data` field should contain the properties specific to the object type. Frequently updated objects should be stored as independently addressable documents.

### boardOperations

Fields:
- `_id`
- `boardId`
- `pageId`
- `operationId`
- `sequence`
- `actorId`
- `type`
- `targetIds`
- `baseVersion` where applicable
- `payload`
- `createdAt`
- `commitStatus` or equivalent durable status

Use unique constraints for idempotency and appropriate indexes for sequence retrieval.

### boardSnapshots

Fields:
- `_id`
- `boardId`
- `pageId` or board-wide scope
- `version`
- `schemaVersion`
- `stateReference` or serialized state
- `createdAt`
- `createdBy` or system identity
- `checksum` where useful

Large snapshots may be stored as versioned objects in external storage with metadata in MongoDB.

### chatMessages

Fields:
- `_id`
- `roomId`
- `senderId`
- `content`
- `replyToId` where applicable
- `contextReference` where applicable
- `createdAt`
- `editedAt` where applicable
- `moderationStatus`

### assets

Fields:
- `_id`
- `roomId`
- `uploadedBy`
- `storageKey`
- `mimeType`
- `size`
- `createdAt`
- `status`

### games

Fields:
- `_id`
- `roomId`
- `type`
- `hostId`
- `status`
- `config`
- `currentRound`
- `startedAt`
- `endedAt`

### gameParticipants

Fields:
- `_id`
- `gameId`
- `participantId`
- `teamId` where applicable
- `score`
- `status`
- `joinedAt`

### gameRounds

Fields:
- `_id`
- `gameId`
- `roundNumber`
- `state`
- `startedAt`
- `endedAt`
- `resultsReference` where applicable

### gameSubmissions

Fields:
- `_id`
- `gameId`
- `roundId`
- `participantId`
- `submissionType`
- `payload`
- `submittedAt`
- `validationStatus`

Secret words, answer keys, and hidden scoring data must be protected from unauthorized reads.

### activities or auditEvents

Record important events such as:
- Room created or closed.
- Role changed.
- Participant removed.
- Permission changed.
- Board exported.
- Game started or ended.

Do not store every cursor movement as an audit event.

## 13.2 Indexing and consistency

Add indexes based on real query patterns, including:
- Room membership lookups.
- Board and page retrieval.
- Object retrieval by page.
- Operation history by board and sequence.
- Snapshot lookup by board and version.
- Chat history by room and timestamp.
- Game participants by game.
- Idempotency keys.

Use unique indexes where needed to prevent duplicate operation IDs or duplicate submissions.

If an operation modifies several related records, define whether it requires a MongoDB transaction or an atomic single-document update. Do not assume that separate database writes succeed together automatically.

---

# 14. API and Real-Time Event Contracts

Use Express.js for HTTP endpoints and Socket.IO for real-time events.

HTTP is appropriate for resource retrieval, account management, uploads, and administrative actions. Socket.IO is appropriate for live collaboration events, presence, chat delivery, and game updates.

## 14.1 API conventions

Use:
- Consistent JSON responses.
- Authentication middleware.
- Authorization checks.
- Request validation.
- Rate limits.
- Clear HTTP status codes.
- Stable error codes.
- Pagination for list endpoints.
- Request IDs for debugging.
- Idempotency for retryable mutations.

## 14.2 Example HTTP endpoints

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Choose a secure session or token strategy and document it. If using JWTs, define expiration, refresh, revocation, and storage rules.

### Rooms

- `POST /api/rooms`
- `GET /api/rooms/:roomId`
- `PATCH /api/rooms/:roomId`
- `POST /api/rooms/:roomId/join`
- `POST /api/rooms/:roomId/leave`
- `POST /api/rooms/:roomId/invitations`
- `PATCH /api/rooms/:roomId/members/:memberId`
- `DELETE /api/rooms/:roomId/members/:memberId`

### Boards and pages

- `GET /api/boards/:boardId`
- `GET /api/boards/:boardId/pages`
- `POST /api/boards/:boardId/pages`
- `PATCH /api/pages/:pageId`
- `DELETE /api/pages/:pageId`
- `GET /api/boards/:boardId/snapshot`
- `GET /api/boards/:boardId/operations`
- `POST /api/boards/:boardId/snapshots`
- `GET /api/boards/:boardId/export`

### Search

- `GET /api/search?q=...`
- `GET /api/boards/:boardId/search?q=...`

### Games

- `POST /api/rooms/:roomId/games`
- `GET /api/games/:gameId`
- `POST /api/games/:gameId/join`
- `POST /api/games/:gameId/ready`
- `POST /api/games/:gameId/start`
- `POST /api/games/:gameId/leave`
- `GET /api/games/:gameId/results`

Validate every endpoint against the caller's identity, role, permissions, and resource ownership.

## 14.3 Operation payload format

Use a consistent operation envelope:

```json
{
  "operationId": "client-generated-unique-id",
  "boardId": "board-id",
  "pageId": "page-id",
  "type": "object.update",
  "targetId": "object-id",
  "baseVersion": 12,
  "clientSequence": 104,
  "payload": {
    "position": {
      "x": 320,
      "y": 180
    }
  }
}
```

This is an illustrative contract. Actual IDs, schemas, and validation must be implemented consistently.

The server must derive the authenticated actor identity from the connection or session. It must not trust a client-supplied `actorId` as proof of identity.

A successful commit can return:

```json
{
  "operationId": "client-generated-unique-id",
  "status": "committed",
  "sequence": 105,
  "objectVersion": 13
}
```

A conflict can return:

```json
{
  "operationId": "client-generated-unique-id",
  "status": "conflict",
  "code": "VERSION_CONFLICT",
  "currentVersion": 14,
  "message": "The object changed before this update was committed."
}
```

The client should handle the conflict without silently discarding unrelated local work.

## 14.4 Socket.IO events

Recommended client-to-server events:

- `room:join`
- `room:leave`
- `board:operation`
- `board:sync:request`
- `cursor:update`
- `chat:send`
- `chat:reaction`
- `presenter:follow`
- `presenter:control`
- `game:join`
- `game:ready`
- `game:action`
- `game:submit`

Recommended server-to-client events:

- `room:joined`
- `room:member:joined`
- `room:member:left`
- `room:member:updated`
- `board:operation:accepted`
- `board:operation:rejected`
- `board:sync:required`
- `board:version`
- `cursor:updated`
- `chat:message`
- `chat:reaction`
- `presenter:state`
- `game:state`
- `game:round:started`
- `game:round:ended`
- `game:results`

Every event must have a documented payload, validation rule, authorization rule, and error behavior.

Do not broadcast secret answers, private messages, or restricted board data to the entire room.

## 14.5 Synchronization rules

- Use a server-authoritative committed sequence or equivalent versioning strategy.
- Make durable mutations idempotent.
- Reject unauthorized operations.
- Validate payload size and object type.
- Use acknowledgements for durable operations.
- Handle duplicate, stale, and out-of-order events.
- Reconcile the client after reconnecting.
- Do not assume Socket.IO delivery guarantees database durability.
- Do not assume in-memory state survives server restarts.

---

# 15. Permissions and Security

## 15.1 Role and permission matrix

Define permissions explicitly rather than scattering role-name checks throughout the code.

Examples of permissions:
- `room.view`
- `room.manage`
- `room.invite`
- `member.moderate`
- `board.view`
- `board.edit`
- `board.export`
- `page.manage`
- `presenter.control`
- `game.manage`
- `game.participate`
- `chat.send`
- `chat.moderate`

Roles map to permission sets. Room-specific overrides should be explicit and validated.

## 15.2 Security requirements

- Hash passwords using an appropriate password-hashing algorithm.
- Enforce authorization on both HTTP and Socket.IO events.
- Validate all user-provided data.
- Protect against cross-site scripting in text and chat rendering.
- Configure CORS and origin validation.
- Rate-limit sensitive endpoints and high-volume events.
- Validate file uploads and storage access.
- Protect invite tokens and room secrets.
- Prevent users from joining unauthorized real-time channels.
- Use secure cookie settings when cookie-based authentication is selected.
- Avoid storing sensitive authentication tokens in insecure browser storage.
- Never trust client-side scores, role claims, permissions, or timers.
- Apply retention rules to chat, activity logs, and deleted content.

---

# 16. Accessibility, Responsiveness, and User Experience

## 16.1 Responsive layouts

Support desktop and tablet layouts, with a practical mobile experience.

Desktop:
- Canvas as the main workspace.
- Drawing toolbar.
- Participant list.
- Chat panel.
- Contextual properties panel.
- Page navigation.
- Room and session controls.

Tablet:
- Collapsible side panels.
- Touch-friendly tools.
- Canvas-first layout.

Mobile:
- Simplified toolbar.
- Collapsible chat and participant views.
- Touch gestures for drawing, panning, and zooming.
- Readable game and classroom controls.
- Appropriate warnings for tools that require a larger screen.

## 16.2 Accessibility

- Keyboard navigation.
- Visible focus indicators.
- Accessible labels for toolbar actions.
- Sufficient color contrast.
- Non-color-only indicators for game and participant status.
- Reduced-motion support.
- Screen-reader-friendly dialogs and controls.
- Text alternatives for important visual information where practical.

## 16.3 User feedback

The interface must distinguish:
- Connecting.
- Connected.
- Reconnecting.
- Offline.
- Saving.
- Saved.
- Save failed.
- Conflict detected.
- Exporting.
- Export complete.
- Permission denied.

Use clear messages rather than silent failures.

---

# 17. Board History, Replay, and Export

## 17.1 Version history

Allow authorized users to inspect available snapshots and committed changes.

Features:
- Checkpoint list.
- Timestamp and version information.
- Preview of a previous state.
- Restore with confirmation.
- Clear indication of the version being viewed.

Restoration should create a new committed state or explicit restore operation. It must not erase the historical record needed for auditing and recovery.

## 17.2 Replay

Where event history is available, reconstruct board changes in order.

Replay should support:
- Play and pause.
- Playback speed.
- Timeline navigation.
- Start and end points.
- Optional filtering by participant.
- Returning to the current board.

Cursor and transient presence events should be excluded by default to avoid enormous replay logs.

## 17.3 Export

Provide:
- PNG export.
- SVG export where supported.
- PDF export.
- Optional JSON backup for authorized users.

Export should respect page dimensions, backgrounds, image assets, and typography as far as supported by the renderer.

For large exports, use a background job or controlled rendering process rather than blocking the collaboration event loop.

---

# 18. Notifications and Activity

Notify users about relevant events such as:
- Invitation received.
- Participant joined.
- Presenter started a session.
- Game started.
- Quiz results are available.
- User was mentioned in chat.
- Shared board access changed.

Do not notify every participant for every pointer movement or routine drawing operation.

Room activity history should prioritize meaningful events rather than high-frequency technical noise.

---

# 19. Error Handling and Recovery

The system must handle:

- Server restart.
- Database timeout.
- Duplicate operation submission.
- Reconnection during drawing.
- Network interruption.
- Stale object version.
- Missing snapshot.
- Missing image asset.
- Unauthorized event.
- Invalid game state.
- Timer and round-transition race conditions.
- Export failure.

For recoverable network failures, retry using bounded backoff and idempotency keys.

For permanent errors, show a meaningful message and preserve unsaved local work where possible.

Do not retry an invalid or unauthorized operation indefinitely.

---

# 20. Performance and Scalability

The following are initial engineering targets to validate under load, not claims about achieved performance.

- Target a responsive local drawing experience.
- Target approximately 100 ms or less for typical healthy-network collaboration updates under a controlled test environment.
- Keep cursor events ephemeral and rate-limited.
- Batch high-frequency movement and drawing data.
- Avoid full-board serialization for individual object edits.
- Paginate large room, chat, and search results.
- Index frequent database access patterns.
- Bound snapshot and operation-log sizes.
- Avoid blocking real-time processing with image export or expensive computation.
- Monitor event rates, database latency, rejected operations, reconnect frequency, and snapshot duration.

Define the supported maximum room size and board complexity through load testing. Do not advertise an unlimited participant count without evidence.

If the deployment scales to multiple backend instances, use an appropriate Socket.IO adapter and shared coordination or durable state mechanism. A single-process in-memory room map is not sufficient for multi-instance coordination.

---

# 21. Analytics and Product Metrics

Collect operational metrics and privacy-conscious product analytics where appropriate.

Useful measurements:
- Room creation and join success rate.
- Average active participants per room.
- Reconnection recovery success.
- Operation commit latency.
- Conflict rate.
- Snapshot creation duration.
- Board export success.
- Game completion rate.
- Game abandonment rate.
- Teaching session duration.
- Search success rate.
- Feature usage.

Avoid collecting unnecessary sensitive message content or private board contents in analytics.

---

# 22. Testing Requirements

## 22.1 Unit tests

Cover:
- Object updates and version increments.
- Operation validation.
- Permission resolution.
- Snapshot reconstruction.
- Conflict handling.
- Undo/redo inverses.
- Game scoring.
- Guess validation.
- Timer transitions.
- Search permission filtering.

## 22.2 Integration tests

Cover:
- Creating and joining rooms.
- Loading snapshots and operation history.
- Persisting partial updates.
- Duplicate operation handling.
- Concurrent object edits.
- Reconnection.
- Unauthorized socket events.
- Chat persistence.
- Game round transitions.
- Export endpoints.

## 22.3 End-to-end tests

Scenario A: Collaboration

1. User A creates a room.
2. Users B and C join.
3. All three draw simultaneously.
4. One user moves a shape while another edits a separate text object.
5. All clients converge on the same committed state.
6. Refresh one client.
7. Confirm that its board matches the server's current version.

Scenario B: Incremental persistence

1. Create a board with many objects.
2. Move one object.
3. Inspect the database writes.
4. Confirm that unrelated object records are not rewritten.
5. Confirm that the operation is recoverable after restart.

Scenario C: Teaching

1. Teacher starts a session.
2. Students join.
3. Teacher enables follow mode.
4. Teacher moves to another page.
5. Students follow the presenter.
6. Teacher locks the board.
7. Students cannot submit unauthorized drawing operations.

Scenario D: Draw & Guess

1. Host starts a game.
2. Players join.
3. Drawer receives the secret word.
4. Other players cannot read the secret word from public events.
5. Players submit guesses.
6. Server validates answers and scoring.
7. The round ends correctly.
8. Results are consistent for all clients.

Scenario E: Recovery

1. Commit several operations.
2. Disconnect a participant.
3. Continue editing.
4. Reconnect the participant.
5. Load the appropriate snapshot and missing operations.
6. Confirm that no committed changes are missing or duplicated.

---

# 23. Acceptance Criteria

The product is not complete merely because the interface looks correct.

## Core collaboration
- [ ] Multiple participants can draw at the same time.
- [ ] Live cursors and participant presence work.
- [ ] Object creation, updates, and deletion synchronize.
- [ ] Chat works across clients.
- [ ] Permissions are enforced by the server.

## Incremental persistence
- [ ] Every board object has a stable ID.
- [ ] Individual edits update only the affected records.
- [ ] Operations have unique IDs and defined commit semantics.
- [ ] Snapshots can reconstruct a consistent board state.
- [ ] Missing operations can be replayed after reconnecting.
- [ ] Duplicate submissions do not create duplicate effects.
- [ ] Concurrent edits follow a documented conflict policy.

## Rooms and teaching
- [ ] Room creation and invitation flows work.
- [ ] Private rooms cannot be accessed without authorization.
- [ ] Presenter controls work.
- [ ] Student permissions can be configured.
- [ ] Follow mode works independently of edit permissions.

## Games
- [ ] Every implemented game has a complete lifecycle.
- [ ] Timers and scoring are server-authoritative.
- [ ] Hidden answers remain private.
- [ ] Invalid submissions are rejected.
- [ ] Results and rematches work.

## Usability and reliability
- [ ] The main navigation leads to functional pages.
- [ ] Loading, error, empty, and reconnecting states are present.
- [ ] Export works for supported formats.
- [ ] Core workflows are tested.
- [ ] Deployment and environment configuration are documented.

---

# 24. Implementation Plan

Build the application in dependency order rather than implementing disconnected features.

## Phase 1 — Foundation
- Project structure.
- Environment configuration.
- Database connection.
- Authentication.
- Core room and board schemas.
- Authorization middleware.
- Error handling and logging.

**Exit condition:** A user can sign in, create a room, and load a persisted board.

## Phase 2 — Canvas engine
- Canvas rendering.
- Freehand drawing.
- Eraser.
- Shapes.
- Text and typography.
- Selection and movement.
- Sticky notes.
- Page navigation.
- Undo/redo.

**Exit condition:** A user can create and edit a board without multiplayer.

## Phase 3 — Real-time synchronization
- Socket.IO integration.
- Room membership.
- Live drawing.
- Object operations.
- Cursor presence.
- Chat.
- Operation IDs and versioning.
- Incremental database updates.

**Exit condition:** Multiple clients see consistent object changes without full-board rewrites.

## Phase 4 — Snapshots and recovery
- Snapshot creation.
- Operation replay.
- Reconnection.
- Conflict handling.
- Idempotency.
- Recovery testing.

**Exit condition:** The board recovers correctly after refresh, disconnection, and server restart.

## Phase 5 — Teaching and presenting
- Presenter assignment.
- Follow mode.
- Classroom permissions.
- Student question queue.
- Polls and quizzes.
- Page controls.

**Exit condition:** A teacher can conduct a complete session with students.

## Phase 6 — Games and Party Mode
- Game lobby.
- Game state machine.
- Draw & Guess.
- Quick Draw.
- Team play.
- Server-authoritative scoring.
- Results and rematch.

**Exit condition:** At least one game is fully playable from start to finish. Additional games should be added using the same tested game framework.

## Phase 7 — Search, export, and history
- Global search.
- In-board search.
- PNG, SVG, and PDF exports where supported.
- Version history.
- Replay.
- Templates.

**Exit condition:** Users can locate, preserve, review, and share their work.

## Phase 8 — Hardening and release
- Security review.
- Load testing.
- Accessibility checks.
- Browser compatibility.
- Deployment.
- Monitoring.
- Documentation.
- End-to-end acceptance tests.

**Exit condition:** The application is deployable, recoverable, and demonstrably functional.

---

# 25. IDE Agent Instructions

The following implementation rules are mandatory.

1. Inspect the existing repository before modifying it.
2. Preserve working functionality unless a documented architectural change requires otherwise.
3. Review the existing package manager, framework, environment files, database configuration, and routing.
4. Do not recreate the project from scratch if a functional codebase already exists.
5. Do not claim a feature is complete until its frontend, backend, persistence, permissions, and relevant tests work.
6. Use TypeScript where practical and maintain consistent request and event schemas.
7. Use MongoDB's native driver unless the existing project or owner specifies otherwise.
8. Implement the snapshot-plus-operation-log strategy with targeted object updates.
9. Do not persist the entire board after every edit.
10. Keep ephemeral cursor and presence data separate from durable board content.
11. Validate all operations on the server.
12. Keep secrets and hidden game answers out of unauthorized payloads.
13. Implement proper loading, empty, error, and recovery states.
14. Avoid fake buttons, placeholder success messages, hardcoded user counts, and simulated backend success.
15. If an external service is unavailable, document the dependency and implement a safe, clearly identified fallback where possible.
16. Write and run tests for each completed phase.
17. Maintain an implementation checklist and update it as features are verified.
18. Keep architecture and API documentation aligned with the actual implementation.
19. Do not silently replace stable IDs, committed versions, or persisted state.
20. At the end of each phase, report what changed, which tests ran, what passed, what remains, and how to run the application.

## Required project documentation

Maintain these files:

- `README.md` — installation, configuration, and running the application.
- `PRD.md` — this product specification.
- `ARCHITECTURE.md` — components, data flow, and design decisions.
- `API.md` — HTTP endpoints and payload schemas.
- `SOCKET_EVENTS.md` — event contracts, authorization, and acknowledgement behavior.
- `DATABASE.md` — collections, indexes, versions, and persistence strategy.
- `SECURITY.md` — authentication, authorization, and security assumptions.
- `TESTING.md` — test commands, test scenarios, and known gaps.
- `IMPLEMENTATION_PLAN.md` — phased task checklist and verified progress.
- `.env.example` — required environment variable names without real secrets.

## Final implementation instruction

Implement the platform as a cohesive application, not as separate mockups.

Start by inspecting the existing codebase and mapping its current capabilities against this PRD. Identify what already works, what is incomplete, and what is missing. Propose the smallest safe set of changes that establishes the correct architecture.

Then implement one phase at a time. Verify each phase with real tests before proceeding. Prioritize the complete collaboration journey, durable incremental persistence, and reliable recovery before advanced games or decorative enhancements.

When a requirement is ambiguous, document the chosen behavior and make it consistent across the frontend, backend, database, and tests. Never hide an implementation limitation behind a successful-looking UI.

The final outcome must be a working real-time collaboration product whose features have meaningful user flows, whose board state can be recovered, and whose data remains consistent under concurrent use.