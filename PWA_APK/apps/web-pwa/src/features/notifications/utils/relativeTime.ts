const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31536000],
  ["month", 2592000],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60]
];

const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function relativeTimeFrom(isoTimestamp: string, now = Date.now()): string {
  const seconds = Math.round((new Date(isoTimestamp).getTime() - now) / 1000);

  if (Math.abs(seconds) < 60) {
    return "Just now";
  }

  for (const [unit, secondsInUnit] of UNITS) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return formatter.format(Math.round(seconds / secondsInUnit), unit);
    }
  }

  return formatter.format(Math.round(seconds / 60), "minute");
}
