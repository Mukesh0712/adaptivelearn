import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

// Small endpoints that exist only to demonstrate RBAC. Real feature routes
// will use the same authenticate + authorize(...) pattern.
export const testRouter = Router();

// Every route below requires a valid access token.
testRouter.use(authenticate);

testRouter.get('/student', authorize('student'), (req, res) => {
  res.json({ message: 'Hello student', user: req.user });
});
testRouter.get('/instructor', authorize('instructor'), (req, res) => {
  res.json({ message: 'Hello instructor', user: req.user });
});
testRouter.get('/parent', authorize('parent'), (req, res) => {
  res.json({ message: 'Hello parent', user: req.user });
});
testRouter.get('/admin', authorize('admin'), (req, res) => {
  res.json({ message: 'Hello admin', user: req.user });
});
// A route can allow several roles at once.
testRouter.get('/staff', authorize('instructor', 'admin'), (req, res) => {
  res.json({ message: 'Hello staff member', user: req.user });
});
