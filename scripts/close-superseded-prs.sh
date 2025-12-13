#!/bin/bash
# Close Superseded PRs
# This script provides commands to close the 11 PRs that were superseded by PR #109

set -e

echo "════════════════════════════════════════════════════════════════"
echo "Close Superseded PRs - Command Generator"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "11 PRs need to be closed as they were superseded by PR #109"
echo "(Branch Consolidation)"
echo ""
echo "════════════════════════════════════════════════════════════════"

# Check if gh CLI is available
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI (gh) is available"
    echo ""
    read -p "Do you want to close these PRs now? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Cancelled. Commands shown below for manual execution."
        MANUAL=true
    else
        MANUAL=false
    fi
else
    echo "⚠️  GitHub CLI (gh) not found. Showing commands for manual execution."
    MANUAL=true
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Group 1: Duplicate TypeError Fixes (3 PRs)"
echo "════════════════════════════════════════════════════════════════"

MSG_TYPEERROR="This PR has been superseded by the branch consolidation in PR #109, which merged the latest version of the TypeError fixes (codex/fix-typeerror-and-git-workflow-errors-2025-11-1222-05-29). All functionality from this PR is now in main. Closing as duplicate/superseded."

for pr in 89 94 95; do
    echo ""
    echo "PR #$pr - TypeError fix (superseded)"
    if [ "$MANUAL" = true ]; then
        echo "  gh pr close $pr --comment \"$MSG_TYPEERROR\""
    else
        echo -n "  Closing... "
        if gh pr close $pr --comment "$MSG_TYPEERROR" 2>/dev/null; then
            echo "✅ Closed"
        else
            echo "❌ Failed (may need manual action)"
        fi
    fi
done

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Group 2: Duplicate CodeQL Workflows (4 PRs)"
echo "════════════════════════════════════════════════════════════════"

MSG_CODEQL="This PR is a duplicate. The repository already has CodeQL code scanning enabled in \`.github/workflows/codeql.yml\` on the main branch. Closing as duplicate. CodeQL is already active and running."

for pr in 90 91 92 93; do
    echo ""
    echo "PR #$pr - CodeQL workflow (duplicate)"
    if [ "$MANUAL" = true ]; then
        echo "  gh pr close $pr --comment \"$MSG_CODEQL\""
    else
        echo -n "  Closing... "
        if gh pr close $pr --comment "$MSG_CODEQL" 2>/dev/null; then
            echo "✅ Closed"
        else
            echo "❌ Failed (may need manual action)"
        fi
    fi
done

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Group 3: Superseded Features (4 PRs)"
echo "════════════════════════════════════════════════════════════════"

echo ""
echo "PR #36 - expand-critique-on-gemini (testing infrastructure)"
MSG_36="This PR has been superseded by the branch consolidation in PR #109. The testing infrastructure and UI components from this PR were included in the copilot/revamp-ui-modern-design branch, which was successfully merged as part of the comprehensive consolidation. All valuable features from this PR are now in main. Closing as superseded."

if [ "$MANUAL" = true ]; then
    echo "  gh pr close 36 --comment \"$MSG_36\""
else
    echo -n "  Closing... "
    if gh pr close 36 --comment "$MSG_36" 2>/dev/null; then
        echo "✅ Closed"
    else
        echo "❌ Failed (may need manual action)"
    fi
fi

echo ""
echo "PR #50 - pbpaste-|-patch (component refactoring)"
MSG_50="This PR has been superseded by the branch consolidation in PR #109. The component refactoring and scraper improvements from this PR were included in the copilot/push-uphill-boulder and related branches that were successfully merged as part of the comprehensive consolidation. All valuable changes from this PR are now in main. Closing as superseded."

if [ "$MANUAL" = true ]; then
    echo "  gh pr close 50 --comment \"$MSG_50\""
else
    echo -n "  Closing... "
    if gh pr close 50 --comment "$MSG_50" 2>/dev/null; then
        echo "✅ Closed"
    else
        echo "❌ Failed (may need manual action)"
    fi
fi

echo ""
echo "PR #57 - add-realtime-crypto-graphs (revert, not needed)"
MSG_57="This PR is no longer needed. The crypto tracking features that this PR would have reverted were not included in the branch consolidation (PR #109). The repository is now in a clean state without the crypto features, making this revert PR unnecessary. Closing as not needed."

if [ "$MANUAL" = true ]; then
    echo "  gh pr close 57 --comment \"$MSG_57\""
else
    echo -n "  Closing... "
    if gh pr close 57 --comment "$MSG_57" 2>/dev/null; then
        echo "✅ Closed"
    else
        echo "❌ Failed (may need manual action)"
    fi
fi

echo ""
echo "PR #86 - fix-ci-feedback-issues (WIP/superseded)"
MSG_86="This WIP PR has been superseded by the branch consolidation in PR #109. CI and network connectivity issues were addressed in multiple branches that were merged as part of the consolidation, including codex/fix-typeerror-and-git-workflow-errors (CI improvements) and copilot/fix-retry-count-issues (network reliability). Closing as WIP/superseded."

if [ "$MANUAL" = true ]; then
    echo "  gh pr close 86 --comment \"$MSG_86\""
else
    echo -n "  Closing... "
    if gh pr close 86 --comment "$MSG_86" 2>/dev/null; then
        echo "✅ Closed"
    else
        echo "❌ Failed (may need manual action)"
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Summary"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "PRs to close: #36, 50, 57, 86, 89, 90, 91, 92, 93, 94, 95 (11 total)"
echo "Reason: All superseded by PR #109 (branch consolidation)"
echo ""
if [ "$MANUAL" = true ]; then
    echo "Commands above can be run manually or via GitHub web interface"
    echo ""
    echo "Or run this script with gh CLI installed to close automatically."
else
    echo "✅ All PR close commands have been executed."
    echo "   Check output above for any failures."
fi
echo ""
echo "════════════════════════════════════════════════════════════════"
