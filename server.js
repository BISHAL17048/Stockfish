import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import gameRoutes from './routes/games.js';
import simpleGameRoutes from './routes/gameRoutes.js';
import authRoutes from './routes/authRoutes.js';
import lichessRoutes from './routes/lichess.js';
import aiReviewRoutes from './routes/aiReview.js';
import ratingsRoutes from './routes/ratings.js';
import { registerChessSocketHandlers } from './sockets/chessSocket.js';
import { registerWatchSocketHandlers } from './sockets/watchSocket.js';

dotenv.config();

const app = express();

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const configuredOrigin = process.env.CLIENT_URL;
  if (configuredOrigin && origin === configuredOrigin) {
    return true;
  }

  return /^http:\/\/localhost:\d+$/.test(origin);
};

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST']
  }
});

const PORT = Number(process.env.PORT || 5000);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chess_app';

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.get('/api/test', (req, res) => {
  res.send('API working');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Game routes
app.use('/api/games', gameRoutes);
app.use('/api/game', simpleGameRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/lichess', lichessRoutes);
app.use('/api/ai', aiReviewRoutes);
app.use('/api/ratings', ratingsRoutes);

registerChessSocketHandlers(io);
registerWatchSocketHandlers(io);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

async function startServer() {
  try {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
      console.log('MongoDB connected');
    } catch (dbError) {
      console.warn('MongoDB connection failed. Running without persistent DB.');
      console.warn(dbError.message);
    }

    const tryListen = (port) =>
      new Promise((resolve, reject) => {
        const onError = (error) => {
          cleanup()
          reject(error)
        }

        const onListening = () => {
          cleanup()
          resolve()
        }

        const cleanup = () => {
          httpServer.off('error', onError)
          httpServer.off('listening', onListening)
        }

        httpServer.once('error', onError)
        httpServer.once('listening', onListening)
        httpServer.listen(port)
      })

    let boundPort = null
    for (let offset = 0; offset <= 10; offset += 1) {
      const candidatePort = PORT + offset
      try {
        await tryListen(candidatePort)
        boundPort = candidatePort
        break
      } catch (error) {
        if (error?.code !== 'EADDRINUSE') {
          throw error
        }

        if (offset === 10) {
          throw error
        }

        console.warn(`Port ${candidatePort} is already in use. Retrying on ${candidatePort + 1}...`)
      }
    }

    console.log(`Chess server running on http://localhost:${boundPort}`)
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();
