#!/usr/bin/env bash
# Client-side signed upload example using a server signer
# Usage:
# SIGNER_URL=http://localhost:3000 ./scripts/cloudinary_signed_upload.sh assets/store/image.png public_id=store/image1

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <file> [public_id]"
  exit 1
fi

FILE="$1"
PUBLIC_ID=""
if [ "$#" -ge 2 ]; then
  # second arg can be public_id=value or just the public id string
  if [[ "$2" == public_id=* ]]; then
    PUBLIC_ID="${2#public_id=}"
  else
    PUBLIC_ID="$2"
  fi
fi

SIGNER_URL=${SIGNER_URL:-http://localhost:3000/sign}

echo "Requesting signature from $SIGNER_URL ..."
if [ -n "$PUBLIC_ID" ]; then
  SIG_JSON=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"public_id\": \"${PUBLIC_ID}\"}" "$SIGNER_URL")
else
  SIG_JSON=$(curl -s -X POST "$SIGNER_URL")
fi

API_KEY=$(echo "$SIG_JSON" | jq -r .api_key)
TIMESTAMP=$(echo "$SIG_JSON" | jq -r .timestamp)
SIGNATURE=$(echo "$SIG_JSON" | jq -r .signature)
CLOUD_NAME=$(echo "$SIG_JSON" | jq -r .cloud_name)

if [ -z "$API_KEY" ] || [ -z "$TIMESTAMP" ] || [ -z "$SIGNATURE" ] || [ -z "$CLOUD_NAME" ]; then
  echo "Invalid response from signer: $SIG_JSON"
  exit 1
fi

echo "Uploading $FILE to Cloudinary (cloud: $CLOUD_NAME) ..."

curl -s -X POST "https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload" \
  -F "file=@${FILE}" \
  -F "api_key=${API_KEY}" \
  -F "timestamp=${TIMESTAMP}" \
  -F "signature=${SIGNATURE}" \
  ${PUBLIC_ID:+-F "public_id=${PUBLIC_ID}"} | jq -r .secure_url
