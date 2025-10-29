# GitHub SSH Setup

## Issue
`Permission denied (publickey)` - Your SSH key needs to be added to GitHub.

## Solution: Two Options

### Option 1: Use HTTPS (Quick & Easy)

```bash
# Remove SSH remote
git remote remove origin

# Add HTTPS remote instead
git remote add origin https://github.com/abhi2varma/webrtc-genesys.git

# Push (will prompt for GitHub credentials)
git push -u origin main
```

### Option 2: Set Up SSH Key (Recommended)

#### Step 1: Generate SSH Key

```bash
# Generate new SSH key
ssh-keygen -t ed25519 -C "your-email@example.com"

# When prompted:
# - File location: Press Enter (use default)
# - Passphrase: Press Enter twice (no passphrase, or create one)
```

#### Step 2: Copy Your Public Key

**Windows PowerShell:**
```powershell
Get-Content $HOME\.ssh\id_ed25519.pub | Set-Clipboard
```

**OR manually:**
```powershell
notepad $HOME\.ssh\id_ed25519.pub
# Copy the entire content (starts with ssh-ed25519)
```

#### Step 3: Add Key to GitHub

1. Go to: https://github.com/settings/keys
2. Click: **"New SSH key"**
3. Title: `My Windows PC`
4. Key type: `Authentication Key`
5. Paste the key from your clipboard
6. Click: **"Add SSH key"**

#### Step 4: Test Connection

```bash
ssh -T git@github.com
# Should see: "Hi abhi2varma! You've successfully authenticated..."
```

#### Step 5: Push to GitHub

```bash
git push -u origin main
```

## Quick Decision

**Use HTTPS if:**
- ✅ You want to push RIGHT NOW
- ✅ Don't mind entering password/token each time
- ✅ Quick one-time setup

**Use SSH if:**
- ✅ You'll push frequently
- ✅ Want passwordless access
- ✅ More secure for automation

## GitHub Personal Access Token (for HTTPS)

If HTTPS asks for password:
1. Go to: https://github.com/settings/tokens
2. Generate new token (classic)
3. Select: `repo` scope
4. Use token as password

---

**Recommendation:** Use HTTPS now to publish quickly, set up SSH later for convenience.


