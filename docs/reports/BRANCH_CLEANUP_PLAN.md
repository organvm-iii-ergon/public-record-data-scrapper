# Branch Cleanup Plan

**Date**: 2025-01-13
**Total Remote Branches**: 52
**Status**: Action Required

---

## 📊 Branch Inventory

### ✅ Recently Merged (DELETE)
1. `claude/ingest-011CV5QdKEje5tQXRcESTTS6` - **MERGED** via PR #99 ✅
   - Status: Fully merged to main
   - Action: **DELETE**
   - Command: `git push origin --delete claude/ingest-011CV5QdKEje5tQXRcESTTS6`

---

## 🔍 Branches Requiring Review

### Claude AI Branches (1)
1. `claude/consolidate-branches-merge-011CUfePc5QPn8x5MQctWBej`
   - **Action Required**: REVIEW
   - Purpose: Previous branch consolidation attempt
   - Next Steps:
     - Checkout and review commits
     - Compare with current main
     - Merge valuable changes or delete if superseded
   ```bash
   git checkout claude/consolidate-branches-merge-011CUfePc5QPn8x5MQctWBej
   git log --oneline -20
   git diff main...HEAD
   ```

---

### Copilot Branches (34) - REVIEW REQUIRED

#### High Priority - Likely Valuable
1. `copilot/implement-agentic-forces`
   - **Priority**: HIGH
   - Reason: May have alternative agentic implementation
   - Action: Review and merge if better than current

2. `copilot/implement-data-enrichment-pipeline`
   - **Priority**: HIGH
   - Reason: May conflict with current pipeline
   - Action: Review for complementary features

3. `copilot/add-vitest-testing-infrastructure`
   - **Priority**: HIGH
   - Reason: Testing infrastructure needed
   - Action: **MERGE** - Tests are high priority TODO item

4. `copilot/revamp-ui-modern-design`
   - **Priority**: MEDIUM
   - Reason: UI improvements always valuable
   - Action: Review for UX enhancements

#### Medium Priority - Potential Value
5. `copilot/add-dark-light-theme-toggle`
   - Action: Review and merge if complete

6. `copilot/add-realtime-crypto-graphs`
   - Action: Review - may not be relevant

7. `copilot/improve-data-scraping-reliability`
   - Action: Review for scraping improvements

8. `copilot/update-prospect-cards-design`
   - Action: Review for UI improvements

#### Documentation/Organization Branches
9. `copilot/create-docs-directory`
10. `copilot/create-docs-directory-again`
11. `copilot/document-ui-changes-dashboard`
12. `copilot/organize-repo-structure`
13. `copilot/update-repo-metadata-organization`
    - Action: Review for docs improvements, likely delete if redundant

#### Bug Fix Branches
14. `copilot/fix-all-dependencies-in-one-sweep`
15. `copilot/fix-ci-feedback-issues`
16. `copilot/fix-markdown-language-identifier`
17. `copilot/fix-network-issues-in-ci`
18. `copilot/fix-retry-count-issues`
    - Action: Review if fixes still needed, otherwise delete

#### Merge/Cleanup Branches (Likely Stale)
19. `copilot/clean-disparate-branches`
20. `copilot/merge-multiple-approved-branches`
21. `copilot/merge-open-prs-and-organize-repo`
22. `copilot/merge-suggestions-into-main`
23. `copilot/wrap-up-pull-requests-36-45-48`
24. `copilot/address-open-ended-pr-comments`
25. `copilot/address-open-ended-pr-comments-again`
26. `copilot/review-and-fix-pull-requests`
    - Action: **DELETE** - Cleanup branches likely obsolete

#### Feature/Research Branches
27. `copilot/brainstorm-cash-advance-leads`
28. `copilot/filter-small-business-leads`
29. `copilot/gather-user-team-feedback`
30. `copilot/research-mcp-servers-open-source`
31. `copilot/research-similar-applications`
32. `copilot/expand-critique-on-gemini`
33. `copilot/create-ui-mockups-dashboard-prospect-cards`
34. `copilot/implement-redesigned-dashboard`
35. `copilot/push-uphill-boulder`
    - Action: Review for research value, merge docs, delete code branches

---

### Codex Branches (11) - GitHub Actions Related

#### Code Scanning Branches (5 - Likely Duplicates)
1. `codex/enable-code-scanning-with-github-actions-2025-11-1221-47-54`
2. `codex/enable-code-scanning-with-github-actions-2025-11-1222-03-35`
3. `codex/enable-code-scanning-with-github-actions-2025-11-1222-03-46`
4. `codex/enable-code-scanning-with-github-actions-2025-11-1222-03-55`
   - **Action**: Review latest, merge if beneficial, delete others
   - Note: May be superseded by existing workflows

#### Bug Fix Branches (6)
5. `codex/fix-typeerror-and-git-workflow-errors-2025-11-1221-06-21`
6. `codex/fix-typeerror-and-git-workflow-errors-2025-11-1222-04-41`
7. `codex/fix-typeerror-and-git-workflow-errors-2025-11-1222-05-18`
8. `codex/fix-typeerror-and-git-workflow-errors-2025-11-1222-05-29`
   - **Action**: Review if fixes needed (we have TypeErrors in TODO)
   - Merge relevant fixes, delete others

#### Feature Branches
9. `codex/extend-improvementcategory-to-include-competitor-categories-2025-11-1222-05-58`
   - **Action**: **REVIEW** - Fixes ImprovementCategory type error (in TODO)

10. `codex/implement-cascade-forward-functionality-2025-11-1219-53-59`
    - **Action**: Review for feature value

---

### Dependabot Branches (5) - Dependency Updates

1. `dependabot/npm_and_yarn/eslint-plugin-react-refresh-0.4.24`
2. `dependabot/npm_and_yarn/radix-ui/react-popover-1.1.15`
3. `dependabot/npm_and_yarn/radix-ui/react-progress-1.1.8`
4. `dependabot/npm_and_yarn/radix-ui/react-slider-1.3.6`
5. `dependabot/npm_and_yarn/react-resizable-panels-3.0.6`

**Action for all**:
- Check if updates already in package.json
- Run `npm outdated` to see current versions
- Merge if beneficial and tested
- Delete after review

---

### Other Branches (1)

1. `pbpaste-|-patch`
   - **Action**: **DELETE** - Appears to be accidental paste
   - Command: `git push origin --delete pbpaste-|-patch`

---

## 📋 Cleanup Workflow

### Step 1: Immediate Deletions (No Review Needed)

```bash
# Delete merged branch
git push origin --delete claude/ingest-011CV5QdKEje5tQXRcESTTS6

# Delete accidental branch
git push origin --delete pbpaste-|-patch

# Delete obvious cleanup branches
git push origin --delete copilot/clean-disparate-branches
git push origin --delete copilot/merge-multiple-approved-branches
git push origin --delete copilot/merge-open-prs-and-organize-repo
git push origin --delete copilot/merge-suggestions-into-main
git push origin --delete copilot/wrap-up-pull-requests-36-45-48
```

### Step 2: High Priority Reviews (DO FIRST)

```bash
# 1. Review vitest testing infrastructure (HIGH PRIORITY)
git checkout copilot/add-vitest-testing-infrastructure
git log --oneline -10
git diff main...HEAD
# If good: merge to main

# 2. Review ImprovementCategory fix (FIXES TYPE ERROR)
git checkout codex/extend-improvementcategory-to-include-competitor-categories-2025-11-1222-05-58
git log --oneline -10
git diff main...HEAD
# If fixes type error: merge to main

# 3. Review agentic forces implementation
git checkout copilot/implement-agentic-forces
git log --oneline -10
git diff main...HEAD
# Compare with current implementation

# 4. Review data enrichment pipeline
git checkout copilot/implement-data-enrichment-pipeline
git log --oneline -10
git diff main...HEAD
# Check for conflicts with current pipeline
```

### Step 3: Medium Priority Reviews

```bash
# UI improvements
for branch in \
  copilot/revamp-ui-modern-design \
  copilot/update-prospect-cards-design \
  copilot/add-dark-light-theme-toggle; do
  git checkout $branch
  git log --oneline -5
  git diff main...HEAD --stat
done

# Data scraping improvements
git checkout copilot/improve-data-scraping-reliability
git log --oneline -10
git diff main...HEAD
```

### Step 4: Batch Delete After Review

```bash
# After reviewing, delete branches with no value
# Template:
git push origin --delete <branch-name>

# Example batch delete for reviewed branches:
for branch in \
  copilot/create-docs-directory \
  copilot/create-docs-directory-again \
  copilot/fix-all-dependencies-in-one-sweep; do
  git push origin --delete $branch
done
```

### Step 5: Dependabot Updates

```bash
# Check current package versions
npm outdated

# Review and merge each dependabot branch if needed
git checkout dependabot/npm_and_yarn/eslint-plugin-react-refresh-0.4.24
# Test, then merge or delete
```

---

## 🎯 Success Criteria

### Target State
- **Active Branches**: 3-5 (main + active development)
- **Archived Branches**: 0 (all merged or deleted)
- **Stale Branches**: 0

### Completion Checklist
- [ ] All valuable code merged to main
- [ ] All duplicate branches deleted
- [ ] All stale branches deleted
- [ ] Documentation updated
- [ ] Team notified of changes

---

## 📊 Estimated Cleanup Results

### Before Cleanup
- Total Branches: 52
- Active: 1 (main)
- Stale: 51

### After Cleanup (Estimated)
- Total Branches: 3-5
- Active: 1 (main)
- Development: 2-4 (active features)
- Stale: 0

### Breakdown
- **DELETE Immediately**: ~10 branches (merged, accidental, cleanup)
- **REVIEW & MERGE**: ~15 branches (valuable features, fixes)
- **REVIEW & DELETE**: ~25 branches (stale, superseded)
- **KEEP**: 2-3 branches (active development)

---

## ⚠️ Important Notes

1. **Always Review Before Deleting**
   - Check commit history
   - Compare with main
   - Look for unique code
   - Verify not in active use

2. **Backup Strategy**
   - Git retains deleted branch history
   - Can recover within 90 days: `git reflog`
   - Can recreate from commit SHA
   - No permanent data loss

3. **Communication**
   - Notify team before mass deletion
   - Document merged changes
   - Update project documentation
   - Share cleanup results

4. **Automation**
   - Consider GitHub branch protection rules
   - Set up auto-delete for merged branches
   - Configure stale branch warnings
   - Use branch naming conventions

---

## 📅 Recommended Timeline

### Week 1: High Priority
- Day 1: Delete obvious branches (merged, accidental)
- Day 2-3: Review and merge high priority branches
- Day 4-5: Review and merge medium priority branches

### Week 2: Cleanup
- Day 1-2: Review remaining branches
- Day 3: Batch delete reviewed branches
- Day 4: Verify cleanup
- Day 5: Document and communicate

---

## 🔗 Related Documents

- [TODO.md](./TODO.md) - Project todo list
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Branch naming conventions
- [README.md](./README.md) - Project overview

---

**Next Action**: Review high priority branches listed in Step 2
**Owner**: Development Team
**Due Date**: Within 2 weeks
