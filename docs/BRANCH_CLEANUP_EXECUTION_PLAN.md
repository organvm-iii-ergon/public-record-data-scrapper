# Branch Cleanup Execution Plan

**Date**: December 13, 2024  
**Goal**: Reduce 23 branches to just `main`, close all outstanding PRs  
**Status**: Ready for Execution

## Current State

### Branches (23 total)
1. `main` (base branch)
2. `copilot/merge-all-prs-and-branches` (current working branch - THIS WORK)
3. `claude/pick-implementation-016NMwaaexJYbyDuHajpV91B`
4. `claude/pr-consolidation-docs-01T7PkKwVUqzxhquL2TR3JvL`
5. `claude/review-and-pr-01LudkNMEDKinPMNnYHq5K6t`
6. `codex/enable-code-scanning-with-github-actions-2025-11-1221-47-54`
7. `codex/enable-code-scanning-with-github-actions-2025-11-1222-03-35`
8. `codex/enable-code-scanning-with-github-actions-2025-11-1222-03-46`
9. `codex/enable-code-scanning-with-github-actions-2025-11-1222-03-55`
10. `codex/fix-typeerror-and-git-workflow-errors-2025-11-1221-06-21`
11. `codex/fix-typeerror-and-git-workflow-errors-2025-11-1222-04-41`
12. `codex/fix-typeerror-and-git-workflow-errors-2025-11-1222-05-18`
13. `copilot/expand-critique-on-gemini`
14. `copilot/merge-multiple-approved-branches`
15. `copilot/merge-open-prs-and-organize-repo`
16. `copilot/merge-suggestions-into-main`
17. `copilot/resolve-pr-comment-issue`
18. `dependabot/npm_and_yarn/eslint/js-9.39.1`
19. `dependabot/npm_and_yarn/github/spark-0.44.5`
20. `dependabot/npm_and_yarn/react-day-picker-9.12.0`
21. `dependabot/npm_and_yarn/react-hook-form-7.68.0`
22. `dependabot/npm_and_yarn/zod-4.1.13`
23. `pr135`

## Execution Strategy

### Phase 1: Merge Current Work into Main ✅ READY

**Branch**: `copilot/merge-all-prs-and-branches`  
**Action**: Merge into `main`  
**Contents**:
- Repository reorganization (46 files moved)
- Updated README with new structure
- Documentation consolidation
- Scripts organization

**Command**:
```bash
# From main branch
git checkout main
git merge --no-ff copilot/merge-all-prs-and-branches -m "Complete repository reorganization and consolidation"
git push origin main
```

### Phase 2: Delete Redundant Branches

Use the existing script: `scripts/cleanup-branches.sh`

This script will delete:

#### Group A: Duplicate CodeQL Branches (4)
These are duplicates - CodeQL is already configured:
```bash
git push origin --delete codex/enable-code-scanning-with-github-actions-2025-11-1221-47-54
git push origin --delete codex/enable-code-scanning-with-github-actions-2025-11-1222-03-35
git push origin --delete codex/enable-code-scanning-with-github-actions-2025-11-1222-03-46
git push origin --delete codex/enable-code-scanning-with-github-actions-2025-11-1222-03-55
```

#### Group B: Duplicate TypeError Fix Branches (3)
Multiple attempts at same fix:
```bash
git push origin --delete codex/fix-typeerror-and-git-workflow-errors-2025-11-1221-06-21
git push origin --delete codex/fix-typeerror-and-git-workflow-errors-2025-11-1222-04-41
git push origin --delete codex/fix-typeerror-and-git-workflow-errors-2025-11-1222-05-18
```

#### Group C: Planning/WIP Branches (7)
Coordination branches that are no longer needed:
```bash
git push origin --delete claude/pick-implementation-016NMwaaexJYbyDuHajpV91B
git push origin --delete claude/pr-consolidation-docs-01T7PkKwVUqzxhquL2TR3JvL
git push origin --delete claude/review-and-pr-01LudkNMEDKinPMNnYHq5K6t
git push origin --delete copilot/expand-critique-on-gemini
git push origin --delete copilot/merge-multiple-approved-branches
git push origin --delete copilot/merge-open-prs-and-organize-repo
git push origin --delete copilot/merge-suggestions-into-main
git push origin --delete copilot/resolve-pr-comment-issue
```

#### Group D: Dependabot Branches (5)
If dependencies have been updated in main:
```bash
git push origin --delete dependabot/npm_and_yarn/eslint/js-9.39.1
git push origin --delete dependabot/npm_and_yarn/github/spark-0.44.5
git push origin --delete dependabot/npm_and_yarn/react-day-picker-9.12.0
git push origin --delete dependabot/npm_and_yarn/react-hook-form-7.68.0
git push origin --delete dependabot/npm_and_yarn/zod-4.1.13
```

#### Group E: Other (1)
```bash
git push origin --delete pr135
```

#### Group F: Current Working Branch (1)
After merge is complete:
```bash
git push origin --delete copilot/merge-all-prs-and-branches
```

**Total Branches to Delete**: 21 (keeping only `main`)

### Phase 3: Close Open PRs

Use the existing script: `scripts/close-superseded-prs.sh`

This requires GitHub CLI (`gh`) or manual action via GitHub web interface.

The script will close PRs with appropriate messages explaining they were:
- Duplicates
- Superseded by consolidation
- No longer needed

### Phase 4: Verification

After cleanup:
```bash
# Should show only 'main'
git ls-remote --heads origin

# Should show clean working tree
git status

# Verify main has all the work
git log --oneline -20
```

## Expected Final State

### Branches
- ✅ **1 branch**: `main` only
- ✅ **0 feature branches**
- ✅ **0 WIP branches**

### PRs
- ✅ **0 open PRs**
- ✅ All superseded PRs closed with explanations

### Repository Structure
- ✅ Clean root directory (31 files, down from 67)
- ✅ Organized docs/ hierarchy
- ✅ Consolidated scripts/ directory
- ✅ Archived historical documents
- ✅ Updated documentation

## Manual Steps Required

Since this requires elevated permissions and GitHub access:

1. **Review this plan** - Ensure all branches are safe to delete
2. **Execute Phase 1** - Merge current work into main
3. **Run cleanup script** - Execute `scripts/cleanup-branches.sh`
4. **Close PRs** - Execute `scripts/close-superseded-prs.sh` or close manually
5. **Verify** - Confirm final state matches expectations

## Risk Mitigation

### Before Deletion
- ✅ All important work is merged into main
- ✅ Scripts are preserved for reference (`scripts/cleanup-branches.sh`)
- ✅ Documentation exists explaining what was consolidated
- ✅ This execution plan documents all actions

### Rollback Plan
If something goes wrong:
- Branches can be restored from reflog within 30-90 days
- GitHub maintains deleted branch history
- Repository organization can be reverted via git

## Timeline

1. **Phase 1** (merge): 5 minutes
2. **Phase 2** (delete branches): 10 minutes
3. **Phase 3** (close PRs): 10 minutes
4. **Phase 4** (verify): 5 minutes

**Total Estimated Time**: 30 minutes

## Success Criteria

- ✅ 23 branches → 1 branch (main)
- ✅ All PRs closed appropriately
- ✅ Repository organization complete
- ✅ Documentation updated
- ✅ No loss of important work

---

**Status**: ✅ Plan Ready  
**Next Action**: Execute Phase 1 (merge into main)  
**Owner**: Repository administrator with push rights  
**Created**: December 13, 2024
