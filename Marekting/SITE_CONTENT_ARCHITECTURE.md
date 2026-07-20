# Smart One Marketing Site Content Architecture

## Global Content Model

Every page should contain:

- page title
- short positioning statement
- proof or capability section
- one primary CTA
- one secondary CTA when relevant
- footer with legal and support links

## Shared Sections

### Hero

Used on:

- `/`
- `/platform`
- `/oem`
- `/integrations`
- `/developers`
- `/security`

### Capability strip

Short trust indicators such as:

- Secure Device Provisioning
- MQTT and REST APIs
- OTA Firmware Management
- Android, PWA and Web
- Multi-Tenant Architecture
- OEM and White-Label Ready

### CTA band

Reusable endings:

- Open Smart One
- Discuss Your OEM IoT Project
- Request API Access
- Request Integration Assessment

## Route Plan

### `/`

Purpose:

- establish category leadership
- explain the platform
- drive visitors to explore, enquire, or open the app

Sections:

- hero
- trust strip
- core platform
- Jenix ecosystem
- approved third-party integrations
- OEM block
- developer block
- security block
- industries / use cases
- final CTA

### `/platform`

Purpose:

- explain operational platform features in depth

Sections:

- platform hero
- provisioning
- dashboards
- scenes and automation
- alerts
- OTA
- access management
- audit and governance

### `/oem`

Purpose:

- convert OEM and white-label prospects

Sections:

- OEM hero
- what can be branded
- product identity and PID model
- tenant isolation
- branding layers
- firmware channel control
- onboarding and commercial caveat

### `/integrations`

Purpose:

- attract third-party device partners and integrators

Sections:

- integrations hero
- approved integration wording
- MQTT path
- REST path
- webhook path
- gateway path
- custom adapter path
- integration assessment CTA

### `/developers`

Purpose:

- present partner-grade API and SDK capability

Sections:

- developer hero
- REST APIs
- MQTT topics
- webhooks
- auth model
- sample payload / docs preview
- request API access CTA

### `/security`

Purpose:

- present the real security approach without exaggeration

Sections:

- security hero
- device identity
- sessions and auth
- RBAC
- tenant isolation
- audit logging
- firmware and operations controls
- incident / recovery posture

### `/about`

Purpose:

- explain company background and engineering capability

Sections:

- company overview
- what Jenix builds
- combined disciplines
- legal and support identity block

### `/contact`

Purpose:

- capture qualified leads

Form fields:

- full name
- business email
- phone
- company
- country
- enquiry type
- expected device count
- project description
- consent

### `/support`

Purpose:

- route users to support, privacy, and operational help

Sections:

- support categories
- account help
- device help
- integration help
- privacy requests

### `/privacy`

Must cover:

- account data
- authentication data
- device identifiers
- telemetry
- provisioning data
- permissions and phone features
- support communications
- retention
- sharing
- deletion

### `/terms`

Must cover:

- licence and usage terms
- user responsibilities
- safety-critical limitations
- OEM responsibilities
- APIs
- limitation of liability

### `/data-deletion`

Must allow:

- authenticated delete path
- unauthenticated deletion request path
- explanation of retained records
- privacy contact fallback

## Login-Related Public Behavior

- `/login` should open or redirect to `https://app.iotsoft.in`
- `/signup` may serve either registration guidance or OEM/contact conversion
- public marketing site should not look like the internal app shell

## Footer Requirements

Columns:

- Platform
- Company
- Legal
- Applications

Always show:

- Smart One by Jenix identity
- support email
- legal operator reference
- dynamic copyright year

## Content Governance

Before publication, replace every placeholder with confirmed values for:

- legal entity text
- privacy email
- retention details
- processors and infrastructure providers
- exact Android permissions
- actual support process
