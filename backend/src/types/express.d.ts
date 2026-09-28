import type { Role } from '../models/User.js';

// Tell TypeScript that, after the authenticate middleware runs, req.user exists.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

export {};
