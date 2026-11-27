// Delete only orphaned ImageKit product files. Preview without --apply.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z][A-Z0-9_]*=/.test(line))
  .map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
if (env.FIREBASE_ADMIN_PROJECT_ID !== 'brothersoutfitgallary' || !env.IMAGEKIT_PRIVATE_KEY) throw new Error('Expected Firebase project and ImageKit key are required.');
initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) });
const db = getFirestore();
const headers = { Authorization: `Basic ${Buffer.from(`${env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64')}` };

async function references() {
  const [products, settings] = await Promise.all([db.collection('products').get(), db.collection('settings').get()]);
  return JSON.stringify([...products.docs, ...settings.docs].map(doc => doc.data()));
}

function isUsed(file, refs) {
  return refs.includes(file.fileId) || refs.includes(String(file.url || '').split('?')[0]);
}

async function listFiles() {
  const files = [];
  for (let skip = 0; skip < 10000; skip += 100) {
    const response = await fetch(`https://api.imagekit.io/v1/files?skip=${skip}&limit=100`, { headers });
    if (!response.ok) throw new Error(`ImageKit list failed (${response.status}).`);
    const page = await response.json();
    files.push(...page);
    if (page.length < 100) return files;
  }
  throw new Error('ImageKit listing exceeded the safety limit.');
}

async function deleteFile(file) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(file.fileId)}`, { method: 'DELETE', headers });
    if (response.ok || response.status === 404) return;
    if (response.status !== 429 && response.status < 500) throw new Error(`Delete failed (${response.status}) for ${file.fileId}.`);
    await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1500));
  }
  throw new Error(`Delete retries exhausted for ${file.fileId}.`);
}

const files = await listFiles();
let refs = await references();
const orphans = files.filter(file => file.fileId && String(file.filePath || '').startsWith('/products/') && !isUsed(file, refs));
console.log(JSON.stringify({ imageKitFiles: files.length, orphanProductFiles: orphans.length, retained: files.length - orphans.length }));
if (process.argv.includes('--apply')) {
  let deleted = 0;
  for (let i = 0; i < orphans.length; i += 1) {
    if (i % 25 === 0) refs = await references();
    if (isUsed(orphans[i], refs)) continue;
    await deleteFile(orphans[i]);
    deleted += 1;
    if (deleted % 25 === 0) console.log(`Deleted ${deleted}/${orphans.length} orphan files`);
  }
  console.log(JSON.stringify({ deleted, remaining: (await listFiles()).length }));
}
