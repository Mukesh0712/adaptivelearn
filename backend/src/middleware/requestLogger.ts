import type { RequestHandler } from 'express';

// Logs every API call with its status and how long it took, e.g.
//   POST /api/auth/login 200 184ms
// Useful to see WHERE time goes (network vs. database vs. bcrypt).
// Never logs bodies, so passwords can't end up in logs.
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });
  next();
};
