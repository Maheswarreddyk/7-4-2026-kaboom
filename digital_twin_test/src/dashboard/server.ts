import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

import { store } from '../store';

io.on('connection', (socket) => {
  console.log('[Dashboard] Client connected');
  // Send initial state
  store.trails.forEach((trail) => {
    socket.emit('update', trail);
  });
});

// We can expose an endpoint or an event emitter for store.ts to call
export const dashboardEmitter = {
  emit: (event: string, data: any) => {
    io.emit(event, data);
  }
};

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`[Dashboard] Live monitoring available at http://localhost:${PORT}`);
});
