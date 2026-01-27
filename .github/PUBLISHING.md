# Publishing Guide for waveform-navigator

This document explains how the automated NPM publishing workflow works and how to set it up.

## Overview

The `waveform-navigator` package uses an automated publishing workflow that triggers whenever changes are merged to the `main` branch. The workflow uses **NPM Trusted Publishing with OIDC** for secure, token-free authentication.

### Workflow Features

1. ✅ Waits for all CI checks to pass
2. 🏗️ Builds the package
3. 📊 Determines the version bump type based on commit messages
4. 📦 Publishes to NPM with cryptographic provenance
5. 🏷️ Creates a git tag
6. 📝 Creates a GitHub release

### Why OIDC Trusted Publishing?

- 🔒 **No token management** - No need to create, rotate, or secure long-lived tokens
- 🔐 **Enhanced security** - Uses short-lived credentials generated per-publish
- 📜 **Automatic provenance** - Every publish includes cryptographic proof of origin
- ✅ **Supply chain transparency** - Verifiable build environment and source
- 🚀 **Future-proof** - NPM's recommended approach (classic tokens are deprecated)

## Setup Instructions

### Prerequisites

1. You must be a maintainer of the `waveform-navigator` NPM package
2. You need admin access to the GitHub repository
3. You need access to configure the NPM package settings

### Step 1: Configure NPM Trusted Publishing

The workflow uses **OIDC (OpenID Connect) Trusted Publishing** for secure, token-free authentication with NPM. This is NPM's recommended approach and provides automatic cryptographic provenance.

1. Log in to [npmjs.com](https://www.npmjs.com)
2. Navigate to your package: `waveform-navigator`
3. Go to **Settings** → **Publishing Access**
4. Click **Add Trusted Publisher**
5. Configure the GitHub Actions publisher:
   - **Provider**: GitHub Actions
   - **Repository Owner**: `KHeavyy`
   - **Repository Name**: `waveform-navigator`
   - **Workflow File**: `publish.yml`
   - **Environment** (optional): Leave blank (or specify if using deployment environments)
6. Click **Add Publisher**

### Step 2: Verify Setup

The workflow is now ready! Next time you merge changes to `main`, the automated publishing will trigger.

**No secrets or tokens needed!** The workflow authenticates automatically using OIDC.

## How to Trigger a Release

### The Process

1. **Make your changes** in a feature branch
2. **Create a Pull Request** to `main`
3. **Wait for CI checks** to pass (all tests must pass)
4. **Merge the PR** to `main`
5. **Automatic publishing** happens - no manual intervention needed!

The workflow will:
- Run all CI checks (lint, type-check, unit tests, integration tests, visual tests, build)
- Determine the version bump based on your commit messages
- Publish to NPM
- Create a git tag
- Create a GitHub release

## Semantic Versioning

The workflow uses **Semantic Versioning** (semver) based on your commit messages:

### Commit Message Conventions

| Commit Message Pattern | Version Bump | Example |
|------------------------|--------------|---------|
| `BREAKING CHANGE:` anywhere in message | **Major** (1.0.0 → 2.0.0) | Breaking API changes |
| `feat:` or `feature:` prefix | **Minor** (1.0.0 → 1.1.0) | New features |
| Any other commit | **Patch** (1.0.0 → 1.0.1) | Bug fixes, docs, etc. |

### Examples

#### Patch Release (Bug Fix)
```bash
git commit -m "fix: resolve audio playback issue on Safari"
```
Result: `1.0.0` → `1.0.1`

#### Minor Release (New Feature)
```bash
git commit -m "feat: add support for custom waveform colors"
```
Result: `1.0.0` → `1.1.0`

#### Major Release (Breaking Change)
```bash
git commit -m "feat: redesign component API

BREAKING CHANGE: The onTimeUpdate callback now receives an object instead of a number"
```
Result: `1.0.0` → `2.0.0`

### Best Practices

1. **Use conventional commit messages** - This ensures proper version bumping
2. **Squash commits** when merging PRs to keep a clean commit history
3. **Include detailed PR descriptions** - They help generate better changelogs
4. **Test thoroughly** before merging - The publish is automatic!

## Workflow Details

### Workflow Triggers

The publish workflow only runs when:
- ✅ Code is pushed to the `main` branch (not on PRs)
- ✅ All CI jobs pass successfully

### CI Jobs That Must Pass

Before publishing, these jobs must complete successfully:

1. **lint-and-typecheck** - TypeScript type checking and linting
2. **unit-tests** - Unit test suite with coverage
3. **integration-tests** - Playwright integration tests
4. **visual-tests** - Visual regression tests
5. **build** - Library build validation

### Workflow Steps

1. **Checkout** - Clones the repository with full git history
2. **Setup Node.js** - Installs Node.js 20 with NPM cache
3. **Install** - Runs `npm ci` for clean dependency install
4. **Build** - Generates distribution files
5. **Validate** - Ensures all required dist files exist
6. **Version Bump** - Analyzes commits and bumps version accordingly
7. **Publish** - Pushes package to NPM registry
8. **Tag** - Creates and pushes git tag
9. **Release** - Creates GitHub release with changelog

### Build Artifacts Validated

The workflow verifies these files exist before publishing:
- `dist/index.mjs` - ESM module
- `dist/index.cjs` - CommonJS module
- `dist/index.d.ts` - TypeScript definitions
- `dist/styles.css` - Component styles
- `dist/peaks.worker.js` - Web Worker file

## Troubleshooting

### Publishing Fails with "401 Unauthorized" or "403 Forbidden"

**Problem:** NPM authentication or authorization failed

**Solution:**
1. Verify the **Trusted Publisher** is configured correctly on npmjs.com
2. Check the repository owner, name, and workflow file match exactly
3. Ensure you're a maintainer of the `waveform-navigator` package on NPM
4. Verify the workflow has `id-token: write` permission (already configured)
5. Check that the package name in `package.json` is correct
6. Ensure `publishConfig.access` is set to `"public"` in `package.json`
7. Verify you're running on a GitHub-hosted runner (self-hosted runners don't support OIDC yet)

### Version Already Exists

**Problem:** The version you're trying to publish already exists

**Solution:**
- This usually means the workflow ran twice accidentally
- NPM doesn't allow overwriting published versions
- The workflow should handle this automatically, but if it fails:
  1. Check recent workflow runs for duplicate publications
  2. Wait for the current run to complete
  3. The next merge will bump to the next version

### Git Push Fails

**Problem:** Cannot push tags back to repository

**Solution:**
1. Ensure the workflow has `contents: write` permission (already configured)
2. Check that branch protection rules allow GitHub Actions to push
3. Verify `GITHUB_TOKEN` has proper permissions

### Build Artifacts Missing

**Problem:** Required dist files don't exist

**Solution:**
1. Run `npm run build` locally to test the build
2. Check that all build scripts in `package.json` are correct
3. Verify `vite.config.ts` is properly configured
4. Look at the build step logs in the workflow for errors

### CI Jobs Failing Before Publish

**Problem:** Publish doesn't run because CI jobs fail

**Solution:**
1. Fix the failing CI jobs first
2. The publish workflow won't run until all CI passes
3. Check the CI workflow logs to identify the issue
4. Common issues:
   - Failing tests
   - TypeScript errors
   - Linting issues
   - Build failures

### No Version Bump

**Problem:** Workflow doesn't detect changes for version bump

**Solution:**
- Ensure commits since last tag exist
- Check commit message format follows conventions
- If this is the first release, it will use `patch` by default

## Manual Publishing (Emergency)

If the automated workflow fails and you need to publish manually:

```bash
# 1. Ensure you're on the main branch with latest changes
git checkout main
git pull origin main

# 2. Install dependencies
npm ci

# 3. Run all checks
npm run build
npm run type-check
npm test

# 4. Login to NPM (if not already logged in)
npm login

# 5. Bump version manually
npm version patch  # or minor, or major

# 6. Publish with provenance
npm publish --provenance --access public

# 7. Push the version tag
git push --follow-tags
```

**Note:** Manual publishing should be avoided. Fix the workflow instead! When publishing manually, you'll use your personal NPM credentials rather than OIDC.

## Resources

- [NPM Trusted Publishing Documentation](https://docs.npmjs.com/trusted-publishers)
- [NPM OIDC Announcement](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)
- [NPM Provenance Documentation](https://docs.npmjs.com/generating-provenance-statements)
- [NPM Publishing Documentation](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [Semantic Versioning Specification](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Support

If you encounter issues not covered in this guide:

1. Check the [workflow runs](https://github.com/KHeavyy/waveform-navigator/actions) for detailed logs
2. Open an issue in the repository
3. Contact the maintainers

---

**Last Updated:** 2026-01-27
