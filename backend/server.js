require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { initSocket } = require('./utils/socket');
const { notFound, errorHandler } = require('./middleware/error');

// Fail early with a clear message if the .env file is incomplete
['MONGO_URI', 'JWT_SECRET'].forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing ${key} in backend/.env (copy .env.example to .env and fill it in)`);
    process.exit(1);
  }
});

const app = express();

// CORS: only our React app may call this API from a browser
app.use(
  cors({
    origin: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()),
  })
);
app.use(express.json()); // lets us read JSON request bodies as req.body

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PriorityQ API is running' });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/queue', require('./routes/queueRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// These two MUST stay last
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize real-time Socket.IO communication
initSocket(server);

connectDB().then(() => {
  server.listen(PORT, () => console.log(`PriorityQ API running on http://localhost:${PORT}`));
});
