#!/usr/bin/env bash
# ==============================================================================
# Agent Workforce Harness for public-record-data-scrapper
# Provides conflict-free claiming, worktree management, preflight checks, and
# PR submission for autonomous multi-agent systems across local and remote runs.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKTREE_BASE_DIR="$(cd "${REPO_ROOT}/.." && pwd)/public-record-data-scrapper-worktrees"

log() {
  printf "[\033[1;34mHARNESS\033[0m] %s\n" "$*"
}

err() {
  printf "[\033[1;31mERROR\033[0m] %s\n" "$*" >&2
}

cmd_claim() {
  local issue_id="${1:-}"
  if [[ -z "$issue_id" ]]; then
    err "Usage: $0 claim <issue-id>"
    exit 1
  fi

  log "Inspecting issue #${issue_id} on GitHub..."
  local issue_json
  issue_json=$(gh issue view "$issue_id" --json title,labels,state)

  local state
  state=$(echo "$issue_json" | jq -r .state)
  if [[ "$state" != "OPEN" ]]; then
    err "Issue #${issue_id} is ${state}, not OPEN."
    exit 1
  fi

  local title
  title=$(echo "$issue_json" | jq -r .title)
  local labels
  labels=$(echo "$issue_json" | jq -r '.labels[].name')

  # Determine owning lane from labels
  local lane=""
  if echo "$labels" | grep -q "lane:heal"; then
    lane="lane/heal"
  elif echo "$labels" | grep -q "lane:verify"; then
    lane="lane/verify"
  elif echo "$labels" | grep -q "lane:expand"; then
    lane="lane/expand-public-records"
  elif echo "$labels" | grep -q "lane:evolve"; then
    lane="lane/evolve-platform"
  else
    err "Issue #${issue_id} does not have a valid lane label (lane:heal, lane:verify, lane:expand, lane:evolve)."
    exit 1
  fi

  # Check if already claimed
  if echo "$labels" | grep -q "agent:claimed"; then
    err "Issue #${issue_id} is already claimed by another agent."
    exit 1
  fi

  local slug
  slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//' | cut -c 1-30)
  local lane_suffix="${lane#lane/}"
  local branch_name="work/${lane_suffix}/${issue_id}-${slug}"
  local worktree_path="${WORKTREE_BASE_DIR}/${issue_id}-${slug}"

  log "Owning lane: ${lane}"
  log "Branch name: ${branch_name}"
  log "Worktree path: ${worktree_path}"

  mkdir -p "$WORKTREE_BASE_DIR"

  # Sync lane from origin
  git -C "$REPO_ROOT" fetch origin "$lane"

  # Check if branch exists
  if git -C "$REPO_ROOT" rev-parse --verify "$branch_name" >/dev/null 2>&1; then
    err "Branch ${branch_name} already exists locally."
    exit 1
  fi

  # Create worktree
  log "Creating git worktree branched from origin/${lane}..."
  git -C "$REPO_ROOT" worktree add -b "$branch_name" "$worktree_path" "origin/${lane}"

  # Set up environment in worktree
  log "Installing locked workspace dependencies in worktree..."
  (cd "$worktree_path" && npm ci --ignore-scripts --no-audit --no-fund)

  # Update GitHub issue status
  log "Updating issue #${issue_id} on GitHub..."
  gh issue edit "$issue_id" --add-label "agent:claimed" --remove-label "agent:ready"
  gh issue comment "$issue_id" --body "🤖 **Agent Claim**: Claimed by agent. Isolated worktree created on branch \`${branch_name}\` from \`${lane}\` at $(date -u +'%Y-%m-%dT%H:%M:%SZ')."

  log "✅ Claim complete! To start work:"
  echo "cd \"$worktree_path\""
}

cmd_preflight() {
  local target_dir
  target_dir="$(pwd)"

  log "Running multi-agent preflight verification in ${target_dir}..."

  log "1/5 Checking formatting..."
  npx prettier --check .

  log "2/5 Running ESLint..."
  npm run lint

  log "3/5 Running TypeScript typecheck..."
  npm run typecheck

  log "4/5 Running Server Vitest Suite..."
  ./node_modules/.bin/vitest run --config vitest.config.server.ts --coverage.enabled=false

  log "5/5 Running Production Build..."
  npm run build:render

  mkdir -p .quality
  local receipt_file=".quality/agent-receipt.json"
  cat > "$receipt_file" << EOF
{
  "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "commit": "$(git rev-parse HEAD)",
  "branch": "$(git rev-parse --abbrev-ref HEAD)",
  "status": "GREEN",
  "checks": [
    "prettier",
    "eslint",
    "typecheck",
    "server-tests",
    "build:render"
  ]
}
EOF

  log "✅ Preflight passed 100%! Receipt written to ${receipt_file}"
}

cmd_submit() {
  local target_dir
  target_dir="$(pwd)"
  local receipt_file="${target_dir}/.quality/agent-receipt.json"

  if [[ ! -f "$receipt_file" ]]; then
    err "No preflight receipt found. You must run '$0 preflight' before submitting."
    exit 1
  fi

  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$branch" == "main" || "$branch" =~ ^lane/ ]]; then
    err "Cannot submit directly from ${branch}. You must be on a work/* branch."
    exit 1
  fi

  # Determine target lane from branch pattern
  local base_lane=""
  if [[ "$branch" =~ ^work/heal/ ]]; then
    base_lane="lane/heal"
  elif [[ "$branch" =~ ^work/verify/ ]]; then
    base_lane="lane/verify"
  elif [[ "$branch" =~ ^work/expand-public-records/ ]]; then
    base_lane="lane/expand-public-records"
  elif [[ "$branch" =~ ^work/evolve-platform/ ]]; then
    base_lane="lane/evolve-platform"
  else
    err "Cannot determine target lane from branch name '${branch}'."
    exit 1
  fi

  # Extract issue number
  local issue_id
  issue_id=$(echo "$branch" | grep -oE '[0-9]+' | head -1 || true)

  log "Pushing branch ${branch} to origin..."
  git push -u origin "$branch"

  log "Opening pull request against ${base_lane}..."
  local pr_url
  pr_url=$(gh pr create \
    --base "$base_lane" \
    --head "$branch" \
    --title "$(git log -1 --format=%s)" \
    --body "## Recovered Intention
Addresses #${issue_id} on \`${base_lane}\`.

## Changes
$(git log "origin/${base_lane}..HEAD" --oneline)

## Verification Proof
Preflight verification passed locally. Receipt generated at \`.quality/agent-receipt.json\`.
Ref: #${issue_id}")

  log "PR opened: ${pr_url}"

  if [[ -n "$issue_id" ]]; then
    gh issue edit "$issue_id" --add-label "agent:in-review" --remove-label "agent:claimed"
    gh issue comment "$issue_id" --body "🚀 **Agent Submission**: PR opened at ${pr_url} targeting \`${base_lane}\`."
  fi

  log "✅ Submission complete!"
}

cmd_release() {
  local issue_id="${1:-}"
  if [[ -z "$issue_id" ]]; then
    err "Usage: $0 release <issue-id>"
    exit 1
  fi

  log "Releasing claim on issue #${issue_id}..."
  gh issue edit "$issue_id" --add-label "agent:ready" --remove-label "agent:claimed"
  gh issue comment "$issue_id" --body "⚠️ **Agent Release**: Work claim released. Task restored to \`agent:ready\`."
  log "✅ Issue #${issue_id} released and ready for other agents."
}

case "${1:-}" in
  claim)
    shift
    cmd_claim "$@"
    ;;
  preflight)
    shift
    cmd_preflight "$@"
    ;;
  submit)
    shift
    cmd_submit "$@"
    ;;
  release)
    shift
    cmd_release "$@"
    ;;
  *)
    echo "Usage: $0 {claim <issue-id>|preflight|submit|release <issue-id>}"
    exit 1
    ;;
esac
