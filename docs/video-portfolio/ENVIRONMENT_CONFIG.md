# Environment Configuration Template

## Portfolio Video Production Settings

**Purpose:** Standardize input variables for consistent, customizable video production across different candidates and use cases.

---

## Configuration Variables

Copy and customize these environment variables before beginning video production. These values will be used throughout the script, visuals, and call-to-action.

---

### Repository & Project Information

```bash
# Repository location (absolute path or URL)
REPO_ROOT="/home/runner/work/public-record-data-scrapper/public-record-data-scrapper"

# Alternative: Remote repository URL
# REPO_ROOT="https://github.com/ivviiviivvi/public-record-data-scrapper"

# Project name (as it should appear in video)
PROJECT_NAME="UCC-MCA Intelligence Platform"

# One-line project description
PROJECT_TAGLINE="AI-powered lead generation for merchant cash advance providers"
```

---

### Candidate Information

```bash
# Your full name as it should appear in the video
CANDIDATE_NAME="[Your Full Name]"

# Your target role or professional positioning
# Examples:
# - "Product Strategist & Systems Architect"
# - "Creative Technologist"
# - "Digital Systems Lead"
# - "Full-Stack Product Engineer"
# - "Technical Product Manager"
CANDIDATE_ROLE_TARGET="Product Strategist & Systems Architect"

# Optional: Your current title (for context)
# CANDIDATE_CURRENT_TITLE="Senior Software Engineer"

# Optional: Years of experience (for positioning)
# CANDIDATE_YEARS_EXPERIENCE="8"
```

---

### Target Audience

```bash
# Primary audience for this video
# Options:
# - "non-technical executive"
# - "technical hiring manager"
# - "client / buyer"
# - "hiring committee"
# - "venture capital investor"
# - "board member"
TARGET_AUDIENCE="non-technical executive"

# Specific pain points this audience cares about (comma-separated)
AUDIENCE_PAIN_POINTS="time to revenue,competitive advantage,risk mitigation,team efficiency"

# Decision criteria this audience uses (comma-separated)
AUDIENCE_DECISION_CRITERIA="business value,communication clarity,strategic thinking,execution capability"
```

---

### Video Specifications

```bash
# Target video length (in minutes)
# Options: "2-3", "3-5", "5-7"
# Recommended: "3-5" for comprehensive presentation
VIDEO_LENGTH_TARGET="3-5"

# Video format
# Options: "16:9" (standard), "9:16" (vertical/mobile), "1:1" (square)
VIDEO_ASPECT_RATIO="16:9"

# Resolution
# Options: "1080p", "4K"
VIDEO_RESOLUTION="1080p"

# Frame rate
# Options: "30fps", "60fps"
VIDEO_FRAME_RATE="30fps"
```

---

### Tone & Voice

```bash
# Overall tone of the video
# Examples:
# - "clear, confident, intelligent, non-jargony"
# - "warm, approachable, authoritative"
# - "technical but accessible, precise"
# - "energetic, passionate, innovative"
TONE="clear, confident, intelligent, non-jargony"

# Voiceover style
# Options:
# - "calm professional" - Bloomberg Terminal narrator
# - "warm authoritative" - TED Talk presenter
# - "thoughtful explainer" - Documentary narrator
# - "energetic motivator" - Startup pitch energy
VOICE_STYLE="calm professional"

# Speaking pace (words per minute)
# Options: 140-160 (relaxed), 160-180 (moderate), 180-200 (brisk)
# Recommended: 150-160 for non-technical audiences
SPEAKING_PACE="150"
```

---

### Narrative Framework

```bash
# Narrative structure for the video
# Default: "Problem → Insight → Solution → Impact → Why Me"
# Alternative: "Challenge → Approach → Results → Differentiation"
NARRATIVE_FRAMEWORK="Problem → Insight → Solution → Impact → Why Me"

# Emphasis areas (what to spend more time on)
# Options: "business_value", "technical_depth", "execution_quality", "strategic_thinking"
# Can specify multiple, comma-separated
NARRATIVE_EMPHASIS="business_value,strategic_thinking"
```

---

### Brand & Visual Identity

```bash
# Path to your logo file (optional)
# Leave empty if no logo
# Example: "/path/to/logo.png"
BRAND_LOGO_PATH=""

# Primary brand color (hex code)
# Default from project: Navy Blue
BRAND_COLOR_PRIMARY="#1e2b5c"

# Accent color (hex code)
# Default from project: Warm Amber
BRAND_COLOR_ACCENT="#e0a825"

# Secondary color (hex code)
# Default from project: Cool Cyan
BRAND_COLOR_SECONDARY="#3daeb8"

# Background color (hex code)
# Default: Off-white
BRAND_COLOR_BACKGROUND="#f9fafb"

# Primary font family
# Examples: "IBM Plex Sans", "Inter", "Helvetica Neue", "Roboto"
BRAND_FONT_PRIMARY="IBM Plex Sans"

# Optional: Secondary font for emphasis or headings
# BRAND_FONT_SECONDARY="IBM Plex Serif"
```

---

### Visual Style Preferences

```bash
# Avatar/talking-head mode
# Options:
# - "none" - No personal appearance, voice-only
# - "subtle" - Brief appearances at key moments
# - "prominent" - Frequent talking-head throughout
# Recommended: "subtle" or "none" for most cases
AVATAR_MODE="subtle"

# Animation complexity
# Options: "minimal", "moderate", "complex"
# Recommended: "moderate" - professional without being distracting
ANIMATION_COMPLEXITY="moderate"

# Visual metaphor preference
# Options: "abstract", "concrete", "mixed"
# "abstract" - Geometric shapes, particles, data viz
# "concrete" - Real-world objects, familiar metaphors
# "mixed" - Combination approach
VISUAL_METAPHOR_STYLE="mixed"

# Use project screenshots
# Options: "yes", "no", "blurred"
# "yes" - Show actual UI
# "blurred" - Show UI but blur sensitive data
# "no" - Use mockups/diagrams only
USE_PROJECT_SCREENSHOTS="blurred"
```

---

### Audio Settings

```bash
# Background music
# Options: "yes", "no"
# If yes, use subtle, non-distracting instrumental
USE_BACKGROUND_MUSIC="yes"

# Music style (if enabled)
# Options: "minimal_piano", "ambient_electronic", "corporate_uplifting", "none"
MUSIC_STYLE="ambient_electronic"

# Music volume relative to voiceover (dB)
# Recommended: -20 to -25 (quiet background)
MUSIC_VOLUME="-22"

# Sound effects
# Options: "minimal", "moderate", "none"
# "minimal" - Only essential transitions (whoosh, appear)
# "moderate" - Reinforce key moments (chime, pop, alert)
SOUND_EFFECTS="minimal"

# Include closed captions
# Options: "yes", "no"
# Recommended: "yes" for accessibility
INCLUDE_CAPTIONS="yes"
```

---

### Call-to-Action

```bash
# Desired outcome from viewer
# Examples:
# - "book a call"
# - "request proposal"
# - "review resume"
# - "schedule interview"
# - "discuss project"
# - "explore collaboration"
CTA_OUTCOME="book a call"

# Your primary contact URL
# Examples:
# - "https://calendly.com/yourname/30min"
# - "https://yourwebsite.com/contact"
# - "https://linkedin.com/in/yourprofile"
CTA_URL="https://calendly.com/yourname/30min"

# Alternative contact methods (comma-separated, optional)
# Example: "email:you@example.com,linkedin:yourprofile"
CTA_ALTERNATIVE_CONTACTS="email:your.email@example.com"

# CTA message tone
# Options: "direct", "inviting", "collaborative"
# "direct" - "Let's talk about your needs"
# "inviting" - "I'd love to hear about what you're building"
# "collaborative" - "Let's explore how we can work together"
CTA_TONE="collaborative"
```

---

### Production Settings

```bash
# Production environment
# Options: "local", "cloud", "studio"
PRODUCTION_ENVIRONMENT="local"

# Animation software to use
# Options: "after_effects", "keynote", "canva", "figma", "powerpoint"
ANIMATION_SOFTWARE="keynote"

# Voiceover method
# Options: "self_recorded", "professional_voiceover", "ai_generated"
VOICEOVER_METHOD="self_recorded"

# Expected production timeline (days)
PRODUCTION_TIMELINE="7"

# Budget tier
# Options: "minimal" (<$100), "moderate" ($100-500), "professional" ($500+)
PRODUCTION_BUDGET="minimal"
```

---

### Feature Flags

```bash
# Show technical metrics (test count, coverage, etc.)
# Options: "yes", "no"
# Recommended: "yes" for technical roles, "no" for executive-only
SHOW_TECHNICAL_METRICS="yes"

# Include code snippets or terminal views
# Options: "yes", "no"
# Recommended: "no" for non-technical audiences
INCLUDE_CODE_VISUALS="no"

# Show team size or collaboration indicators
# Options: "yes", "no"
# Use if project involved team management
SHOW_TEAM_INDICATORS="no"

# Include timeline or project duration
# Options: "yes", "no"
SHOW_PROJECT_TIMELINE="yes"

# Mention specific technologies by name
# Options: "yes", "no"
# "no" = Use metaphors instead of "React", "PostgreSQL", etc.
MENTION_TECH_STACK="no"
```

---

### Optional: Project-Specific Context

```bash
# Business domain
# Examples: "fintech", "healthcare", "e-commerce", "SaaS", "marketplace"
BUSINESS_DOMAIN="fintech"

# Primary user persona
# Examples: "sales teams", "executives", "consumers", "developers"
PRIMARY_USER_PERSONA="sales teams"

# Key problem being solved (1-2 sentences)
KEY_PROBLEM="Merchant cash advance providers waste time manually searching scattered state databases for prospects, with no way to identify which businesses actually need financing right now."

# Key innovation or differentiator (1-2 sentences)
KEY_INNOVATION="Autonomous agents continuously monitor all 50 states and use ML to predict financing needs before businesses even realize they need it, creating a competitive intelligence advantage."

# Measurable impact (if available)
# Example: "Reduced prospect research time by 60%"
MEASURABLE_IMPACT="Reduced sales cycle by 60%, increased lead quality by 40%"
```

---

## Usage Instructions

### Step 1: Customize Variables

1. Copy this file to `.env.portfolio` in your repository
2. Fill in all `[Your ...]` placeholders
3. Adjust colors, fonts, and preferences to match your brand
4. Set target audience and CTA appropriately

### Step 2: Validate Configuration

```bash
# Check that all required variables are set
source .env.portfolio
echo "Candidate: $CANDIDATE_NAME"
echo "Role: $CANDIDATE_ROLE_TARGET"
echo "CTA: $CTA_URL"
```

### Step 3: Use in Production

Reference these variables throughout:

- **Script writing:** Personalize narration with `$CANDIDATE_NAME`
- **Visual design:** Use `$BRAND_COLOR_*` in all graphics
- **Call-to-action:** Display `$CTA_URL` in final frame
- **Export settings:** Use `$VIDEO_RESOLUTION` and `$VIDEO_FRAME_RATE`

---

## Configuration Presets

### Preset: Technical Leadership Role

```bash
TARGET_AUDIENCE="technical hiring manager"
CANDIDATE_ROLE_TARGET="Technical Lead & Systems Architect"
NARRATIVE_EMPHASIS="technical_depth,strategic_thinking"
SHOW_TECHNICAL_METRICS="yes"
MENTION_TECH_STACK="yes"
VOICE_STYLE="calm professional"
```

### Preset: Product Management Role

```bash
TARGET_AUDIENCE="non-technical executive"
CANDIDATE_ROLE_TARGET="Product Strategist & Systems Designer"
NARRATIVE_EMPHASIS="business_value,strategic_thinking"
SHOW_TECHNICAL_METRICS="no"
MENTION_TECH_STACK="no"
VOICE_STYLE="warm authoritative"
```

### Preset: Consultant/Freelancer

```bash
TARGET_AUDIENCE="client / buyer"
CANDIDATE_ROLE_TARGET="Digital Systems Consultant"
NARRATIVE_EMPHASIS="business_value,execution_quality"
CTA_OUTCOME="discuss project"
CTA_TONE="collaborative"
VOICE_STYLE="thoughtful explainer"
```

### Preset: Startup Founder Pitch

```bash
TARGET_AUDIENCE="venture capital investor"
CANDIDATE_ROLE_TARGET="Founder & Technical Lead"
NARRATIVE_EMPHASIS="business_value,strategic_thinking"
VIDEO_LENGTH_TARGET="2-3"
VOICE_STYLE="energetic motivator"
CTA_OUTCOME="schedule meeting"
```

---

## Template Validation Checklist

Before beginning production, ensure:

- [ ] `CANDIDATE_NAME` is set and correctly spelled
- [ ] `CTA_URL` is valid and accessible
- [ ] Brand colors are specified in hex format
- [ ] `TARGET_AUDIENCE` matches your actual target viewer
- [ ] `VIDEO_LENGTH_TARGET` is realistic for your content
- [ ] `CANDIDATE_ROLE_TARGET` accurately describes your positioning
- [ ] All file paths (logo, etc.) are valid if specified
- [ ] `TONE` and `VOICE_STYLE` are consistent with each other
- [ ] `NARRATIVE_EMPHASIS` aligns with `TARGET_AUDIENCE` priorities

---

## Advanced: Dynamic Content Generation

If using automated video generation tools, you can use these variables programmatically:

```javascript
// Example: Load config and generate personalized script
const config = require('./.env.portfolio')

const hook = `Every day, thousands of businesses in ${config.BUSINESS_DOMAIN} 
face a critical problem: ${config.KEY_PROBLEM}`

const cta = `If you're looking for ${config.CANDIDATE_ROLE_TARGET}, 
let's ${config.CTA_OUTCOME}. Visit ${config.CTA_URL}`
```

---

## Updating Configuration

### When to Update:

- **Targeting different role:** Change `CANDIDATE_ROLE_TARGET`, `TARGET_AUDIENCE`, `NARRATIVE_EMPHASIS`
- **Different project:** Change `PROJECT_NAME`, `KEY_PROBLEM`, `KEY_INNOVATION`
- **Brand refresh:** Update `BRAND_COLOR_*` and `BRAND_FONT_*`
- **New CTA:** Update `CTA_URL`, `CTA_OUTCOME`

### Version Control:

- Keep `.env.portfolio.template` in repository (with placeholders)
- Add `.env.portfolio` to `.gitignore` (personal information)
- Document changes in `CHANGELOG.md` if updating template structure

---

**Remember:** These variables are the foundation of your video. Take time to set them thoughtfully—they'll save hours during production and ensure consistency throughout.
