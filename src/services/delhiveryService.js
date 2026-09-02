import { getBackendUrl } from '../utils/apiConfig';

/**
 * Check Delhivery PIN code serviceability
 * @param {string} pincode 
 * @returns {Promise<{serviceable: boolean, estimatedDays?: string, error?: string}>}
 */
export const checkPincodeServiceability = async (pincode) => {
  if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
    return { serviceable: false, error: 'Please enter a valid 6-digit Indian PIN code.' };
  }

  // Client-side quick filter for known invalid test codes
  if (/^000|^999|000000|123456|999999/.test(pincode)) {
    return { serviceable: false, pincode, error: `PIN Code ${pincode} is invalid.` };
  }

  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/api/delhivery/pincode/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pincode }),
    });

    if (!response.ok) {
      return { serviceable: false, error: 'Delivery service check unavailable.' };
    }

    return await response.json();
  } catch (error) {
    console.error('Delhivery pincode check error:', error);
    return {
      serviceable: false,
      pincode,
      error: 'Unable to verify pincode. Please double-check your entry.'
    };
  }
};

/**
 * Lookup PIN codes by City / Place Name
 * @param {string} place 
 * @returns {Promise<Array<{pincode: string, area: string, city: string, state: string}>>}
 */
export const lookupPincodeByPlace = async (place) => {
  if (!place || place.trim().length < 3) return [];
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/api/delhivery/pincode/lookup-by-place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.suggestions || [];
  } catch (err) {
    console.error('Error looking up place:', err);
    return [];
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
