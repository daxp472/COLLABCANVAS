import { getDB } from '../config/db.js';
import { config } from '../config/env.js';

export async function createSnapshot(boardId) {
  const db = getDB();
  const board = await db.collection('boards').findOne({ boardId });
  if (!board) return null;

  const currentVersion = board.currentVersion || 0;

  // Retrieve all active objects and pages
  const [pages, objects] = await Promise.all([
    db.collection('pages').find({ boardId }).sort({ order: 1 }).toArray(),
    db.collection('canvasObjects').find({ boardId, deletedAt: { $exists: false } }).sort({ zIndex: 1 }).toArray()
  ]);

  const snapshot = {
    boardId,
    version: currentVersion,
    schemaVersion: 1,
    pages: pages.map(p => ({
      pageId: p.pageId,
      name: p.name,
      order: p.order,
      background: p.background
    })),
    objects: objects.map(o => ({
      objectId: o.objectId,
      pageId: o.pageId,
      type: o.type,
      data: o.data,
      version: o.version,
      zIndex: o.zIndex,
      isLocked: !!o.isLocked
    })),
    createdAt: new Date()
  };

  const insertResult = await db.collection('boardSnapshots').insertOne(snapshot);

  // Update board pointer
  await db.collection('boards').updateOne(
    { boardId },
    {
      $set: {
        latestSnapshotVersion: currentVersion,
        latestSnapshotId: insertResult.insertedId,
        updatedAt: new Date()
      }
    }
  );

  return snapshot;
}

export async function createSnapshotIfNeeded(boardId, currentSequence) {
  const db = getDB();
  const board = await db.collection('boards').findOne({ boardId });
  if (!board) return;

  const latestVersion = board.latestSnapshotVersion || 0;
  if (currentSequence - latestVersion >= config.snapshotIntervalOps) {
    await createSnapshot(boardId);
  }
}

export async function getBoardRecoveryState(boardId, sinceVersion = 0) {
  const db = getDB();
  const board = await db.collection('boards').findOne({ boardId });
  if (!board) {
    const err = new Error('Board not found');
    err.status = 404;
    err.code = 'BOARD_NOT_FOUND';
    throw err;
  }

  // Find latest snapshot
  const latestSnapshot = await db.collection('boardSnapshots')
    .find({ boardId })
    .sort({ version: -1 })
    .limit(1)
    .next();

  let snapshot = null;
  let fromSequence = sinceVersion;

  if (latestSnapshot && latestSnapshot.version >= sinceVersion) {
    snapshot = latestSnapshot;
    fromSequence = latestSnapshot.version;
  }

  // Retrieve delta operations committed after fromSequence
  const operations = await db.collection('boardOperations')
    .find({
      boardId,
      sequence: { $gt: fromSequence }
    })
    .sort({ sequence: 1 })
    .toArray();

  // If no snapshot exists at all, fetch current active objects
  if (!snapshot && fromSequence === 0) {
    const [pages, objects] = await Promise.all([
      db.collection('pages').find({ boardId }).sort({ order: 1 }).toArray(),
      db.collection('canvasObjects').find({ boardId, deletedAt: { $exists: false } }).sort({ zIndex: 1 }).toArray()
    ]);

    snapshot = {
      boardId,
      version: 0,
      pages,
      objects
    };
  }

  return {
    boardId,
    currentVersion: board.currentVersion || 0,
    snapshot,
    deltaOperations: operations.map(op => ({
      operationId: op.operationId,
      sequence: op.sequence,
      actorId: op.actorId,
      pageId: op.pageId,
      type: op.type,
      targetId: op.targetId,
      payload: op.payload
    }))
  };
}
