import bcrypt from 'bcrypt';

// Cost factor 10 = 2^10 hashing rounds: slow enough to make brute-forcing
// stolen hashes expensive, fast enough (~100ms) for a normal login.
const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
