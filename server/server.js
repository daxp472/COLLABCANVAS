import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config/env.js';
import { connectDB, closeDB } from './config/db.js';
import { createApp } from './app.js';
import { setupSocketIO } from './socket/socketHandler.js';

async function bootstrap() {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Initialize Express application
    const app = createApp();

    // 3. Create HTTP Server
    const server = http.createServer(app);

    // 4. Attach Socket.IO Server
    const io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      pingTimeout: 30000,
      pingInterval: 10000
    });

    setupSocketIO(io);

    // 5. Start listening
    server.listen(config.port, () => {
      console.log(`[CollabCanvas] Server running on port ${config.port}`);
      console.log(`[CollabCanvas] Health: http://localhost:${config.port}/api/health`);
    });

    // Graceful Shutdown
    const handleShutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await closeDB();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

    return { server, app, io };
  } catch (err) {
    console.error('[CollabCanvas] Critical Startup Failure:', err);
    process.exit(1);
  }
}

bootstrap();
