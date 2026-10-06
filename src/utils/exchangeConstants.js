/**
 * exchangeConstants.js
 * 
 * Strict Exchange-Only Model, State Machine, Reasons,
 * and Customer Timeline Steps for Brother's Outfit Gallery.
 */

import { INTERNAL_STATUS, normalizeShipmentStatus } from './shipmentStatus.js';

// Canonical Exchange Request Statuses
export const EXCHANGE_STATUS = Object.freeze({
  PENDING_ADMIN_REVIEW: 'PENDING_ADMIN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REVERSE_PICKUP_PENDING: 'REVERSE_PICKUP_PENDING',
  REVERSE_PICKUP_CREATED: 'REVERSE_PICKUP_CREATED',
  PICKED_UP: 'PICKED_UP',
  RECEIVED: 'RECEIVED',
  QC_PENDING: 'QC_PENDING',
  QC_APPROVED: 'QC_APPROVED',
  QC_REJECTED: 'QC_REJECTED',
  REPLACEMENT_SHIPPED: 'REPLACEMENT_SHIPPED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
});

// Human-friendly status labels and visual badge variants
export const EXCHANGE_STATUS_METADATA = Object.freeze({
  [EXCHANGE_STATUS.PENDING_ADMIN_REVIEW]: {
    label: 'Under Review',
    description: 'Submitted and awaiting admin evaluation',
    badgeClass: 'badge-pending',
    step: 1
  },
  [EXCHANGE_STATUS.APPROVED]: {
    label: 'Exchange Approved',
    description: 'Approved by admin',
    badgeClass: 'badge-approved',
    step: 2
  },
  [EXCHANGE_STATUS.REJECTED]: {
    label: 'Exchange Rejected',
    description: 'Request did not meet exchange policy guidelines',
    badgeClass: 'badge-rejected',
    step: -1
  },
  [EXCHANGE_STATUS.REVERSE_PICKUP_PENDING]: {
    label: 'Pickup Pending',
    description: 'Pickup creation queued for dispatch',
    badgeClass: 'badge-pending',
    step: 2
  },
  [EXCHANGE_STATUS.REVERSE_PICKUP_CREATED]: {
    label: 'Pickup Scheduled',
    description: 'Delhivery courier agent assigned for reverse pickup',
    badgeClass: 'badge-progress',
    step: 3
  },
  [EXCHANGE_STATUS.PICKED_UP]: {
    label: 'Picked Up',
    description: 'Garment collected by Delhivery courier agent',
    badgeClass: 'badge-progress',
    step: 3
  },
  [EXCHANGE_STATUS.RECEIVED]: {
    label: 'Product Received',
    description: 'Parcel arrived at Himmatnagar processing warehouse',
    badgeClass: 'badge-progress',
    step: 4
  },
  [EXCHANGE_STATUS.QC_PENDING]: {
    label: 'QC Inspection',
    description: 'Checking tags, unworn condition, and fabric state',
    badgeClass: 'badge-progress',
    step: 4
  },
  [EXCHANGE_STATUS.QC_APPROVED]: {
    label: 'Inspection Passed',
    description: 'Garment passed quality check; packaging replacement',
    badgeClass: 'badge-approved',
    step: 4
  },
  [EXCHANGE_STATUS.QC_REJECTED]: {
    label: 'QC Failed',
    description: 'Garment shows wear, missing tags, or damage',
    badgeClass: 'badge-rejected',
    step: -2
  },
  [EXCHANGE_STATUS.REPLACEMENT_SHIPPED]: {
    label: 'Replacement Dispatched',
    description: 'New size/garment shipped via Delhivery Express',
    badgeClass: 'badge-progress',
    step: 5
  },
  [EXCHANGE_STATUS.COMPLETED]: {
    label: 'Exchange Completed',
    description: 'Replacement parcel safely received by customer',
    badgeClass: 'badge-completed',
    step: 6
  },
  [EXCHANGE_STATUS.CANCELLED]: {
    label: 'Cancelled',
    description: 'Exchange request was cancelled',
    badgeClass: 'badge-rejected',
    step: -3
  }
});

// Customer-Facing Reason Options
export const EXCHANGE_REASONS = Object.freeze([
  'Size too small',
  'Size too large',
  'Wrong product / size received',
  'Damaged or defective garment',
  'Other'
]);

// Default exchange window in days (48 hours = 2 days per published store policy)
export const DEFAULT_EXCHANGE_WINDOW_DAYS = 2;

// 6-Step Visual Timeline for Customer View
export const CUSTOMER_EXCHANGE_STEPS = Object.freeze([
  { step: 1, key: 'submitted', label: 'Request Submitted' },
  { step: 2, key: 'review', label: 'Admin Review' },
  { step: 3, key: 'pickup', label: 'Reverse Pickup' },
  { step: 4, key: 'received', label: 'Product Received & QC' },
  { step: 5, key: 'replacement', label: 'Replacement Shipped' },
  { step: 6, key: 'completed', label: 'Exchange Completed' }
]);

/**
 * Checks whether an order and product are eligible for customer exchange.
 * 
 * Rules:
 * 1. Order must exist and be delivered (normalized shipmentStatus === DELIVERED).
 * 2. Order must be within exchangeWindowDays (default: 2 days / 48 hours).
 * 3. No active/unfinalized exchange request for this order/product.
 * 4. Cancelled or RTO orders cannot be exchanged.
 * 
 * @param {object} order 
 * @param {Array<object>} [existingExchanges] 
 * @param {object} [settings] 
 * @returns {{
 *   isEligible: boolean,
 *   reason: string | null,
 *   daysRemaining: number | null,
 *   hoursRemaining: number | null,
 *   activeExchange: object | null
 * }}
 */
export function checkExchangeEligibility(order, existingExchanges = [], settings = {}) {
  if (!order) {
    return { isEligible: false, reason: 'Order not found.', activeExchange: null };
  }

  // 1. Normalized status check
  const normalizedStatus = normalizeShipmentStatus(order.shipmentStatus || order.status, order.rawProviderStatusCode);
  const isDelivered = normalizedStatus === INTERNAL_STATUS.DELIVERED || String(order.status || '').toLowerCase() === 'delivered';

  if (!isDelivered) {
    if (normalizedStatus === INTERNAL_STATUS.CANCELLED || String(order.status || '').toLowerCase().includes('cancel')) {
      return { isEligible: false, reason: 'Cancelled orders cannot be exchanged.', activeExchange: null };
    }
    if (normalizedStatus === INTERNAL_STATUS.RTO || String(order.status || '').toLowerCase().includes('rto')) {
      return { isEligible: false, reason: 'Returned orders cannot be exchanged.', activeExchange: null };
    }
    return {
      isEligible: false,
      reason: 'Exchange is available only after your parcel has been safely Delivered.',
      activeExchange: null
    };
  }

  // 2. Active exchange request check
  const matchingExchanges = Array.isArray(existingExchanges)
    ? existingExchanges.filter(ex => ex.orderId === order.id)
    : [];

  const activeExchange = matchingExchanges.find(ex =>
    ex.status !== EXCHANGE_STATUS.REJECTED &&
    ex.status !== EXCHANGE_STATUS.CANCELLED &&
    ex.status !== EXCHANGE_STATUS.QC_REJECTED
  );

  if (activeExchange) {
    return {
      isEligible: false,
      reason: `An exchange request is currently ${EXCHANGE_STATUS_METADATA[activeExchange.status]?.label || activeExchange.status}.`,
      activeExchange
    };
  }

  // 3. Time Window Check (48 Hours / Configured Days)
  const windowDays = Number(settings.exchangeWindowDays || DEFAULT_EXCHANGE_WINDOW_DAYS) || 2;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  // Derive delivery timestamp
  let deliveredTimeMs = null;
  if (order.deliveredAt) {
    if (typeof order.deliveredAt.toDate === 'function') {
      deliveredTimeMs = order.deliveredAt.toDate().getTime();
    } else if (order.deliveredAt._seconds) {
      deliveredTimeMs = order.deliveredAt._seconds * 1000;
    } else {
      const parsed = new Date(order.deliveredAt).getTime();
      if (!isNaN(parsed)) deliveredTimeMs = parsed;
    }
  }

  // If no delivery timestamp recorded yet, fall back to updatedAt or allow recent delivery
  if (!deliveredTimeMs && order.updatedAt) {
    const updatedMs = order.updatedAt?.toDate ? order.updatedAt.toDate().getTime() : new Date(order.updatedAt).getTime();
    if (!isNaN(updatedMs)) deliveredTimeMs = updatedMs;
  }

  if (deliveredTimeMs) {
    const elapsedMs = Date.now() - deliveredTimeMs;
    const remainingMs = windowMs - elapsedMs;

    if (remainingMs <= 0) {
      return {
        isEligible: false,
        reason: `The ${windowDays * 24}-hour exchange window has passed for this order.`,
        daysRemaining: 0,
        hoursRemaining: 0,
        activeExchange: null
      };
    }

    const hoursRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));
    const daysRemaining = Math.ceil(hoursRemaining / 24);

    return {
      isEligible: true,
      reason: null,
      hoursRemaining,
      daysRemaining,
      activeExchange: null
    };
  }

  // If timestamp could not be determined accurately, assume eligible within grace period
  return {
    isEligible: true,
    reason: null,
    hoursRemaining: windowDays * 24,
    daysRemaining: windowDays,
    activeExchange: null
  };
}

/**
 * Validates transition state machine for exchange status changes.
 * 
 * @param {string} currentStatus 
 * @param {string} nextStatus 
 * @returns {boolean}
 */
export function isValidExchangeTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return true;

  switch (currentStatus) {
    case EXCHANGE_STATUS.PENDING_ADMIN_REVIEW:
      return [EXCHANGE_STATUS.APPROVED, EXCHANGE_STATUS.REJECTED, EXCHANGE_STATUS.CANCELLED].includes(nextStatus);

    case EXCHANGE_STATUS.APPROVED:
      return [EXCHANGE_STATUS.RECEIVED, EXCHANGE_STATUS.QC_PENDING, EXCHANGE_STATUS.REVERSE_PICKUP_CREATED, EXCHANGE_STATUS.REVERSE_PICKUP_PENDING, EXCHANGE_STATUS.CANCELLED].includes(nextStatus);

    case EXCHANGE_STATUS.REVERSE_PICKUP_PENDING:
      return [EXCHANGE_STATUS.REVERSE_PICKUP_CREATED, EXCHANGE_STATUS.CANCELLED].includes(nextStatus);

    case EXCHANGE_STATUS.REVERSE_PICKUP_CREATED:
      return [EXCHANGE_STATUS.PICKED_UP, EXCHANGE_STATUS.RECEIVED, EXCHANGE_STATUS.CANCELLED].includes(nextStatus);

    case EXCHANGE_STATUS.PICKED_UP:
      return [EXCHANGE_STATUS.RECEIVED].includes(nextStatus);

    case EXCHANGE_STATUS.RECEIVED:
      return [EXCHANGE_STATUS.QC_PENDING, EXCHANGE_STATUS.QC_APPROVED, EXCHANGE_STATUS.QC_REJECTED].includes(nextStatus);

    case EXCHANGE_STATUS.QC_PENDING:
      return [EXCHANGE_STATUS.QC_APPROVED, EXCHANGE_STATUS.QC_REJECTED].includes(nextStatus);

    case EXCHANGE_STATUS.QC_APPROVED:
      return [EXCHANGE_STATUS.REPLACEMENT_SHIPPED].includes(nextStatus);

    case EXCHANGE_STATUS.REPLACEMENT_SHIPPED:
      return [EXCHANGE_STATUS.COMPLETED].includes(nextStatus);

    case EXCHANGE_STATUS.REJECTED:
    case EXCHANGE_STATUS.QC_REJECTED:
    case EXCHANGE_STATUS.COMPLETED:
    case EXCHANGE_STATUS.CANCELLED:
      // Terminal states
      return false;

    default:
      return false;
  }
}
