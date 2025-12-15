# GitHub Pages Setup Guide for Privacy Policy

This guide will help you host your Privacy Policy on GitHub Pages for free.

---

## Option 1: Quick Setup (Using This Repository)

### Step 1: Enable GitHub Pages

1. Go to your GitHub repository
2. Click **Settings** (top right)
3. Scroll down to **Pages** (left sidebar)
4. Under **Source**, select:
   - Branch: `main` (or `master`)
   - Folder: `/ (root)`
5. Click **Save**

### Step 2: Create an HTML Version

Create a file named `privacy.html` in the root directory:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - AdduGenet EShop</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1 { color: #8a6c09; border-bottom: 3px solid #8a6c09; padding-bottom: 10px; }
        h2 { color: #8a6c09; margin-top: 30px; }
        h3 { color: #666; }
        a { color: #8a6c09; }
        code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
        .last-updated { color: #666; font-style: italic; }
        .contact-box {
            background: #f9f9f9;
            border-left: 4px solid #8a6c09;
            padding: 15px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <!-- Copy your PRIVACY_POLICY.md content here, converted to HTML -->
    <!-- You can use an online converter: https://markdowntohtml.com/ -->
</body>
</html>
```

### Step 3: Convert Markdown to HTML

**Option A: Online Converter**
1. Go to https://markdowntohtml.com/
2. Copy content from `PRIVACY_POLICY.md`
3. Paste and convert
4. Copy the HTML output
5. Paste into `privacy.html` (inside `<body>` tags)

**Option B: Using VSCode Extension**
1. Install "Markdown Preview Enhanced" extension
2. Open `PRIVACY_POLICY.md`
3. Right-click → "Markdown Preview Enhanced: HTML"
4. Copy the generated HTML

### Step 4: Commit and Push

```bash
git add privacy.html
git commit -m "Add privacy policy page"
git push origin main
```

### Step 5: Access Your Page

Your privacy policy will be available at:
```
https://[your-username].github.io/[repository-name]/privacy.html
```

Example: `https://johndoe.github.io/easy_shopping/privacy.html`

### Step 6: Update app.json

```json
"privacy": {
  "url": "https://[your-username].github.io/[repository-name]/privacy.html"
}
```

---

## Option 2: Separate Privacy Policy Repository

### Step 1: Create New Repository

1. Go to GitHub → Click **New Repository**
2. Name: `privacy-policy` or `addugenet-privacy`
3. Set to **Public**
4. Check "Add a README file"
5. Click **Create repository**

### Step 2: Add Privacy Policy

1. Click **Add file** → **Create new file**
2. Name it: `index.html`
3. Paste your HTML-converted privacy policy
4. Commit

### Step 3: Enable GitHub Pages

1. Go to **Settings** → **Pages**
2. Source: `main` branch, `/ (root)` folder
3. Save

### Step 4: Access URL

Your page will be at:
```
https://[your-username].github.io/privacy-policy/
```

Much cleaner URL!

---

## Option 3: Using GitHub Gist (Simplest)

### Step 1: Create a Gist

1. Go to https://gist.github.com/
2. Click **New Gist**
3. Filename: `privacy-policy.md`
4. Paste your privacy policy content
5. Select **Public**
6. Click **Create public gist**

### Step 2: Get Raw URL

1. Click **Raw** button (top right)
2. Copy the URL (looks like: `https://gist.githubusercontent.com/...`)

### Step 3: Use RawGit or Similar

Visit: https://raw.githack.com/
Paste your raw gist URL to get a proper HTML link

**Note**: Gist is quick but less professional. GitHub Pages is recommended.

---

## Option 4: Custom Domain (Professional)

If you own a domain (e.g., addugenet.com):

### Step 1: Set Up GitHub Pages

Follow Option 1 or 2 above

### Step 2: Configure Custom Domain

1. In your repository's **Settings** → **Pages**
2. Under **Custom domain**, enter: `www.addugenet.com`
3. Click **Save**

### Step 3: Update DNS Records

Add a CNAME record in your domain registrar:
```
Type: CNAME
Name: www
Value: [your-username].github.io
```

### Step 4: Access at Custom Domain

Your privacy policy will be at:
```
https://www.addugenet.com/privacy.html
```

---

## Testing Your Privacy Policy Page

Before submitting to App Store:

1. **Check Accessibility**
   - Open the URL in a browser
   - Verify it loads without login
   - Test on mobile devices

2. **Verify Content**
   - All sections are visible
   - Links work correctly
   - Formatting is proper

3. **HTTPS Check**
   - GitHub Pages automatically uses HTTPS
   - Verify URL starts with `https://`

---

## Troubleshooting

### Page Not Loading (404 Error)

**Wait 5-10 minutes** - GitHub Pages takes time to build

**Check Branch Name**: Ensure you selected the correct branch

**File Name**: If using index.html, access the root URL directly

### HTML Not Rendering Properly

- Ensure HTML is valid (use https://validator.w3.org/)
- Check all opening tags have closing tags
- Verify CSS is included

### Can't Find Pages Settings

- Ensure repository is **Public**
- Check you have admin access
- Try refreshing the Settings page

---

## Quick Start Commands

```bash
# Clone your repository
git clone https://github.com/[username]/[repo-name].git
cd [repo-name]

# Create HTML file
# (paste your converted HTML content)
nano privacy.html

# Commit and push
git add privacy.html
git commit -m "Add privacy policy"
git push origin main

# Access at:
# https://[username].github.io/[repo-name]/privacy.html
```

---

## Recommended Approach for AdduGenet

**Best Option**: Option 1 (Using existing repository)

**URL Structure**: 
```
https://[your-username].github.io/easy_shopping/privacy.html
```

**Why**:
- No additional repository needed
- Easy to maintain with your app code
- Professional appearance
- Free SSL certificate
- Fast setup (< 30 minutes)

---

## Next Steps

1. ✅ Convert PRIVACY_POLICY.md to HTML
2. ✅ Upload to GitHub and enable Pages
3. ✅ Get your public URL
4. ✅ Update app.json with the URL
5. ✅ Test the URL in a browser
6. ✅ Proceed with App Store submission

---

## Need Help?

If you encounter issues:
- Check GitHub Pages documentation: https://pages.github.com/
- Verify repository is public
- Ensure you have a valid GitHub account
- Wait 5-10 minutes after enabling Pages

---

*Once your privacy policy is live, you're one step closer to App Store submission!*
