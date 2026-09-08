import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import './CartItemCard.css';

export default function CartItemCard({ item }) {
  const { updateQuantity, removeFromCart } = useCart();
  
  const handleQuantity = (delta) => {
    updateQuantity(item.cartItemId, item.quantity + delta);
  };

  return (
    <div className="cart-item-card">
      <Link to={`/product/${item.slug}`} className="cart-item-image-link">
        <img src={item.image} alt={item.name} className="cart-item-img" />
      </Link>
      
      <div className="cart-item-details">
        <div className="cart-item-header">
          <Link to={`/product/${item.slug}`} className="cart-item-title">
            {item.name}
          </Link>
          <span className="cart-item-price">₹{item.price}</span>
        </div>

        <div className="cart-item-variants">
          <span>Color: {typeof item.color === 'object' && item.color !== null ? (item.color.name || item.color.color || 'Standard') : (item.color || 'Standard')}</span>
          <span>Size: {typeof item.size === 'object' && item.size !== null ? (item.size.name || item.size.size || 'One Size') : (item.size || 'One Size')}</span>
        </div>


        <div className="cart-item-actions">
          <div className="cart-quantity-selector">
            <button onClick={() => handleQuantity(-1)} disabled={item.quantity <= 1}>−</button>
            <span>{item.quantity}</span>
            <button onClick={() => handleQuantity(1)} disabled={item.quantity >= item.stock}>+</button>
          </div>
          
          <button 
            className="btn-cart-remove" 
            onClick={() => removeFromCart(item.cartItemId)}
            aria-label="Remove item"
          >
            🗑 Remove
          </button>
        </div>
      </div>
    </div>
  );
}
