import './TrustBar.css';

export default function TrustBar({ placement = 'top' }) {
  return (
    <section className={`trust-bar-section trust-bar-section--${placement}`} aria-label="Customer Guarantees">
      <div className="trust-bar-container">
        {/* Pillar 1: Free Express Shipping */}
        <div className="trust-bar-card">
          <div className="trust-bar-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <div className="trust-bar-text">
            <strong>Free Express Shipping</strong>
            <span>On prepaid & orders above ₹999</span>
          </div>
        </div>

        {/* Pillar 2: Exchange on Damage */}
        <div className="trust-bar-card">
          <div className="trust-bar-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"></polyline>
              <polyline points="23 20 23 14 17 14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
          </div>
          <div className="trust-bar-text">
            <strong>Exchange on Damage</strong>
            <span>Replacement for defective/damaged items</span>
          </div>
        </div>

        {/* Pillar 3: WhatsApp Sizing Concierge */}
        <div className="trust-bar-card">
          <div className="trust-bar-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
          </div>
          <div className="trust-bar-text">
            <strong>WhatsApp Sizing Concierge</strong>
            <span>One-on-one personal stylist advice</span>
          </div>
        </div>

        {/* Pillar 4: 100% Quality Fabric */}
        <div className="trust-bar-card">
          <div className="trust-bar-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <polyline points="9 12 11 14 15 10"></polyline>
            </svg>
          </div>
          <div className="trust-bar-text">
            <strong>100% Quality Fabric</strong>
            <span>Checked for durability, fit & finish</span>
          </div>
        </div>
      </div>
    </section>
  );
}
