import { useState, useRef, useEffect, useMemo } from 'react';
import ImageZoom from './ImageZoom';
import ImageLightbox from './ImageLightbox';
import { optimizeImage } from '../../utils/imageUtils';
import './ProductGallery.css';

export default function ProductGallery({ images, selectedColor, selectedColorIndex, totalColors }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef(null);

  // Extract purely the URL regardless if it's the legacy string format or the object format
  const extractUrl = (img) => (typeof img === 'object' && img !== null && img.url) ? img.url : (typeof img === 'string' ? img : '');
  const extractColor = (img) => (typeof img === 'object' && img !== null && img.color) ? String(img.color).trim() : '';

  // Filter images linked specifically to the selected color
  const displayImages = useMemo(() => {
    if (!images || images.length === 0) return [];

    // Filter out invalid items
    const validImages = images.filter(img => extractUrl(img));
    if (validImages.length === 0) return [];

    // Check if any images in the set are explicitly tagged with a color
    const hasColorTaggedImages = validImages.some(img => {
      const c = extractColor(img);
      return c && c.toLowerCase() !== 'all' && c.toLowerCase() !== 'general' && c.toLowerCase() !== 'standard';
    });

    if (hasColorTaggedImages && selectedColor) {
      const target = String(selectedColor).trim().toLowerCase();
      const colorMatched = validImages.filter(img => {
        const c = extractColor(img).toLowerCase();
        return c === target;
      });

      // If specific color images found, also include general/all images if any
      if (colorMatched.length > 0) {
        const generalImages = validImages.filter(img => {
          const c = extractColor(img).toLowerCase();
          return c === 'all' || c === 'general';
        });
        return [...colorMatched, ...generalImages];
      }
    }

    return validImages;
  }, [images, selectedColor]);

  // When selected color changes, reset image index to 0
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedColor]);

  // Legacy fallback: if images are not color-tagged, jump to corresponding index when color index changes
  useEffect(() => {
    if (!images || images.length === 0) return;
    const hasColorTaggedImages = images.some(img => {
      const c = extractColor(img);
      return c && c.toLowerCase() !== 'all' && c.toLowerCase() !== 'general';
    });

    // Only use sequential math if no color tagging was explicitly defined
    if (!hasColorTaggedImages && selectedColorIndex != null && totalColors && totalColors > 0) {
      const imagesPerColor = images.length / totalColors;
      const targetIndex = Math.min(Math.floor(selectedColorIndex * imagesPerColor), images.length - 1);
      setCurrentIndex(targetIndex);
    }
  }, [selectedColorIndex, totalColors, images]);

  if (!displayImages || displayImages.length === 0) {
    return <div className="product-gallery-empty">No Images Available</div>;
  }

  const safeCurrentIndex = Math.min(currentIndex, displayImages.length - 1);
  const currentImage = extractUrl(displayImages[safeCurrentIndex]) || extractUrl(displayImages[0]);

  const handleNavigate = (direction) => {
    if (direction === 'next') {
      setCurrentIndex((prev) => (prev + 1) % displayImages.length);
    } else {
      setCurrentIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
    }
  };

  // Touch swipe support for main product gallery (Mobile)
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (!touchStartX.current || displayImages.length <= 1) return;
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
      {displayImages.length > 1 && (
        <div className="product-gallery-thumbnails">
          {displayImages.map((imgObj, idx) => {
            const thumbUrl = extractUrl(imgObj);
            const imgColor = extractColor(imgObj);
            return (
              <button 
                key={idx} 
                className={`thumbnail-btn ${idx === safeCurrentIndex ? 'active' : ''}`}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`View image ${idx + 1}`}
                title={imgColor ? `Color: ${imgColor}` : `View image ${idx + 1}`}
              >
                <img loading="lazy" decoding="async" src={optimizeImage(thumbUrl, 240)} alt={`Thumbnail ${idx + 1}`} />
              </button>
            );
          })}
        </div>
      )}

      {/* Main Large Image Block */}
      <div 
        className="product-gallery-main"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <ImageZoom 
          src={optimizeImage(currentImage, {
            width: typeof window !== 'undefined' && window.innerWidth < 768 ? 1200 : 1600,
            quality: 92
          })} 
          alt={`Product view ${safeCurrentIndex + 1}`} 
          onClick={() => setLightboxOpen(true)}
        />

        {/* Previous / Next Arrow Overlay Controls */}
        {displayImages.length > 1 && (
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
        {displayImages.length > 1 && (
          <>
            <div className="product-gallery-dots" role="tablist" aria-label="Product gallery images">
              {displayImages.map((_, idx) => (
                <button 
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === safeCurrentIndex}
                  aria-label={`View image ${idx + 1} of ${displayImages.length}`}
                  className={`dot ${idx === safeCurrentIndex ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                />
              ))}
            </div>
            <span className="sr-only" aria-live="polite" aria-atomic="true">
              Showing image {safeCurrentIndex + 1} of {displayImages.length}
            </span>
          </>
        )}

        {/* Color Badge Indicator on image if active color has multiple images */}
        {selectedColor && displayImages.length > 0 && (
          <div className="gallery-color-indicator">
            <span className="gallery-color-indicator-text">{selectedColor}</span>
            {displayImages.length > 1 && (
              <span className="gallery-color-count-pill">{safeCurrentIndex + 1}/{displayImages.length}</span>
            )}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <ImageLightbox 
          images={displayImages.map(img => optimizeImage(extractUrl(img), { width: 1800, quality: 95 }))} 
          currentIndex={safeCurrentIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={handleNavigate}
          onSelectIndex={(idx) => setCurrentIndex(idx)}
        />
      )}

    </div>
  );
}

