import { useState, useRef } from 'react';
import ImageZoom from './ImageZoom';
import ImageLightbox from './ImageLightbox';
import { optimizeImage } from '../../utils/imageUtils';
import './ProductGallery.css';

export default function ProductGallery({ images }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef(null);
  
  if (!images || images.length === 0) return <div className="product-gallery-empty">No Images Available</div>;

  // Extract purely the URL regardless if it's the legacy string format or the new object format
  const extractUrl = (img) => (typeof img === 'object' && img !== null && img.url) ? img.url : img;
  const currentImage = extractUrl(images[currentIndex]);

  const handleNavigate = (direction) => {
    if (direction === 'next') {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    } else {
      setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    }
  };

  // Touch swipe support for main product gallery (Mobile)
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (!touchStartX.current) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 35) { // minimum swipe distance
      if (diff > 0) {
        handleNavigate('next');
      } else {
        handleNavigate('prev');
      }
    }
    touchStartX.current = null;
  };

  return (
    <div className="product-gallery-wrapper">
      
      {/* Thumbnails list (Vertical on Desktop, Horizontal Scroll on Mobile) */}
      <div className="product-gallery-thumbnails">
        {images.map((imgObj, idx) => {
          const thumbUrl = extractUrl(imgObj);
          return (
            <button 
              key={idx} 
              className={`thumbnail-btn ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`View image ${idx + 1}`}
            >
              <img loading="lazy" src={optimizeImage(thumbUrl, 200)} alt={`Thumbnail ${idx + 1}`} />
            </button>
          )
        })}
      </div>

      {/* Main Large Image Block */}
      <div 
        className="product-gallery-main"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <ImageZoom 
          src={optimizeImage(currentImage, 1000)} 
          alt={`Product view ${currentIndex + 1}`} 
          onClick={() => setLightboxOpen(true)}
        />

        {/* Previous / Next Arrow Overlay Controls */}
        {images.length > 1 && (
          <>
            <button 
              className="gallery-nav-arrow gallery-nav-prev" 
              onClick={(e) => { e.stopPropagation(); handleNavigate('prev'); }}
              aria-label="Previous image"
            >
              ‹
            </button>
            <button 
              className="gallery-nav-arrow gallery-nav-next" 
              onClick={(e) => { e.stopPropagation(); handleNavigate('next'); }}
              aria-label="Next image"
            >
              ›
            </button>
          </>
        )}
        
        {/* Mobile Swipe Indicators (Dots) */}
        {images.length > 1 && (
          <div className="product-gallery-dots">
            {images.map((_, idx) => (
              <span 
                key={idx}
                className={`dot ${idx === currentIndex ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <ImageLightbox 
          images={images.map(img => optimizeImage(extractUrl(img), 1400))} 
          currentIndex={currentIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={handleNavigate}
          onSelectIndex={(idx) => setCurrentIndex(idx)}
        />
      )}

    </div>
  );
}

