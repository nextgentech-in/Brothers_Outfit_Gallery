import { useEffect } from 'react';

/**
 * Hook to trap keyboard focus within a container (e.g. modal, drawer)
 * and close on Escape key.
 * 
 * @param {React.RefObject} containerRef - Ref to the modal/drawer container
 * @param {boolean} isOpen - Whether the overlay is currently open
 * @param {Function} onClose - Callback when Escape is pressed
 */
export function useFocusTrap(containerRef, isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Escape key closes overlay
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
        return;
      }

      // Focus trapping on Tab
      if (e.key === 'Tab' && containerRef?.current) {
        const focusableElements = containerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus to the container or first interactive element
    const timer = setTimeout(() => {
      if (containerRef?.current) {
        const firstFocusable = containerRef.current.querySelector(
          'input:not([disabled]), button:not([disabled]), a[href]'
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          containerRef.current.focus?.();
        }
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [containerRef, isOpen, onClose]);
}
