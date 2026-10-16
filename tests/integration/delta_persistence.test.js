import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { connectDB, closeDB, getDB } from '../../server/config/db.js';
import { applyBoardOperation, getBoard, getPageObjects } from '../../server/services/boardService.js';
import { createSnapshot, getBoardRecoveryState } from '../../server/services/snapshotService.js';
import { nanoid } from 'nanoid';

describe('Delta Operation & Partial Persistence Integration Tests', () => {
  const testBoardId = `brd_test_${Date.now()}`;
  const testPageId = `pg_test_${Date.now()}`;
  const testActor = 'user_tester_1';

  before(async () => {
    await connectDB();
    const db = getDB();

    // Setup test board and page
    await db.collection('boards').insertOne({
      boardId: testBoardId,
      roomId: 'room_test',
      name: 'Delta Test Board',
      currentVersion: 0,
      latestSnapshotVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await db.collection('pages').insertOne({
      pageId: testPageId,
      boardId: testBoardId,
      name: 'Page 1',
      order: 0,
      background: { type: 'dots', color: '#0f172a' },
      createdAt: new Date()
    });
  });

  after(async () => {
    try {
      const db = getDB();
      await db.collection('boards').deleteOne({ boardId: testBoardId });
      await db.collection('pages').deleteMany({ boardId: testBoardId });
      await db.collection('canvasObjects').deleteMany({ boardId: testBoardId });
      await db.collection('boardOperations').deleteMany({ boardId: testBoardId });
      await db.collection('boardSnapshots').deleteMany({ boardId: testBoardId });
    } catch (e) {}
    await closeDB();
  });

  it('increments board sequence monotonically on object creation', async () => {
    const op1 = await applyBoardOperation({
      operationId: `op_${nanoid(8)}`,
      boardId: testBoardId,
      pageId: testPageId,
      type: 'object:create',
      targetId: 'sticky_1',
      payload: {
        type: 'sticky',
        data: { x: 100, y: 100, text: 'First sticky', color: '#fef08a' }
      },
      actorId: testActor
    });

    assert.strictEqual(op1.status, 'committed');
    assert.strictEqual(op1.sequence, 1);

    const op2 = await applyBoardOperation({
      operationId: `op_${nanoid(8)}`,
      boardId: testBoardId,
      pageId: testPageId,
      type: 'object:create',
      targetId: 'sticky_2',
      payload: {
        type: 'sticky',
        data: { x: 300, y: 100, text: 'Second sticky', color: '#bbf7d0' }
      },
      actorId: testActor
    });

    assert.strictEqual(op2.status, 'committed');
    assert.strictEqual(op2.sequence, 2);
  });

  it('updates only the targeted object without rewriting unrelated objects', async () => {
    const db = getDB();

    // Capture state of sticky_2 before update
    const sticky2Before = await db.collection('canvasObjects').findOne({ objectId: 'sticky_2' });

    // Update position of sticky_1
    const updateOp = await applyBoardOperation({
      operationId: `op_${nanoid(8)}`,
      boardId: testBoardId,
      pageId: testPageId,
      type: 'object:update',
      targetId: 'sticky_1',
      baseVersion: 1,
      payload: {
        data: { x: 150, y: 220 }
      },
      actorId: testActor
    });

    assert.strictEqual(updateOp.status, 'committed');
    assert.strictEqual(updateOp.sequence, 3);
    assert.strictEqual(updateOp.objectVersion, 2);

    // Verify sticky_1 position changed
    const sticky1After = await db.collection('canvasObjects').findOne({ objectId: 'sticky_1' });
    assert.strictEqual(sticky1After.data.x, 150);
    assert.strictEqual(sticky1After.data.y, 220);
    assert.strictEqual(sticky1After.version, 2);

    // CRITICAL: Verify sticky_2 was completely untouched
    const sticky2After = await db.collection('canvasObjects').findOne({ objectId: 'sticky_2' });
    assert.deepStrictEqual(sticky2After.data, sticky2Before.data);
    assert.strictEqual(sticky2After.version, sticky2Before.version);
    assert.strictEqual(sticky2After.updatedAt.getTime(), sticky2Before.updatedAt.getTime());
  });

  it('creates snapshot and recovers state with delta operations replay', async () => {
    // Create checkpoint snapshot at version 3
    const snapshot = await createSnapshot(testBoardId);
    assert.ok(snapshot);
    assert.strictEqual(snapshot.version, 3);
    assert.strictEqual(snapshot.objects.length, 2);

    // Now apply another operation after the snapshot (sequence 4)
    await applyBoardOperation({
      operationId: `op_${nanoid(8)}`,
      boardId: testBoardId,
      pageId: testPageId,
      type: 'object:create',
      targetId: 'shape_rect_1',
      payload: {
        type: 'rectangle',
        data: { x: 50, y: 50, width: 200, height: 100, strokeColor: '#6366f1' }
      },
      actorId: testActor
    });

    // Request recovery state
    const recovery = await getBoardRecoveryState(testBoardId, 0);

    assert.strictEqual(recovery.currentVersion, 4);
    assert.ok(recovery.snapshot);
    assert.strictEqual(recovery.snapshot.version, 3);
    // Delta operations should contain exactly the operation(s) after version 3
    assert.strictEqual(recovery.deltaOperations.length, 1);
    assert.strictEqual(recovery.deltaOperations[0].sequence, 4);
    assert.strictEqual(recovery.deltaOperations[0].targetId, 'shape_rect_1');
  });

  it('guarantees idempotency on duplicate operation IDs', async () => {
    const fixedOpId = 'idempotent_op_999';

    const firstRun = await applyBoardOperation({
      operationId: fixedOpId,
      boardId: testBoardId,
      pageId: testPageId,
      type: 'object:create',
      targetId: 'circle_test',
      payload: { type: 'circle', data: { x: 500, y: 500, radius: 40 } },
      actorId: testActor
    });

    const duplicateRun = await applyBoardOperation({
      operationId: fixedOpId,
      boardId: testBoardId,
      pageId: testPageId,
      type: 'object:create',
      targetId: 'circle_test',
      payload: { type: 'circle', data: { x: 500, y: 500, radius: 40 } },
      actorId: testActor
    });

    assert.strictEqual(duplicateRun.status, 'committed');
    assert.strictEqual(duplicateRun.sequence, firstRun.sequence);
    assert.strictEqual(duplicateRun.idempotent, true);
  });
});
