# Smart One Marketing Website Implementation Plan

## Objective

Build a production-grade public marketing website at `one.jenix.in` that:

- positions Smart One by Jenix as an OEM IoT platform
- supports Google OAuth homepage validation
- supports Google Play compliance
- provides legal pages and support routes
- drives OEM, API, and integration enquiries

## Phase 1 Scope

Phase 1 should include:

- Homepage
- Platform page
- OEM page
- Integrations page
- Developers page
- Security page
- About page
- Contact page
- Support page
- Privacy page
- Terms page
- Cookies page
- Acceptable Use page
- Data Deletion page
- Refund Policy page
- `/login` redirect to app
- `/signup` sales or onboarding route

## Deliverables

### 1. Brand foundation

- logo usage rules
- color system
- typography system
- CTA language system
- company/legal identity block

### 2. Page architecture

- route-by-route content model
- shared section inventory
- reusable trust, capability, OEM, API, security, and legal components

### 3. Technical structure

- `apps/marketing-web`
- shared components under `src/components`
- page sections under `src/sections`
- page routes under `src/pages`
- legal content under `src/legal`
- SEO metadata helpers under `src/seo`

### 4. Compliance layer

- privacy policy content
- terms structure
- data deletion page
- contact/support disclosures
- OAuth-facing metadata consistency

## Recommended Build Order

### Step 1

Set up the marketing app shell:

- layout
- responsive header
- footer
- shared CTA bar
- page container rules
- SEO wrapper

### Step 2

Build the homepage:

- hero
- trust strip
- platform features
- Jenix ecosystem
- third-party integration
- OEM block
- developer/API block
- security block
- use cases
- final CTA

### Step 3

Build detail pages:

- `/platform`
- `/oem`
- `/integrations`
- `/developers`
- `/security`
- `/about`

### Step 4

Build conversion and support routes:

- `/contact`
- `/support`
- `/signup`
- `/login`

### Step 5

Build legal and compliance routes:

- `/privacy`
- `/terms`
- `/cookies`
- `/acceptable-use`
- `/data-deletion`
- `/refund-policy`

### Step 6

Add production hardening:

- metadata
- sitemap
- robots
- structured data
- analytics consent hooks
- rate-limited contact submissions

## Visual Direction

The visual design should aim for:

- mature enterprise product positioning
- original network and device-to-cloud illustrations
- clear contrast and readable typography
- strong CTA hierarchy
- minimal clutter

Recommended elements:

- architecture diagrams
- dashboard/device mockups
- line-art connectivity visuals
- modular cards for products and capabilities

Avoid:

- copied competitor layouts
- fake certifications
- fake testimonials
- decorative effects that reduce trust

## Content Rules

- keep language business-facing
- explain outcomes before technical details
- mention only implemented capabilities as facts
- use “approved integration” wording for third-party devices
- do not expose private endpoints, topic structures, or credentials

## Compliance Checklist Before Publish

- homepage available on verified HTTPS domain
- privacy page final and publicly accessible
- terms page final and publicly accessible
- data deletion page publicly accessible
- support email and business details visible
- branding consistent with Google OAuth and app listing
- only `openid`, `email`, `profile` requested for basic Google login
- legal placeholders removed

## Immediate Next Build Task

Convert the prompt into actual build-ready content blocks for each route, then start the homepage and shared layout first.
