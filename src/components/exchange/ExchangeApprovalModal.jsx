import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ExchangeApprovalModal.css';

const SUPPORT_WHATSAPP_NUMBER = '918460233020';

export default function ExchangeApprovalModal({
  isOpen,
  onClose,
  exchange
}) {
  // Lock body scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle ESC key press
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen || !exchange) return null;
  if (typeof document === 'undefined') return null;

  const exchangeId = exchange.id || exchange.docId || 'EXC-UNKNOWN';
  const orderId = exchange.orderId || 'N/A';
  const productName = exchange.productName || exchange.productNameSnapshot || 'Garment Item';
  const productImage = exchange.productImage || exchange.productImageSnapshot || '/images/hero.png';
  const currentSize = exchange.currentVariant?.size || 'Standard';
  const requestedSize = exchange.requestedVariant?.size || exchange.requestedSize || 'New Size';
  const reverseAwb = exchange.reversePickupAwb || exchange.pickupReference || null;

  // Build pre-filled WhatsApp message for proof submission
  const waMessage = 
`Hi Brother's Outfit Gallery Team,

My Exchange Request has been APPROVED!
• Exchange ID: #${exchangeId}
• Order ID: #${orderId}
• Item: ${productName}
• Current Size: ${currentSize}
• Replacement Size: ${requestedSize}

I am submitting the required photo / video proof showing the garment in unworn condition with all original brand tags attached.`;

  const waUrl = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  const modalContent = (
    <div className="exchange-approval-backdrop" onClick={onClose} role="presentation">
      <div 
        className="exchange-approval-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exchange-approval-title"
      >
        {/* Header */}
        <div className="approval-modal-header">
          <div className="approval-badge-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className="approval-title-group">
            <span className="approval-kicker">EXCHANGE APPROVED</span>
            <h2 id="exchange-approval-title" className="approval-modal-title">
              Your Request Is Approved!
            </h2>
            <p className="approval-ref-line">
              Exchange #{exchangeId} • Order #{orderId}
            </p>
          </div>
          <button 
            type="button" 
            className="approval-modal-close"
            onClick={onClose}
            aria-label="Close approval notification"
          >
            ✕
          </button>
        </div>

        {/* Hero Banner */}
        <div className="approval-pickup-banner">
          <div className="pickup-banner-icon" aria-hidden="true">
            ✓
          </div>
          <div className="pickup-banner-info">
            <div className="pickup-banner-headline">
              Exchange Approved by Admin
            </div>
            <p className="pickup-banner-text">
              Your exchange request has been approved by admin. Please submit photos/video of the tags and garment via WhatsApp to coordinate the exchange.
            </p>
            {reverseAwb && (
              <div className="pickup-awb-chip">
                <span>Reverse AWB:</span> <strong>{reverseAwb}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Product Snapshot */}
        <div className="approval-product-card">
          <img 
            src={productImage} 
            alt={productName} 
            className="approval-product-thumb"
            onError={(e) => { e.target.src = '/images/hero.png'; }}
          />
          <div className="approval-product-meta">
            <h4 className="approval-product-name">{productName}</h4>
            <div className="approval-size-flow">
              <span className="size-pill size-from">Current: {currentSize}</span>
              <span className="size-arrow" aria-hidden="true">➔</span>
              <span className="size-pill size-to">Replacement: {requestedSize}</span>
            </div>
          </div>
        </div>

        {/* Guidelines / Next Steps */}
        <div className="approval-guidelines">
          <div className="guidelines-heading">Quick Checklist Before Pickup:</div>
          <ul className="guidelines-list">
            <li>
              <span className="check-bullet">✓</span>
              <span><strong>Keep brand tags attached:</strong> Garment must be unworn and unwashed with original tags.</span>
            </li>
            <li>
              <span className="check-bullet">✓</span>
              <span><strong>Pack securely:</strong> Place the garment inside the original packaging or a neat polybag.</span>
            </li>
            <li>
              <span className="check-bullet">✓</span>
              <span><strong>Submit Proof:</strong> Send photos/video of tags & folded item to our WhatsApp concierge team below.</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="approval-modal-actions">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp-proof"
          >
            <svg 
              className="whatsapp-svg-icon" 
              viewBox="0 0 24 24" 
              width="22" 
              height="22" 
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.203c.043.072.043.419-.101.824z"/>
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.662 1.435 5.179L2 22l4.953-1.399C8.384 21.498 10.134 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.167c-1.636 0-3.153-.487-4.43-1.325l-.317-.208-2.94.831.845-2.863-.228-.337A8.125 8.125 0 0 1 3.833 12c0-4.503 3.664-8.167 8.167-8.167 4.503 0 8.167 3.664 8.167 8.167 0 4.503-3.664 8.167-8.167 8.167z"/>
            </svg>
            <span>Submit Proof of Exchange on WhatsApp</span>
          </a>

          <button
            type="button"
            className="btn-modal-dismiss"
            onClick={onClose}
          >
            Got It, I'll Prepare the Package
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
