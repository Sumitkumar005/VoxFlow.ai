import app from './app.js';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);

// Initialize Socket.io for real-time call updates
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Make io available to routes
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Join room for specific agent run
  socket.on('join-run', (runId) => {
    socket.join(`run-${runId}`);
    console.log(`Client joined run room: run-${runId}`);
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
    ╔════════════════════════════════════════╗
    ║  🎙️  VoxFlow API Server Running     ║
    ╠════════════════════════════════════════╣
    ║  Port: ${PORT.toString().padEnd(30)} ║
    ║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(22)} ║
    ║  URL: http://localhost:${PORT.toString().padEnd(17)} ║
    ╚════════════════════════════════════════╝
  `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
});

export { io };