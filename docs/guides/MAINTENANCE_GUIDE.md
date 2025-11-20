# Repository Maintenance Guide

## Post-PR #28 Merge Actions

After PR #28 "Clean up disparate branches and consolidate dependency updates" is merged to main, follow these steps to complete the repository cleanup.

### Step 1: Close Incorporated Dependabot PRs

The following Dependabot PRs have been incorporated into PR #28 and should be closed:

```bash
# Via GitHub UI or CLI:
gh pr close 25 --comment "Incorporated in PR #28"
gh pr close 26 --comment "Incorporated in PR #28"
gh pr close 27 --comment "Incorporated in PR #28"
```

**PRs to Close:**
- PR #25: Bump globals from 16.4.0 to 16.5.0 ✅ Incorporated
- PR #26: Bump react-hook-form from 7.65.0 to 7.66.0 ✅ Incorporated
- PR #27: Bump @tanstack/react-query from 5.90.5 to 5.90.6 ✅ Incorporated

### Step 2: Delete Obsolete Branches

After closing the PRs, delete their associated branches:

```bash
# Delete Dependabot branches (incorporated)
git push origin --delete dependabot/npm_and_yarn/globals-16.5.0
git push origin --delete dependabot/npm_and_yarn/react-hook-form-7.66.0
git push origin --delete dependabot/npm_and_yarn/tanstack/react-query-5.90.6

# Delete old feature branches (already merged to main)
git push origin --delete copilot/fix-all-dependencies-in-one-sweep
git push origin --delete copilot/update-repo-metadata-organization

# Delete consolidation branch after PR #28 merges
git push origin --delete copilot/clean-disparate-branches
```

**Total Branches to Delete:** 6 branches

### Step 3: Handle Major Version Updates

Create dedicated testing branches for the deferred major updates:

#### Update @vitejs/plugin-react (v4.7.0 → v5.1.0)

```bash
# Create testing branch
git checkout main
git pull origin main
git checkout -b update/vite-plugin-react-v5

# Update package.json
# Change: "@vitejs/plugin-react": "^4.7.0" → "@vitejs/plugin-react": "^5.1.0"

# Test the update
npm install
npm run build
npm run lint
# Run your test suite if available

# If tests pass, create PR
git add package.json package-lock.json
git commit -m "Update @vitejs/plugin-react to v5.1.0"
git push origin update/vite-plugin-react-v5
gh pr create --title "Update @vitejs/plugin-react to v5.1.0" \
  --body "Major version update from v4.7.0 to v5.1.0. Deferred from PR #28 for dedicated testing."

# After merge, close PR #24 and delete branch
gh pr close 24 --comment "Incorporated in update/vite-plugin-react-v5"
git push origin --delete dependabot/npm_and_yarn/vitejs/plugin-react-5.1.0
```

#### Update @vitejs/plugin-react-swc (v3.11.0 → v4.2.0)

```bash
# Create testing branch
git checkout main
git pull origin main
git checkout -b update/vite-plugin-react-swc-v4

# Update package.json
# Change: "@vitejs/plugin-react-swc": "^3.11.0" → "@vitejs/plugin-react-swc": "^4.2.0"

# Test the update
npm install
npm run build
npm run lint
# Run your test suite if available

# If tests pass, create PR
git add package.json package-lock.json
git commit -m "Update @vitejs/plugin-react-swc to v4.2.0"
git push origin update/vite-plugin-react-swc-v4
gh pr create --title "Update @vitejs/plugin-react-swc to v4.2.0" \
  --body "Major version update from v3.11.0 to v4.2.0. Deferred from PR #28 for dedicated testing."

# After merge, close PR #23 and delete branch
gh pr close 23 --comment "Incorporated in update/vite-plugin-react-swc-v4"
git push origin --delete dependabot/npm_and_yarn/vitejs/plugin-react-swc-4.2.0
```

### Step 4: Evaluate Remaining Feature Branches

Two feature branches remain and need evaluation:

#### Branch: copilot/update-all-dependencies

```bash
# Check what unique changes this branch has
git checkout copilot/update-all-dependencies
git log --oneline main..HEAD

# Review changes
git diff main...copilot/update-all-dependencies

# Decision options:
# Option A: If valuable changes exist, cherry-pick them
git checkout main
git cherry-pick <commit-hash>

# Option B: If superseded by PR #28, delete the branch
git push origin --delete copilot/update-all-dependencies
```

#### Branch: claude/consolidate-branches-merge-011CUfePc5QPn8x5MQctWBej

This branch represents a previous consolidation attempt documented in `BRANCH_CONSOLIDATION.md`.

```bash
# Review documented issues in BRANCH_CONSOLIDATION.md
# - 29 linting errors
# - 8 warnings
# - Build succeeded

# Decision options:
# Option A: If fixes from this branch are valuable, cherry-pick specific commits
git checkout main
git log claude/consolidate-branches-merge-011CUfePc5QPn8x5MQctWBej
git cherry-pick <commit-hash>

# Option B: If work is superseded, close and archive
git push origin --delete claude/consolidate-branches-merge-011CUfePc5QPn8x5MQctWBej
```

**Recommendation:** Since PR #28 accomplishes the same consolidation goals with a cleaner approach, delete both branches unless specific valuable changes are identified.

### Step 5: Configure Dependabot Grouping

To reduce future PR noise, configure Dependabot to group minor/patch updates:

Create or update `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      # Group all minor and patch updates
      production-dependencies:
        patterns:
          - "*"
        update-types:
          - "minor"
          - "patch"
      # Keep major updates separate for dedicated testing
      development-dependencies:
        patterns:
          - "*"
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"
```

This configuration will create single PRs for minor/patch updates instead of individual PRs for each package.

### Step 6: Set Up Automated Branch Deletion

To automatically delete branches after PR merges, add a GitHub Action:

Create `.github/workflows/cleanup-merged-branches.yml`:

```yaml
name: Cleanup Merged Branches

on:
  pull_request:
    types: [closed]

jobs:
  delete-branch:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - name: Delete merged branch
        uses: dawidd6/action-delete-branch@v3
        with:
          github_token: ${{secrets.GITHUB_TOKEN}}
          branches: ${{ github.head_ref }}
```

### Verification Checklist

After completing all steps, verify the cleanup:

- [ ] All 7 open PRs are either merged or closed
- [ ] 6-8 obsolete branches are deleted
- [ ] Only active development branches remain (ideally ≤3)
- [ ] Dependabot configuration is updated
- [ ] Auto-delete workflow is in place
- [ ] No build or linting regressions from dependency updates

### Expected Final State

**Branches (should be ~3-5 total):**
- `main` (production)
- Active feature branches (if any)
- Testing branches for major updates (temporary)

**Open PRs (should be 0-2):**
- New Dependabot grouped update PR (if configured)
- Active feature PRs (if any)

**Documentation:**
- `BRANCH_CONSOLIDATION.md` (historical record)
- `BRANCH_RESOLUTION.md` (strategy document)
- `PR_SUMMARY.md` (PR #28 summary)
- `MAINTENANCE_GUIDE.md` (this file)

## Future Maintenance Best Practices

### Branch Management
1. **Create short-lived feature branches** - Merge within 1-2 weeks
2. **Delete branches after merge** - Use auto-delete workflow
3. **Limit concurrent branches** - Keep to 3-5 active branches max
4. **Use consistent naming** - `feature/`, `fix/`, `update/`, `docs/`

### Dependency Management
1. **Review Dependabot PRs weekly** - Don't let them accumulate
2. **Group minor/patch updates** - Reduce PR noise
3. **Test major updates separately** - Create dedicated testing branches
4. **Keep dependencies current** - Update at least monthly

### Code Quality
1. **Fix linting errors incrementally** - Don't let them accumulate
2. **Run tests before merging** - Ensure no regressions
3. **Document breaking changes** - Update CHANGELOG
4. **Review security advisories** - Act on vulnerabilities promptly

### Documentation
1. **Keep README current** - Update with new features
2. **Maintain CHANGELOG** - Document all changes
3. **Update API docs** - As interfaces change
4. **Archive old docs** - Keep historical context

## Troubleshooting

### Issue: npm install fails with peer dependency conflicts

```bash
# Solution: Use legacy peer deps flag
npm install --legacy-peer-deps
```

### Issue: Build fails after dependency update

```bash
# Solution: Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm run build
```

### Issue: Too many Dependabot PRs

```bash
# Solution: Configure grouping in .github/dependabot.yml (see Step 5)
```

### Issue: Merge conflicts in package-lock.json

```bash
# Solution: Regenerate package-lock.json
git checkout --theirs package-lock.json
npm install
git add package-lock.json
git commit
```

## Support

For questions or issues:
1. Check existing documentation in this repository
2. Review BRANCH_RESOLUTION.md for consolidation details
3. Check BRANCH_CONSOLIDATION.md for historical context
4. Create a new issue with the `maintenance` label

---

Last Updated: November 4, 2025  
Maintainer: Repository Team
