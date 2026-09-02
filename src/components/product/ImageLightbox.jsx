import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import './ImageLightbox.css';

export default function ImageLightbox({ images, currentIndex, onClose, onNavigate, onSelectIndex }) {
  const touchStartX = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === ' ') onNavigate('next');
      if (e.key === 'ArrowLeft') onNavigate('prev');
    };
    
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, onNavigate]);

  const total = images.length;
  const currentImage = images[currentIndex];

  // Touch Swipe Handler for Mobile
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (!touchStartX.current) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        onNavigate('next');
      } else {
        onNavigate('prev');
      }
    }
    touchStartX.current = null;
  };

  const content = (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-header">
        <span className="lightbox-counter">IMAGE {currentIndex + 1} OF {total}</span>
        <button className="lightbox-close" onClick={onClose} aria-label="Close Gallery">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      
      <div 
        className="lightbox-content" 
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {total > 1 && (
          <button className="lightbox-nav lightbox-prev" onClick={() => onNavigate('prev')} aria-label="Previous image">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
        
        <img 
          src={currentImage} 
          alt={`Fullscreen View ${currentIndex + 1}`} 
          className="lightbox-image" 
          onClick={() => total > 1 && onNavigate('next')}
          title="Click to view next image"
        />
        
        {total > 1 && (
          <button className="lightbox-nav lightbox-next" onClick={() => onNavigate('next')} aria-label="Next image">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}
      </div>

      {/* Lightbox Bottom Thumbnail Bar */}
      {total > 1 && (
        <div className="lightbox-thumbnails-bar" onClick={(e) => e.stopPropagation()}>
          {images.map((imgUrl, idx) => (
            <button
              key={idx}
              className={`lightbox-thumb ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => onSelectIndex ? onSelectIndex(idx) : (idx > currentIndex ? onNavigate('next') : onNavigate('prev'))}
            >
              <img src={imgUrl} alt={`Thumb ${idx + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}


