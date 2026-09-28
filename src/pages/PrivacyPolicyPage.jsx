import React from 'react';
import './PolicyPages.css';

export default function PrivacyPolicyPage() {
  return (
    <div className="policy-page">
      <div className="policy-container">
        <div className="policy-header">
          <span className="policy-label">DATA & SECURITY</span>
          <h1 className="policy-title">Privacy Policy</h1>
          <p className="policy-updated">Last Updated: September 2026</p>
        </div>

        <div className="policy-card">
          <div className="policy-section">
            <h2>🔒 Our Commitment to Your Privacy</h2>
            <p>
              At <strong>Brothers Outfit Gallery</strong> ("we", "us", "our"), we respect the privacy of our visitors and customers. This Privacy Policy explains what personal information we collect, why we collect it, how we use it, and how we keep it secure when you visit or make a purchase from our website (brothersoutfit.in).
            </p>
          </div>

          <div className="policy-section">
            <h2>📋 Information We Collect</h2>
            <ul>
              <li><strong>Contact & Shipping Details:</strong> When you place an order or register an account, we collect your full name, email address, mobile phone number, shipping address, and PIN code to fulfill your order.</li>
              <li><strong>Order & Transaction History:</strong> We maintain records of products purchased, order values, delivery dates, and coupon codes redeemed.</li>
              <li><strong>Payment Information:</strong> All online payments are handled directly by our PCI-DSS Level 1 compliant payment processor (Razorpay). <strong>Brothers Outfit never sees, stores, or processes your credit/debit card numbers, CVVs, or net banking passwords.</strong></li>
              <li><strong>Device & Analytics Data:</strong> We may collect browser details, IP address, and anonymized user behavior via trusted analytics platforms (e.g., Vercel Analytics) solely to improve page load speed and shopping experience.</li>
            </ul>
          </div>

          <div className="policy-section">
            <h2>⚙️ How We Use Your Information</h2>
            <p>We use your personal information strictly for the following business purposes:</p>
            <ul>
              <li>To process, pack, and deliver your orders via Delhivery Express.</li>
              <li>To send order confirmation notifications, delivery status updates, and tracking numbers via SMS, WhatsApp, and email.</li>
              <li>To provide prompt customer support and resolve order inquiries.</li>
              <li>To prevent fraudulent transactions and safeguard the security of our platform.</li>
            </ul>
          </div>

          <div className="policy-section">
            <h2>🛡️ Sharing of Information with Third Parties</h2>
            <p>
              We do <strong>not</strong> sell, trade, or rent your personal information to marketing brokers. We share details only with essential service providers necessary for operating our storefront:
            </p>
            <ul>
              <li><strong>Logistics Partners (Delhivery):</strong> To generate shipping manifests and deliver parcels to your doorstep.</li>
              <li><strong>Payment Gateway (Razorpay):</strong> To facilitate end-to-end encrypted payment processing.</li>
              <li><strong>Cloud & Database Hosting (Google Firebase):</strong> Encrypted data storage in compliance with industry security protocols.</li>
            </ul>
          </div>

          <div className="policy-section">
            <h2>🍪 Cookies & Local Storage</h2>
            <p>
              We use lightweight local browser storage (such as session and local storage) to keep track of your shopping bag contents, wishlist selections, and authentication state so your cart remains intact between page visits.
            </p>
          </div>

          <div className="policy-section">
            <h2>📞 Data Rights & Inquiries</h2>
            <p>
              You have the right to review, update, or request the deletion of your personal account data at any time.
            </p>
            <div className="policy-contact-box">
              <p><strong>Contact our Data Protection Desk:</strong></p>
              <p>Brothers Outfit Gallery</p>
              <p>📍 Store Address: Himatnagar, Gujarat, India</p>
              <p>✉️ Email: support@brothersoutfit.in</p>
              <p>📱 WhatsApp: +91 84602 33020</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
