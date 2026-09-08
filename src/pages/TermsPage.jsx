import React from 'react';
import './PolicyPages.css';

export default function TermsPage() {
  return (
    <div className="policy-page">
      <div className="policy-container">
        <div className="policy-header">
          <span className="policy-label">LEGAL AGREEMENT</span>
          <h1 className="policy-title">Terms & Conditions</h1>
          <p className="policy-updated">Last Updated: September 2026</p>
        </div>

        <div className="policy-card">
          <div className="policy-section">
            <h2>📜 Introduction & Agreement</h2>
            <p>
              Welcome to <strong>Brothers Outfit Gallery</strong>. By browsing, accessing, or purchasing from our website (brothersoutfit.in), you agree to be bound by the following terms, conditions, and policies. Please read these terms carefully prior to completing transactions.
            </p>
          </div>

          <div className="policy-section">
            <h2>👔 Store Ownership & Location</h2>
            <p>
              Brothers Outfit Gallery operates both an online boutique and a flagship retail store in Himatnagar, Gujarat, India. All apparel, t-shirts, shirts, jeans, and menswear accessories presented on this platform are curated and managed by Brothers Outfit Gallery.
            </p>
          </div>

          <div className="policy-section">
            <h2>🏷️ Product Pricing & Availability</h2>
            <ul>
              <li>All prices displayed on the website are in <strong>Indian Rupees (₹ / INR)</strong> and include applicable Goods and Services Tax (GST).</li>
              <li>We make every effort to display garment colors, fabrics, and fits as accurately as possible. However, slight variations may occur due to display monitor calibrations and lighting conditions.</li>
              <li>We reserve the right to correct any typographical pricing errors or discontinue products at any time without prior notice.</li>
            </ul>
          </div>

          <div className="policy-section">
            <h2>💳 Orders & Payment Verification</h2>
            <p>
              Receipt of an order confirmation does not signify our final acceptance of your order. We reserve the right to decline or cancel any order in cases of suspected fraudulent activity, unauthorized coupon usage, pricing discrepancy, or lack of delivery serviceability in your postal area.
            </p>
            <p>
              If a paid order is cancelled by Brothers Outfit Gallery, the full transaction amount will be refunded to your original payment method within 5 to 7 business days via Razorpay.
            </p>
          </div>

          <div className="policy-section">
            <h2>⚖️ Intellectual Property</h2>
            <p>
              All content on this site, including the Brothers Outfit Gallery logo, graphics, design, photographs, and written descriptions, is the intellectual property of Brothers Outfit Gallery and is protected by applicable Indian copyright and trademark laws.
            </p>
          </div>

          <div className="policy-section">
            <h2>🏛️ Governing Law & Jurisdiction</h2>
            <p>
              These Terms and Conditions and any separate agreements whereby we provide you services shall be governed by and construed in accordance with the laws of the <strong>State of Gujarat, India</strong>, with exclusive jurisdiction in the competent courts of Sabarkantha / Himatnagar.
            </p>
          </div>

          <div className="policy-contact-box">
            <p><strong>Questions regarding our Terms & Conditions?</strong></p>
            <p>Brothers Outfit Gallery Legal & Customer Relations</p>
            <p>✉️ Email: legal@brothersoutfit.in</p>
            <p>📱 WhatsApp: +91 84602 33020</p>
          </div>
        </div>
      </div>
    </div>
  );
}
