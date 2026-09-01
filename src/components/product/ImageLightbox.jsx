import { useEffect } from 'react';
import './ImageLightbox.css';

export default function ImageLightbox({ images, currentIndex, onClose, onNavigate }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNavigate('next');
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

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-header">
        <span className="lightbox-counter">{currentIndex + 1} / {total}</span>
        <button className="lightbox-close" onClick={onClose} aria-label="Close Gallery">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {total > 1 && (
          <button className="lightbox-nav lightbox-prev" onClick={() => onNavigate('prev')} aria-label="Previous image">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
        
        <img src={currentImage} alt="Fullscreen Product View" className="lightbox-image" />
        
        {total > 1 && (
          <button className="lightbox-nav lightbox-next" onClick={() => onNavigate('next')} aria-label="Next image">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
