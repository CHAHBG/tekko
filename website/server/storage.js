import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import multer from 'multer';

const allowedMimeTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

function getFileExtension(mimeType, originalName = '') {
  if (allowedMimeTypes.has(mimeType)) {
    return allowedMimeTypes.get(mimeType);
  }

  return path.extname(originalName).toLowerCase() || '.jpg';
}

function sanitizeAsset(asset) {
  if (!asset) {
    return null;
  }

  const { file, previewUrl, ...safeAsset } = asset;
  return safeAsset;
}

async function downloadRemoteFile(remoteUrl, targetPath) {
  const parsedUrl = new URL(remoteUrl);

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only http and https image links are allowed.');
  }

  // Block private/internal IPs (SSRF protection)
  const { address } = await lookup(parsedUrl.hostname);
  const parts = address.split('.').map(Number);
  const isPrivate =
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0 ||
    address === '0.0.0.0' ||
    address.startsWith('::') ||
    address.startsWith('fc') ||
    address.startsWith('fd') ||
    address.startsWith('fe80') ||
    address.startsWith('::ffff:10.') ||
    address.startsWith('::ffff:127.') ||
    address.startsWith('::ffff:192.168.') ||
    /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(address);
  if (isPrivate) {
    throw new Error('Remote URLs pointing to private networks are not allowed.');
  }

  const response = await fetch(parsedUrl, { signal: AbortSignal.timeout(10000) });

  if (!response.ok) {
    throw new Error('The remote image could not be downloaded.');
  }

  // Block oversized remote files (max 8 MB)
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  if (contentLength > 8 * 1024 * 1024) {
    throw new Error('Remote image is too large (max 8 MB).');
  }

  const contentType = response.headers.get('content-type')?.split(';')[0] ?? '';

  if (!allowedMimeTypes.has(contentType)) {
    throw new Error('Only JPG, PNG, and WEBP images are allowed.');
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Double-check actual size after download (Content-Length could be missing/wrong)
  if (buffer.byteLength > 8 * 1024 * 1024) {
    throw new Error('Remote image is too large (max 8 MB).');
  }

  fs.writeFileSync(targetPath, buffer);

  return {
    mimeType: contentType,
    fileSize: buffer.byteLength,
  };
}

export function ensureRuntimeFolders({ uploadDir, dataDir }) {
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(path.join(uploadDir, 'tmp'), { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
}

export function createUploadMiddleware(uploadDir) {
  const tempDir = path.join(uploadDir, 'tmp');

  const storage = multer.diskStorage({
    destination: (_request, _file, callback) => {
      callback(null, tempDir);
    },
    filename: (_request, file, callback) => {
      callback(null, `${Date.now()}-${randomUUID()}${getFileExtension(file.mimetype, file.originalname)}`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: 8 * 1024 * 1024,
    },
    fileFilter: (_request, file, callback) => {
      callback(null, allowedMimeTypes.has(file.mimetype));
    },
  });
}

export async function persistAsset({ orderId, assetKey, asset, file, uploadDir }) {
  const sanitizedAsset = sanitizeAsset(asset);

  if (!sanitizedAsset && !file) {
    return null;
  }

  const orderDir = path.join(uploadDir, orderId);
  fs.mkdirSync(orderDir, { recursive: true });

  if (file) {
    const extension = getFileExtension(file.mimetype, file.originalname);
    const fileName = `${assetKey}${extension}`;
    const targetPath = path.join(orderDir, fileName);
    fs.renameSync(file.path, targetPath);

    return {
      ...sanitizedAsset,
      sourceType: 'file',
      mimeType: file.mimetype,
      originalName: file.originalname,
      fileSize: file.size,
      storedUrl: `/uploads/${orderId}/${fileName}`,
    };
  }

  if (sanitizedAsset?.remoteUrl) {
    const targetPath = path.join(orderDir, `${assetKey}-${randomUUID()}.jpg`);
    const downloaded = await downloadRemoteFile(sanitizedAsset.remoteUrl, targetPath);
    const fileName = path.basename(targetPath);

    return {
      ...sanitizedAsset,
      sourceType: 'url',
      mimeType: downloaded.mimeType,
      fileSize: downloaded.fileSize,
      storedUrl: `/uploads/${orderId}/${fileName}`,
    };
  }

  return sanitizedAsset;
}

export function cleanupTempFiles(fileGroups) {
  if (!fileGroups) {
    return;
  }

  Object.values(fileGroups)
    .flat()
    .forEach((file) => {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
}