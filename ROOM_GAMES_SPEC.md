# CollabCanvas Room Games & Party Mode Specification

This specification defines the 7 multiplayer game modes supported by the CollabCanvas game framework, including state transitions, server-authoritative timer logic, scoring algorithms, and security measures.

---

## 1. Game State Machine

All games run through a standardized finite state machine managed server-side:

```
[WAITING (Lobby)]
       |
       v (Host starts game, checks min participants)
[STARTING (3-2-1 Countdown)]
       |
       v
[IN_PROGRESS (Round active, timer ticking)]
       |
       +---> [PAUSED (Optional host pause)] ---> [IN_PROGRESS]
       |
       v (Timer reaches 0 OR all players finished)
[ROUND_RESULTS (Answer reveal, round scores, podium)]
       |
       +---> [NEXT_ROUND] ---> [IN_PROGRESS] (if round < totalRounds)
       |
       v (if round == totalRounds)
[FINISHED (Final scoreboard, winner celebration, rematch/return to canvas)]
```

---

## 2. Supported Game Modes

### 2.1 Draw & Guess (Skribbl / Classic Pictionary)
- **Min Players**: 2 (Recommended 3-10)
- **Rounds**: 3 rounds per player (configurable)
- **Round Time**: 60-80 seconds
- **Role Allocation**: One active drawer per round, others are guessers.
- **Word Selection**: The server provides 3 secret words of varying difficulty (Easy, Medium, Hard). The drawer picks one within 10 seconds (or auto-assigned).
- **Secret Protection**:
  - The secret word is transmitted **only** to the drawer's socket (`game:drawer:word`).
  - Guessers receive category, word length, and masked letters (e.g., `_ _ P P _ _`).
  - Guesses submitted via `game:submit` or room chat are intercepted by the server. If correct, the guess message is hidden from public chat to prevent spoiling, and a system notice "Player X guessed the word!" is broadcast.
- **Scoring Formula**:
  - Guessers: $\text{Points} = 100 + \lfloor 400 \times \frac{\text{TimeRemaining}}{\text{RoundDuration}} \rfloor$.
  - First guesser gets a +50 speed bonus.
  - Drawer: $\text{Points} = \lfloor 75 \times \text{NumberOfSuccessfulGuessers} \rfloor$.

### 2.2 Pictionary Teams
- **Min Players**: 4 (2 teams: Red Team vs Blue Team)
- **Mechanics**:
  - Teams alternate turns. Team A designates a drawer; only Team A members can guess during their turn (or optional competitive steal round).
  - If Team A fails to guess within 60s, Team B has 15s to attempt a steal for half points.
- **Rounds**: 4 rounds total (2 draws per team).

### 2.3 Quick Draw Challenge
- **Min Players**: 2
- **Mechanics**:
  - All players receive the exact same prompt at the same time (e.g., "A flying toaster", "Cyberpunk cat").
  - 45 seconds on the clock.
  - Everyone draws simultaneously on their own personal isolated sub-canvas.
  - When time expires, all drawings are automatically snapshot and displayed side-by-side in a voting gallery.
  - Players cast 1 vote for their favorite drawing (self-voting is prohibited by the server).
- **Scoring**: 200 points per vote received.

### 2.4 Collaborative Drawing Challenge
- **Min Players**: 2
- **Mechanics**:
  - Co-op challenge: The room is given a grand theme (e.g., "Build an Alien Space Station", "A Medieval Castle Siege") with 3-5 sub-objectives.
  - Shared canvas unlocked for everyone for 3-5 minutes.
  - Audio/chat coordination.
  - End of challenge: The host and room review the masterpiece, award community badges (Most Creative, Best Detail, Funniest Element), and export a commemorative PNG snapshot.

### 2.5 Educational Quiz Battle (Kahoot-Style)
- **Min Players**: 1 (Single player practice or up to 100 participants)
- **Mechanics**:
  - Host/Teacher selects a curated question deck (Math, Science, History, Tech, or custom).
  - Question types: Multiple Choice (4 colored cards), True/False, Short Answer.
  - Server counts down 15-30s per question.
  - Client sends answer index with timestamp.
  - Points awarded based on correctness and reaction speed:
    $$\text{Score} = \text{Correct} \times (500 + \lfloor 500 \times \frac{\text{TimeRemaining}}{\text{QuestionDuration}} \rfloor) \times \text{StreakMultiplier}$$
  - Streak multiplier: $+10\%$ per consecutive correct answer up to $\times 1.5$.
  - Answers and leaderboard revealed after each question.

### 2.6 Word Association
- **Min Players**: 2
- **Mechanics**:
  - Turn-based rapid word chaining. A starting topic or word is given (e.g., "Ocean").
  - Each player has 8 seconds on their turn to type a strongly associated word that hasn't been used yet.
  - The server checks against a lemmatized dictionary and session history to prevent repetitions and gibberish.
  - Running out of time or repeating a word loses a life (3 lives per player). Last player standing wins.

### 2.7 Brainstorming Battle
- **Min Players**: 2
- **Mechanics**:
  - Problem prompt provided (e.g., "How to reduce carbon footprint on campus?").
  - **Phase 1: Sticky Blitz (2 minutes)**: Everyone places sticky notes rapidly.
  - **Phase 2: Cluster & Organize (1.5 minutes)**: Group notes into columns/themes.
  - **Phase 3: Dot Voting (1 minute)**: Each participant is allocated 5 voting dots to distribute on the best ideas.
  - **Phase 4: Synthesis**: The server ranks top voted ideas and exports them as an actionable task list.

---

## 3. Server-Authoritative Anti-Cheat and Integrity

1. **Hidden Fields**:
   - The `secretWord`, `correctOptionIndex`, and `answerKey` are held exclusively in the server's in-memory game session or restricted collection.
   - Sockets of guessers/students only receive sanitized payloads (`category`, `hintMask`, `optionsTextWithoutAnswerIndex`).
2. **Authoritative Clock**:
   - Timers are computed using server `Date.now()`.
   - Every tick or 1-second interval, the server emits `game:timer:tick` with `{ remainingSeconds }`.
   - Clients cannot spoof remaining time or submit guesses after the round has officially transitioned.
3. **Idempotent Scoring**:
   - Each player can register only one valid guess/submission per round.
   - Submissions are indexed by `(gameId, roundNumber, participantId)` with unique enforcement.
