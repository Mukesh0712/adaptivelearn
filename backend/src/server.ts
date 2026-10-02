import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { verifyEmailConfig } from './utils/mailer.js';

async function start(): Promise<void> {
  try {
    await connectDB();
  } catch (err) {
    console.error('Could not connect to MongoDB. Is it running and is MONGODB_URI correct?');
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`AdaptiveLearn API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    void verifyEmailConfig(); // logs which email provider is used and whether it works
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    server.close(() => {
      void disconnectDB().then(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void start();
