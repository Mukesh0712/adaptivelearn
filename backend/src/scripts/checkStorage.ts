// Checks the Cloudinary setup end to end, with the keys in .env:
//   1. the keys are accepted (ping),
//   2. a tiny test file can be uploaded the way lesson files are,
//   3. it can be fetched back through a signed URL (the download path),
//   4. it can be deleted.
// Run (PowerShell, in the backend folder):  npm run check:storage
// The API secret is never printed.
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { deleteStoredFiles, fetchStoredFile, storageEnabled, storeFile } from '../utils/fileStorage.js';

const ok = (msg: string) => console.log(`  OK    ${msg}`);
const fail = (msg: string, err?: unknown): never => {
  const e = err as { message?: string; http_code?: number; error?: { message?: string; http_code?: number } } | undefined;
  const detail = e?.message ?? e?.error?.message;
  const code = e?.http_code ?? e?.error?.http_code;
  console.log(`  FAIL  ${msg}${detail ? `\n        Cloudinary says: ${detail}${code ? ` (HTTP ${code})` : ''}` : ''}`);
  process.exit(1);
};

console.log('Checking Cloudinary storage…');
if (!storageEnabled) {
  fail('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must all be set in backend/.env');
}
const name = env.CLOUDINARY_CLOUD_NAME!;
const key = env.CLOUDINARY_API_KEY!;
const secret = env.CLOUDINARY_API_SECRET!;
console.log(`  Cloud name: ${name}`);
console.log(`  API key:    ${key.slice(0, 4)}…${key.slice(-2)} (${key.length} characters)`);
console.log(`  API secret: ${secret.length} characters (not shown)`);
// Common copy-paste mistakes in .env.
for (const [label, value] of [['Cloud name', name], ['API key', key], ['API secret', secret]] as const) {
  if (value !== value.trim() || /^["']|["']$/.test(value) || /\s/.test(value)) {
    fail(`${label} has spaces or quotes around it. Write it in .env as KEY=value with nothing else.`);
  }
}
if (!/^\d+$/.test(key)) console.log('  WARN  The API key is normally only digits. Did you paste the secret into the key?');

try {
  await cloudinary.api.ping();
  ok('Keys accepted');
} catch (err) {
  fail('Cloudinary did not accept the cloud name / API key / API secret', err);
}

const publicId = `adaptivelearn/_check/${Date.now()}.txt`;
const content = Buffer.from('AdaptiveLearn storage check\n');
try {
  await storeFile(content, publicId);
  ok('Upload (authenticated, raw)');
} catch (err) {
  fail('Upload failed', err);
}

try {
  const res = await fetchStoredFile(publicId);
  if (!res.ok) fail(`Download via signed URL returned HTTP ${res.status}`);
  const back = Buffer.from(await res.arrayBuffer());
  if (!back.equals(content)) fail('Downloaded file is different from the uploaded one');
  ok('Download via signed URL');
} catch (err) {
  fail('Download failed', err);
}

await deleteStoredFiles([publicId]);
ok('Delete (any error would be printed above)');
console.log('All good: lesson uploads and downloads will work.');
