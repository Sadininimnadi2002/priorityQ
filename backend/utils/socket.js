const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

/**
 * Initializes Socket.IO with CORS settings and verified JWT authentication middleware.
 * Ensures clients can only join private rooms matching their verified identity.
 */
function initSocket(server) {
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim());

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PATCH'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware: verify JWT token before allowing connection
  io.use((socket, next) => {
    try {
      const rawToken =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.query?.token;

      if (!rawToken) {
        return next(new Error('Authentication required: No token provided'));
      }

      const token = rawToken.startsWith('Bearer ') ? rawToken.split(' ')[1] : rawToken;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach verified user payload to the socket
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication failed: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.user.id || socket.user._id);
    const userRoom = `user:${userId}`;

    // Join ONLY the private room bound to this authenticated user ID
    socket.join(userRoom);

    socket.on('disconnect', (reason) => {
      // Disconnection handled gracefully
    });
  });

  return io;
}

/**
 * Returns current Socket.IO instance or null
 */
function getIO() {
  return io;
}

/**
 * Delivers a real-time notification to a specific authenticated user's private room.
 * Never broadcasts customer-specific notifications to unauthorized users.
 */
function sendNotificationToUser(userId, notification) {
  if (!io) return false;
  const userRoom = `user:${String(userId)}`;
  io.to(userRoom).emit('notification', notification);
  return true;
}

/**
 * Delivers a real-time queue position and status update to a specific authenticated user's private room.
 */
function sendQueueUpdateToUser(userId, payload) {
  if (!io) return false;
  const userRoom = `user:${String(userId)}`;
  io.to(userRoom).emit('queue:update', payload);
  return true;
}

module.exports = {
  initSocket,
  getIO,
  sendNotificationToUser,
  sendQueueUpdateToUser,
};

