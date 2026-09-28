import React from 'react';
import './PolicyPages.css';

export default function ReturnsPolicyPage() {
  return (
    <div className="policy-page">
      <div className="policy-container">
        <div className="policy-header">
          <span className="policy-label">PURCHASE CONFIDENCE</span>
          <h1 className="policy-title">Returns & Exchange Policy</h1>
          <p className="policy-updated">Last Updated: September 2026</p>
        </div>

        <div className="policy-card">
          <div className="policy-section">
            <h2>🔁 48-Hour Replacement Guarantee</h2>
            <p>
              At <strong>Brothers Outfit Gallery</strong>, we take extreme pride in the quality, craftsmanship, and fit of our men’s collection. We rigorously inspect each garment prior to packaging and dispatch.
            </p>
            <div className="policy-highlight-box">
              <p>
                ⚠️ <strong>Important Notice:</strong> We offer <strong>free replacements or exchanges ONLY in the event of receiving a damaged, defective, or incorrect item</strong>. We do not offer unconditional returns or cash refunds for buyer's remorse or change of mind.
              </p>
            </div>
          </div>

          <div className="policy-section">
            <h2>📹 Mandatory Unboxing Video Proof</h2>
            <p>
              To protect both our customers and our brand from transit tampering, all damage or missing item claims <strong>require an uncut, clear unboxing video</strong> recorded from the moment the sealed courier flyer/box is opened.
            </p>
            <ul>
              <li>The unboxing video must clearly show the courier shipping label with your name and tracking number.</li>
              <li>The seal of the outer polybag/box must be shown unbroken prior to opening.</li>
              <li>The defect or damage on the garment must be clearly visible in the video footage.</li>
            </ul>
          </div>

          <div className="policy-section">
            <h2>⏱️ Time Window for Raising a Request</h2>
            <p>
              You must report any issue within <strong>48 hours of confirmed delivery</strong> by our courier partner. Requests initiated after 48 hours cannot be processed.
            </p>
          </div>

          <div className="policy-section">
            <h2>📏 Sizing Exchanges</h2>
            <p>
              If an item does not fit your body shape as expected, we offer size exchanges subject to stock availability:
            </p>
            <ul>
              <li>The item must be in its original, unworn, unwashed condition with all brand tags, labels, and packaging intact.</li>
              <li>Items showing signs of perfume, wear, stains, or wash will be rejected.</li>
              <li>A reverse pickup fee of ₹99 may be applicable for size change requests.</li>
            </ul>
          </div>

          <div className="policy-section">
            <h2>🚀 How to Initiate an Exchange</h2>
            <p>
              Initiating an exchange is fast and friendly. Simply reach out to our customer care team via WhatsApp with:
            </p>
            <ul>
              <li>Your Order ID (e.g. #ORD-12345)</li>
              <li>Your unboxing video or high-resolution photos of the issue</li>
              <li>Brief explanation of the exchange reason</li>
            </ul>

            <div className="policy-contact-box">
              <p><strong>Direct Support Desk:</strong></p>
              <p>Brothers Outfit Gallery Customer Care</p>
              <a
                href="https://wa.me/918460233020?text=Hi%20Brothers%20Outfit!%20I%20would%20like%20to%20request%20an%20exchange%20for%20my%20order."
                target="_blank"
                rel="noreferrer"
                className="policy-whatsapp-btn"
              >
                💬 WhatsApp: +91 84602 33020
              </a>
              <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '6px' }}>
                Mon - Sat: 10:00 AM – 8:00 PM IST
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
