import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Object key prefixes under bucket root (match S3 console: materials/...) */
const MATERIAL_PREFIX_BY_USER_TYPE = {
  superadmin: 'materials/superadmin_materials/',
  admin: 'materials/admin-materials/',
  teacher: 'materials/teacher_materials/',
  school: 'materials/user-materials/',
};
const RECEIPTS_PREFIX = 'receipts/';
const TEACHER_PROFILE_PREFIX_BY_ASSET = {
  // Matches requested bucket path: funtalk-storage/profile-photos/
  profile_photo: 'profile-photos/',
  cv_file: 'teachers/cv-files/',
  intro_audio: 'teachers/audio-intros/',
  intro_video: 'teachers/video-intros/',
};

/**
 * @param {string} userType
 * @returns {string}
 */
export function getMaterialsKeyPrefix(userType) {
  return MATERIAL_PREFIX_BY_USER_TYPE[userType] || MATERIAL_PREFIX_BY_USER_TYPE.teacher;
}

export function isS3Configured() {
  return Boolean(
    config.s3.bucket &&
      config.s3.region &&
      config.s3.accessKeyId &&
      config.s3.secretAccessKey
  );
}

function getS3Client() {
  return new S3Client({
    region: config.s3.region,
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
    },
  });
}

/**
 * Public HTTPS URL for an object key (virtual-hosted–style).
 * @param {string} key
 */
export function getPublicUrlForKey(key) {
  const { bucket, region } = config.s3;
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
}

/**
 * Upload a file from local disk to the role-specific materials prefix.
 * @param {{ localPath: string, userType: string, contentType?: string }} opts
 * @returns {Promise<string>} Public file URL stored in DB
 */
export async function uploadMaterialFileToS3({ localPath, userType, contentType }) {
  const prefix = getMaterialsKeyPrefix(userType);
  const filename = path.basename(localPath);
  const key = `${prefix}${filename}`;
  const body = await readFile(localPath);
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    })
  );

  return getPublicUrlForKey(key);
}

/**
 * Upload a receipt file from local disk to receipts/ prefix.
 * @param {{ localPath: string, contentType?: string }} opts
 * @returns {Promise<string>} Public file URL stored in DB
 */
export async function uploadReceiptFileToS3({ localPath, contentType }) {
  const filename = path.basename(localPath);
  const key = `${RECEIPTS_PREFIX}${filename}`;
  const body = await readFile(localPath);
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    })
  );

  return getPublicUrlForKey(key);
}

/**
 * Upload teacher profile asset to dedicated teachers/* folder.
 * @param {{ localPath: string, assetType: 'profile_photo'|'cv_file'|'intro_audio'|'intro_video', contentType?: string }} opts
 * @returns {Promise<string>}
 */
export async function uploadTeacherProfileFileToS3({ localPath, assetType, contentType }) {
  const prefix = TEACHER_PROFILE_PREFIX_BY_ASSET[assetType] || TEACHER_PROFILE_PREFIX_BY_ASSET.profile_photo;
  const filename = path.basename(localPath);
  const key = `${prefix}${filename}`;
  const body = await readFile(localPath);
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    })
  );

  return getPublicUrlForKey(key);
}

/**
 * Extract S3 object key from our public URL or compatible S3 URLs for this bucket.
 * @param {string} fileUrl
 * @returns {string|null}
 */
export function extractS3KeyFromUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string' || !fileUrl.startsWith('http')) {
    return null;
  }
  try {
    const u = new URL(fileUrl);
    const bucket = config.s3.bucket;
    const host = u.hostname;

    if (host === `${bucket}.s3.${config.s3.region}.amazonaws.com`) {
      return decodeURIComponent(u.pathname.replace(/^\//, ''));
    }

    if (host.startsWith(`${bucket}.s3.`) && host.endsWith('.amazonaws.com')) {
      return decodeURIComponent(u.pathname.replace(/^\//, ''));
    }

    if (host.startsWith('s3.') && u.pathname.includes(`/${bucket}/`)) {
      const after = u.pathname.split(`/${bucket}/`)[1];
      return after ? decodeURIComponent(after) : null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Delete object in our bucket if URL points to this bucket.
 * @param {string} fileUrl
 */
export async function deleteMaterialObjectByUrl(fileUrl) {
  if (!isS3Configured() || !fileUrl) return;
  const key = extractS3KeyFromUrl(fileUrl);
  if (!key) return;

  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
    })
  );
}

function removeLocalUploadFile(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith('/uploads/materials/')) return;
  const name = path.basename(fileUrl);
  const p = path.join(__dirname, '..', 'uploads', 'materials', name);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
}

/**
 * Remove a stored file whether it was local (legacy) or S3.
 * @param {string} fileUrl
 */
export async function removeMaterialFileFromStorage(fileUrl) {
  if (!fileUrl) return;
  if (fileUrl.startsWith('/uploads/materials/')) {
    removeLocalUploadFile(fileUrl);
    return;
  }
  await deleteMaterialObjectByUrl(fileUrl);
}
