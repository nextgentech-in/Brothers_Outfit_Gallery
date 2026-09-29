import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { EXCHANGE_REASONS, checkExchangeEligibility } from '../../utils/exchangeConstants';
import { submitCustomerExchangeRequest } from '../../services/exchangeService';
import './ExchangeRequestModal.css';

const NUMERIC_SIZES = ['38', '40', '42', '44'];
const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

export default function ExchangeRequestModal({
  isOpen,
  onClose,
  order,
  existingExchanges = [],
  onSuccess
}) {
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [otherReasonText, setOtherReasonText] = useState('');
  const [requestedSize, setRequestedSize] = useState('');
  const [customSizeText, setCustomSizeText] = useState('');
  const [customerMessage, setCustomerMessage] = useState('');
  const [unboxingVideoConfirmed, setUnboxingVideoConfirmed] = useState(false);
  const [tagsIntactConfirmed, setTagsIntactConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Initialize or reset when order changes or modal opens
  useEffect(() => {
    if (isOpen && order) {
      setSelectedItemIndex(0);
      setSelectedQuantity(1);
      setReason('');
      setOtherReasonText('');
      setRequestedSize('');
      setCustomSizeText('');
      setCustomerMessage('');
      setUnboxingVideoConfirmed(false);
      setTagsIntactConfirmed(false);
      setSubmitError(null);
      setSubmitSuccess(false);

      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }
    } else {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;
  if (typeof document === 'undefined') return null;

  const items = Array.isArray(order.items) && order.items.length > 0 ? order.items : [];
  const activeItem = items[selectedItemIndex] || items[0] || {};
  const currentItemQuantity = Math.max(1, Number(activeItem.quantity) || 1);

  // Check eligibility via canonical helper
  const eligibility = checkExchangeEligibility(order, existingExchanges);

  // Format order date
  const orderDateStr = order.createdAt?.toDate
    ? order.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : (order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent');

  // Format delivery date
  const deliveredDateStr = order.deliveredAt?.toDate
    ? order.deliveredAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : (order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Verified Delivered');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!eligibility.isEligible) {
      setSubmitError(eligibility.reason || 'This order is not eligible for exchange.');
      return;
    }

    if (!reason) {
      setSubmitError('Please select a reason for the exchange.');
      return;
    }

    if (reason === 'Other' && !otherReasonText.trim()) {
      setSubmitError('Please provide details for the "Other" reason.');
      return;
    }

    if (!requestedSize) {
      setSubmitError('Please select your requested replacement size or custom fit.');
      return;
    }

    if (requestedSize === 'Custom' && !customSizeText.trim()) {
      setSubmitError('Please enter your custom size or tailored fit specifications.');
      return;
    }

    if (!unboxingVideoConfirmed || !tagsIntactConfirmed) {
      setSubmitError('Please acknowledge that tags are intact and you have an unboxing video ready.');
      return;
    }

    setSubmitting(true);

    try {
      const finalReason = reason === 'Other' ? `Other: ${otherReasonText.trim()}` : reason;
      const finalRequestedSize = requestedSize === 'Custom'
        ? `Custom (${customSizeText.trim()})`
        : requestedSize;

      const payload = {
        orderId: order.id,
        productId: activeItem.productId || activeItem.id || `item_${selectedItemIndex}`,
        productSlug: activeItem.slug || activeItem.id || null,
        productNameSnapshot: activeItem.name || 'Garment Item',
        productImageSnapshot: activeItem.thumbnailUrl || activeItem.image || (activeItem.images && activeItem.images[0]?.url) || (activeItem.images && activeItem.images[0]) || '/images/hero.png',
        currentVariant: {
          size: activeItem.size || 'Standard',
          color: activeItem.color || ''
        },
        requestedVariant: {
          size: finalRequestedSize,
          color: activeItem.color || ''
        },
        requestedSize: finalRequestedSize,
        requestedColor: activeItem.color || '',
        quantity: selectedQuantity,
        reason: finalReason,
        customerMessage: customerMessage.trim(),
        itemIndex: selectedItemIndex,
        unboxingVideoConfirmed: true,
        tagsIntactConfirmed: true,
        userPhone: order.shippingAddress?.phone || '',
        shippingAddress: order.shippingAddress || {},
        deliveredAt: order.deliveredAt || null
      };

      const result = await submitCustomerExchangeRequest(payload);

      setSubmitSuccess(true);
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      let msg = err.message || 'Failed to submit exchange request. Please try again.';
      if (msg.includes('Unexpected token') || msg.includes('<!DOCTYPE') || msg.includes('not valid JSON')) {
        msg = 'Unable to reach the exchange service. Please check your internet connection or try again shortly.';
      }
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="exchange-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="exchange-modal-title">
      <div className="exchange-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="exchange-modal-header">
          <div className="exchange-header-title-wrap">
            <span className="exchange-header-icon" aria-hidden="true">🔄</span>
            <div>
              <h2 id="exchange-modal-title" className="exchange-header-title">Request an Exchange</h2>
              <p className="exchange-header-subtitle">
                Order #{order.id} • Placed on {orderDateStr} • Delivered on {deliveredDateStr}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="exchange-modal-close"
            onClick={onClose}
            aria-label="Close exchange dialog"
          >
            ✕
          </button>
        </div>

        {submitSuccess ? (
          <div className="exchange-success-view">
            <div className="exchange-success-icon" aria-hidden="true">✓</div>
            <h3 className="exchange-success-title">Exchange Request Submitted</h3>
            <p className="exchange-success-desc">
              Our team will review your request and update your exchange status within 24 hours.
            </p>
            <div className="exchange-success-notice">
              <span className="notice-icon" aria-hidden="true">📋</span>
              <div>
                <strong>Important Quality Guidelines:</strong>
                <p>
                  Please keep the garment unused, unwashed, and in original packaging with brand tags intact.
                  Keep your unboxing video ready for verification by our support team.
                </p>
              </div>
            </div>
            <div className="exchange-success-actions">
              <button
                type="button"
                className="exchange-btn-primary"
                onClick={onClose}
              >
                View Exchange Status in Profile
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="exchange-modal-form">
            {/* Eligibility Banner if not eligible */}
            {!eligibility.isEligible && (
              <div className="exchange-ineligible-banner">
                <span className="ineligible-icon" aria-hidden="true">⚠️</span>
                <div>
                  <strong>Exchange Not Available</strong>
                  <p>{eligibility.reason}</p>
                </div>
              </div>
            )}

            {/* Step 1: Select Product */}
            <div className="exchange-section">
              <label className="exchange-section-title">
                <span className="step-badge">1</span>
                {items.length > 1 ? 'Select Product to Exchange' : 'Product to Exchange'}
              </label>

              <div className="exchange-product-picker">
                {items.map((item, idx) => {
                  const isSelected = selectedItemIndex === idx;
                  const itemImg = item.thumbnailUrl || item.image || (item.images && item.images[0]?.url) || (item.images && item.images[0]) || '/images/hero.png';
                  return (
                    <div
                      key={idx}
                      className={`exchange-product-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedItemIndex(idx);
                        setSelectedQuantity(1);
                        setRequestedSize('');
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedItemIndex(idx);
                          setSelectedQuantity(1);
                        }
                      }}
                    >
                      <img src={itemImg} alt={item.name} className="exchange-product-img" />
                      <div className="exchange-product-info">
                        <div className="exchange-product-name">{item.name}</div>
                        <div className="exchange-product-meta">
                          {item.size && <span className="meta-pill">Size: {item.size}</span>}
                          {item.color && <span className="meta-pill">{item.color}</span>}
                          <span className="meta-pill">Qty: {item.quantity || 1}</span>
                          <span className="meta-price">₹{((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      <div className="exchange-product-check" aria-hidden="true">
                        {isSelected ? '●' : '○'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quantity selector if order item quantity > 1 */}
              {currentItemQuantity > 1 && (
                <div className="exchange-qty-row">
                  <label htmlFor="exchange-qty-select" className="exchange-field-label">Quantity to Exchange:</label>
                  <select
                    id="exchange-qty-select"
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(Number(e.target.value))}
                    className="exchange-select-input"
                  >
                    {Array.from({ length: currentItemQuantity }, (_, i) => i + 1).map((q) => (
                      <option key={q} value={q}>{q} of {currentItemQuantity}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Step 2: Reason for Exchange */}
            <div className="exchange-section">
              <label htmlFor="exchange-reason-select" className="exchange-section-title">
                <span className="step-badge">2</span>
                Reason for Exchange <span className="required-star">*</span>
              </label>

              <select
                id="exchange-reason-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="exchange-select-input"
                required
              >
                <option value="">-- Choose a reason --</option>
                {EXCHANGE_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {reason === 'Other' && (
                <div className="exchange-subfield">
                  <input
                    type="text"
                    placeholder="Please specify the reason..."
                    value={otherReasonText}
                    onChange={(e) => setOtherReasonText(e.target.value.slice(0, 150))}
                    className="exchange-text-input"
                    maxLength={150}
                    required
                  />
                </div>
              )}
            </div>

            {/* Step 3: Requested Size / Replacement Variant */}
            <div className="exchange-section">
              <label className="exchange-section-title">
                <span className="step-badge">3</span>
                Requested Replacement Size <span className="required-star">*</span>
              </label>

              <div className="exchange-variant-summary">
                <span className="variant-label">Current Size:</span>
                <span className="variant-pill current-variant">{activeItem.size || 'Standard'}</span>
                <span className="variant-arrow">→</span>
                <span className="variant-label">Requested:</span>
                <span className="variant-pill requested-variant">
                  {requestedSize === 'Custom'
                    ? (customSizeText.trim() ? `Custom (${customSizeText.trim()})` : 'Custom Fit')
                    : (requestedSize || 'Select below')}
                </span>
              </div>

              {/* Group A: Numeric Sizes (Kurta, Ethnic, Shirt Sizing) */}
              <div className="exchange-size-group">
                <div className="size-group-title">Numeric Sizes (Ethnic Wear / Formal Shirts)</div>
                <div className="exchange-size-grid" role="group" aria-label="Numeric replacement sizes">
                  {NUMERIC_SIZES.map((sz) => {
                    const isCurrent = (activeItem.size || '').toUpperCase() === sz;
                    const isSelected = requestedSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        className={`exchange-size-btn ${isSelected ? 'active' : ''} ${isCurrent ? 'is-current' : ''}`}
                        onClick={() => {
                          setRequestedSize(sz);
                          setCustomSizeText('');
                        }}
                        title={isCurrent ? `Current Size (${sz})` : `Request Size ${sz}`}
                      >
                        {sz}
                        {isCurrent && <span className="current-subtag">Current</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group B: Standard Alpha Sizes */}
              <div className="exchange-size-group" style={{ marginTop: '12px' }}>
                <div className="size-group-title">Standard Alpha Sizes</div>
                <div className="exchange-size-grid" role="group" aria-label="Standard replacement sizes">
                  {STANDARD_SIZES.map((sz) => {
                    const isCurrent = (activeItem.size || '').toUpperCase() === sz;
                    const isSelected = requestedSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        className={`exchange-size-btn ${isSelected ? 'active' : ''} ${isCurrent ? 'is-current' : ''}`}
                        onClick={() => {
                          setRequestedSize(sz);
                          setCustomSizeText('');
                        }}
                        title={isCurrent ? `Current Size (${sz})` : `Request Size ${sz}`}
                      >
                        {sz}
                        {isCurrent && <span className="current-subtag">Current</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group C: Custom / Tailored Measurement Option */}
              <div className="exchange-custom-option-wrap">
                <button
                  type="button"
                  className={`exchange-custom-size-toggle ${requestedSize === 'Custom' ? 'active' : ''}`}
                  onClick={() => setRequestedSize('Custom')}
                >
                  <span className="custom-icon" aria-hidden="true">✂️</span>
                  <div className="custom-text-wrap">
                    <strong className="custom-title">Custom Size / Tailored Fit</strong>
                    <p className="custom-desc">Need custom chest, shoulder, or tailored adjustments</p>
                  </div>
                  <span className="custom-radio-indicator">
                    {requestedSize === 'Custom' ? '●' : '○'}
                  </span>
                </button>

                {requestedSize === 'Custom' && (
                  <div className="exchange-custom-size-input-card">
                    <label htmlFor="custom-size-input" className="exchange-field-label">
                      Specify Custom Size / Tailored Fit Details <span className="required-star">*</span>
                    </label>
                    <input
                      id="custom-size-input"
                      type="text"
                      className="exchange-text-input custom-size-input"
                      placeholder="e.g. Chest 41 inches, Shoulder 18.5, Kurta Length 40"
                      value={customSizeText}
                      onChange={(e) => setCustomSizeText(e.target.value.slice(0, 150))}
                      maxLength={150}
                      required
                      autoFocus
                    />
                    <div className="custom-size-input-footer">
                      <span className="field-char-count">{customSizeText.length}/150</span>
                      <p className="exchange-field-hint">
                        Our master artisans will tailor the replacement garment to these specifications.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 4: Customer Message / Explanation */}
            <div className="exchange-section">
              <label htmlFor="exchange-message-textarea" className="exchange-section-title">
                <span className="step-badge">4</span>
                Additional Notes / Explanation (Optional)
              </label>
              <textarea
                id="exchange-message-textarea"
                rows={2}
                value={customerMessage}
                onChange={(e) => setCustomerMessage(e.target.value.slice(0, 300))}
                placeholder="Let us know how the current fit feels or any special requests..."
                className="exchange-textarea"
                maxLength={300}
              />
              <span className="field-char-count">{customerMessage.length}/300</span>
            </div>

            {/* Step 5: Policy Verification Checkboxes */}
            <div className="exchange-section exchange-policy-box">
              <div className="policy-box-title">🛡️ Exchange Policy & Condition Check</div>
              <label className="exchange-checkbox-label">
                <input
                  type="checkbox"
                  checked={tagsIntactConfirmed}
                  onChange={(e) => setTagsIntactConfirmed(e.target.checked)}
                  required
                />
                <span>The garment is unwashed, unworn, and original brand tags & packaging are intact.</span>
              </label>

              <label className="exchange-checkbox-label">
                <input
                  type="checkbox"
                  checked={unboxingVideoConfirmed}
                  onChange={(e) => setUnboxingVideoConfirmed(e.target.checked)}
                  required
                />
                <span>I confirm that I have an unboxing video of the delivered package ready for verification.</span>
              </label>
            </div>

            {submitError && (
              <div className="exchange-error-banner" role="alert">
                <span className="error-icon" aria-hidden="true">⚠️</span>
                <span>{submitError}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="exchange-modal-actions">
              <button
                type="button"
                className="exchange-btn-cancel"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="exchange-btn-submit"
                disabled={submitting || !eligibility.isEligible}
              >
                {submitting ? 'Submitting Request...' : 'Submit Exchange Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
