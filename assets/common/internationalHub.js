import { toLatLng } from "./orderTracking";

export function driverDeliveryRoute(shipment) {
  const address = String(shipment?.pickupFrom?.address || "").trim();
  const country = String(shipment?.destinationCountry || "").trim();
  const recipient = shipment?.recipient || {};
  const pickup = address ? [address, country].filter(Boolean).join(", ") : "";
  const point = toLatLng(recipient.location);
  const destination = point || (recipient.address1
    ? [recipient.address1, recipient.address2, recipient.city, recipient.zip, recipient.country || country].filter(Boolean).join(", ")
    : "");
  const destinationQuery = point ? `${point.latitude},${point.longitude}` : destination;
  const url = pickup && destinationQuery
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(destinationQuery)}&travelmode=driving`
    : "";
  return { pickup, destination, url };
}

export const CHARGE_TYPES = [
  { value: "customs_duty", label: "Customs duty" },
  { value: "tariff", label: "Tariff" },
  { value: "tax", label: "Import tax / VAT" },
  { value: "clearance", label: "Clearance & handling" },
  { value: "storage", label: "Storage" },
  { value: "other", label: "Other" },
];

const STAGE_LABELS = {
  in_transit: "In transit",
  in_customs: "At customs",
  cleared: "Collected from customs",
  ready: "Ready",
  dispatched: "Driver assigned",
  out_for_delivery: "Out for delivery",
  awaiting_collection: "Awaiting collection",
  delivered: "Delivered",
};
const CHARGE_STATUS = {
  awaiting_payment: "Payment due",
  bank_review: "Bank transfer under review",
  paid: "Paid",
  waived: "No charges due",
};
export const ACTION_LABELS = {
  arrive: "Mark arrived",
  charges: "Record customs & duty charges",
  clear: "Mark collected from customs",
  ready: "Release (ready for delivery / pickup)",
  dispatch: "Dispatch to driver",
  handover: "Record pickup handover",
  pickup: "Picked up from hub",
  deliver: "Mark delivered",
};

export const stageLabel = (stage) => STAGE_LABELS[stage] || stage || "Pending";
export const chargeStatusLabel = (status) => CHARGE_STATUS[status] || status || "Not assessed";

const STAGE_ORDER = ["in_transit", "in_customs", "cleared", "ready", "dispatched", "out_for_delivery", "awaiting_collection", "delivered"];
const SETTLED = ["paid", "waived"];

export const pendingCustomsPackages = (shipment) => (shipment?.packages || [])
  .filter((entry) => !entry.cancelled && !entry.customsCollected);

export function customsCollectionPayload(shipment, orderIds, note = "") {
  const pending = new Set(pendingCustomsPackages(shipment).map((entry) => entry.orderId));
  if (!Array.isArray(orderIds) || !orderIds.length || new Set(orderIds).size !== orderIds.length ||
      orderIds.some((orderId) => !pending.has(orderId))) {
    throw new Error("Select at least one package still awaiting customs collection.");
  }
  return { orderIds, ...(note.trim() ? { note: note.trim() } : {}) };
}

// The five hub steps with done/current/pending state and a waiting hint, so operators always see the whole workflow.
export function hubSteps(shipment) {
  const destination = shipment?.destination || null;
  const stage = STAGE_ORDER.indexOf(destination?.stage);
  const charges = destination?.charges || null;
  const settled = Boolean(charges) && SETTLED.includes(charges.status);
  const delivered = shipment?.status === "delivered" || destination?.stage === "delivered";
  const driver = destination?.driver || null;
  const active = (shipment?.packages || []).filter((entry) => !entry.cancelled);
  const pickups = active.filter((entry) => entry.fulfillmentMethod === "pickup");
  const collected = active.filter((entry) => entry.customsCollected).length;
  const steps = [
    { key: "arrive", label: "Mark arrived", done: stage >= 1,
      hint: stage >= 1 ? "" : destination ? "In transit - mark it arrived once it reaches customs." : "Mark the shipment arrived to start hub processing." },
    { key: "charges", label: "Record customs & duty charges", done: Boolean(charges),
      hint: charges ? chargeStatusLabel(charges.status) : stage >= 1 && !delivered ? "Record the charges (or no charges) so the customer can pay." : "" },
    { key: "clear", label: "Collect from customs", done: stage >= 2,
      hint: stage === 1 && active.length ? `${collected} of ${active.length} active packages collected.` : "" },
    { key: "ready", label: "Release for delivery / pickup", done: stage >= 3,
      hint: stage !== 2 || delivered ? "" : !charges ? "Record the charges first." : settled ? "" : "Waiting for the customer to pay the charges." },
    { key: "complete", label: "Deliver / hand over", done: delivered,
      hint: delivered || stage < 3 ? "" : driver?.pickedUpAt ? "Driver is delivering." : driver ? "Waiting for the driver to pick up from the hub."
        : pickups.length ? "Hand over pickup packages; the customer confirms collection." : "Dispatch a driver to deliver." },
  ];
  const current = steps.findIndex((step) => !step.done);
  return steps.map((step, index) => ({ key: step.key, label: step.label, hint: step.hint,
    state: step.done ? "done" : index === current && !delivered ? "current" : "pending" }));
}

export function formatMoney(amount, currency) {
  return `${String(currency || "").toUpperCase()} ${Number(amount || 0).toFixed(2)}`;
}

export function chargeMethods(currency) {
  return String(currency).toLowerCase() === "usd"
    ? [{ value: "card", label: "Card" }, { value: "bank", label: "USD bank transfer" }]
    : [{ value: "telebirr", label: "Telebirr" }, { value: "bank", label: "ETB bank transfer" }];
}

// Charges can be paid only while due; once a method starts, the customer must finish or check that same method.
export function chargePaymentState(charges) {
  if (!charges) return { payable: false, started: null };
  if (charges.status !== "awaiting_payment") return { payable: false, started: null };
  return { payable: true, started: charges.method || null };
}

export function chargesPayload(rows, note = "") {
  const charges = rows
    .filter((row) => String(row.amount ?? "").trim() !== "" || row.type === "other" && String(row.label || "").trim())
    .map((row) => ({ type: row.type, amount: String(row.amount).trim(), ...(row.label?.trim() ? { label: row.label.trim() } : {}) }));
  for (const row of charges) {
    if (!/^\d+(\.\d{1,2})?$/.test(row.amount)) throw new Error("Enter each amount as a non-negative number with at most two decimals.");
    if (row.type === "other" && !row.label) throw new Error("Describe each other related cost.");
  }
  const total = charges.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100;
  return { body: { charges, ...(note.trim() ? { note: note.trim() } : {}) }, total };
}

// Shipments whose customs charges still need customer payment or bank-transfer review.
export const unpaidCharges = (shipments) => (shipments || [])
  .map((shipment) => shipment?.destination?.charges)
  .filter((charges) => charges && ["awaiting_payment", "bank_review"].includes(charges.status));

export function destinationTimeline(shipment) {
  return (shipment?.destination?.history || []).map((entry) => ({
    key: `${entry.stage}-${entry.at}`,
    label: stageLabel(entry.stage),
    at: entry.at,
    note: entry.note || "",
  }));
}

export const errorMessage = (failure) => failure?.response?.data?.message || failure?.message || "Request failed.";
