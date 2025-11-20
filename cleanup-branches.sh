#!/bin/bash
# Branch Cleanup Script
# This script deletes all redundant branches identified in the consolidation
# Run this after verifying the consolidated branch is working correctly

set -e

echo "================================"
echo "Branch Cleanup Script"
echo "================================"
echo ""
echo "This will delete 17 redundant branches from the remote repository."
echo "These branches have been merged into: claude/merge-all-branches-01T7PkKwVUqzxhquL2TR3JvL"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Cleanup cancelled."
  exit 0
fi

echo ""
echo "Starting branch deletion..."
echo ""

# Counter for success/failure
SUCCESS=0
FAILED=0

# Function to delete a branch
delete_branch() {
  local branch=$1
  echo -n "Deleting $branch... "
  if git push origin --delete "$branch" 2>/dev/null; then
    echo "✅ SUCCESS"
    ((SUCCESS++))
  else
    echo "❌ FAILED"
    ((FAILED++))
  fi
}

# Already merged branches
echo "=== Already Merged Branches ==="
delete_branch "claude/add-recursive-generative-features-015ESCQkNm9jqsM5xDtXBpef"

# Duplicate CodeQL branches
echo ""
echo "=== Duplicate CodeQL Branches ==="
delete_branch "codex/enable-code-scanning-with-github-actions-2025-11-1221-47-54"
delete_branch "codex/enable-code-scanning-with-github-actions-2025-11-1222-03-35"
delete_branch "codex/enable-code-scanning-with-github-actions-2025-11-1222-03-46"
delete_branch "codex/enable-code-scanning-with-github-actions-2025-11-1222-03-55"

# Duplicate TypeError fix branches (keeping the latest one that was merged)
echo ""
echo "=== Duplicate TypeError Fix Branches ==="
delete_branch "codex/fix-typeerror-and-git-workflow-errors-2025-11-1221-06-21"
delete_branch "codex/fix-typeerror-and-git-workflow-errors-2025-11-1222-04-41"
delete_branch "codex/fix-typeerror-and-git-workflow-errors-2025-11-1222-05-18"

# Planning-only branches
echo ""
echo "=== Planning-Only Branches ==="
delete_branch "copilot/fix-ci-feedback-issues"
delete_branch "copilot/merge-multiple-approved-branches"

# Already merged/no unique commits
echo ""
echo "=== Already Merged/No Unique Commits ==="
delete_branch "copilot/merge-open-prs-and-organize-repo"
delete_branch "copilot/merge-suggestions-into-main"

# Reverted feature
echo ""
echo "=== Reverted Features ==="
delete_branch "copilot/add-realtime-crypto-graphs"

# Superseded by consolidation
echo ""
echo "=== Superseded by Consolidation ==="
delete_branch "copilot/add-vitest-testing-infrastructure"
delete_branch "copilot/address-open-ended-pr-comments"
delete_branch "copilot/expand-critique-on-gemini"
delete_branch "pbpaste-|-patch"

echo ""
echo "================================"
echo "Cleanup Summary"
echo "================================"
echo "Successfully deleted: $SUCCESS branches"
echo "Failed to delete: $FAILED branches"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ All redundant branches have been deleted!"
else
  echo "⚠️  Some branches could not be deleted. You may need admin rights."
  echo "   Check the output above for details."
fi

echo ""
echo "=== Optionally Delete Merged Branches ==="
echo ""
echo "The following branches were successfully merged and can be deleted:"
echo "  - claude/add-recursive-generative-features-0118tVWmwCvXDha8jv9GEZae"
echo "  - codex/implement-cascade-forward-functionality-2025-11-1219-53-59"
echo "  - codex/fix-typeerror-and-git-workflow-errors-2025-11-1222-05-29"
echo "  - copilot/implement-data-enrichment-pipeline"
echo "  - copilot/push-uphill-boulder"
echo "  - copilot/fix-retry-count-issues"
echo "  - copilot/revamp-ui-modern-design"
echo ""
read -p "Delete these merged branches too? (yes/no): " delete_merged

if [ "$delete_merged" == "yes" ]; then
  echo ""
  echo "=== Deleting Merged Branches ==="
  delete_branch "claude/add-recursive-generative-features-0118tVWmwCvXDha8jv9GEZae"
  delete_branch "codex/implement-cascade-forward-functionality-2025-11-1219-53-59"
  delete_branch "codex/fix-typeerror-and-git-workflow-errors-2025-11-1222-05-29"
  delete_branch "copilot/implement-data-enrichment-pipeline"
  delete_branch "copilot/push-uphill-boulder"
  delete_branch "copilot/fix-retry-count-issues"
  delete_branch "copilot/revamp-ui-modern-design"
fi

echo ""
echo "================================"
echo "Final Summary"
echo "================================"
echo "Successfully deleted: $SUCCESS branches"
echo "Failed to delete: $FAILED branches"
echo ""
echo "Remaining active branches:"
git branch -r | grep -E "(main|claude/merge-all-branches)" || echo "  (run 'git branch -r' to see all branches)"
echo ""
echo "✅ Cleanup complete!"
