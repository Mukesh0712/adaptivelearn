import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env, isProduction } from './config/env.js';
import { authRouter } from './routes/auth.routes.js';
import { testRouter } from './routes/test.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { enforceHttps } from './middleware/enforceHttps.js';

// The Express app is built here without calling listen(), so it can later be
// imported by tests without starting a real server.
export const app = express();

if (isProduction) app.set('trust proxy', env.TRUST_PROXY);
app.disable('x-powered-by'); // don't advertise the server technology

app.use(enforceHttps); // production only: http:// → https://
// Standard security headers. Includes Strict-Transport-Security (HSTS): once a
// browser has seen it over HTTPS, it will only ever use HTTPS for this site.
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(requestLogger);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser()); // fills req.cookies (needed to read the refresh token)

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', authRouter);
app.use('/api/test', testRouter);

// These two must be registered last: unknown routes → 404, then all errors → JSON.
app.use(notFound);
app.use(errorHandler);
