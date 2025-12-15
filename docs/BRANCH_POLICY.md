# Branch Management Policy

## Overview

This document defines the branch management policy for the `public-record-data-scrapper` repository to maintain code quality, enable collaboration, and ensure repository cleanliness.

---

## Core Principles

1. **Main is sacred** - The `main` branch always reflects production-ready code
2. **No long-lived branches** - Feature branches are short-lived and deleted after merge
3. **Linear history preferred** - Use rebase or squash merges to maintain clean history
4. **CI must pass** - All checks must pass before merging
5. **Automatic cleanup** - Branches are automatically deleted after merge

---

## Branch Structure

### Permanent Branch

- **`main`** - The only long-lived branch. Represents the current production state.

### Temporary Branches

All other branches are temporary and follow these naming conventions:

| Prefix        | Purpose                               | Example                       | Lifespan |
| ------------- | ------------------------------------- | ----------------------------- | -------- |
| `feature/`    | New features or enhancements          | `feature/add-export-api`      | < 1 week |
| `fix/`        | Bug fixes                             | `fix/pagination-error`        | < 3 days |
| `hotfix/`     | Urgent production fixes               | `hotfix/security-patch`       | < 1 day  |
| `docs/`       | Documentation changes                 | `docs/update-readme`          | < 2 days |
| `refactor/`   | Code refactoring (no behavior change) | `refactor/extract-utils`      | < 5 days |
| `test/`       | Test additions or improvements        | `test/add-e2e-suite`          | < 3 days |
| `security/`   | Security improvements                 | `security/fix-sql-injection`  | < 1 day  |
| `chore/`      | Maintenance tasks                     | `chore/update-deps`           | < 2 days |
| `dependabot/` | Automated dependency updates          | `dependabot/npm_and_yarn/...` | Auto     |
| `copilot/`    | AI-generated branches (temporary)     | `copilot/implement-feature`   | < 2 days |

---

## Workflow

### 1. Starting Work

```bash
# Always start from latest main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name
```

### 2. Making Changes

- Make focused, atomic commits
- Write clear commit messages following [Conventional Commits](https://www.conventionalcommits.org/)
- Push regularly to backup your work

```bash
git add .
git commit -m "feat: add new export functionality"
git push origin feature/your-feature-name
```

### 3. Opening a Pull Request

- Open PR as soon as you have meaningful progress
- Use PR template to provide context
- Link relevant issues
- Request reviews from appropriate team members
- Ensure CI checks pass

### 4. Merging

**Merge Methods:**

- **Squash Merge** (default) - Combines all commits into one, keeps main history clean
- **Rebase Merge** - Preserves individual commits, good for multi-part features
- **Merge Commit** - Rarely used, only for special cases

**Requirements Before Merge:**

- ✅ All CI checks passing
- ✅ At least 1 approving review
- ✅ No merge conflicts with main
- ✅ Up-to-date with main branch

### 5. After Merge

- **Branch is automatically deleted** (if enabled in settings)
- Pull latest main: `git checkout main && git pull`
- Start next feature

---

## Branch Protection Rules

### Main Branch Protection

Enable these settings on `main`:

**Required:**

- [ ] Require pull request before merging
  - [ ] Require approvals: 1
  - [ ] Dismiss stale pull request approvals when new commits are pushed
- [ ] Require status checks to pass before merging
  - [ ] Require branches to be up to date before merging
  - [ ] Status checks: CI, ESLint, Tests, Build
- [ ] Require linear history (squash or rebase)
- [ ] Do not allow bypassing the above settings

**Recommended:**

- [ ] Require signed commits
- [ ] Require code review from code owners
- [ ] Restrict who can push to matching branches

**Automatic Cleanup:**

- [ ] Automatically delete head branches (in repository settings)

---

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding missing tests
- `chore`: Maintenance tasks
- `security`: Security fixes
- `ci`: CI/CD changes

### Examples:

```
feat(auth): add JWT authentication
fix(api): resolve null pointer in data export
docs: update installation instructions
security(db): fix SQL injection in bulkInsert
```

---

## Dependency Updates

### Dependabot Configuration

- Automated weekly dependency update PRs
- Minor and patch updates: Auto-merge if CI passes
- Major updates: Require manual review

### Handling Dependabot PRs

1. Review changelog for breaking changes
2. Verify CI passes
3. Check for security vulnerabilities
4. Merge via GitHub UI (squash)
5. Branch auto-deletes

---

## Stale Branch Policy

### Definition of Stale

A branch is considered stale if:

- No commits in last 30 days
- Associated PR is closed or merged
- No active discussion on related issues

### Cleanup Process

**Automated (recommended):**

- Use GitHub Actions to identify and notify owners of stale branches
- Auto-delete after 7 days of no activity following notification

**Manual:**

```bash
# List stale branches
git branch -r --sort=-committerdate

# Delete remote branch
git push origin --delete branch-name
```

---

## Emergency Procedures

### Hotfix Process

For critical production issues:

1. **Create hotfix branch from main**

   ```bash
   git checkout main
   git pull
   git checkout -b hotfix/critical-issue
   ```

2. **Fix and test immediately**
   - Make minimal changes to fix the issue
   - Add tests if possible
   - Document the fix

3. **Fast-track PR**
   - Mark as high priority
   - Request immediate review
   - Can bypass some checks if necessary (with justification)

4. **Merge and deploy**
   - Squash merge to main
   - Tag release
   - Deploy immediately
   - Delete hotfix branch

### Reverting Bad Merges

If a merge causes issues:

```bash
# Revert the merge commit
git revert -m 1 <merge-commit-sha>
git push origin main

# Or create a fix-forward
git checkout -b fix/revert-bad-change
# Make fixes
# Open PR
```

---

## Conflict Resolution

### Preventing Conflicts

- Keep branches short-lived
- Sync with main frequently
- Communicate with team about overlapping work

### Resolving Conflicts

```bash
# Update your branch with latest main
git checkout feature/your-branch
git fetch origin
git rebase origin/main

# Fix conflicts
# git add resolved-files
# git rebase --continue

# Force push (only on feature branches!)
git push --force-with-lease
```

---

## Monitoring and Metrics

Track these metrics monthly:

- Average branch lifespan
- Number of active branches
- Merge frequency
- Failed merge attempts
- Stale branches cleaned up

**Goals:**

- < 5 active feature branches at any time
- < 7 day average branch lifespan
- Zero stale branches > 30 days

---

## Enforcement

### Automated

- Branch protection rules enforce most policies
- GitHub Actions for stale branch cleanup
- Pre-commit hooks for commit message format

### Team Responsibility

- Code review emphasizes adherence to policy
- Regular retrospectives to improve workflow
- Update policy as needs evolve

---

## Examples

### Good Branch Lifecycle

```bash
# Day 1: Start feature
git checkout -b feature/add-csv-export main
# Make changes, commit regularly
git commit -m "feat(export): add CSV export function"
git push origin feature/add-csv-export

# Day 2: Open PR
# Open PR via GitHub UI
# Respond to review feedback

# Day 3: Merge and cleanup
# Merge via GitHub UI (squash)
# Branch auto-deletes
git checkout main
git pull origin main
```

### Bad Branch Lifecycle ❌

```bash
# Don't do this!
git checkout -b my-work
# Work for 3 weeks without pushing
# Never open PR
# Meanwhile main has diverged significantly
# Finally try to merge - huge conflicts
```

---

## FAQ

**Q: Can I have multiple feature branches active?**
A: Yes, but keep them focused. Each branch should address one feature/fix.

**Q: What if I need to work on something urgent while my current PR is in review?**
A: Start a new branch from main. Don't branch from your feature branch.

**Q: How do I handle a PR that's been open for > 1 week?**
A: Evaluate if it can be split into smaller PRs. Sync with main daily to avoid conflicts.

**Q: What if CI is failing due to infrastructure issues?**
A: Tag a maintainer. Never bypass CI without explicit approval and documentation.

**Q: Can I create branches with other names?**
A: Yes, but follow the spirit of the naming convention. Prefixes help organize work.

---

## Revision History

| Date       | Version | Changes                                            | Author         |
| ---------- | ------- | -------------------------------------------------- | -------------- |
| 2025-12-15 | 1.0     | Initial policy created during branch consolidation | GitHub Copilot |

---

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- Internal: [Branch Consolidation Audit](./BRANCH_AUDIT.md)
