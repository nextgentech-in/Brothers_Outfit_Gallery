/**
 * shipmentStatus.js
 * 
 * Centralized internal shipment status model, normalization rules,
 * monotonic progression guards, and timeline step calculations
 * for Brother's Outfit Gallery logistics integration.
 */

// 1. Canonical Internal Shipment Status Model
export const INTERNAL_STATUS = Object.freeze({
  PLACED: 'PLACED',
  CONFIRMED: 'CONFIRMED',
  SHIPPED: 'SHIPPED',
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  DELIVERY_FAILED: 'DELIVERY_FAILED',
  RTO: 'RTO',
  CANCELLED: 'CANCELLED',
  UNKNOWN: 'UNKNOWN'
});

// 2. Progression Ranks for Monotonic Status Progression
// Higher rank means further along in delivery lifecycle.
// Terminal states (DELIVERED, RTO, CANCELLED) have specific guard rules.
export const STATUS_PROGRESSION_RANK = Object.freeze({
  UNKNOWN: 0,
  PLACED: 10,
  CONFIRMED: 20,
  SHIPPED: 30,
  IN_TRANSIT: 40,
  OUT_FOR_DELIVERY: 50,
  DELIVERY_FAILED: 55, // Non-terminal delivery exception/reattempt
  DELIVERED: 100,      // Terminal success
  RTO: 900,            // Terminal failure / Return to Origin
  CANCELLED: 999       // Terminal cancellation
});

// 3. 5-Step Customer-Facing Timeline Milestones
export const TIMELINE_MILESTONES = Object.freeze([
  {
    step: 1,
    key: 'placed',
    label: 'Order Placed',
    desc: 'Received & Verified'
  },
  {
    step: 2,
    key: 'confirmed',
    label: 'Confirmed',
    desc: 'Packed at Himmatnagar Hub'
  },
  {
    step: 3,
    key: 'shipped',
    label: 'Shipped',
    desc: 'In Transit with Delhivery'
  },
  {
    step: 4,
    key: 'out_for_delivery',
    label: 'Out for Delivery',
    desc: 'Arriving Today'
  },
  {
    step: 5,
    key: 'delivered',
    label: 'Delivered',
    desc: 'Package Received'
  }
]);

/**
 * Normalizes any raw provider status, status code, or nested Delhivery tracking object
 * into our single internal status model.
 * 
 * Handles:
 * - Varied casing: "DELIVERED", "Delivered", "delivered"
 * - Extra whitespace: "  Delivered  "
 * - Known provider wording: "package delivered", "delivered to consignee", "delivery completed",
 *   "out for delivery", "in transit", "manifested", "picked up", "rto", "undelivered"
 * - Provider status codes: "DL" (Delivered), "OD"/"OFD" (Out for Delivery), "IT" (In Transit),
 *   "PU"/"PP"/"MP" (Shipped/Picked Up/Manifested), "RT"/"RTO" (RTO), "UD" (Undelivered), "CN" (Cancelled)
 * - Nested objects: { Status: { Status: "Delivered", StatusType: "DL" } }
 * - Safe fallback: UNKNOWN (never blindly maps unknown statuses to Delivered)
 * 
 * @param {string|object} rawInput 
 * @param {string} [rawCode] 
 * @returns {string} One of INTERNAL_STATUS
 */
export function normalizeShipmentStatus(rawInput, rawCode = null) {
  if (rawInput === null || rawInput === undefined) {
    if (rawCode) {
      return normalizeByStatusCode(rawCode);
    }
    return INTERNAL_STATUS.UNKNOWN;
  }

  let statusStr = '';
  let codeStr = String(rawCode || '').trim().toUpperCase();

  // Extract from string or nested provider structure
  if (typeof rawInput === 'string') {
    statusStr = rawInput.trim();
  } else if (typeof rawInput === 'object') {
    // Nested Delhivery v1 structure: ship.Status may be an object { Status, StatusType, ... }
    const statusObj = rawInput.Status || rawInput.status || rawInput;
    if (typeof statusObj === 'string') {
      statusStr = statusObj.trim();
    } else if (typeof statusObj === 'object' && statusObj !== null) {
      statusStr = String(
        statusObj.Status ||
        statusObj.status ||
        statusObj.currentStatus ||
        statusObj.CurrentStatus ||
        rawInput.currentStatus ||
        rawInput.CurrentStatus ||
        rawInput.shipmentStatus ||
        rawInput.ScanDetail?.Scan ||
        ''
      ).trim();

      const possibleCode = statusObj.StatusType ||
                           statusObj.statusType ||
                           statusObj.statusCode ||
                           rawInput.statusCode ||
                           rawInput.StatusType ||
                           rawInput.ScanDetail?.ScanType;
      if (possibleCode && !codeStr) {
        codeStr = String(possibleCode).trim().toUpperCase();
      }
    }
  }

  // Check by provider code first if code is valid
  if (codeStr) {
    const fromCode = normalizeByStatusCode(codeStr);
    if (fromCode !== INTERNAL_STATUS.UNKNOWN) {
      // If code is DL, it's definitely Delivered
      if (fromCode === INTERNAL_STATUS.DELIVERED) return INTERNAL_STATUS.DELIVERED;
      // If code is RT/RTO, definitely RTO
      if (fromCode === INTERNAL_STATUS.RTO) return INTERNAL_STATUS.RTO;
      // If code is CN, Cancelled
      if (fromCode === INTERNAL_STATUS.CANCELLED) return INTERNAL_STATUS.CANCELLED;
      // For others, if statusStr also gives Delivered, Delivered wins
      if (statusStr && isDeliveredWording(statusStr)) {
        return INTERNAL_STATUS.DELIVERED;
      }
      return fromCode;
    }
  }

  if (!statusStr) {
    return INTERNAL_STATUS.UNKNOWN;
  }

  // Normalize string: lowercase, collapse underscores/hyphens/multi-spaces
  const s = statusStr.toLowerCase().replace(/[_\s-]+/g, ' ').trim();

  // 1. Explicit Delivered check
  if (isDeliveredWording(s)) {
    return INTERNAL_STATUS.DELIVERED;
  }

  // 2. Cancellation
  if (s.includes('cancel')) {
    return INTERNAL_STATUS.CANCELLED;
  }

  // 3. RTO / Return
  if (s === 'rto' || s.startsWith('rto ') || s.includes('return to origin') || s.includes('returned to shipper') || s.includes('rto in transit')) {
    return INTERNAL_STATUS.RTO;
  }

  // 4. Undelivered / Delivery failed
  if (s.includes('undeliver') || s.includes('delivery failed') || s.includes('customer not available') || s.includes('door step undelivered') || s.includes('delivery attempt')) {
    return INTERNAL_STATUS.DELIVERY_FAILED;
  }

  // 5. Out for Delivery
  if (s.includes('out for delivery') || s.includes('arriving today') || s.includes('dispatched for delivery') || s === 'ofd' || s === 'out_for_delivery') {
    return INTERNAL_STATUS.OUT_FOR_DELIVERY;
  }

  // 6. In Transit
  if (s.includes('in transit') || s.includes('in-transit') || s.includes('on route') || s.includes('reached at') || s.includes('sorting hub') || s.includes('processing facility') || s.includes('transit hub')) {
    return INTERNAL_STATUS.IN_TRANSIT;
  }

  // 7. Shipped / Dispatched / Manifested / Picked Up
  if (s.includes('shipped') || s.includes('picked up') || s.includes('pickup completed') || s.includes('manifest') || s.includes('dispatched')) {
    return INTERNAL_STATUS.SHIPPED;
  }

  // 8. Confirmed / Packing / Processing
  if (s.includes('confirm') || s.includes('packing') || s.includes('packed') || s.includes('processing') || s.includes('order verified')) {
    return INTERNAL_STATUS.CONFIRMED;
  }

  // 9. Placed
  if (s.includes('placed') || s.includes('received') || s.includes('order created')) {
    return INTERNAL_STATUS.PLACED;
  }

  // Unknown statuses: Safe fallback (never assume delivered!)
  return INTERNAL_STATUS.UNKNOWN;
}

/**
 * Helper to match known delivery wording
 */
function isDeliveredWording(cleanedStr) {
  const s = cleanedStr.toLowerCase().replace(/[_\s-]+/g, ' ').trim();
  return (
    s === 'delivered' ||
    s === 'dl' ||
    s.startsWith('delivered') ||
    s.endsWith('delivered') ||
    s.includes('delivered to') ||
    s.includes('package delivered') ||
    s.includes('shipment delivered') ||
    s.includes('delivery completed') ||
    s.includes('delivered successfully')
  );
}

/**
 * Normalizes Delhivery status codes
 */
function normalizeByStatusCode(code) {
  const c = String(code || '').trim().toUpperCase();
  switch (c) {
    case 'DL':
      return INTERNAL_STATUS.DELIVERED;
    case 'OD':
    case 'OFD':
      return INTERNAL_STATUS.OUT_FOR_DELIVERY;
    case 'IT':
      return INTERNAL_STATUS.IN_TRANSIT;
    case 'PU':
    case 'PP':
    case 'MP':
      return INTERNAL_STATUS.SHIPPED;
    case 'UD':
      return INTERNAL_STATUS.DELIVERY_FAILED;
    case 'RT':
    case 'RTO':
      return INTERNAL_STATUS.RTO;
    case 'CN':
      return INTERNAL_STATUS.CANCELLED;
    default:
      return INTERNAL_STATUS.UNKNOWN;
  }
}

/**
 * Guard for monotonic status progression.
 * Ensures the order/shipment status only advances forward, and NEVER regresses
 * backward from DELIVERED to IN_TRANSIT, SHIPPED, or OUT_FOR_DELIVERY.
 * 
 * @param {string} currentStatus Current stored status
 * @param {string} incomingStatus New candidate status from provider/event
 * @returns {boolean} True if status transition is permissible
 */
export function canTransitionStatus(currentStatus, incomingStatus) {
  const currentNorm = normalizeShipmentStatus(currentStatus);
  const incomingNorm = normalizeShipmentStatus(incomingStatus);

  // Unknown incoming status should not overwrite a known status
  if (incomingNorm === INTERNAL_STATUS.UNKNOWN) {
    return false;
  }

  // If no previous status, allow any valid incoming status
  if (currentNorm === INTERNAL_STATUS.UNKNOWN) {
    return true;
  }

  // TERMINAL RULE 1: DELIVERED cannot regress to in-transit, out-for-delivery, etc.
  if (currentNorm === INTERNAL_STATUS.DELIVERED) {
    // Only RTO / explicit reverse shipment can follow Delivered, never a backward transit event
    return incomingNorm === INTERNAL_STATUS.RTO;
  }

  // TERMINAL RULE 2: CANCELLED cannot regress
  if (currentNorm === INTERNAL_STATUS.CANCELLED) {
    return false;
  }

  // TERMINAL RULE 3: RTO cannot regress to standard delivery forward states
  if (currentNorm === INTERNAL_STATUS.RTO) {
    return false;
  }

  const currentRank = STATUS_PROGRESSION_RANK[currentNorm] || 0;
  const incomingRank = STATUS_PROGRESSION_RANK[incomingNorm] || 0;

  // Status must move forward or remain at same rank
  return incomingRank >= currentRank;
}

/**
 * Calculates the active timeline step number (1 to 5).
 * 
 * Step 1: Order Placed
 * Step 2: Confirmed
 * Step 3: Shipped (covers Shipped / In Transit)
 * Step 4: Out for Delivery (also delivery attempts)
 * Step 5: Delivered (Terminal Success: all 5 completed!)
 * 
 * @param {string|object} status 
 * @returns {number} 1 to 5, or negative for terminal non-success states
 */
export function calculateTimelineStep(status) {
  const norm = normalizeShipmentStatus(status);
  switch (norm) {
    case INTERNAL_STATUS.DELIVERED:
      return 5;
    case INTERNAL_STATUS.OUT_FOR_DELIVERY:
    case INTERNAL_STATUS.DELIVERY_FAILED:
      return 4;
    case INTERNAL_STATUS.IN_TRANSIT:
    case INTERNAL_STATUS.SHIPPED:
      return 3;
    case INTERNAL_STATUS.CONFIRMED:
      return 2;
    case INTERNAL_STATUS.PLACED:
      return 1;
    case INTERNAL_STATUS.CANCELLED:
      return -1;
    case INTERNAL_STATUS.RTO:
      return -2;
    default:
      return 1;
  }
}

/**
 * Determines whether the timeline step at stepNumber (1 to 5) should be
 * marked as completed ('✓'), currently active, or pending.
 * 
 * When DELIVERED (activeStep === 5):
 * Every single step (1, 2, 3, 4, 5) is completed ('✓')!
 * 
 * @param {number} stepNumber 1 to 5
 * @param {number} activeStep 1 to 5
 * @param {boolean} isDelivered
 * @returns {{ isCompleted: boolean, isCurrent: boolean, isPending: boolean }}
 */
export function getStepVisualState(stepNumber, activeStep, isDelivered) {
  if (isDelivered || activeStep >= 5) {
    return {
      isCompleted: true,
      isCurrent: stepNumber === 5,
      isPending: false
    };
  }

  const isCompleted = stepNumber < activeStep;
  const isCurrent = stepNumber === activeStep;
  const isPending = stepNumber > activeStep;

  return {
    isCompleted,
    isCurrent,
    isPending
  };
}

/**
 * Safely format timestamps (ISO string, Firestore Timestamp, ms number, Date)
 * into customer-friendly IST display format: "29 Sep 2026, 4:32 PM".
 * 
 * @param {any} timestamp
 * @returns {string|null} Formatted date string, or null if invalid
 */
export function formatDeliveryTimestamp(timestamp) {
  if (!timestamp) return null;

  try {
    let dateObj;

    // Handle Firestore Timestamp object ({ toDate: Function })
    if (typeof timestamp.toDate === 'function') {
      dateObj = timestamp.toDate();
    }
    // Handle Firestore Timestamp serialized as {_seconds, _nanoseconds}
    else if (timestamp._seconds !== undefined) {
      dateObj = new Date(timestamp._seconds * 1000);
    }
    // Handle Date object
    else if (timestamp instanceof Date) {
      dateObj = timestamp;
    }
    // Handle numeric timestamp or string
    else {
      dateObj = new Date(timestamp);
    }

    if (isNaN(dateObj.getTime())) {
      return null;
    }

    // Format in Indian Standard Time / English (India)
    return dateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return null;
  }
}

/**
 * Computes aggregate status for orders with multiple shipments/packages.
 * 
 * Rule:
 * - If any package is CANCELLED and all others CANCELLED -> CANCELLED
 * - If ALL packages are DELIVERED -> DELIVERED
 * - If ANY package is OUT_FOR_DELIVERY -> OUT_FOR_DELIVERY
 * - If ANY package is IN_TRANSIT -> IN_TRANSIT
 * - If ANY package is SHIPPED -> SHIPPED
 * - Otherwise highest progressive state of any package
 * 
 * @param {Array<{ status: string, waybill?: string }>} shipments
 * @returns {string} One of INTERNAL_STATUS
 */
export function aggregateShipmentStatus(shipments) {
  if (!Array.isArray(shipments) || shipments.length === 0) {
    return INTERNAL_STATUS.UNKNOWN;
  }

  const normalizedList = shipments.map(s => normalizeShipmentStatus(s.status || s));

  // If all are DELIVERED, order is DELIVERED
  if (normalizedList.every(s => s === INTERNAL_STATUS.DELIVERED)) {
    return INTERNAL_STATUS.DELIVERED;
  }

  // If all are CANCELLED, order is CANCELLED
  if (normalizedList.every(s => s === INTERNAL_STATUS.CANCELLED)) {
    return INTERNAL_STATUS.CANCELLED;
  }

  // If all are RTO, order is RTO
  if (normalizedList.every(s => s === INTERNAL_STATUS.RTO)) {
    return INTERNAL_STATUS.RTO;
  }

  // Pick highest progressing forward rank among non-terminal packages
  let highestStatus = INTERNAL_STATUS.PLACED;
  let highestRank = 0;

  for (const status of normalizedList) {
    // Skip cancelled individual packages if other packages are progressing
    if (status === INTERNAL_STATUS.CANCELLED && normalizedList.length > 1) continue;

    const rank = STATUS_PROGRESSION_RANK[status] || 0;
    // Don't let a single DELIVERED package mark the whole order as delivered if others are in transit
    if (status === INTERNAL_STATUS.DELIVERED) {
      if (highestRank < STATUS_PROGRESSION_RANK.OUT_FOR_DELIVERY) {
        highestStatus = INTERNAL_STATUS.OUT_FOR_DELIVERY;
        highestRank = STATUS_PROGRESSION_RANK.OUT_FOR_DELIVERY;
      }
      continue;
    }

    if (rank > highestRank) {
      highestRank = rank;
      highestStatus = status;
    }
  }

  return highestStatus;
}
