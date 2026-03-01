// Simple Cloudinary signature server (Express)
// Usage:
//   Set environment variables: CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME
//   node scripts/cloudinary_server.js
// Then POST to /sign with optional body { public_id, folder } to receive { signature, api_key, timestamp, cloud_name }

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
app.use(express.json());

// Multer memory storage for multipart uploads
const upload = multer({ storage: multer.memoryStorage() });

// Allow cross-origin requests from mobile apps during development
app.use(cors());

const PORT = process.env.PORT || 3000;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;

if (!CLOUDINARY_API_SECRET || !CLOUDINARY_API_KEY || !CLOUDINARY_CLOUD_NAME) {
  console.error('Environment variables missing: CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME');
  process.exit(1);
}

// Configure cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

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

// Server-side signed upload: accepts multipart/form-data with field `file`.
// Optional form fields: public_id, folder, resource_type
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { public_id, folder, resource_type } = req.body || {};

    const uploadOptions = {};
    if (public_id) uploadOptions.public_id = public_id;
    if (folder) uploadOptions.folder = folder;
    if (resource_type) uploadOptions.resource_type = resource_type; // e.g., 'image' or 'video'

    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
          if (result) resolve(result);
          else reject(error);
        });
        stream.end(buffer);
      });
    };

    const result = await streamUpload(req.file.buffer);
    return res.json({
      secure_url: result.secure_url,
      public_id: result.public_id,
      raw: result,
    });
  } catch (err) {
    console.error('Upload error', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// Server-side base64 upload endpoint
// Accepts JSON: { data: "data:image/png;base64,...." OR base64 string, public_id, folder }
app.post('/upload_base64', async (req, res) => {
  try {
    const body = req.body || {};
    const data = body.data || body.base64 || '';
    if (!data) return res.status(400).json({ error: 'No base64 data provided in `data` or `base64` field' });

    // Strip data URL prefix if present
    const match = data.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    let base64String = data;
    if (match) {
      base64String = match[2];
    }

    const buffer = Buffer.from(base64String, 'base64');

    const { public_id, folder, resource_type } = body;
    const uploadOptions = {};
    if (public_id) uploadOptions.public_id = public_id;
    if (folder) uploadOptions.folder = folder;
    if (resource_type) uploadOptions.resource_type = resource_type;

    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
          if (result) resolve(result);
          else reject(error);
        });
        stream.end(buffer);
      });
    };

    const result = await streamUpload(buffer);
    return res.json({ secure_url: result.secure_url, public_id: result.public_id, raw: result });
  } catch (err) {
    console.error('Base64 upload error', err);
    return res.status(500).json({ error: err.message || 'Base64 upload failed' });
  }
});

app.get('/', (_, res) => res.send('Cloudinary signer running'));

app.listen(PORT, () => console.log(`Cloudinary signer listening on ${PORT}`));
