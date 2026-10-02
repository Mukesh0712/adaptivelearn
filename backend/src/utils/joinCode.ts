import crypto from 'node:crypto';

// 31 characters with no look-alikes (no 0/O, 1/I/L), so a code read out in
// class or copied from a whiteboard can't be mistyped. 31^6 ≈ 887 million codes.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LENGTH = 6;

// crypto.randomInt is cryptographically secure, so codes can't be predicted
// from earlier ones (Math.random could be).
export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return code;
}

// What the user typed ("k7q-2mx", " K7Q 2MX ") → stored form ("K7Q2MX").
export const normalizeJoinCode = (input: string) => input.toUpperCase().replace(/[\s-]/g, '');
