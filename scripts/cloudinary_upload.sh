#!/bin/bash
# Upload image(s) to Cloudinary using unsigned upload preset
# Usage: CLOUD_NAME=your_cloud_name UPLOAD_PRESET=your_preset ./cloudinary_upload.sh /path/to/image1.png /path/to/image2.jpg

if [ -z "$CLOUD_NAME" ] || [ -z "$UPLOAD_PRESET" ]; then
  echo "Missing CLOUD_NAME or UPLOAD_PRESET environment variables."
  echo "Example: CLOUD_NAME=demo UPLOAD_PRESET=unsigned_preset ./cloudinary_upload.sh image.png"
  exit 1
fi

if [ "$#" -lt 1 ]; then
  echo "Provide at least one image file path"
  exit 1
fi

for file in "$@"; do
  if [ ! -f "$file" ]; then
    echo "File not found: $file"
    continue
  fi

  echo "Uploading $file..."
  response=$(curl -s -X POST "https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload" \
    -F "file=@${file}" \
    -F "upload_preset=${UPLOAD_PRESET}")

  echo "$response" | jq -r '.secure_url // .url // .error.message'
done
