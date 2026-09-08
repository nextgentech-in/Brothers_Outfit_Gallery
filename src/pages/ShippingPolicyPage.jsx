import React from 'react';
import { Link } from 'react-router-dom';
import './PolicyPages.css';

export default function ShippingPolicyPage() {
  return (
    <div className="policy-page">
      <div className="policy-container">
        <div className="policy-header">
          <span className="policy-label">DELIVERY INFORMATION</span>
          <h1 className="policy-title">Shipping Policy</h1>
          <p className="policy-updated">Last Updated: September 2026</p>
        </div>

        <div className="policy-card">
          <div className="policy-section">
            <h2>🚚 Courier Partner & Coverage</h2>
            <p>
              At <strong>Brothers Outfit Gallery</strong>, all domestic orders across India are dispatched exclusively through our primary logistics partner, <strong>Delhivery Express</strong>, ensuring fast, tracked, and secure doorstep delivery.
            </p>
            <p>
              We cover over 19,000+ PIN codes across all states and union territories in India.
            </p>
          </div>

          <div className="policy-section">
            <h2>⏱️ Order Processing & Dispatch</h2>
            <ul>
              <li><strong>Dispatch Time:</strong> Orders placed before 2:00 PM IST on business days (Monday to Saturday) are dispatched within 24 to 48 hours after payment confirmation or Cash on Delivery verification.</li>
              <li><strong>Sundays & Public Holidays:</strong> Orders placed on Sundays or gazetted public holidays will be dispatched on the next working day.</li>
            </ul>
          </div>

          <div className="policy-section">
            <h2>📦 Delivery Timelines</h2>
            <ul>
              <li><strong>Metro Cities (Mumbai, Delhi, Bengaluru, Ahmedabad, etc.):</strong> 2 to 3 business days from dispatch.</li>
              <li><strong>Tier 2 & Tier 3 Cities / Rest of India:</strong> 3 to 5 business days from dispatch.</li>
              <li><strong>North East & Remote Locations:</strong> 4 to 7 business days from dispatch.</li>
            </ul>
            <div className="policy-highlight-box">
              <p>
                ⚡ <strong>Free Express Shipping:</strong> Enjoy Free Express Shipping on all orders above ₹999. A nominal delivery fee of ₹49–₹99 applies to orders below this threshold based on weight and destination.
              </p>
            </div>
          </div>

          <div className="policy-section">
            <h2>🔍 Order Tracking</h2>
            <p>
              Once your shipment is picked up by Delhivery, you will receive a confirmation message and email containing your unique <strong>Waybill Tracking Number (AWB)</strong>. You can track your shipment live on our website or directly at Delhivery’s official tracking portal.
            </p>
          </div>

          <div className="policy-section">
            <h2>📍 Address Inaccuracies & Non-Delivery</h2>
            <p>
              Please ensure your complete delivery address, landmark, and 10-digit mobile number are accurate during checkout. Our delivery courier will attempt delivery up to 3 times before returning the parcel. If an order is returned due to incorrect contact details, additional shipping charges may apply for re-dispatch.
            </p>
          </div>

          <div className="policy-contact-box">
            <p><strong>Have shipping or delivery questions?</strong></p>
            <p>Contact our support team directly via WhatsApp or phone:</p>
            <a
              href="https://wa.me/918460233020?text=Hello%20Brothers%20Outfit!%20I%20have%20a%20question%20about%20shipping."
              target="_blank"
              rel="noreferrer"
              className="policy-whatsapp-btn"
            >
              💬 WhatsApp: +91 84602 33020
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
