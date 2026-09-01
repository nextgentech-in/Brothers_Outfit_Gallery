import { useState } from 'react';
import './PhotoGallery.css';

export default function PhotoGallery({ images }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openLightbox = (index) => {
    setCurrentIndex(index);
    setIsOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setIsOpen(false);
    document.body.style.overflow = 'auto';
  };

  const showNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const showPrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  if (!images || images.length === 0) return null;

  return (
    <>
      <div className="photo-gallery-grid">
        {images.map((img, index) => (
          <div 
            key={index} 
            className="photo-gallery-item"
            onClick={() => openLightbox(index)}
          >
            {img.url.includes('placeholder') ? (
              <div className="photo-gallery-placeholder">
                <span>{img.alt}</span>
              </div>
            ) : (
              <img src={img.url} alt={img.alt} loading="lazy" />
            )}
            <div className="photo-gallery-zoom">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </div>
          </div>
        ))}
      </div>

      {isOpen && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <button className="lightbox-close" onClick={closeLightbox} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          <button className="lightbox-nav lightbox-prev" onClick={showPrev} aria-label="Previous">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {images[currentIndex].url.includes('placeholder') ? (
              <div className="lightbox-placeholder">
                <span>{images[currentIndex].alt}</span>
              </div>
            ) : (
              <img src={images[currentIndex].url} alt={images[currentIndex].alt} />
            )}
            {images[currentIndex].caption && (
              <div className="lightbox-caption">{images[currentIndex].caption}</div>
            )}
          </div>

          <button className="lightbox-nav lightbox-next" onClick={showNext} aria-label="Next">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
