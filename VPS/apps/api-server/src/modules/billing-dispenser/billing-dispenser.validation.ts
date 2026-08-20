import type { BillingDispenserElement, BillingDispenserItem, PrintCustomRequest } from "./billing-dispenser.types";

export interface BillingDispenserValidationSuccess<T> {
  ok: true;
  data: T;
}

export interface BillingDispenserValidationFailure {
  ok: false;
  errors: string[];
}

export type BillingDispenserValidationResult<T> =
  | BillingDispenserValidationSuccess<T>
  | BillingDispenserValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Real tickets run 6-10 lines; a hard cap keeps the composed elements JSON inside the
// firmware's PrintRequest.customJson buffer (see Billing firmware.md — bump to 4096,
// but still finite). Anything larger should be paginated by the caller, not us.
const MAX_ITEMS = 30;

function parseItem(raw: unknown, index: number): { item?: BillingDispenserItem; error?: string } {
  if (!isRecord(raw)) return { error: `items[${index}] must be an object` };
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const qty = typeof raw.qty === "number" ? raw.qty : Number(raw.qty);
  if (!name) return { error: `items[${index}].name is required` };
  if (!Number.isFinite(qty) || qty <= 0) return { error: `items[${index}].qty must be a positive number` };

  const item: BillingDispenserItem = { name, qty };
  if (typeof raw.price === "number" && Number.isFinite(raw.price)) item.price = raw.price;
  if (typeof raw.note === "string" && raw.note.trim()) item.note = raw.note.trim();
  return { item };
}

export function parsePrintCustomRequest(body: unknown): BillingDispenserValidationResult<PrintCustomRequest> {
  if (!isRecord(body)) return { ok: false, errors: ["Request body must be an object"] };

  const errors: string[] = [];

  const ticketType = body.ticketType === "kitchen" || body.ticketType === "bill" ? body.ticketType : undefined;
  if (!ticketType) errors.push('ticketType must be "kitchen" or "bill"');

  const tableNumber = typeof body.tableNumber === "number" || typeof body.tableNumber === "string"
    ? body.tableNumber
    : undefined;
  if (tableNumber === undefined || String(tableNumber).trim() === "") errors.push("tableNumber is required");

  const rawItems = Array.isArray(body.items) ? body.items : undefined;
  if (!rawItems || rawItems.length === 0) errors.push("items must be a non-empty array");
  if (rawItems && rawItems.length > MAX_ITEMS) errors.push(`items must not exceed ${MAX_ITEMS} lines`);

  const items: BillingDispenserItem[] = [];
  if (rawItems) {
    rawItems.slice(0, MAX_ITEMS).forEach((raw, index) => {
      const { item, error } = parseItem(raw, index);
      if (error) errors.push(error);
      else if (item) items.push(item);
    });
  }

  const total = typeof body.total === "number" && Number.isFinite(body.total) ? body.total : undefined;
  if (ticketType === "bill" && total === undefined) errors.push("total is required for a bill ticket");

  const header = typeof body.header === "string" && body.header.trim() ? body.header.trim() : undefined;

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      ticketType: ticketType!,
      tableNumber: tableNumber!,
      items,
      ...(total !== undefined ? { total } : {}),
      ...(header !== undefined ? { header } : {})
    }
  };
}

// ---------------------------------------------------------------------------
// Ticket composition — lives here, not in HotelQR-Lite or in the caller, so a
// layout tweak (bigger table number, a GST line, a QR on the bill) never needs
// a cross-repo change. Element shape must match applyElement() in
// firmware/src/print_template.cpp:65 exactly.
// ---------------------------------------------------------------------------

function money(n: number): string {
  return `Rs ${n.toFixed(2)}`;
}

export function buildElements(request: PrintCustomRequest): BillingDispenserElement[] {
  return request.ticketType === "kitchen" ? buildKitchenElements(request) : buildBillElements(request);
}

function buildKitchenElements(request: PrintCustomRequest): BillingDispenserElement[] {
  const elements: BillingDispenserElement[] = [];

  if (request.header) {
    elements.push({ type: "text", content: request.header, align: 1, bold: true });
  }
  elements.push({ type: "text", content: `TABLE ${request.tableNumber}`, align: 1, bold: true, double_height: true });
  elements.push({ type: "feed", lines: 1 });

  for (const item of request.items) {
    elements.push({ type: "text", content: `${item.qty}x  ${item.name}`, align: 0 });
    if (item.note) elements.push({ type: "text", content: `   (${item.note})`, align: 0 });
  }

  elements.push({ type: "feed", lines: 2 });
  elements.push({ type: "cut" });
  return elements;
}

function buildBillElements(request: PrintCustomRequest): BillingDispenserElement[] {
  const elements: BillingDispenserElement[] = [];

  if (request.header) {
    elements.push({ type: "text", content: request.header, align: 1, bold: true, double_height: true });
  }
  elements.push({ type: "text", content: `Table ${request.tableNumber}`, align: 1 });
  elements.push({ type: "feed", lines: 1 });

  for (const item of request.items) {
    const priceStr = typeof item.price === "number" ? money(item.price * item.qty) : "";
    elements.push({ type: "text", content: `${item.qty}x ${item.name}`.padEnd(24) + priceStr, align: 0 });
  }

  elements.push({ type: "feed", lines: 1 });
  elements.push({ type: "text", content: `TOTAL: ${money(request.total ?? 0)}`, align: 2, bold: true, double_height: true });
  elements.push({ type: "feed", lines: 2 });
  elements.push({ type: "cut" });
  return elements;
}
