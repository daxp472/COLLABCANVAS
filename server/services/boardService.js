import { nanoid } from 'nanoid';
import { getDB } from '../config/db.js';
import { createSnapshotIfNeeded } from './snapshotService.js';

export async function getBoard(boardId) {
  const db = getDB();
  const board = await db.collection('boards').findOne({ boardId });
  if (!board) return null;

  const pages = await db.collection('pages')
    .find({ boardId })
    .sort({ order: 1 })
    .toArray();

  return {
    boardId: board.boardId,
    roomId: board.roomId,
    name: board.name,
    currentVersion: board.currentVersion || 0,
    latestSnapshotVersion: board.latestSnapshotVersion || 0,
    pages: pages.map(p => ({
      pageId: p.pageId,
      name: p.name,
      order: p.order,
      background: p.background,
      version: p.version || 0
    }))
  };
}

export async function getPageObjects(boardId, pageId) {
  const db = getDB();
  return await db.collection('canvasObjects')
    .find({
      boardId,
      pageId,
      deletedAt: { $exists: false }
    })
    .sort({ zIndex: 1 })
    .toArray();
}

/**
 * Applies an operation incrementally.
 * Does NOT rewrite the entire board! Updates only the targeted canvasObjects document.
 */
export async function applyBoardOperation({
  operationId,
  boardId,
  pageId,
  type,
  targetId,
  baseVersion = 0,
  payload = {},
  actorId
}) {
  const db = getDB();

  // 1. Idempotency Check
  if (operationId) {
    const existingOp = await db.collection('boardOperations').findOne({ operationId });
    if (existingOp) {
      return {
        status: 'committed',
        sequence: existingOp.sequence,
        objectVersion: existingOp.baseVersion || 1,
        idempotent: true
      };
    }
  }

  // 2. Atomically increment board sequence
  const boardUpdateResult = await db.collection('boards').findOneAndUpdate(
    { boardId },
    {
      $inc: { currentVersion: 1 },
      $set: { updatedAt: new Date() }
    },
    { returnDocument: 'after' }
  );

  if (!boardUpdateResult) {
    const err = new Error('Board not found');
    err.status = 404;
    err.code = 'BOARD_NOT_FOUND';
    throw err;
  }

  const sequence = boardUpdateResult.currentVersion;
  let objectVersion = 1;

  // 3. Perform targeted object mutation
  if (type === 'object:create') {
    const newObject = {
      objectId: targetId || `obj_${nanoid(10)}`,
      boardId,
      pageId,
      type: payload.type,
      data: payload.data || {},
      version: 1,
      zIndex: payload.zIndex || sequence,
      isLocked: !!payload.isLocked,
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('canvasObjects').insertOne(newObject);
    objectVersion = 1;
  } else if (type === 'object:update') {
    const currentObj = await db.collection('canvasObjects').findOne({ objectId: targetId });
    if (!currentObj) {
      const err = new Error(`Object ${targetId} not found`);
      err.status = 404;
      err.code = 'OBJECT_NOT_FOUND';
      throw err;
    }

    if (currentObj.isLocked && !payload.forceUnlock) {
      const err = new Error(`Object ${targetId} is locked`);
      err.status = 403;
      err.code = 'OBJECT_LOCKED';
      throw err;
    }

    // Prepare partial update
    const updateFields = {
      version: (currentObj.version || 0) + 1,
      updatedBy: actorId,
      updatedAt: new Date()
    };

    if (payload.zIndex !== undefined) updateFields.zIndex = payload.zIndex;
    if (payload.isLocked !== undefined) updateFields.isLocked = payload.isLocked;

    // Merge or set data properties
    if (payload.data) {
      for (const [key, val] of Object.entries(payload.data)) {
        updateFields[`data.${key}`] = val;
      }
    }

    await db.collection('canvasObjects').updateOne(
      { objectId: targetId },
      { $set: updateFields }
    );

    objectVersion = updateFields.version;
  } else if (type === 'object:delete') {
    await db.collection('canvasObjects').updateOne(
      { objectId: targetId },
      {
        $set: {
          deletedAt: new Date(),
          updatedBy: actorId,
          updatedAt: new Date()
        }
      }
    );
  } else if (type === 'page:add') {
    const newPage = {
      pageId: targetId || `pg_${nanoid(8)}`,
      boardId,
      name: payload.name || 'New Page',
      order: payload.order !== undefined ? payload.order : sequence,
      background: payload.background || { type: 'dots', color: '#0f172a' },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.collection('pages').insertOne(newPage);
  } else if (type === 'page:delete') {
    await db.collection('pages').deleteOne({ pageId: targetId });
    // Soft delete contained objects
    await db.collection('canvasObjects').updateMany(
      { boardId, pageId: targetId },
      { $set: { deletedAt: new Date(), updatedBy: actorId } }
    );
  }

  // 4. Record operation into boardOperations log
  const opRecord = {
    operationId: operationId || `op_${nanoid(10)}`,
    boardId,
    pageId,
    sequence,
    actorId,
    type,
    targetId,
    baseVersion,
    payload,
    createdAt: new Date()
  };
  await db.collection('boardOperations').insertOne(opRecord);

  // 5. Trigger snapshot creation if interval reached (async in background)
  createSnapshotIfNeeded(boardId, sequence).catch(err => {
    console.error('[Snapshot] Error creating snapshot in background:', err.message);
  });

  return {
    status: 'committed',
    sequence,
    objectVersion,
    operationId: opRecord.operationId
  };
}

export async function addPage({ boardId, name, background }) {
  const db = getDB();
  const pageId = `pg_${nanoid(8)}`;
  const count = await db.collection('pages').countDocuments({ boardId });

  const page = {
    pageId,
    boardId,
    name: name?.trim() || `Page ${count + 1}`,
    order: count,
    background: background || { type: 'dots', color: '#0f172a' },
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.collection('pages').insertOne(page);
  return page;
}

export async function updatePage(pageId, updates) {
  const db = getDB();
  const allowed = { updatedAt: new Date() };

  if (updates.name) allowed.name = updates.name.trim();
  if (updates.background) allowed.background = updates.background;
  if (updates.order !== undefined) allowed.order = updates.order;

  await db.collection('pages').updateOne(
    { pageId },
    { $set: allowed }
  );

  return await db.collection('pages').findOne({ pageId });
}

export async function deletePage(boardId, pageId) {
  const db = getDB();
  const pagesCount = await db.collection('pages').countDocuments({ boardId });
  if (pagesCount <= 1) {
    const err = new Error('Cannot delete the only page in the board');
    err.status = 400;
    err.code = 'CANNOT_DELETE_LAST_PAGE';
    throw err;
  }

  await db.collection('pages').deleteOne({ pageId, boardId });
  await db.collection('canvasObjects').updateMany(
    { boardId, pageId },
    { $set: { deletedAt: new Date() } }
  );

  return { success: true };
}
