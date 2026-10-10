import { Readable } from 'node:stream';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { env } from '../config/env.js';

// Lesson files live in Cloudinary as "authenticated" assets: they have no
// public address. Only this server, which knows the API secret, can create
// the signed address needed to fetch one. Students download through our own
// API (which checks they may see the lesson), never from Cloudinary directly.
//
// resource_type "raw": stored and returned byte-for-byte. Cloudinary does no
// image/PDF processing on them (none is needed, and processing untrusted
// files is itself a risk).

export const storageEnabled = !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

if (storageEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME!,
    api_key: env.CLOUDINARY_API_KEY!,
    api_secret: env.CLOUDINARY_API_SECRET!,
    secure: true,
  });
}

const OPTIONS = { resource_type: 'raw', type: 'authenticated' } as const;

// Cloudinary reports failures as a plain object { message, http_code },
// not an Error. This keeps its message (e.g. "Invalid Signature") so the
// server log says what actually went wrong.
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly httpCode?: number,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

const toStorageError = (err: unknown): StorageError => {
  if (err instanceof StorageError) return err;
  const e = err as { message?: unknown; http_code?: unknown; error?: { message?: unknown } } | undefined;
  const message = e?.message ?? e?.error?.message;
  return new StorageError(
    typeof message === 'string' && message ? message : 'Unknown storage error',
    typeof e?.http_code === 'number' ? e.http_code : undefined,
  );
};

export function storeFile(data: Buffer, publicId: string): Promise<{ publicId: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      { ...OPTIONS, public_id: publicId, overwrite: false },
      (err?: unknown, result?: UploadApiResponse) => {
        if (err || !result) return reject(toStorageError(err));
        resolve({ publicId: result.public_id, bytes: result.bytes });
      },
    );
    // A network failure before Cloudinary answers arrives here, not in the callback.
    upload.on('error', (err: unknown) => reject(toStorageError(err)));
    Readable.from(data).pipe(upload);
  });
}

// Fetches a stored file for streaming to the browser.
export async function fetchStoredFile(publicId: string): Promise<Response> {
  const url = cloudinary.url(publicId, { ...OPTIONS, sign_url: true, secure: true });
  return fetch(url, { signal: AbortSignal.timeout(30_000) });
}

// Best effort: a failure is logged, never shown to the user (the lesson
// change itself already succeeded). At worst an unused file stays stored.
export async function deleteStoredFiles(publicIds: string[]): Promise<void> {
  if (!storageEnabled || publicIds.length === 0) return;
  const results = await Promise.allSettled(
    publicIds.map((id) =>
      cloudinary.uploader.destroy(id, { ...OPTIONS, invalidate: true }).catch((err: unknown) => {
        throw toStorageError(err);
      }),
    ),
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`Storage: could not delete ${publicIds[i]}: ${(r.reason as Error).message}`);
    }
  });
}
