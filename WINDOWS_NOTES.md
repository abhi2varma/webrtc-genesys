# Windows Deployment Notes

This WebRTC system is designed to run on Linux servers using Docker. If you're developing on Windows, here are some important notes:

## Development on Windows

### Prerequisites for Windows Development

1. **Docker Desktop for Windows**
   - Download from: https://www.docker.com/products/docker-desktop
   - Enable WSL 2 backend (recommended)
   - Ensure virtualization is enabled in BIOS

2. **Git for Windows**
   - Ensure line endings are set to LF, not CRLF
   - Run: `git config --global core.autocrlf false`

3. **Text Editor**
   - Use VSCode, Notepad++, or similar with Unix line endings

### Running Shell Scripts on Windows

The shell scripts in `scripts/` are bash scripts meant for Linux. On Windows:

**Option 1: Use Git Bash (Recommended)**
```bash
# Open Git Bash and navigate to project
cd /f/Project/WebRTC

# Run scripts
bash scripts/setup.sh
bash scripts/generate-certs.sh
bash scripts/monitor.sh
```

**Option 2: Use WSL 2 (Best for Development)**
```bash
# In PowerShell, enter WSL
wsl

# Navigate to project (Windows drives are mounted at /mnt/)
cd /mnt/f/Project/WebRTC

# Make scripts executable
chmod +x scripts/*.sh

# Run scripts
./scripts/setup.sh
```

**Option 3: PowerShell Equivalents**

Some commands translated to PowerShell:

```powershell
# View container status
docker-compose ps

# View logs
docker-compose logs -f asterisk

# Start services
docker-compose up -d

# Stop services
docker-compose down

# Enter Asterisk CLI
docker exec -it webrtc-asterisk asterisk -r

# View running containers
docker ps
```

### Line Ending Issues

**Important:** Ensure all configuration files use Unix (LF) line endings, not Windows (CRLF).

```bash
# In Git Bash or WSL, convert line endings if needed
find . -type f \( -name "*.conf" -o -name "*.cfg" -o -name "*.sh" \) -exec dos2unix {} \;
```

### Path Differences

Windows uses backslashes (`\`) while Linux/Docker uses forward slashes (`/`):
- Windows path: `F:\Project\WebRTC`
- Docker/Linux path: `/mnt/f/Project/WebRTC` (in WSL)
- In Docker: `/etc/asterisk`, `/etc/kamailio`, etc.

## Deployment to Production Linux Server

This system is meant to run on a Linux server. To deploy:

### Option 1: Direct Deployment

1. **Set up a Linux server:**
   - Ubuntu 20.04 or 22.04 recommended
   - Minimum: 2 CPU, 4GB RAM
   - Install Docker and Docker Compose

2. **Transfer files:**
```powershell
# Using SCP from PowerShell
scp -r F:\Project\WebRTC user@your-server-ip:/home/user/

# Or use SFTP client like FileZilla or WinSCP
```

3. **On the Linux server:**
```bash
ssh user@your-server-ip
cd /home/user/WebRTC
chmod +x scripts/*.sh
./scripts/setup.sh
```

### Option 2: Git Repository

1. **Initialize Git (if not already):**
```bash
cd F:\Project\WebRTC
git init
git add .
git commit -m "Initial commit"
```

2. **Push to repository:**
```bash
# Add remote (GitHub, GitLab, etc.)
git remote add origin https://github.com/yourusername/webrtc-asterisk.git
git push -u origin main
```

3. **Clone on Linux server:**
```bash
ssh user@your-server-ip
git clone https://github.com/yourusername/webrtc-asterisk.git
cd webrtc-asterisk
chmod +x scripts/*.sh
./scripts/setup.sh
```

### Option 3: Docker Context (Advanced)

Deploy directly from Windows to remote Linux server:

```powershell
# Create Docker context for remote server
docker context create remote --docker "host=ssh://user@your-server-ip"

# Use remote context
docker context use remote

# Deploy
docker-compose up -d

# Switch back to local
docker context use default
```

## Development Workflow

### Testing Locally on Windows

1. **Local Docker testing:**
```powershell
# Start services locally
docker-compose up -d

# Access via localhost (if configured)
# Note: WebRTC may have issues with localhost, use domain/IP
```

2. **Use hosts file for local domain:**
```powershell
# Edit: C:\Windows\System32\drivers\etc\hosts
# Add: 127.0.0.1 your-domain.local
```

3. **Generate local certificates:**
```bash
# In Git Bash
bash scripts/generate-certs.sh development
```

### Configuration Tips

1. **Environment variables in PowerShell:**
```powershell
# Copy example
Copy-Item .env.example .env

# Edit with notepad
notepad .env
```

2. **Editing configuration files:**
```powershell
# Use VSCode
code asterisk/etc/pjsip.conf
code kamailio/kamailio.cfg
```

3. **Viewing logs:**
```powershell
# Real-time logs
docker-compose logs -f

# Specific service
docker-compose logs -f asterisk

# Save to file
docker-compose logs > logs.txt
```

## Common Windows Issues

### Issue: Line endings cause parsing errors

**Solution:**
```bash
# In Git Bash or WSL
dos2unix asterisk/etc/*.conf
dos2unix kamailio/*.cfg
```

### Issue: Volume mount permissions

**Solution:**
- Ensure Docker Desktop has access to your drive (Settings → Resources → File Sharing)
- Restart Docker Desktop if needed

### Issue: Cannot access containers from browser

**Solution:**
```powershell
# Check Docker network
docker network ls
docker network inspect webrtc_default

# Verify containers are running
docker ps

# Test connectivity
curl http://localhost:8088  # Asterisk HTTP
```

### Issue: Port conflicts

**Solution:**
```powershell
# Check what's using ports
netstat -ano | findstr :5060
netstat -ano | findstr :443

# Stop conflicting services or change ports in docker-compose.yml
```

## Production Deployment Checklist

Before deploying to production:

- [ ] All configuration files use Unix line endings (LF)
- [ ] Sensitive data (.env) is not committed to Git
- [ ] Scripts are executable on Linux (`chmod +x scripts/*.sh`)
- [ ] SSL certificates are properly generated
- [ ] Firewall rules are configured on Linux server
- [ ] All placeholders (YOUR_DOMAIN, YOUR_IP) are replaced
- [ ] Genesys credentials are correct
- [ ] Backup strategy is in place

## Useful Windows Commands

```powershell
# Docker management
docker-compose up -d              # Start services
docker-compose down               # Stop services
docker-compose restart asterisk   # Restart service
docker-compose ps                 # List services
docker-compose logs -f            # View logs

# Container interaction
docker exec -it webrtc-asterisk asterisk -r    # Asterisk CLI
docker exec -it webrtc-asterisk /bin/bash      # Shell access
docker exec webrtc-asterisk asterisk -rx "core show channels"

# System maintenance
docker system prune -a            # Clean up Docker
docker volume prune               # Remove unused volumes
docker network prune              # Remove unused networks

# File operations
Get-Content .env                  # View file
Get-ChildItem -Recurse            # List files recursively
Copy-Item -Recurse source dest    # Copy directory
```

## Recommended Tools for Windows

1. **WSL 2** - Best Linux compatibility
2. **Git Bash** - Unix commands on Windows
3. **VSCode** - Code editor with Docker integration
4. **PuTTY** - SSH client for server access
5. **WinSCP** - SFTP/SCP file transfer
6. **Docker Desktop** - Container management

## Additional Resources

- WSL 2 Setup: https://docs.microsoft.com/en-us/windows/wsl/install
- Docker Desktop: https://docs.docker.com/desktop/windows/
- Git for Windows: https://gitforwindows.org/

---

**Note:** For production deployment, always use a proper Linux server. Windows is suitable for development and testing only.




