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

  const [previewImg, setPreviewImg] = useState(null);

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
              <th>RECOMMENDS</th>
              <th>PHOTOS</th>
              <th>COMMENT</th>
              <th>PRODUCT</th>
              <th>DATE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{textAlign: 'center', padding: '40px'}}>Loading reviews...</td></tr>
            ) : reviews.length === 0 ? (
              <tr><td colSpan="8" style={{textAlign: 'center', padding: '40px'}}>No customer reviews found.</td></tr>
            ) : reviews.map(r => (
              <tr key={r.id}>
                <td>
                  <strong>{r.userName || r.author || 'Anonymous'}</strong>
                  {r.userEmail && <div style={{ fontSize: '11px', color: '#64748b' }}>{r.userEmail}</div>}
                </td>
                <td>
                  <span style={{color: '#f59e0b', fontWeight: 'bold'}}>
                    {'★'.repeat(Number(r.rating) || 5)}
                  </span>
                </td>
                <td>
                  {r.recommend !== false ? (
                    <span style={{ color: '#15803d', fontWeight: 600, background: '#f0fdf4', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                      👍 Yes
                    </span>
                  ) : (
                    <span style={{ color: '#b91c1c', fontWeight: 600, background: '#fef2f2', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                      👎 No
                    </span>
                  )}
                </td>
                <td>
                  {r.images && r.images.length > 0 ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {r.images.map((img, i) => (
                        <img 
                          key={i} 
                          src={img} 
                          alt="Review attachment" 
                          style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                          onClick={() => setPreviewImg(img)}
                          title="Click to view full photo"
                        />
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>None</span>
                  )}
                </td>
                <td style={{ maxWidth: '280px', fontSize: '13px', lineHeight: '1.4' }}>{r.comment || r.reviewText}</td>
                <td><strong>{r.productName || 'General Store Review'}</strong></td>
                <td style={{fontSize: '12px', whiteSpace: 'nowrap'}}>
                  {r.dateFormatted || (r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString('en-IN') : 'Recent')}
                </td>
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

      {previewImg && (
        <div 
          onClick={() => setPreviewImg(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'pointer' }}
        >
          <img src={previewImg} alt="Preview" style={{ maxWidth: '85vw', maxHeight: '85vh', borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }} />
        </div>
      )}
    </div>
  );
}
