import type { RequestHandler } from 'express';

// Hides the value of secret query parameters before a URL is logged.
// Invite and password-reset links carry a single-use token in the URL
// (?token=…); anyone able to read the server logs could otherwise copy it
// and use the link themselves.
const SECRET_PARAMS = /([?&](?:token)=)[^&#]*/gi;
export const redactUrl = (url: string) => url.replace(SECRET_PARAMS, '$1[redacted]');

// Logs every request with its status and how long it took, e.g.
//   POST /api/auth/login 200 184ms
// Useful to see WHERE time goes (network vs. database vs. bcrypt).
// Never logs bodies, so passwords can't end up in logs.
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.method} ${redactUrl(req.originalUrl)} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });
  next();
};
