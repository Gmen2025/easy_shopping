/**
 * Shared/CloudinaryUploader.js
 *
 * React Native helper for direct Cloudinary uploads using a server-side signature.
 * Usage:
 * 1) Call `getSignature(serverUrl, params)` to get `{ signature, api_key, timestamp, cloud_name }` from your signer.
 * 2) Call `uploadToCloudinary(localUri, signatureResp, options)` to upload the file directly to Cloudinary.
 *
 * Also supports `uploadWithProgress` using XMLHttpRequest for progress callbacks.
 */

async function getSignature(serverUrl, params = {}, options = {}) {
  const normalized = (serverUrl || '').replace(/\/$/, '');
  const primaryUrl = normalized.endsWith('/sign') ? normalized : `${normalized}/sign`;
  const urls = [primaryUrl];

  if (primaryUrl.endsWith('/api/v1/sign')) {
    urls.push(primaryUrl.replace(/\/api\/v1\/sign$/, '/sign'));
  } else if (primaryUrl.endsWith('/sign') && !primaryUrl.includes('/api/v1/')) {
    urls.push(primaryUrl.replace(/\/sign$/, '/api/v1/sign'));
  }

  const uniqueUrls = [...new Set(urls)];
  const headers = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  let lastError;
  for (let index = 0; index < uniqueUrls.length; index += 1) {
    const url = uniqueUrls[index];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });

      if (res.ok) {
        return await res.json();
      }

      const text = await res.text();
      lastError = new Error(`Signature request failed: ${res.status} ${text}`);

      const hasFallback = index < uniqueUrls.length - 1;
      if (!(res.status === 404 && hasFallback)) {
        throw lastError;
      }
    } catch (err) {
      lastError = err;
      const hasFallback = index < uniqueUrls.length - 1;
      if (!hasFallback) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Signature request failed');
}

async function uploadToCloudinary(localUri, signatureResp, options = {}) {
  const { api_key, signature, timestamp, cloud_name } = signatureResp || {};
  if (!cloud_name) throw new Error('cloud_name missing from signature response');

  const resource_type = options.resource_type || 'image';
  const url = `https://api.cloudinary.com/v1_1/${cloud_name}/${resource_type}/upload`;

  const form = new FormData();
  form.append('file', {
    uri: localUri,
    name: options.fileName || 'photo.jpg',
    type: options.fileType || 'image/jpeg',
  });

  form.append('api_key', api_key);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);

  if (options.public_id) form.append('public_id', options.public_id);
  if (options.folder) form.append('folder', options.folder);
  if (options.upload_preset) form.append('upload_preset', options.upload_preset);

  if (options.extraParams) {
    Object.keys(options.extraParams).forEach((k) => {
      if (options.extraParams[k] !== undefined) form.append(k, options.extraParams[k]);
    });
  }

  // Try fetch first; if that fails (network error), fall back to XMLHttpRequest
  try {
    const res = await fetch(url, { method: 'POST', body: form });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text || '{}'); } catch (e) { json = { raw: text }; }
    if (!res.ok) throw new Error(`Cloudinary upload failed: ${res.status} ${text}`);
    return json;
  } catch (fetchErr) {
    // Fallback to XHR (can be more reliable for binary/form uploads on some RN setups)
    return await new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.onload = () => {
          const ok = xhr.status >= 200 && xhr.status < 300;
          let resp = {};
          try { resp = JSON.parse(xhr.responseText || '{}'); } catch (e) { resp = { raw: xhr.responseText }; }
          if (ok) resolve(resp);
          else reject(new Error(`Cloudinary upload failed (XHR): ${xhr.status} ${xhr.responseText}`));
        };
        xhr.onerror = () => reject(new Error(`Network error during Cloudinary upload (XHR)`));
        xhr.send(form);
      } catch (xhrErr) {
        reject(new Error(`Upload failed: ${fetchErr.message}; XHR fallback error: ${xhrErr.message}`));
      }
    });
  }
}

function uploadWithProgress(localUri, signatureResp, options = {}, onProgress, onComplete, onError) {
  const { api_key, signature, timestamp, cloud_name } = signatureResp || {};
  if (!cloud_name) throw new Error('cloud_name missing from signature response');

  const resource_type = options.resource_type || 'image';
  const url = `https://api.cloudinary.com/v1_1/${cloud_name}/${resource_type}/upload`;

  const form = new FormData();
  form.append('file', {
    uri: localUri,
    name: options.fileName || 'photo.jpg',
    type: options.fileType || 'image/jpeg',
  });
  form.append('api_key', api_key);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  if (options.public_id) form.append('public_id', options.public_id);
  if (options.folder) form.append('folder', options.folder);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', url);
  xhr.onload = () => {
    const ok = xhr.status >= 200 && xhr.status < 300;
    let resp = {};
    try { resp = JSON.parse(xhr.responseText || '{}'); } catch (e) { resp = { raw: xhr.responseText }; }
    if (ok) onComplete && onComplete(resp);
    else onError && onError(resp);
  };
  xhr.onerror = () => onError && onError(new Error('Network error'));
  if (xhr.upload && typeof onProgress === 'function') {
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
  }
  xhr.send(form);
  return xhr;
}

export default {
  getSignature,
  uploadToCloudinary,
  uploadWithProgress,
};

/* Example usage:

import CloudinaryUploader from '../Shared/CloudinaryUploader';

// 1) request signature from your server
const sig = await CloudinaryUploader.getSignature('https://your-server.com', { folder: 'mobile_uploads' });

// 2) upload file (localUri from ImagePicker / camera)
const res = await CloudinaryUploader.uploadToCloudinary(localUri, sig, { folder: 'mobile_uploads' });

// 3) or upload with progress
CloudinaryUploader.uploadWithProgress(localUri, sig, {},
  (pct) => console.log('progress', pct),
  (result) => console.log('done', result),
  (err) => console.error('err', err)
);

*/
