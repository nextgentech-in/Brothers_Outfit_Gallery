import { useState, useRef } from 'react';
import './ImageZoom.css';

export default function ImageZoom({ src, alt, onClick }) {
  const [zoomStyle, setZoomStyle] = useState({ display: 'none' });
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    // Disable hover-zoom gracefully on touch devices mapping abstract width boundaries broadly 
    if (window.innerWidth < 1024) return;

    const { left, top, width, height } = containerRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;

    // Calculate percentages
    const xPercent = (x / width) * 100;
    const yPercent = (y / height) * 100;

    // Boundary protections keeping bounds from snapping off prematurely 
    if (xPercent < 0 || xPercent > 100 || yPercent < 0 || yPercent > 100) {
      setZoomStyle({ display: 'none' });
      return;
    }

    setZoomStyle({
      display: 'block',
      backgroundImage: `url(${src})`,
      backgroundPosition: `${xPercent}% ${yPercent}%`,
      left: `${x}px`,
      top: `${y}px`
    });
  };

  const handleMouseLeave = () => {
    setZoomStyle({ display: 'none' });
  };

  return (
    <div 
      className="image-zoom-container" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        if (onClick) onClick(e);
      }}
    >
      <img src={src} alt={alt} className="image-zoom-base" loading="eager" />
      <div className="image-zoom-lens" style={zoomStyle}></div>
      <div className="image-zoom-hint">🔍 Click to enlarge / Fullscreen</div>
    </div>

  );
}
