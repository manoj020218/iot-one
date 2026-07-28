export type DeviceCategory = "sense" | "automate" | "operate" | "protect" | "future";

export interface DeviceCardContent {
  id: string;
  category: DeviceCategory;
  categoryLabel: string;
  name: string;
  tagline: string;
  problemLabel: string;
  problem: string;
  fixLabel: string;
  fix?: string[];
  fixBody?: string;
  ctaLabel: string;
}

export const deviceShowcaseHeading = {
  eyebrow: "Device Ecosystem",
  title: "Every Jenix device, one platform, one app",
  body:
    "Each product below runs on the same Smart One core — provisioning, MQTT, OTA and alerts — so a new device category becomes a new card here, not a new app to install."
};

export const deviceShowcaseCards: DeviceCardContent[] = [
  {
    id: "tank-guard",
    category: "sense",
    categoryLabel: "Sense & Alert",
    name: "Smart Tank Guard",
    tagline: "Know your tank level before it's empty — or overflowing.",
    problemLabel: "The problem",
    problem: "Manual tank checks, dry-run pump damage, and silent overflow waste water and money.",
    fixLabel: "The fix",
    fix: [
      "Continuous ultrasonic water-level reading, visible from anywhere",
      "Overflow and low-level alerts pushed straight to your phone",
      "Motor status tracking, so you know exactly when the pump ran"
    ],
    ctaLabel: "Talk to us about Tank Guard"
  },
  {
    id: "nurse-call",
    category: "sense",
    categoryLabel: "Sense & Alert",
    name: "Smart Nurse Call Receiver",
    tagline: "A press of a button, an instant call — no new wiring.",
    problemLabel: "The problem",
    problem:
      "Patients, guests or customers have no fast way to summon staff without shouting or walking over.",
    fixLabel: "The fix",
    fix: [
      "RF remote triggers an instant call on the receiver panel and your phone",
      "Calls persist and repeat until someone attends, so nothing gets missed",
      "Learn a new remote in seconds — no rewiring the building"
    ],
    ctaLabel: "Talk to us about the Nurse Call Receiver"
  },
  {
    id: "rf-bridge",
    category: "automate",
    categoryLabel: "Automate & Control",
    name: "Smart RF Actuator Bridge",
    tagline: "Turn any existing RF remote switch into a smart, app-controlled device.",
    problemLabel: "The problem",
    problem:
      "Water motors, submersible pumps and sirens already run on RF remotes — but you can't schedule them, check their status, or trigger them from your phone.",
    fixLabel: "The fix",
    fix: [
      "Bridges any 433MHz RF relay — motor, pump or siren — into Smart One",
      "Trigger from the app, a schedule, or another device's alert automatically",
      "No rewiring the pump or motor panel — the bridge learns the existing remote"
    ],
    ctaLabel: "Talk to us about the RF Actuator Bridge"
  },
  {
    id: "token-dispenser",
    category: "operate",
    categoryLabel: "Queue Operations",
    name: "Smart Token Dispenser",
    tagline: "Print a token, keep the queue honest.",
    problemLabel: "The problem",
    problem: "Walk-in counters turn into crowds and arguments without a fair, visible queue order.",
    fixLabel: "The fix",
    fix: [
      "One tap prints a sequential token on a real thermal printer",
      "Every token event syncs to the platform for reporting and control",
      "The waiting list it manages drives the Token Display automatically"
    ],
    ctaLabel: "Talk to us about the Token Dispenser"
  },
  {
    id: "token-display",
    category: "operate",
    categoryLabel: "Queue Operations",
    name: "Smart Token Display",
    tagline: "Calls out the next number — on screen and out loud.",
    problemLabel: "The problem",
    problem:
      "Customers don't know when it's their turn, and staff waste time calling names over and over.",
    fixLabel: "The fix",
    fix: [
      "Scrolling LED display plus spoken/tone audio announce the current token",
      "The waiting list is managed from the PWA, not buttons on the unit",
      "Doubles as an offers/announcement board when the counter is quiet"
    ],
    ctaLabel: "Talk to us about the Token Display"
  },
  {
    id: "sos-siren",
    category: "protect",
    categoryLabel: "Protect & Warn",
    name: "Smart SOS Siren",
    tagline: "One trigger, an alarm loud enough for the whole site to act on.",
    problemLabel: "The problem",
    problem:
      "A factory incident, flood, fire or landslide warning only helps if it's heard across the entire site — not just near one buzzer.",
    fixLabel: "The fix",
    fix: [
      "Cloud- or button-triggered siren built for large-area warning, not a beep",
      "Four alert patterns, tuned safely for real horn speakers",
      "Same platform, same app, alongside every other Jenix device"
    ],
    ctaLabel: "Talk to us about the SOS Siren"
  },
  {
    id: "future-device",
    category: "future",
    categoryLabel: "Coming Next",
    name: "Your Product, Powered by Smart One",
    tagline: "This is where the next device category slots in.",
    problemLabel: "The problem",
    problem: "Most platforms need a rebuild every time a new product category joins the lineup.",
    fixLabel: "The fix",
    fixBody:
      "Smart One is built product-by-product, not rebuilt each time. New device categories load their own dashboard and controls without disrupting what's already live — OEM or in-house.",
    ctaLabel: "Discuss Your OEM IoT Project"
  }
];
