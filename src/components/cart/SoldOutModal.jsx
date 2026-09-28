import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { optimizeImage } from '../../utils/imageUtils';
import './SoldOutModal.css';

export default function SoldOutModal() {
  const { soldOutModalData, dismissSoldOutModal } = useCart();
  const navigate = useNavigate();

  if (!soldOutModalData || !soldOutModalData.items || soldOutModalData.items.length === 0) {
    return null;
  }

  const { items, message } = soldOutModalData;

  const handleExplore = () => {
    dismissSoldOutModal();
    navigate('/shop');
  };

  return (
    <div className="som-backdrop" onClick={dismissSoldOutModal} role="dialog" aria-modal="true" aria-labelledby="som-title">
      <div className="som-modal" onClick={e => e.stopPropagation()}>
        {/* Close Icon Button */}
        <button 
          className="som-close-btn" 
          onClick={dismissSoldOutModal} 
          aria-label="Close dialog"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header Icon */}
        <div className="som-icon-wrap" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
            <line x1="9" y1="14" x2="15" y2="14" strokeWidth="2.5" />
          </svg>
        </div>

        {/* Title & Message */}
        <h2 id="som-title" className="som-title">Product Sold Out</h2>
        <p className="som-message">
          {message || 'Your added product sold out explore other products'}
        </p>

        {/* List of Sold Out Items */}
        <div className="som-items-list" role="list">
          {items.map(item => (
            <div key={item.cartItemId || item.id} className="som-item-card" role="listitem">
              <div className="som-item-img-wrap">
                <img
                  src={optimizeImage(item.image, 160)}
                  alt={item.name}
                  className="som-item-img"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/images/hero.png';
                  }}
                />
                <span className="som-badge-soldout">SOLD OUT</span>
              </div>
              <div className="som-item-info">
                <span className="som-item-name">{item.name}</span>
                {item.size && item.size !== 'One Size' && (
                  <span className="som-item-meta">Size: <strong>{item.size}</strong></span>
                )}
                {item.color && item.color !== 'Standard' && item.color !== 'Default' && (
                  <span className="som-item-meta">Color: <strong>{item.color}</strong></span>
                )}
                <span className="som-item-price">₹{Number(item.price || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="som-actions">
          <button 
            type="button" 
            className="som-btn som-btn-primary" 
            onClick={handleExplore}
          >
            EXPLORE OTHER PRODUCTS
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </button>
          <button 
            type="button" 
            className="som-btn som-btn-secondary" 
            onClick={dismissSoldOutModal}
          >
            OK, GOT IT
          </button>
        </div>
      </div>
    </div>
  );
}
