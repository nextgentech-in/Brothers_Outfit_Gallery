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
      "url": window.location.origin,
      "sameAs": [businessInfo.googleMapsUrl]
    });
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const storeImages = [
    { url: "placeholder-storefront.jpg", alt: "Store Exterior [Placeholder]", caption: "Brothers Outfit Gallery Storefront" },
    { url: "placeholder-interior.jpg", alt: "Store Interior Layout [Placeholder]", caption: "Our Shopping Environment" },
    { url: "placeholder-racks.jpg", alt: "Clothing Display Racks [Placeholder]", caption: "Premium Men's Wear Displays" },
    { url: "placeholder-trials.jpg", alt: "Trial/Experience Area [Placeholder]", caption: "Comfortable Trial Rooms" },
    { url: "placeholder-shirts.jpg", alt: "Shirts Collection Shelf [Placeholder]", caption: "Organized Collection Shelves" },
    { url: "placeholder-branded.jpg", alt: "Branding/Signboard [Placeholder]", caption: "The Brothers Outfit Gallery Identity" }
  ];

  return (
    <div className="about-page">
      {/* 1. Hero */}
      <section className="about-hero">
        <span className="about-hero__label">{businessInfo.name}</span>
        <h1 className="about-hero__title">MORE THAN CLOTHING.<br />IT'S YOUR STYLE.</h1>
        <p className="about-hero__desc">
          Discover modern men's fashion, quality clothing and a shopping experience built around confidence, comfort and personal style.
        </p>
        <div className="about-hero__actions">
          <Link to="/shop" className="btn-primary">SHOP COLLECTION →</Link>
          <a href={businessInfo.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">VISIT OUR STORE →</a>
        </div>
      </section>

      {/* 2. Story Section */}
      <section className="about-story">
        <div className="about-container">
          <h2 className="section-title">ABOUT BROTHERS OUTFIT GALLERY</h2>
          <div className="about-story__content">
            <p>
              At {businessInfo.name}, we believe that men's fashion should be straightforward, reliable, and effortlessly stylish. We carefully select clothing that bridges the gap between everyday comfort and sharp, modern aesthetics. 
            </p>
            <p>
              Whether you are visiting our physical store or discovering our collections online, you'll find a shopping experience entirely focused on helping you find the right fit and style. From casual essentials to smart-casual upgrades, our collections continuously evolve to bring you fresh, high-quality menswear.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Why Choose Us */}
      <section className="about-features">
        <div className="about-container">
          <h2 className="section-title">WHY SHOP WITH {businessInfo.name}?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <h3>QUALITY FIRST</h3>
              <p>Carefully selected styles and fabrics for everyday comfort and confidence.</p>
            </div>
            <div className="feature-card">
              <h3>MODERN MEN'S FASHION</h3>
              <p>Fashion-forward styles for casual, smart and everyday looks.</p>
            </div>
            <div className="feature-card">
              <h3>TRUSTED SERVICE</h3>
              <p>A shopping experience focused on helping customers find the right style.</p>
            </div>
            <div className="feature-card">
              <h3>STORE + ONLINE SHOPPING</h3>
              <p>Customers can discover products online or visit the physical store.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Real Shop Photos */}
      <section className="about-gallery-section">
        <div className="about-container">
          <h2 className="section-title">VISIT OUR STORE</h2>
          <p className="section-subtitle">See where your style begins.</p>
          <PhotoGallery images={storeImages} />
        </div>
      </section>

      {/* 6. Reviews CTA */}
      <section className="about-reviews">
        <div className="about-container">
          <h2 className="section-title">WHAT OUR CUSTOMERS SAY</h2>
          <p className="section-subtitle">Real experiences from customers of {businessInfo.name}.</p>
          
          <div className="reviews-trust-block">
            <div className="reviews-stars">★★★★★</div>
            <p className="reviews-rating">
              Discover real photos and genuine feedback on our Google profile.
            </p>
            <a href={businessInfo.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              READ ALL GOOGLE REVIEWS →
            </a>
          </div>

          <TestimonialMarquee />
        </div>
      </section>

      {/* 7. Local SEO / Find Our Store */}
      <section className="about-location">
        <div className="about-container">
          <h2 className="section-title">FIND {businessInfo.name}</h2>
          
          <div className="location-grid">
            <div className="location-info">
              <h3>MEN'S CLOTHING STORE NEAR YOU</h3>
              <p>
                Looking for the latest in men's fashion? Visit {businessInfo.name}. We provide an extensive selection of casual wear, shirts, t-shirts, jeans, and premium men's collections directly in our local store. Experience the comfort and fit firsthand.
              </p>
              
              <ul className="location-details">
                <li><strong>Address:</strong> {businessInfo.address}</li>
                <li><strong>Phone:</strong> {businessInfo.phone}</li>
                <li><strong>Email:</strong> {businessInfo.email}</li>
              </ul>
              
              <div className="location-hours">
                <h4>Opening Hours</h4>
                {businessInfo.openingHours.map((slot, i) => (
                  <div key={i} className="hours-row">
                    <span>{slot.day}</span>
                    <span>{slot.hours}</span>
                  </div>
                ))}
              </div>

              <a href={businessInfo.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{marginTop: '24px'}}>
                GET DIRECTIONS →
              </a>
            </div>
            
            <div className="location-map-placeholder">
              <div className="map-standin">
                <span>[GOOGLE MAPS EMBED PLACEHOLDER]</span>
                <p>Embed API Key Required</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FAQ */}
      <section className="about-faq">
        <div className="about-container">
          <h2 className="section-title">FREQUENTLY ASKED QUESTIONS</h2>
          
          <div className="faq-list">
            <div className="faq-item">
              <h4>Where is {businessInfo.name} located?</h4>
              <p>You can find us at our physical store location: {businessInfo.address}. Visit our <a href={businessInfo.googleMapsUrl} target="_blank" rel="noopener noreferrer">Google Maps profile</a> for precise directions.</p>
            </div>
            <div className="faq-item">
              <h4>What type of men's clothing do you offer?</h4>
              <p>We offer a wide variety of men's fashion including casual shirts, t-shirts, premium jeans, trousers, jackets, hoodies, and ethnic wear.</p>
            </div>
            <div className="faq-item">
              <h4>Can I shop online?</h4>
              <p>Yes, you can browse and order our <Link to="/shop">full collection online</Link>, featuring the exact styles available in our physical store.</p>
            </div>
            <div className="faq-item">
              <h4>Do you have sale offers or new arrivals?</h4>
              <p>Absolutely. We regularly update our <Link to="/new-arrivals">New Arrivals</Link> section and run limited-time promotions on our <Link to="/sale">Sale</Link> page.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Final CTA */}
      <section className="about-final-cta">
        <div className="about-container text-center">
          <h2 className="section-title">READY TO FIND YOUR STYLE?</h2>
          <p>Explore our latest men's collection online or visit {businessInfo.name} in person.</p>
          <div className="about-hero__actions">
            <Link to="/shop" className="btn-primary">SHOP NOW →</Link>
            <a href={businessInfo.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">VISIT OUR STORE →</a>
          </div>
        </div>
      </section>
    </div>
  );
}
