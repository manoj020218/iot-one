export type BillingDispenserTicketType = "kitchen" | "bill";

export interface BillingDispenserItem {
  name: string;
  qty: number;
  price?: number;
  note?: string;
}

/** Platform-facing request — what a caller (e.g. HotelQR-Lite) sends us. */
export interface PrintCustomRequest {
  ticketType: BillingDispenserTicketType;
  tableNumber: number | string;
  items: BillingDispenserItem[];
  /** Required when ticketType is "bill" — printed as-is, never recomputed here
   *  (the caller's total may include GST/rounding this module has no visibility into). */
  total?: number;
  /** Optional header line, e.g. the hotel's name. Skipped if omitted. */
  header?: string;
}

/**
 * Firmware-facing element — mirrors applyElement()'s schema exactly
 * (Token Dispensor/firmware/src/print_template.cpp:65). Do not add fields the
 * firmware doesn't parse — it ignores unknown keys silently, so a typo here
 * fails invisibly on the receipt, not in a type error.
 */
export type BillingDispenserElement =
  | { type: "text"; content: string; align?: 0 | 1 | 2; bold?: boolean; double_height?: boolean; double_width?: boolean }
  | { type: "feed"; lines?: number }
  | { type: "cut" }
  | { type: "qr"; content: string; size?: number };

export class BillingDispenserModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "BillingDispenserModuleError";
  }
}
