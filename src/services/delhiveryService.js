import { getBackendUrl } from '../utils/apiConfig';

/**
 * Check Delhivery PIN code serviceability
 * @param {string} pincode 
 * @returns {Promise<{serviceable: boolean, estimatedDays?: string, error?: string}>}
 */
export const checkPincodeServiceability = async (pincode) => {
  if (!pincode || pincode.length !== 6) {
    return { serviceable: false, error: 'Enter a valid 6-digit Indian PIN code.' };
  }

  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/api/delhivery/pincode/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pincode }),
    });

    if (!response.ok) {
      throw new Error('Failed to reach delivery serviceability server.');
    }

    return await response.json();
  } catch (error) {
    console.error('Delhivery pincode check error:', error);
    // Graceful fallback for UI continuity
    return {
      serviceable: true,
      pincode,
      estimatedDays: '3 - 5 Business Days',
      fallback: true
    };
  }
};

/**
 * Create shipment with Delhivery One for an order
 * @param {Object} orderDetails
 * @returns {Promise<{success: boolean, waybill: string, courier: string, status: string}>}
 */
export const createDelhiveryShipment = async (orderDetails) => {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/api/delhivery/create-shipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderDetails),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Shipment creation failed.');
    }

    return await response.json();
  } catch (error) {
    console.error('Delhivery shipment creation error:', error);
    throw error;
  }
};

/**
 * Track shipment live via Delhivery Waybill / AWB
 * @param {string} waybill 
 * @returns {Promise<Object>}
 */
export const trackDelhiveryShipment = async (waybill) => {
  if (!waybill) return null;
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/api/delhivery/track/${waybill}`);
    if (!response.ok) throw new Error('Tracking service unavailable.');
    return await response.json();
  } catch (error) {
    console.error('Delhivery track error:', error);
    return {
      waybill,
      status: 'In Transit',
      courier: 'Delhivery Express',
      trackingUrl: `https://www.delhivery.com/track/package/${waybill}`,
    };
  }
};
