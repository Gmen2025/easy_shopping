// Simple Cloudinary signature server (Express)
// Usage:
//   Set environment variables: CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME
//   node scripts/cloudinary_server.js
// Then POST to /sign with optional body { public_id, folder } to receive { signature, api_key, timestamp, cloud_name }

const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;

if (!CLOUDINARY_API_SECRET || !CLOUDINARY_API_KEY || !CLOUDINARY_CLOUD_NAME) {
  console.error('Environment variables missing: CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME');
  process.exit(1);
}

app.post('/sign', (req, res) => {
  // Accept optional params to include in signature (public_id, folder, tags, etc.)
  const allowed = ['public_id', 'folder', 'tags', 'resource_type', 'eager'];
  const paramsToSign = {};
  const body = req.body || {};
  for (const k of Object.keys(body)) {
    if (allowed.includes(k) && body[k] !== undefined && body[k] !== '') {
      paramsToSign[k] = body[k];
    }
  }

  const timestamp = Math.floor(Date.now() / 1000);
  paramsToSign.timestamp = timestamp;

  // Create the string to sign (keys sorted alphabetically)
  const toSign = Object.keys(paramsToSign).sort().map(k => `${k}=${paramsToSign[k]}`).join('&');

  const signature = crypto.createHash('sha1').update(toSign + CLOUDINARY_API_SECRET).digest('hex');

  res.json({
    signature,
    api_key: CLOUDINARY_API_KEY,
    timestamp,
    cloud_name: CLOUDINARY_CLOUD_NAME
  });
});

app.get('/', (_, res) => res.send('Cloudinary signer running'));

app.listen(PORT, () => console.log(`Cloudinary signer listening on ${PORT}`));
