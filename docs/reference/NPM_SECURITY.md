# NPM Security - Supply Chain Protection

**Priority:** 🔴 CRITICAL
**Created:** 2025-11-03
**Status:** Active
**Applies To:** All implementation phases
**Recommended Package Manager:** pnpm v10+

## Overview

In September 2025, the npm ecosystem experienced one of the most significant supply chain attacks in its history, compromising 187+ packages with over 2.6 billion weekly downloads. This document provides guidance for securing package installations throughout the project lifecycle.

**Key Security Decision:** This project uses **pnpm v10+** instead of npm for enhanced security:
- ✅ Postinstall scripts disabled by default (prevents malicious code execution)
- ✅ `minimumReleaseAge` feature (waits before installing newly published packages)
- ✅ Would have prevented the September 2025 supply chain attack
- ✅ Better disk space efficiency and faster installations

---

## September 2025 NPM Supply Chain Attack

### Timeline

**September 8, 2025 (~9:00 AM EST)**
- Threat actor compromised npm maintainer account "Qix" via phishing
- Malicious versions of 20+ popular packages published
- Malicious code live for approximately 2 hours
- Packages included: `debug`, `chalk`, `ansi-styles`, `strip-ansi`, and 16 others

**September 14, 2025**
- "Shai-Hulud" self-replicating worm discovered
- Worm compromised 500+ additional packages
- Targeted GitHub PATs, AWS keys, GCP credentials, Azure tokens

**September 23, 2025**
- CISA issued official alert
- npm removed all compromised packages
- GitHub implemented enhanced security measures

### Attack Vector

1. **Phishing Email:** Maintainer received fake 2FA reset email from `npmjs.help` (fake domain)
2. **Account Compromise:** Attacker gained access to maintainer's npm account
3. **Malicious Publication:** Published compromised versions of popular packages
4. **Credential Harvesting:** Malicious code scanned for API keys and credentials
5. **Cryptocurrency Theft:** Intercepted Web3 wallet transactions

### Compromised Packages - Complete List

#### Initial Wave (September 8, 2025)

| Package | Malicious Version | Weekly Downloads | Risk Level |
|---------|------------------|------------------|------------|
| debug | 4.4.2 | 500M+ | CRITICAL |
| chalk | 5.6.1 | 400M+ | CRITICAL |
| ansi-styles | 6.2.2 | 300M+ | HIGH |
| strip-ansi | 7.1.1 | 250M+ | HIGH |
| color | 5.0.1 | 50M+ | HIGH |
| color-convert | 3.1.1 | 200M+ | HIGH |
| color-name | 2.0.1 | 200M+ | HIGH |
| color-string | 2.1.1 | 40M+ | MEDIUM |
| has-ansi | 6.0.1 | 100M+ | MEDIUM |
| ansi-regex | 6.2.1 | 200M+ | HIGH |
| supports-color | 10.2.1 | 300M+ | HIGH |
| backslash | 0.2.1 | 5M+ | LOW |
| wrap-ansi | 9.0.1 | 150M+ | HIGH |
| is-arrayish | 0.3.3 | 100M+ | MEDIUM |
| error-ex | 1.3.3 | 50M+ | MEDIUM |
| slice-ansi | 7.1.1 | 40M+ | MEDIUM |
| simple-swizzle | 0.2.3 | 30M+ | LOW |
| chalk-template | 1.1.1 | 20M+ | LOW |
| supports-hyperlinks | 4.1.1 | 10M+ | LOW |

#### Second Wave (September 9, 2025)

| Package | Malicious Version | Weekly Downloads | Risk Level |
|---------|------------------|------------------|------------|
| duckdb | 1.3.3 | 1M+ | HIGH |
| @duckdb/node-api | 1.3.3 | 500K+ | MEDIUM |
| @duckdb/node-bindings | 1.3.3 | 500K+ | MEDIUM |
| @duckdb/duckdb-wasm | 1.29.2 | 100K+ | MEDIUM |
| proto-tinker-wc | 0.1.87 | <10K | LOW |
| @coveops/abi | 2.0.1 | <5K | LOW |

**Additional:** 500+ packages compromised by Shai-Hulud worm (full list available from npm registry)

---

## Impact on Project Dependencies

### Core Backend Dependencies

The following packages are used throughout the project implementation:

| Package | Status | Notes |
|---------|--------|-------|
| express | ⚠️ Indirect | Depends on `debug` (transitive dependency) |
| cors | ✅ Safe | No compromised dependencies |
| helmet | ✅ Safe | No compromised dependencies |
| dotenv | ✅ Safe | No compromised dependencies |
| @anthropic-ai/sdk | ⚠️ Unknown | May depend on compromised packages |
| pg | ✅ Safe | No compromised dependencies |
| ioredis | ⚠️ Indirect | May depend on `debug` |
| bcrypt | ✅ Safe | No compromised dependencies |
| jsonwebtoken | ✅ Safe | No compromised dependencies |
| zod | ✅ Safe | No compromised dependencies |
| rate-limiter-flexible | ✅ Safe | No compromised dependencies |
| typescript | ⚠️ Indirect | May depend on `chalk` for CLI output |
| tsx | ⚠️ Indirect | May depend on compromised packages |

### Testing Dependencies

| Package | Status | Notes |
|---------|--------|-------|
| jest | ⚠️ Indirect | Depends on `chalk`, `ansi-styles` |
| supertest | ⚠️ Indirect | Depends on `debug` |
| artillery | ⚠️ Unknown | May use compromised packages |

### Key Risk: Transitive Dependencies

Even though we're not directly installing `debug` or `chalk`, many packages depend on them. Example dependency chain:

```
express → debug@4.4.2 (COMPROMISED)
jest → chalk@5.6.1 (COMPROMISED)
jest → ansi-styles@6.2.2 (COMPROMISED)
```

---

## Why pnpm v10+ is More Secure

### Security Features (November 2025)

**1. Postinstall Scripts Disabled by Default**

pnpm v10 (released September 2025) disables postinstall scripts by default in response to the Rspack/npm supply chain attacks:

```bash
# With npm (INSECURE):
npm install malicious-package
# ❌ Postinstall script runs automatically, can steal credentials

# With pnpm v10+ (SECURE):
pnpm install malicious-package
# ✅ Postinstall script blocked by default
# Only runs if explicitly added to trustedDependencies
```

**2. minimumReleaseAge Protection**

pnpm can wait before installing newly published packages, preventing zero-day supply chain attacks:

```ini
# .npmrc
minimum-release-age=4320  # Wait 3 days (4320 minutes)
```

If a malicious version is published, it's usually discovered and removed within hours/days. By waiting 3 days, you avoid installing compromised packages entirely.

**3. Better Isolation**

pnpm uses a content-addressable store with hard links, making it harder for malicious packages to access files outside their scope.

### Comparison with npm

| Feature | npm | pnpm v10+ |
|---------|-----|-----------|
| Postinstall scripts | ✅ Run by default | ❌ Blocked by default |
| minimumReleaseAge | ❌ Not available | ✅ Available |
| Supply chain protection | Manual (`--ignore-scripts`) | Automatic |
| September 2025 attack | ❌ Would not prevent | ✅ Would prevent |

---

## Mitigation Strategy

### 1. Use pnpm v10+ (REQUIRED)

**Install pnpm globally:**

```bash
# Install latest pnpm
npm install -g pnpm@latest

# Verify version (must be 10.0+)
pnpm --version
```

**Configure secure pnpm settings:**

```bash
# Create .npmrc in project root
cat > .npmrc <<EOF
# Wait 3 days before installing new packages
minimum-release-age=4320

# Audit settings
audit=true
audit-level=moderate

# Only allow trusted packages to run postinstall scripts
# trustedDependencies[]=bcrypt

# Lockfile settings
lockfile=true
EOF
```

**Always commit `pnpm-lock.yaml`:**

```bash
# Generate lock file
pnpm install

# Commit it
git add pnpm-lock.yaml .npmrc
git commit -m "chore: add pnpm lockfile and security config"
```

**Why:** Lock files pin exact versions of all dependencies AND transitive dependencies, preventing automatic installation of compromised versions. pnpm's default security prevents postinstall script execution.

### 2. Audit Before Every Install

**Run pnpm audit before and after installation:**

```bash
# Before installing new packages
pnpm audit

# After installing
pnpm install <package>
pnpm audit

# Generate detailed report
pnpm audit --json > audit-report.json
```

### 3. Check for Compromised Versions

**Verify no compromised versions are installed:**

```bash
# Check if any compromised packages are in dependencies
pnpm list debug chalk ansi-styles strip-ansi color supports-color

# If found, check versions
pnpm list debug --depth=0
```

**Compromised versions to avoid:**
- debug@4.4.2
- chalk@5.6.1
- ansi-styles@6.2.2
- strip-ansi@7.1.1
- color@5.0.1
- (see full list above)

**Note:** With pnpm's `minimumReleaseAge=4320` (3 days), newly compromised packages won't be installable immediately, giving time for detection and removal.

### 4. Use Dependency Scanning Tools

**Install and use security scanners:**

```bash
# Install Snyk (recommended)
npm install -g snyk

# Authenticate
snyk auth

# Test project
snyk test

# Monitor for vulnerabilities
snyk monitor
```

**Alternative: Socket.dev**

```bash
# Socket works with pnpm
npx socket-ci
```

### 5. Use Latest Stable Versions

**With pnpm + minimumReleaseAge, use latest stable versions:**

```bash
# Install latest stable (3+ days old)
pnpm install express

# pnpm will automatically use latest version that meets minimumReleaseAge
```

**Why not pin versions?**
- Hardcoded versions become outdated quickly (security patches missed)
- pnpm's `minimumReleaseAge` provides safety without version pinning
- Get security updates automatically (after 3-day waiting period)

**For critical dependencies, you can still pin:**

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "0.10.0"
  }
}
```

### 6. Review Dependency Tree

**Before finalizing package.json, review full dependency tree:**

```bash
# Show all dependencies
pnpm list

# Show specific package and its dependencies
pnpm list express

# Export to file for review
pnpm list --json > dependencies.json

# Check for unnecessary dependencies
pnpm why <package-name>
```

---

## Secure Package Installation Procedure

### Standard Installation Process (All Phases)

This secure process uses pnpm v10+ and is followed throughout all implementation phases:

**1. Install pnpm (if not already installed):**

```bash
# Install latest pnpm globally
npm install -g pnpm@latest

# Verify version (must be 10.0+)
pnpm --version
```

**2. Prepare environment:**

```bash
cd backend

# Configure security settings
cat > .npmrc <<EOF
# Supply chain attack protection: wait 3 days before installing new packages
minimum-release-age=4320

# Security auditing
audit=true
audit-level=moderate

# Postinstall scripts disabled by default in pnpm v10+
# Only allow trusted packages that need to compile native modules
trustedDependencies[]=bcrypt

# Lockfile settings
lockfile=true
EOF
```

**3. Create package.json:**

```json
{
  "name": "mtg-agent-backend",
  "version": "1.0.0",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=10.0.0"
  },
  "scripts": {
    "preinstall": "npx only-allow pnpm",
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Note:** The `preinstall` script prevents accidental use of npm/yarn.

**4. Install dependencies with security checks:**

```bash
# Run audit before installing (will show no packages yet)
pnpm audit || echo "No packages installed yet"

# Install packages (no need for exact versions - minimumReleaseAge provides safety)
pnpm install express cors helmet dotenv
pnpm install @anthropic-ai/sdk
pnpm install pg ioredis
pnpm install bcrypt jsonwebtoken
pnpm install zod rate-limiter-flexible

# Install TypeScript tooling
pnpm install typescript tsx @types/node
pnpm install @types/express @types/cors
pnpm install @types/bcrypt @types/jsonwebtoken

# Dev dependencies
pnpm install -D nodemon @types/pg

# Audit results after installation
pnpm audit
```

**5. Verify no compromised versions:**

```bash
# Check for compromised packages from September 2025 attack
pnpm list | grep -E "(debug@4\.4\.2|chalk@5\.6\.1|ansi-styles@6\.2\.2|strip-ansi@7\.1\.1)"

# Should return no results
```

**6. Generate SBOM (Software Bill of Materials):**

```bash
# Generate license list for tracking
pnpm licenses list > licenses-$(date +%Y%m%d).txt

# Store in version control
git add licenses-*.txt
```

**7. Commit lock file:**

```bash
git add package.json pnpm-lock.yaml .npmrc
git commit -m "chore: add dependencies with pnpm security verification"
```

---

## Automated Security Checks During Implementation

### During Package Installation (Automatic)

When implementing any phase, the following checks will be performed automatically with pnpm:

- **Postinstall scripts blocked** by default (pnpm v10+)
- **minimumReleaseAge enforced** (3-day waiting period)
- Run `pnpm audit` before and after installation
- Verify no compromised package versions are installed
- Check dependency tree for suspicious packages
- Generate SBOM (license list)
- Commit pnpm-lock.yaml to version control

### Before Each Implementation Phase

Before starting implementation of any phase:

- Full security audit: `pnpm audit`
- Review dependency tree: `pnpm list`
- Generate fresh license list: `pnpm licenses list`
- Scan with Snyk (if available): `snyk test`
- Verify all dependencies are documented
- Confirm pnpm version is 10.0+: `pnpm --version`

### Before Production Deployment (Phase 4)

Critical security validations before public access:

- Complete security audit with external tools
- Manual review of all dependencies
- Verify all third-party packages documented
- Set up automated dependency monitoring
- Enable Dependabot or equivalent service

---

## Detection: Signs of Compromised Packages

### Runtime Indicators

1. **Unexpected Network Requests:**
   - Connections to unknown domains
   - Cryptocurrency wallet interactions
   - Data exfiltration attempts

2. **Unexpected File Access:**
   - Reading environment variables
   - Accessing `.git` directory
   - Reading AWS credentials (~/.aws/)
   - Accessing SSH keys

3. **Unusual Process Behavior:**
   - Spawning child processes
   - Executing shell commands
   - Modifying system files

### Static Analysis Indicators

**Check package.json for suspicious scripts:**

```bash
# Review all install scripts
npm run-script --list

# Check for post-install scripts (common attack vector)
cat node_modules/*/package.json | grep -A 5 "postinstall"
```

**Red flags:**
- Base64 encoded strings in scripts
- Obfuscated JavaScript
- Network requests in install scripts
- Eval statements
- Child process spawning

---

## Incident Response Plan

### If Compromised Package Detected

**1. Immediate Actions:**

```bash
# Stop all running processes
pkill -f "node"

# Remove node_modules
rm -rf node_modules

# Remove lock file
rm package-lock.json

# Clear npm cache
npm cache clean --force
```

**2. Rotate All Credentials:**

```bash
# List all environment variables that may have been exposed
env | grep -E "(KEY|SECRET|TOKEN|PASSWORD)"

# Rotate immediately:
# - Anthropic API keys
# - Database passwords
# - JWT secrets
# - GitHub tokens
# - AWS keys
# - Any other secrets
```

**3. Audit System:**

```bash
# Check for unauthorized network connections
netstat -an | grep ESTABLISHED

# Review recently modified files
find . -type f -mtime -1

# Check process list
ps aux | grep node
```

**4. Clean Reinstall:**

```bash
# Use known-good package.json
git checkout package.json package-lock.json

# Clean install
npm ci

# Verify
npm audit
npm list
```

**5. Report:**

- Report to npm: https://www.npmjs.com/support
- Report to GitHub: https://github.com/npm/cli/issues
- Report to CISA: https://www.cisa.gov/report

---

## Tools and Resources

### Security Scanning Tools

1. **Snyk** (Recommended)
   - URL: https://snyk.io
   - Free tier available
   - Integrates with GitHub
   - Real-time monitoring

2. **Socket.dev**
   - URL: https://socket.dev
   - Detects supply chain attacks
   - Free for open source

3. **npm audit**
   - Built-in
   - Basic vulnerability scanning
   - Limited to known CVEs

4. **Trivy**
   - URL: https://trivy.dev
   - Container and dependency scanning
   - Open source

### Monitoring Services

1. **Dependabot** (GitHub)
   - Automated dependency updates
   - Security alerts
   - Free for public repos

2. **Renovate**
   - Automated dependency updates
   - More configurable than Dependabot

3. **WhiteSource Renovate**
   - Enterprise-grade scanning
   - License compliance

### Information Sources

- **npm Security Advisories:** https://github.com/advisories?query=type%3Areviewed+ecosystem%3Anpm
- **CISA Alerts:** https://www.cisa.gov/news-events/cybersecurity-advisories
- **npm Blog:** https://github.blog/tag/npm/
- **Sonatype Security Research:** https://blog.sonatype.com/

---

## Implementation Security Checklist

### Before Starting Any Phase Implementation

- [ ] Read this security advisory completely
- [ ] Install pnpm v10+ globally (`npm install -g pnpm@latest`)
- [ ] Verify pnpm version (`pnpm --version` should be 10.0+)
- [ ] Configure pnpm with security settings (.npmrc with minimumReleaseAge)
- [ ] Install security scanning tools (Snyk or Socket.dev) if available
- [ ] Enable GitHub Dependabot on repository (if not already enabled)
- [ ] Document all API keys and secrets that will be used

### During Implementation (Automated)

These checks will be performed automatically with pnpm during package installation:

- [ ] Postinstall scripts blocked by default (pnpm v10+)
- [ ] minimumReleaseAge enforced (3-day waiting period)
- [ ] Run `pnpm audit` before every `pnpm install`
- [ ] Commit pnpm-lock.yaml after every install
- [ ] Review dependency tree for suspicious packages
- [ ] Check for compromised versions (see list above)
- [ ] Generate license list after major dependency changes
- [ ] Never commit .env files or secrets
- [ ] Use environment variables for all secrets

### Before Phase Completion

- [ ] Full pnpm audit with no critical vulnerabilities
- [ ] Snyk scan with no high-risk issues (if available)
- [ ] Review all transitive dependencies
- [ ] Document all third-party packages used
- [ ] Verify no compromised package versions installed
- [ ] Generate final license list for the phase
- [ ] Verify automated security monitoring is active
- [ ] Confirm pnpm-lock.yaml is committed and up to date

---

## Summary

The September 2025 npm supply chain attack demonstrates that even the most trusted packages can be compromised. This project uses **pnpm v10+** for enhanced security throughout all implementation phases:

### Core Security Measures

1. **Use pnpm v10+** (required) - Postinstall scripts disabled by default
2. **Enable minimumReleaseAge** (3 days) - Prevents zero-day supply chain attacks
3. **Use pnpm-lock.yaml** (mandatory) - Lock all dependency versions
4. **Run pnpm audit** before every install
5. **Trust only necessary packages** (bcrypt only for native compilation)
6. **Use security scanning tools** (Snyk, Socket.dev)
7. **Generate license lists** for tracking
8. **Monitor continuously** (Dependabot, Snyk)
9. **Have incident response plan** ready

### Why pnpm v10+ is Critical

- ✅ Would have **prevented** the September 2025 attack
- ✅ Blocks postinstall scripts by default (malicious code can't execute)
- ✅ `minimumReleaseAge` waits 3 days before installing new packages
- ✅ Compromised packages are usually discovered and removed within hours/days
- ✅ Better isolation and security than npm

**Remember:** Supply chain security is not a one-time task. It requires continuous vigilance and monitoring throughout the project lifecycle. Using pnpm v10+ provides automatic protection that npm cannot offer.

---

**Last Updated:** 2025-11-03
**Package Manager:** pnpm v10+
**Next Review:** Before each implementation phase begins
**Status:** Active - Required for all phases
