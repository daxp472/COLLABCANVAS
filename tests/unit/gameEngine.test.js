import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  sanitizeGameState,
  submitGuess,
  WORD_DICTIONARY,
  QUIZ_DECKS
} from '../../server/services/gameEngine.js';

describe('Room Game Engine Unit Tests', () => {
  it('secret word is strictly omitted from public sanitized game state', () => {
    const mockSession = {
      gameId: 'gm_test123',
      roomId: 'room_abc',
      type: 'draw_and_guess',
      status: 'IN_PROGRESS',
      currentRound: 1,
      totalRounds: 3,
      remainingSeconds: 45,
      activeDrawerId: 'user_drawer_1',
      currentWord: 'SUPERSECRETWORD',
      currentCategory: 'Animals',
      hintMask: '_ _ _ _ _ _ _ _ _ _ _ _ _ _ _',
      participants: new Map([
        ['user_drawer_1', { userId: 'user_drawer_1', displayName: 'Drawer', score: 0 }],
        ['user_guesser_2', { userId: 'user_guesser_2', displayName: 'Guesser', score: 0 }]
      ]),
      guessedUsers: new Set()
    };

    const sanitized = sanitizeGameState(mockSession);

    assert.strictEqual(sanitized.currentWord, undefined, 'Secret word must NEVER leak in sanitized state');
    assert.strictEqual(sanitized.hintMask, '_ _ _ _ _ _ _ _ _ _ _ _ _ _ _');
    assert.strictEqual(sanitized.category, 'Animals');
    assert.strictEqual(sanitized.activeDrawerId, 'user_drawer_1');
  });

  it('quiz correct answer index is omitted from active question state', () => {
    const mockQuizSession = {
      gameId: 'gm_quiz_1',
      roomId: 'room_abc',
      type: 'quiz_battle',
      status: 'IN_PROGRESS',
      currentRound: 1,
      totalRounds: 5,
      remainingSeconds: 18,
      quizQuestionIndex: 0,
      participants: new Map(),
      guessedUsers: new Set()
    };

    const sanitized = sanitizeGameState(mockQuizSession);
    assert.ok(sanitized.quizQuestion);
    assert.strictEqual(sanitized.quizQuestion.question, QUIZ_DECKS[0].question);
    assert.strictEqual(sanitized.quizQuestion.correctIndex, undefined, 'Correct index must not be sent to client');
  });

  it('word dictionary contains valid categories and non-empty entries', () => {
    assert.ok(WORD_DICTIONARY.length > 5);
    for (const item of WORD_DICTIONARY) {
      assert.ok(item.word && item.word.length >= 3);
      assert.ok(item.category);
    }
  });
});
