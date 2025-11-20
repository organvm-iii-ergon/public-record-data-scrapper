# PR Comment Resolution Workflow

This document describes the workflow for managing and resolving open-ended PR comments in the organization.

---

## Overview

The goal of this workflow is to ensure that:
- No PR comments are left unaddressed
- Complex discussions have clear ownership and timelines
- Decisions are documented and tracked
- Collaboration remains efficient and transparent

---

## Workflow Diagram

```
New PR Comment
     ↓
Is it straightforward? ──Yes──> Address in PR conversation
     ↓ No                             ↓
     ↓                           Mark as resolved
     ↓
Add to PR_COMMENTS_TRACKING.md
     ↓
Assign owner & set priority
     ↓
Does it need an issue? ──Yes──> Create issue using template
     ↓ No                             ↓
     ↓                           Link to PR_COMMENTS_TRACKING.md
     ↓
Discuss & decide
     ↓
Implement resolution
     ↓
Update documentation
     ↓
Mark as resolved in GitHub
     ↓
Close issue (if created)
```

---

## Roles and Responsibilities

### Comment Author (Reviewer)
- Write clear, actionable comments
- Use appropriate labels/tags
- Respond to follow-up questions
- Approve resolution once complete

### PR Author (Contributor)
- Acknowledge all comments within 48 hours
- Address straightforward comments immediately
- Escalate complex comments to tracking system
- Implement approved resolutions
- Mark resolved comments

### Comment Owner (Assigned)
- Drive discussion to resolution
- Coordinate with stakeholders
- Document decisions
- Update tracking documents
- Ensure timely closure

### Maintainers
- Review tracking document weekly
- Assign owners to unassigned comments
- Escalate blocked items
- Approve resolutions
- Maintain the tracking system

---

## Step-by-Step Process

### Step 1: Comment Creation

When leaving a PR comment that requires discussion:

1. **Use clear labels**:
   - `[Question]` - Seeking clarification
   - `[Suggestion]` - Proposing an improvement
   - `[Security]` - Security concern
   - `[Blocker]` - Must be resolved before merge
   - `[Discussion]` - Requires team discussion
   - `[Decision]` - Needs architectural decision

2. **Be specific**: 
   - State the concern clearly
   - Provide examples if helpful
   - Suggest alternatives if possible

3. **Set expectations**:
   - Indicate if it blocks merge
   - Mention relevant stakeholders

**Example**:
```
[Security][Blocker] Database credentials are hardcoded on line 194. 
This is a security risk.

Recommendation: Use environment variables via process.env or a secrets 
management tool like HashiCorp Vault.

@security-team for review
```

### Step 2: Immediate Response

**Within 48 hours**, the PR author should:

1. Acknowledge the comment
2. For straightforward issues:
   - Make the fix
   - Comment with solution
   - Request resolution approval
   - Mark as resolved once approved

3. For complex issues:
   - Respond with understanding
   - Tag relevant people
   - Indicate it will be added to tracking

**Example Response**:
```
Thanks for catching this! You're right, we shouldn't hardcode credentials.

For this documentation PR, I'll update the guide to show environment 
variable usage instead. 

Adding to PR_COMMENTS_TRACKING.md for proper resolution workflow.
```

### Step 3: Add to Tracking Document

If the comment is open-ended or requires discussion:

1. Open `PR_COMMENTS_TRACKING.md`
2. Find the PR section
3. Add the comment using the template
4. Include:
   - Comment text
   - Type and priority
   - Current status
   - Owner (if known)
   - Action items
   - Discussion points

### Step 4: Create Issue (If Needed)

For comments that require significant discussion or implementation:

1. Use the issue template: `.github/ISSUE_TEMPLATE/open-ended-pr-comment.md`
2. Fill in all sections
3. Link to the PR and original comment
4. Tag stakeholders
5. Set priority and timeline
6. Reference in PR_COMMENTS_TRACKING.md

**When to create an issue**:
- Discussion will take >3 days
- Multiple stakeholders need input
- Requires implementation work
- Architectural decision needed
- Security issue requiring team review

### Step 5: Discussion and Resolution

1. **Discuss in the issue** (if created) or PR comments
2. **Document key points** and tradeoffs
3. **Make a decision** with stakeholder consensus
4. **Document the decision** in tracking document
5. **Create action items** for implementation

### Step 6: Implementation

1. **If code changes needed**:
   - Create new PR or update existing PR
   - Reference the comment/issue
   - Implement the agreed solution

2. **If documentation needed**:
   - Update relevant docs
   - Add notes to tracking document
   - Link to commits

3. **Test the resolution**:
   - Verify the change works
   - Get approval from comment author

### Step 7: Mark as Resolved

1. **Update PR_COMMENTS_TRACKING.md**:
   - Change status to "Resolved"
   - Add resolution date
   - Link to commits/PRs
   - Document the solution

2. **Mark GitHub comment as resolved**:
   - In the PR, click "Resolve conversation"
   - Add final comment summarizing resolution

3. **Close related issue** (if created):
   - Update issue with resolution details
   - Close the issue
   - Link to implementation

### Step 8: Weekly Review

**Every week**, maintainers should:

1. Review PR_COMMENTS_TRACKING.md
2. Check for:
   - Unassigned comments (assign owners)
   - Overdue comments (follow up)
   - Stale discussions (move forward)
   - Blocked items (escalate)

3. Update status of all open items
4. Close resolved items that haven't been closed
5. Create issues for items that need them

---

## Best Practices

### For All Participants

- **Respond promptly**: Don't let comments sit unacknowledged
- **Be respectful**: Assume good intent
- **Be clear**: Avoid ambiguous language
- **Document decisions**: Don't rely on memory
- **Follow through**: Complete action items

### For Comment Authors

- **Be constructive**: Focus on improvement
- **Provide context**: Explain why something matters
- **Suggest solutions**: Don't just point out problems
- **Be willing to discuss**: Be open to alternative approaches

### For PR Authors

- **Don't be defensive**: Comments are meant to help
- **Ask questions**: Seek clarification if unsure
- **Prioritize**: Address blockers first
- **Keep it moving**: Don't let PRs stagnate

### For Owners

- **Drive to resolution**: Don't let items languish
- **Seek input**: Get stakeholder buy-in
- **Document well**: Make decisions clear
- **Update promptly**: Keep tracking current

---

## Metrics and Goals

### Target Metrics

- **Response time**: <48 hours for initial acknowledgment
- **Resolution time**: 
  - High priority: <7 days
  - Medium priority: <14 days
  - Low priority: <30 days
- **Stale comments**: 0 comments >30 days without update

### Tracking

Review these metrics in weekly meetings:
- Number of open comments
- Average resolution time
- Comments by priority
- Overdue comments
- Newly opened vs resolved comments

---

## Tools and Automation

### Current Tools

- **PR_COMMENTS_TRACKING.md**: Manual tracking document
- **GitHub Issues**: For complex discussions
- **Issue Template**: For creating tracking issues
- **GitHub comment resolution**: For marking resolved

### Potential Automation

Consider implementing:
- Bot to flag unresolved comments
- Auto-add to tracking document
- Reminder notifications for overdue items
- Dashboard for comment metrics
- Integration with project management tools

---

## Escalation Path

If a comment cannot be resolved:

1. **Day 1-7**: Normal discussion in PR/issue
2. **Day 8-14**: Owner escalates to maintainers
3. **Day 15-21**: Maintainers involve relevant stakeholders
4. **Day 22+**: Leadership decision or defer to future work

---

## Examples

### Example 1: Security Issue

**Comment**: "[Security][Blocker] Hardcoded password on line 42"

**Workflow**:
1. PR author acknowledges within 24 hours
2. Adds to tracking document as HIGH priority
3. Implements fix using environment variables
4. Comment author reviews and approves
5. Mark as resolved in GitHub and tracking doc

**Duration**: 1-2 days

### Example 2: Architectural Decision

**Comment**: "[Decision] Should we use implementation guide or ADRs?"

**Workflow**:
1. PR author acknowledges, notes need for team discussion
2. Creates issue using template
3. Adds to tracking document
4. Team discusses over 5 days in issue
5. Decision made: Use ADRs for decisions, keep guide for implementation
6. Document decision in tracking
7. PR author updates documentation accordingly
8. Close issue and resolve comment

**Duration**: 7-10 days

### Example 3: Minor Suggestion

**Comment**: "[Suggestion] Consider using const instead of let here"

**Workflow**:
1. PR author makes change immediately
2. Comments "Done, thanks!"
3. Mark as resolved
4. No tracking needed

**Duration**: <1 day

---

## Continuous Improvement

This workflow should evolve based on team needs. Suggestions for improvement:

- Create a GitHub Action to automate tracking
- Add a comment template for common scenarios
- Develop a browser extension for quick tracking
- Integrate with Slack/Teams for notifications
- Create a dashboard for visualization

**Feedback**: Please open an issue with suggestions for improving this workflow.

---

## Summary

This workflow ensures:
✅ No comments are forgotten
✅ Complex discussions have structure
✅ Decisions are documented
✅ Everyone knows their responsibilities
✅ PRs move forward efficiently

By following this process, we maintain high code quality while keeping collaboration smooth and productive.
