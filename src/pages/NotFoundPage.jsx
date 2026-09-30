import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/common/SEO';
import './NotFoundPage.css';

export default function NotFoundPage() {
  return (
    <div className="notfound-container">
      <SEO
        title="404: Page Not Found | Brother’s Outfit Gallery"
        description="The page or product you were looking for is unavailable or has moved. Explore our latest men's clothing catalog or contact our Himatnagar showroom."
        noindex={true}
      />
      <div className="notfound-card">
        <span className="notfound-badge">BROTHER'S OUTFIT GALLERY</span>
        <div className="notfound-code">404</div>
        <h1 className="notfound-title">Page or Garment Not Found</h1>
        <p className="notfound-desc">
          The link you followed may be broken, out of stock, or moved to another section of our store. Explore our latest arrivals or continue browsing below.
        </p>

        <div className="notfound-links">
          <Link to="/shop" className="notfound-btn-primary">
            Explore All Menswear →
          </Link>
          <Link to="/new-arrivals" className="notfound-btn-secondary">
            New Arrivals
          </Link>
          <Link to="/sale" className="notfound-btn-secondary">
            Special Offers
          </Link>
        </div>

        <div className="notfound-help">
          Need styling advice or looking for a specific item?{' '}
          <a
            href="https://wa.me/918460233020?text=Hi%20Brothers%20Outfit!%20I%20was%20looking%20for%20an%20item%20that%20seems%20unavailable."
            target="_blank"
            rel="noopener noreferrer"
          >
            Chat with Our Stylist on WhatsApp ↗
          </a>
        </div>
      </div>
    </div>
  );
}
