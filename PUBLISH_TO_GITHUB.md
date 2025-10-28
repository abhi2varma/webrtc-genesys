# Publishing to GitHub

## Repository
`git@github.com:abhi2varma/webrtc-genesys.git`

## Quick Publish Commands

```bash
# 1. Initialize Git (if not already done)
git init

# 2. Add all files
git add .

# 3. Create initial commit
git commit -m "Initial commit: Asterisk WebRTC with Genesys SIP Endpoint integration"

# 4. Add remote repository
git remote add origin git@github.com:abhi2varma/webrtc-genesys.git

# 5. Push to GitHub
git branch -M main
git push -u origin main
```

## Before Publishing

Make sure you have:
- ✅ Created the repository on GitHub: https://github.com/abhi2varma/webrtc-genesys
- ✅ Set up SSH key authentication with GitHub
- ✅ Reviewed `.gitignore` to ensure no sensitive data is committed

## What Gets Published

✅ **Included:**
- All source code and configurations
- Documentation files
- Setup scripts
- Docker compose files
- Example configurations

❌ **Excluded (.gitignore):**
- `.env` files (sensitive credentials)
- SSL certificates and keys
- Log files
- Database files
- PDF documentation (large files)
- Backup files

## After Publishing

1. Go to: https://github.com/abhi2varma/webrtc-genesys
2. Update repository description
3. Add topics/tags: `webrtc`, `asterisk`, `genesys`, `docker`, `sip`, `voip`
4. Update README-GITHUB.md with your repository URL
5. Enable GitHub Issues and Discussions

## Subsequent Updates

```bash
# Make changes
git add .
git commit -m "Description of changes"
git push
```

