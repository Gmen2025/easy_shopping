Cloudinary Upload Scripts

This folder contains simple scripts to upload images to Cloudinary using an unsigned upload preset.

Requirements
- `curl` and `jq` for the bash script (Linux/macOS/Windows with WSL or Git Bash)
- PowerShell (Windows) for the `.ps1` script
- A Cloudinary account with an upload preset configured as unsigned (or use signed server-side uploads)

Create an unsigned upload preset:
1. Sign in to Cloudinary dashboard.
2. Go to Settings → Upload → Upload Presets.
3. Create a new preset and set "Unsigned" to ON.
4. Note your `cloud name` and the `upload preset` name.

Usage (bash)
```bash
# from repo root
CLOUD_NAME=your_cloud_name UPLOAD_PRESET=your_preset ./scripts/cloudinary_upload.sh assets/store/image1.png
```

Usage (PowerShell)
```powershell
$env:CLOUD_NAME = "your_cloud_name"
$env:UPLOAD_PRESET = "your_preset"
.
\scripts\cloudinary_upload.ps1 -Files "assets\store\image1.png","assets\store\image2.png"
```

Notes
- The scripts perform unsigned uploads and return the `secure_url` for each uploaded image.
- For production, consider implementing signed uploads from your backend to keep API credentials private.
- Cloudinary supports many transformations; you can request resized/optimized URLs directly via Cloudinary URL APIs.

Example cURL response parsing (bash)
- The bash script uses `jq` to extract `secure_url`. Install `jq` if missing.

Alternative: Server-side signed upload
- If you prefer signed uploads, implement a small backend endpoint that creates the signature using your Cloudinary API secret and accepts file uploads.
  
Signed uploads (recommended for production)
-----------------------------------------

Use a server-side signer to keep your `CLOUDINARY_API_SECRET` private. The repo contains two helper scripts:

- `scripts/cloudinary_server.js` — a minimal Express signer endpoint (`POST /sign`) that returns a JSON payload `{ signature, api_key, timestamp, cloud_name }` for the client to use. It reads these environment variables:
	- `CLOUDINARY_API_KEY`
	- `CLOUDINARY_API_SECRET`
	- `CLOUDINARY_CLOUD_NAME`

- `scripts/cloudinary_signed_upload.sh` — client-side bash script that requests a signature from the signer and uploads the file to Cloudinary with the signed parameters. It depends on `jq`.

Quick start (signed uploads)
1. Deploy the signer (for local testing you can run it locally):

```bash
# from repo root
# install dependencies for the signer
npm install express

# set env vars (example)
export CLOUDINARY_API_KEY=your_api_key
export CLOUDINARY_API_SECRET=your_api_secret
export CLOUDINARY_CLOUD_NAME=your_cloud_name

# run the signer
node scripts/cloudinary_server.js
```

2. Upload a file using the signed client script (requires `jq`):

```bash
SIGNER_URL=http://localhost:3000 ./scripts/cloudinary_signed_upload.sh assets/store/image.png public_id=store/image1
```

The script will print the `secure_url` on success.

Security notes
- Never embed `CLOUDINARY_API_SECRET` in client code or publish it.
- For production, host the signer behind your authenticated backend and only allow authorized clients to request signatures.
- For advanced use (transformations, eager processing) include the same parameters when signing on the server (e.g. `eager`, `folder`).

- Use the official Cloudinary SDKs for server-side uploads.
