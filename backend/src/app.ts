import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// The Express app is built here without calling listen(), so it can later be
// imported by tests without starting a real server.
export const app = express();

app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser()); // fills req.cookies (needed to read the refresh token)

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', authRouter);

// These two must be registered last: unknown routes → 404, then all errors → JSON.
app.use(notFound);
app.use(errorHandler);
