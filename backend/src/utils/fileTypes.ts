// Which files may be attached to a lesson, and a check that each file really
// is what its name says. The extension and the browser's MIME type are both
// chosen by the uploader, so the first bytes of the file ("magic number")
// are checked too: a program renamed to notes.pdf is refused.
//
// Deliberately NOT allowed: .svg and .html (they can contain scripts),
// programs (.exe, .bat, .js…) and anything else not listed.

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const startsWith = (buf: Buffer, ...bytes: number[]) => bytes.every((b, i) => buf[i] === b);
const ascii = (buf: Buffer, at: number, text: string) => buf.subarray(at, at + text.length).toString('latin1') === text;

const pdf = (b: Buffer) => ascii(b, 0, '%PDF-');
// Word/Excel/PowerPoint 2007+ files are ZIP archives inside.
const zip = (b: Buffer) => startsWith(b, 0x50, 0x4b, 0x03, 0x04) || startsWith(b, 0x50, 0x4b, 0x05, 0x06);
// Old (97–2003) Office files.
const ole = (b: Buffer) => startsWith(b, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
const png = (b: Buffer) => startsWith(b, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const jpeg = (b: Buffer) => startsWith(b, 0xff, 0xd8, 0xff);
const gif = (b: Buffer) => ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a');
const webp = (b: Buffer) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP');
// Plain text: no NUL bytes in the first 8 KB (binary files nearly always have some).
const text = (b: Buffer) => !b.subarray(0, 8192).includes(0);

export const FILE_TYPES: Record<string, { mime: string; check: (b: Buffer) => boolean }> = {
  pdf: { mime: 'application/pdf', check: pdf },
  doc: { mime: 'application/msword', check: ole },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', check: zip },
  ppt: { mime: 'application/vnd.ms-powerpoint', check: ole },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', check: zip },
  xls: { mime: 'application/vnd.ms-excel', check: ole },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', check: zip },
  zip: { mime: 'application/zip', check: zip },
  png: { mime: 'image/png', check: png },
  jpg: { mime: 'image/jpeg', check: jpeg },
  jpeg: { mime: 'image/jpeg', check: jpeg },
  gif: { mime: 'image/gif', check: gif },
  webp: { mime: 'image/webp', check: webp },
  txt: { mime: 'text/plain; charset=utf-8', check: text },
  csv: { mime: 'text/csv; charset=utf-8', check: text },
  md: { mime: 'text/markdown; charset=utf-8', check: text },
};

export const extensionOf = (name: string) => /\.([a-z0-9]{1,5})$/i.exec(name)?.[1]?.toLowerCase() ?? '';

// A safe display/download name: no folders, no control characters, no
// characters Windows forbids in file names, at most 150 characters with the
// extension kept.
export function cleanFileName(name: string, ext: string): string {
  const base = name
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const hasExt = base.toLowerCase().endsWith(`.${ext}`);
  const stem = (hasExt ? base.slice(0, -(ext.length + 1)) : base).replace(/^\.+/, '').trim() || 'file';
  return `${stem.slice(0, 150 - ext.length - 1)}.${ext}`;
}

// Returns the file type, or the reason the file is refused.
export function checkFile(name: string, data: Buffer): { ext: string; mime: string } | { error: string } {
  const ext = extensionOf(name);
  const type = FILE_TYPES[ext];
  if (!type) {
    return { error: 'This type of file is not allowed. Use PDF, Word, PowerPoint, Excel, an image, ZIP or a text file.' };
  }
  if (data.length === 0) return { error: 'The file is empty.' };
  if (!type.check(data)) return { error: `This file's contents don't match its name (.${ext}). It may be damaged or renamed.` };
  return { ext, mime: type.mime };
}
