import { MongoClient } from 'mongodb';
import { config } from './env.js';

let client = null;
let db = null;

export async function connectDB() {
  if (db) return db;

  try {
    client = new MongoClient(config.mongodbUri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000
    });

    await client.connect();
    db = client.db();
    console.log(`[Database] Connected successfully to MongoDB at ${config.mongodbUri}`);

    await initIndexes(db);
    return db;
  } catch (error) {
    console.error('[Database] Connection failed:', error.message);
    throw error;
  }
}

export function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return db;
}

export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[Database] Connection closed.');
  }
}

async function initIndexes(database) {
  try {
    // users
    await database.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });

    // rooms
    await database.collection('rooms').createIndex({ roomId: 1 }, { unique: true });
    await database.collection('rooms').createIndex({ visibility: 1, status: 1 });
    await database.collection('rooms').createIndex({ ownerId: 1 });

    // roomMembers
    await database.collection('roomMembers').createIndex({ roomId: 1, userId: 1 }, { unique: true });

    // boards
    await database.collection('boards').createIndex({ boardId: 1 }, { unique: true });
    await database.collection('boards').createIndex({ roomId: 1 });

    // pages
    await database.collection('pages').createIndex({ pageId: 1 }, { unique: true });
    await database.collection('pages').createIndex({ boardId: 1, order: 1 });

    // canvasObjects (Critical for partial delta persistence)
    await database.collection('canvasObjects').createIndex({ objectId: 1 }, { unique: true });
    await database.collection('canvasObjects').createIndex({ boardId: 1, pageId: 1, deletedAt: 1 });
    await database.collection('canvasObjects').createIndex({ boardId: 1, updatedAt: -1 });

    // boardOperations (Idempotency and monotonic sequence recovery)
    await database.collection('boardOperations').createIndex({ operationId: 1 }, { unique: true });
    await database.collection('boardOperations').createIndex({ boardId: 1, sequence: 1 });

    // boardSnapshots
    await database.collection('boardSnapshots').createIndex({ boardId: 1, version: -1 });

    // chatMessages
    await database.collection('chatMessages').createIndex({ roomId: 1, createdAt: 1 });

    // games
    await database.collection('games').createIndex({ gameId: 1 }, { unique: true });
    await database.collection('games').createIndex({ roomId: 1, status: 1 });

    console.log('[Database] Indexes ensured successfully.');
  } catch (err) {
    console.warn('[Database] Warning while creating indexes:', err.message);
  }
}
