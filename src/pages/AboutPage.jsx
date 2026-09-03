import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { businessInfo } from '../config/business';
import PhotoGallery from '../components/PhotoGallery';
import TestimonialMarquee from '../components/TestimonialMarquee';
import './AboutPage.css';

export default function AboutPage() {
  
  // Inject explicit LD+JSON structured data strictly aligned with known local business data
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.innerHTML = JSON.stringify({
      "@context": "https://schema.org",
      "@type": ["LocalBusiness", "ClothingStore"],
      "name": businessInfo.name,
      "address": businessInfo.address,
      "telephone": businessInfo.phone,
      "url": window.location.origin,
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": businessInfo.coordinates?.lat || 23.5875977,
        "longitude": businessInfo.coordinates?.lng || 72.9697925
      },
      "sameAs": [businessInfo.googleMapsUrl]
    });
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const storeImages = [
    { 
      url: "/images/store-real-1.jpeg", 
      alt: "Brothers Outfit Gallery Storefront & Main Entrance", 
      caption: "Our Official Storefront - Welcome to Brothers Outfit Gallery" 
    },
    { 
      url: "/images/store-real-2.jpeg", 
      alt: "Brothers Outfit Gallery Interior Collection Display", 
      caption: "Spacious Interior & Contemporary Styles" 
    },
    { 
      url: "/images/store-real-3.jpeg", 
      alt: "Brothers Outfit Gallery Casuals & Designer Shirts Rack", 
      caption: "Pure Cotton Casuals & Designer Shirts Collection" 
    },
    { 
      url: "/images/store-real-4.jpeg", 
      alt: "Brothers Outfit Gallery Premium T-Shirts & Smart Formals", 
      caption: "High-Density Graphic Tees & Formal Shirts" 
    },
    { 
      url: "/images/store-real-5.jpeg", 
      alt: "Brothers Outfit Gallery Denims, Jeans & Trousers Area", 
      caption: "Curated Denims, Cargoes & Comfort-Fit Trousers" 
    },
    { 
      url: "/images/store-real-6.jpeg", 
      alt: "Brothers Outfit Gallery Customer Care & Styling Counter", 
      caption: "Friendly Service & Personal Styling Consultation" 
    }
  ];

  return (
    <div className="about-page">
      {/* 1. Hero Section with Real Store Showcase */}
      <section className="about-hero">
        <div className="about-container">
          <div className="about-hero-badge">
            <span className="hero-badge-dot"></span>
            <span>OFFICIAL STORE • MODASA, GUJARAT</span>
          </div>
          <h1 className="about-hero__title">MORE THAN CLOTHING.<br />IT'S YOUR STYLE.</h1>
          <p className="about-hero__desc">
            Discover modern men's fashion, high-grade fabrics, and a shopping experience built around confidence, comfort, and effortless individuality.
          </p>
          <div className="about-hero__actions">
            <Link to="/shop" className="btn-primary">EXPLORE COLLECTION →</Link>
            <a href={businessInfo.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">VISIT PHYSICAL STORE →</a>
          </div>

          {/* Hero Photos Strip Preview */}
          <div className="about-hero-collage">
            <div className="hero-collage-item primary">
              <img src="/images/store-real-1.jpeg" alt="Brothers Outfit Gallery Front" />
              <div className="collage-label">Main Entrance</div>
            </div>
            <div className="hero-collage-item">
              <img src="/images/store-real-2.jpeg" alt="Men's Wear Display" />
              <div className="collage-label">New Arrivals</div>
            </div>
            <div className="hero-collage-item">
              <img src="/images/store-real-3.jpeg" alt="Designer Shirts Rack" />
              <div className="collage-label">Apparel Racks</div>
            </div>
            <div className="hero-collage-item">
              <img src="/images/store-real-4.jpeg" alt="Casual & Streetwear Collection" />
              <div className="collage-label">Signature Styles</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Key Metrics / Stats Bar */}
      <section className="about-stats-bar">
        <div className="about-container">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-num">5,000+</div>
              <div className="stat-label">Gentlemen Styled</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">500+</div>
              <div className="stat-label">Curated Clothing Styles</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">4.9 ★</div>
              <div className="stat-label">Google Rating</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">100%</div>
              <div className="stat-label">Quality Assured</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Story Section with Real Store Photo Highlight */}
      <section className="about-story">
        <div className="about-container">
          <div className="about-story-grid">
            <div className="about-story__content">
              <span className="section-eyebrow">OUR HERITAGE & VISION</span>
              <h2 className="section-title">THE BROTHERS OUTFIT STORY</h2>
              <p>
                At <strong>{businessInfo.name}</strong>, we believe that modern menswear should be bold yet effortless, comfortable yet sharp. Founded with a vision to provide accessible, top-tier men's fashion, we have grown into one of the most trusted clothing destinations in the region.
              </p>
              <p>
                Every piece in our catalog is handpicked for its fabric longevity, colorfastness, and tailored fit. Whether you walk into our Modasa gallery or shop conveniently online, we ensure you receive attentive customer service, honest sizing advice, and garments you'll be proud to wear.
              </p>
              
              <div className="story-highlights-list">
                <div className="story-highlight-card">
                  <span className="highlight-icon">🧵</span>
                  <div>
                    <strong>Premium Fabrics Only</strong>
                    <p>Heavyweight pure cottons, breathable linens, and durable stretch-denims.</p>
                  </div>
                </div>
                <div className="story-highlight-card">
                  <span className="highlight-icon">✂️</span>
                  <div>
                    <strong>Precision Fits</strong>
                    <p>From drop-shoulder oversized fits to tailored slim cuts made for comfort.</p>
                  </div>
                </div>
                <div className="story-highlight-card">
                  <span className="highlight-icon">🤝</span>
                  <div>
                    <strong>In-Store Personal Styling</strong>
                    <p>Visit us for one-on-one styling guidance and trial assistance.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="about-story__media">
              <div className="story-image-card">
                <img src="/images/store-real-3.jpeg" alt="Brothers Outfit Interior Showroom" className="story-image-main" />
                <div className="story-floating-badge">
                  <span className="badge-star">★</span>
                  <div>
                    <strong>Authentic In-Store Experience</strong>
                    <span>Modasa's Top Fashion Gallery</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Real Store Photo Tour */}
      <section className="about-gallery-section">
        <div className="about-container">
          <div className="gallery-header-row">
            <div>
              <span className="section-eyebrow">PHOTO TOUR</span>
              <h2 className="section-title">INSIDE OUR GALLERY</h2>
              <p className="section-subtitle">Take a visual tour through our aisles, racks, and premium collections.</p>
            </div>
            <a href={businessInfo.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary gallery-directions-btn">
              GET STORE DIRECTIONS ↗
            </a>
          </div>
          
          <PhotoGallery images={storeImages} />
        </div>
      </section>

      {/* 5. Features Grid */}
      <section className="about-features">
        <div className="about-container">
          <div className="text-center" style={{ marginBottom: '40px' }}>
            <span className="section-eyebrow">WHY CHOOSE US</span>
            <h2 className="section-title">WHY SHOP WITH {businessInfo.name}?</h2>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">✨</div>
              <h3>QUALITY FIRST</h3>
              <p>Every shirt, denim, and t-shirt is rigorously checked for stitch durability and comfort.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>TRENDING MEN'S STYLES</h3>
              <p>Weekly updates of drop-shoulder tees, textured shirts, cargo pants, and partywear.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🛡️</div>
              <h3>HONEST PRICING</h3>
              <p>Direct fair pricing without hidden markups, giving you true value for your wardrobe.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📦</div>
              <h3>STORE + ONLINE SYNC</h3>
              <p>Browse our catalog online with fast doorstep shipping or try before buying in store.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Live Google Maps Integration & Store Directions */}
      <section className="about-location" id="store-location">
        <div className="about-container">
          <div className="text-center" style={{ marginBottom: '32px' }}>
            <span className="section-eyebrow">MAP & LOCATION</span>
            <h2 className="section-title">FIND BROTHERS OUTFIT GALLERY</h2>
            <p className="section-subtitle">Conveniently located with easy parking and direct highway access.</p>
          </div>
          
          <div className="location-grid">
            <div className="location-info-card">
              <div className="location-live-status">
                <span className="live-pulsing-dot"></span>
                <span>STORE OPEN FOR SHOPPING</span>
              </div>

              <h3>MEN'S CLOTHING STORE NEAR YOU</h3>
              <p>
                Experience the latest collections in person. Our staff is ready to help you find the perfect size, match coordinates, and elevate your wardrobe.
              </p>
              
              <div className="location-contact-list">
                <div className="contact-detail-row">
                  <span className="contact-icon">📍</span>
                  <div>
                    <strong>Store Address:</strong>
                    <p>{businessInfo.address}</p>
                  </div>
                </div>

                <div className="contact-detail-row">
                  <span className="contact-icon">📞</span>
                  <div>
                    <strong>Phone Support:</strong>
                    <p>{businessInfo.phone}</p>
                  </div>
                </div>

                <div className="contact-detail-row">
                  <span className="contact-icon">✉️</span>
                  <div>
                    <strong>Email:</strong>
                    <p>{businessInfo.email}</p>
                  </div>
                </div>
              </div>
              
              <div className="location-hours-box">
                <h4>Store Opening Hours</h4>
                {businessInfo.openingHours.map((slot, i) => (
                  <div key={i} className="hours-row">
                    <span>{slot.day}</span>
                    <strong>{slot.hours}</strong>
                  </div>
                ))}
              </div>

              <div className="location-buttons-wrap">
                <a href={businessInfo.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  OPEN IN GOOGLE MAPS ↗
                </a>
                <a href="tel:+919876543210" className="btn-secondary">
                  CALL STORE
                </a>
              </div>
            </div>
            
            {/* Interactive Live Google Maps Iframe */}
            <div className="location-map-container">
              <iframe
                title="Brothers Outfit Gallery Google Maps Location"
                src="https://maps.google.com/maps?q=BROTHERS+OUTFIT+GALLERY,+23.5875977,72.9697925&t=&z=16&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="100%"
                className="google-maps-iframe"
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
              <div className="map-info-badge">
                <span className="map-badge-pin">📍</span>
                <div>
                  <strong>BROTHERS OUTFIT GALLERY</strong>
                  <p>Modasa, Gujarat • Click map to zoom or pan</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Reviews Section */}
      <section className="about-reviews">
        <div className="about-container">
          <div className="text-center" style={{ marginBottom: '24px' }}>
            <span className="section-eyebrow">CUSTOMER FEEDBACK</span>
            <h2 className="section-title">WHAT OUR CUSTOMERS SAY</h2>
            <p className="section-subtitle">Real experiences from customers of {businessInfo.name}.</p>
          </div>
          
          <div className="reviews-trust-block">
            <div className="reviews-stars">★★★★★</div>
            <p className="reviews-rating">
              Rated <strong>4.9 / 5.0</strong> by shoppers across Gujarat for quality, styling and fit.
            </p>
            <a href={businessInfo.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              READ REVIEWS ON GOOGLE →
            </a>
          </div>

          <TestimonialMarquee />
        </div>
      </section>

      {/* 8. FAQ */}
      <section className="about-faq">
        <div className="about-container">
          <div className="text-center" style={{ marginBottom: '32px' }}>
            <span className="section-eyebrow">HELP & DETAILS</span>
            <h2 className="section-title">FREQUENTLY ASKED QUESTIONS</h2>
          </div>
          
          <div className="faq-list">
            <div className="faq-item">
              <h4>Where is {businessInfo.name} located?</h4>
              <p>Our store is located at {businessInfo.address}. We are easily accessible via Google Maps navigation.</p>
            </div>
            <div className="faq-item">
              <h4>What types of men's clothing do you offer?</h4>
              <p>We provide oversized graphic t-shirts, casual & formal shirts, premium denim jeans, trousers, jackets, and seasonal outfits.</p>
            </div>
            <div className="faq-item">
              <h4>Can I order online and get home delivery?</h4>
              <p>Yes! Browse our entire catalog on this website. We ship across India with tracking and secure online payment or Cash on Delivery.</p>
            </div>
            <div className="faq-item">
              <h4>Can I try clothes in the store?</h4>
              <p>Yes, our Modasa store features spacious, comfortable trial rooms and dedicated styling assistants to ensure your ideal fit.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Final CTA */}
      <section className="about-final-cta">
        <div className="about-container text-center">
          <h2 className="section-title">READY TO UPGRADE YOUR WARDROBE?</h2>
          <p>Browse our latest men's collections online or visit {businessInfo.name} in person today.</p>
          <div className="about-hero__actions">
            <Link to="/shop" className="btn-primary">SHOP CATALOG ONLINE →</Link>
            <a href={businessInfo.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">GET DIRECTIONS TO STORE →</a>
          </div>
        </div>
      </section>
    </div>
  );
}
