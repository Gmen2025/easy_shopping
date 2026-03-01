# PowerShell script to upload image(s) to Cloudinary using unsigned upload preset
# Usage: $env:CLOUD_NAME='your_cloud'; $env:UPLOAD_PRESET='your_preset'; .\cloudinary_upload.ps1 -Files .\image1.png, .\image2.jpg

param(
    [Parameter(Mandatory=$true)][string[]]$Files
)

if (-not $env:CLOUD_NAME -or -not $env:UPLOAD_PRESET) {
    Write-Error "Please set environment variables CLOUD_NAME and UPLOAD_PRESET"
    exit 1
}

foreach ($file in $Files) {
    if (-not (Test-Path $file)) {
        Write-Warning "File not found: $file"
        continue
    }
    Write-Host "Uploading $file..."
    $uri = "https://api.cloudinary.com/v1_1/$($env:CLOUD_NAME)/image/upload"
    $form = @{
        file = Get-Item $file
        upload_preset = $env:UPLOAD_PRESET
    }
    try {
        $response = Invoke-RestMethod -Uri $uri -Method Post -Form $form
        if ($response.secure_url) { Write-Host $response.secure_url } else { Write-Host ($response | ConvertTo-Json) }
    } catch {
        Write-Error $_.Exception.Message
    }
}
