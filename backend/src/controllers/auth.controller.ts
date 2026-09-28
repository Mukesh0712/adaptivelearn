import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { UserModel, type UserDocument } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken } from '../utils/tokens.js';
import type { LoginInput, RegisterInput } from '../validators/auth.schema.js';

// Cost factor 10 = 2^10 hashing rounds: slow enough to make brute-forcing
// stolen hashes expensive, fast enough (~100ms) for a normal login.
const BCRYPT_ROUNDS = 10;

function authResponse(user: UserDocument) {
  return {
    user: user.toJSON(),
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
  };
}

export async function register(req: Request, res: Response) {
  const { name, email, password, role } = req.body as RegisterInput;

  if (await UserModel.exists({ email })) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await UserModel.create({ name, email, password: hashed, role });

  res.status(201).json(authResponse(user));
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as LoginInput;

  // password has select:false on the schema, so ask for it explicitly here.
  const user = await UserModel.findOne({ email }).select('+password');

  // Same message for "no such user" and "wrong password", so attackers can't
  // use the login form to discover which emails are registered.
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  res.json(authResponse(user));
}

export async function me(req: Request, res: Response) {
  const user = await UserModel.findById(req.user!.id);
  if (!user) throw ApiError.unauthorized('User no longer exists');
  res.json({ user: user.toJSON() });
}
