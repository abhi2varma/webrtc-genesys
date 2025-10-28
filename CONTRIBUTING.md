# Contributing to Asterisk WebRTC Genesys

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## 🎯 Ways to Contribute

- 🐛 Report bugs
- 💡 Suggest new features
- 📝 Improve documentation
- 🔧 Submit code fixes
- ✅ Add tests
- 🌍 Translate to other languages

## 🐛 Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Description:** Clear and concise description
- **Steps to reproduce:** Numbered steps
- **Expected behavior:** What should happen
- **Actual behavior:** What actually happens
- **Environment:**
  - OS version
  - Docker version
  - Asterisk version
  - Browser version
- **Logs:** Relevant error messages
- **Screenshots:** If applicable

## 💡 Suggesting Features

Feature requests are welcome! Please include:

- **Use case:** Why is this feature needed?
- **Description:** What should it do?
- **Examples:** How would it work?
- **Alternatives:** What alternatives have you considered?

## 🔧 Pull Requests

### Process

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Make** your changes
4. **Test** thoroughly
5. **Commit** with clear messages: `git commit -m 'Add feature X'`
6. **Push** to your fork: `git push origin feature/my-feature`
7. **Submit** a Pull Request

### Guidelines

- Follow existing code style
- Update documentation
- Add comments for complex code
- Test on CentOS and Ubuntu
- Keep changes focused
- One feature per PR

### Commit Messages

Use clear, descriptive commit messages:

```
Good:
- "Add WebRTC video support"
- "Fix SIP registration timeout issue"
- "Update Genesys integration docs"

Bad:
- "fix bug"
- "update"
- "changes"
```

## 📝 Documentation

- Use markdown format
- Include code examples
- Add screenshots where helpful
- Keep language clear and simple
- Test all commands/instructions

## 🧪 Testing

Before submitting:

- Test on a clean installation
- Verify with Genesys integration
- Check all documentation links
- Test different browsers (Chrome, Firefox, Edge)
- Verify Docker containers start correctly

## 📋 Code Style

### Bash Scripts

```bash
#!/bin/bash
# Clear comment explaining purpose

set -e  # Exit on error

# Use meaningful variable names
SERVER_IP="192.168.1.100"

# Add comments for complex sections
# This function checks if Docker is installed
check_docker() {
    command -v docker >/dev/null 2>&1
}
```

### JavaScript

```javascript
// Use JSDoc comments
/**
 * Register SIP endpoint
 * @param {string} dn - Agent DN number
 * @param {string} password - SIP password
 */
function registerEndpoint(dn, password) {
    // Implementation
}
```

### Configuration Files

```ini
; Add comments explaining non-obvious settings
[endpoint]
type=endpoint
; This enables WebRTC support
webrtc=yes
```

## 🤝 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the project

## ❓ Questions?

- Open an issue for questions
- Join discussions on GitHub
- Check existing documentation first

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🙏

