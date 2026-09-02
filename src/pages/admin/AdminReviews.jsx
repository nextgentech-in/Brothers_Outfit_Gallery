import { useState, useEffect } from 'react';
import { getAdminReviews, deleteReview } from '../../services/adminService';
import './AdminReviews.css';

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = async () => {
    setLoading(true);
    const data = await getAdminReviews();
    setReviews(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Delete this customer review?")) {
      await deleteReview(id);
      fetchReviews();
    }
  };

  return (
    <div className="admin-reviews-page">
      <div className="admin-header">
        <h1 className="admin-title">Customer Reviews ({reviews.length})</h1>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>AUTHOR</th>
              <th>RATING</th>
              <th>COMMENT</th>
              <th>PRODUCT</th>
              <th>DATE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px'}}>Loading reviews...</td></tr>
            ) : reviews.length === 0 ? (
              <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px'}}>No customer reviews found.</td></tr>
            ) : reviews.map(r => (
              <tr key={r.id}>
                <td><strong>{r.userName || r.author || 'Anonymous'}</strong></td>
                <td>
                  <span style={{color: '#f59e0b', fontWeight: 'bold'}}>
                    {'★'.repeat(r.rating || 5)}
                  </span>
                </td>
                <td>{r.comment || r.reviewText}</td>
                <td>{r.productName || 'General Store Review'}</td>
                <td style={{fontSize: '12px'}}>{r.createdAt || 'Recent'}</td>
                <td>
                  <button onClick={() => handleDelete(r.id)} className="admin-action-btn delete">
                    DELETE
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
