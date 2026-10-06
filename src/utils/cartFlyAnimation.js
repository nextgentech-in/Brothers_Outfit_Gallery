/**
 * Brother’s Outfit Gallery — Premium Add-to-Cart Flying Product Animation Engine
 * 
 * GPU-accelerated, zero-dependency, accessible motion using native Web Animations API.
 * Gracefully degrades if element or target is unavailable or user prefers reduced motion.
 */

/**
 * Finds the currently visible cart icon in the navbar (desktop or mobile)
 * @returns {HTMLElement|null}
 */
export function findVisibleCartTarget() {
  if (typeof document === 'undefined') return null;

  const candidates = document.querySelectorAll(
    '[data-cart-target="true"], #navbar-cart-button, .navbar__cart-btn, .navbar__icon-btn[aria-label="Shopping Cart"]'
  );

  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const style = window.getComputedStyle(el);
      if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
        return el;
      }
    }
  }

  return candidates[0] || null;
}

/**
 * Trigger subtle bounce animation on the cart target element
 * @param {HTMLElement} targetEl 
 */
export function triggerCartBounce(targetEl) {
  const cart = targetEl || findVisibleCartTarget();
  if (!cart) return;

  cart.classList.remove('cart-icon-bounce');
  // Trigger reflow to restart CSS animation if clicked rapidly
  void cart.offsetWidth;
  cart.classList.add('cart-icon-bounce');

  setTimeout(() => {
    cart.classList.remove('cart-icon-bounce');
  }, 400);
}

/**
 * Triggers the flying product animation towards the navbar cart
 * @param {HTMLElement|MouseEvent|React.SyntheticEvent} source - Click event, button, card, or image element
 * @param {string} [customImageUrl] - Optional direct image URL fallback
 * @returns {Promise<boolean>} - Resolves true when animation finishes, false if skipped
 */
export function flyProductToCart(source, customImageUrl = null) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve(false);
    }

    // 1. Accessibility: respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cartTarget = findVisibleCartTarget();

    if (prefersReducedMotion) {
      if (cartTarget) triggerCartBounce(cartTarget);
      return resolve(true);
    }

    // 2. Identify the source DOM element
    let sourceEl = null;
    if (source && source.target) {
      sourceEl = source.currentTarget || source.target;
    } else if (source instanceof HTMLElement) {
      sourceEl = source;
    }

    // 3. Find the best matching product image
    let imgEl = null;
    if (sourceEl) {
      if (sourceEl.tagName === 'IMG') {
        imgEl = sourceEl;
      } else {
        // Look within the closest product card or gallery container
        const cardContainer = sourceEl.closest(
          '.product-card, .product-gallery-section, .product-main-grid, .product-gallery-main, .wishlist-card, .related-products-grid, .product-page-container'
        );
        if (cardContainer) {
          imgEl = cardContainer.querySelector(
            '.product-gallery-main img, .product-card__image, .image-zoom-img, img'
          );
        }
        if (!imgEl) {
          imgEl = sourceEl.querySelector('img');
        }
      }
    }

    // 4. Fallback if no target or image rect found
    if (!cartTarget) {
      return resolve(false);
    }

    const targetRect = cartTarget.getBoundingClientRect();
    if (targetRect.width === 0 || targetRect.height === 0) {
      return resolve(false);
    }

    let sourceRect = imgEl ? imgEl.getBoundingClientRect() : null;

    // If source image rect is invalid or hidden, try sourceEl or resolve gracefully
    if (!sourceRect || sourceRect.width === 0 || sourceRect.height === 0) {
      if (sourceEl) {
        sourceRect = sourceEl.getBoundingClientRect();
      } else {
        triggerCartBounce(cartTarget);
        return resolve(false);
      }
    }

    // 5. Determine image source URL
    const imgSrc = customImageUrl || (imgEl ? (imgEl.currentSrc || imgEl.src) : null);
    if (!imgSrc) {
      triggerCartBounce(cartTarget);
      return resolve(false);
    }

    // 6. Calculate coordinates and trajectory
    const sourceCenterX = sourceRect.left + sourceRect.width / 2;
    const sourceCenterY = sourceRect.top + sourceRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const deltaX = targetCenterX - sourceCenterX;
    const deltaY = targetCenterY - sourceCenterY;

    // Upward parabolic arc height based on distance
    const arcHeight = Math.min(100, Math.max(35, Math.abs(deltaY) * 0.35 + 25));

    // Cap initial clone size so it is visually sharp and compact on desktop/mobile
    const initialWidth = Math.min(sourceRect.width, 220);
    const initialHeight = Math.min(sourceRect.height, 260);
    const initialLeft = sourceCenterX - initialWidth / 2;
    const initialTop = sourceCenterY - initialHeight / 2;

    // 7. Create flying clone element
    const flyingClone = document.createElement('div');
    flyingClone.className = 'flying-product-clone';
    flyingClone.setAttribute('aria-hidden', 'true');

    Object.assign(flyingClone.style, {
      position: 'fixed',
      left: `${initialLeft}px`,
      top: `${initialTop}px`,
      width: `${initialWidth}px`,
      height: `${initialHeight}px`,
      borderRadius: '12px',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '999999',
      boxShadow: '0 14px 34px rgba(17, 17, 17, 0.22), 0 2px 8px rgba(184, 138, 46, 0.3)',
      border: '1.5px solid rgba(184, 138, 46, 0.55)',
      backgroundColor: '#ffffff',
      willChange: 'transform, opacity',
      transformOrigin: 'center center'
    });

    const cloneImg = document.createElement('img');
    cloneImg.src = imgSrc;
    cloneImg.alt = '';
    Object.assign(cloneImg.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block'
    });

    flyingClone.appendChild(cloneImg);
    document.body.appendChild(flyingClone);

    // 8. Animate using native Web Animations API
    const keyframes = [
      {
        transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)',
        opacity: 1,
        borderRadius: '12px'
      },
      {
        transform: `translate3d(${deltaX * 0.35}px, ${deltaY * 0.2 - arcHeight}px, 0) scale(0.72) rotate(-5deg)`,
        opacity: 0.95,
        borderRadius: '16px',
        offset: 0.35
      },
      {
        transform: `translate3d(${deltaX * 0.75}px, ${deltaY * 0.68 - arcHeight * 0.35}px, 0) scale(0.35) rotate(4deg)`,
        opacity: 0.85,
        borderRadius: '20px',
        offset: 0.75
      },
      {
        transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.12) rotate(0deg)`,
        opacity: 0.15,
        borderRadius: '50%',
        offset: 1
      }
    ];

    const duration = 650; // ms

    try {
      const animation = flyingClone.animate(keyframes, {
        duration,
        easing: 'cubic-bezier(0.2, 0.9, 0.32, 1)',
        fill: 'forwards'
      });

      const cleanup = () => {
        if (flyingClone.parentNode) {
          flyingClone.parentNode.removeChild(flyingClone);
        }
        triggerCartBounce(cartTarget);
        resolve(true);
      };

      animation.onfinish = cleanup;
      animation.oncancel = cleanup;

      // Safety timeout in case browser throttles inactive tab
      setTimeout(() => {
        if (flyingClone.parentNode) {
          cleanup();
        }
      }, duration + 150);

    } catch (err) {
      // Fallback if WAAPI fails in edge environments
      if (flyingClone.parentNode) {
        flyingClone.parentNode.removeChild(flyingClone);
      }
      triggerCartBounce(cartTarget);
      resolve(true);
    }
  });
}
