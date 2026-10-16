import { getDB } from '../config/db.js';

export async function searchGlobal({ query, userId, limit = 20 }) {
  const db = getDB();
  const cleanQ = query?.trim();
  if (!cleanQ) return { rooms: [], boards: [] };

  const regex = { $regex: cleanQ, $options: 'i' };

  // Public rooms or rooms owned by user
  const roomFilter = {
    status: 'active',
    $or: [
      { visibility: 'public', name: regex },
      { ownerId: userId, name: regex }
    ]
  };

  const rooms = await db.collection('rooms')
    .find(roomFilter)
    .limit(limit)
    .toArray();

  return {
    rooms: rooms.map(r => ({
      roomId: r.roomId,
      name: r.name,
      description: r.description,
      visibility: r.visibility,
      hasPassword: !!r.passwordHash,
      createdAt: r.createdAt
    }))
  };
}

export async function searchInBoard({ boardId, query, limit = 30 }) {
  const db = getDB();
  const cleanQ = query?.trim();
  if (!cleanQ) return [];

  const regex = { $regex: cleanQ, $options: 'i' };

  // Search inside canvasObjects (text and sticky notes)
  const matchingObjects = await db.collection('canvasObjects')
    .find({
      boardId,
      deletedAt: { $exists: false },
      $or: [
        { 'data.text': regex },
        { 'data.title': regex }
      ]
    })
    .limit(limit)
    .toArray();

  // Search page names
  const matchingPages = await db.collection('pages')
    .find({
      boardId,
      name: regex
    })
    .toArray();

  const results = [];

  for (const page of matchingPages) {
    results.push({
      type: 'page',
      pageId: page.pageId,
      title: page.name,
      snippet: `Page: ${page.name}`
    });
  }

  for (const obj of matchingObjects) {
    results.push({
      type: obj.type,
      objectId: obj.objectId,
      pageId: obj.pageId,
      title: obj.type === 'sticky' ? 'Sticky Note' : 'Text',
      snippet: (obj.data?.text || '').slice(0, 100),
      position: { x: obj.data?.x || 0, y: obj.data?.y || 0 }
    });
  }

  return results;
}
