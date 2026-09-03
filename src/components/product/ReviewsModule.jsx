import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getProductReviews, submitReview, compressReviewImage } from '../../services/reviewService';
import './ReviewsModule.css';

export default function ReviewsModule({ product }) {
  const { currentUser, userProfile } = useAuth() || {};
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Form State
  const [rating, setRating] = useState(5);
  const [userName, setUserName] = useState('');
  const [comment, setComment] = useState('');
  const [recommend, setRecommend] = useState(true); // Reviewer suggests the product
  const [photos, setPhotos] = useState([]); // Base64 data URLs
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Lightbox for reviewing photo enlarged
  const [lightboxImg, setLightboxImg] = useState(null);
  const fileInputRef = useRef(null);

  // Initialize author name if user profile loads
  useEffect(() => {
    if (userProfile?.fullName) {
      setUserName(userProfile.fullName);
    } else if (currentUser?.displayName) {
      setUserName(currentUser.displayName);
    }
  }, [userProfile, currentUser]);

  // Baseline demo reviews if a product is brand new and has no Firestore reviews yet
  const defaultInitialReviews = [
    {
      id: 'demo-1',
      userName: 'Rahul K.',
      rating: 5,
      dateFormatted: '2 days ago',
      recommend: true,
      verifiedPurchase: true,
      comment: 'Exceptional quality! The fitting was absolutely perfect matching the measurements in the Size Guide. Premium finish and soft texture.',
      images: []
    },
    {
      id: 'demo-2',
      userName: 'Sameer Patel',
      rating: 4,
      dateFormatted: '1 week ago',
      recommend: true,
      verifiedPurchase: true,
      comment: 'Very decent build specifically the premium fabric textures used. Very comfortable for everyday wear. Delivery was fast.',
      images: []
    }
  ];

  // Fetch reviews for current product
  useEffect(() => {
    let isMounted = true;
    if (!product?.id) return;
    
    async function loadReviews() {
      setLoading(true);
      try {
        const data = await getProductReviews(product.id);
        if (isMounted) {
          if (data && data.length > 0) {
            setReviews(data);
          } else {
            setReviews(defaultInitialReviews);
          }
        }
      } catch (err) {
        console.error('Error loading reviews:', err);
        if (isMounted) setReviews(defaultInitialReviews);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadReviews();

    return () => {
      isMounted = false;
    };
  }, [product?.id]);

  // Handle Photo File Selection
  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (photos.length + files.length > 5) {
      alert('You can attach a maximum of 5 photos per review.');
      return;
    }

    setCompressing(true);
    try {
      const compressedList = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const base64Data = await compressReviewImage(file);
        compressedList.push(base64Data);
      }
      setPhotos(prev => [...prev, ...compressedList]);
    } catch (err) {
      console.error('Photo processing error:', err);
      alert('Failed to process one or more images. Please try different photos.');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (indexToRemove) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit Review to Firestore
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!comment.trim()) {
      setFeedback({ type: 'error', text: 'Please write your review thoughts.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const newReview = await submitReview({
        productId: product?.id || 'general-product',
        productName: product?.name || 'Store Product',
        productSlug: product?.slug || '',
        userId: currentUser?.uid || 'guest',
        userName: userName.trim() || 'Verified Customer',
        userEmail: currentUser?.email || '',
        rating: Number(rating),
        comment: comment.trim(),
        recommend: Boolean(recommend),
        images: photos,
        verifiedPurchase: true
      });

      // Prepend to current reviews
      setReviews(prev => [newReview, ...prev]);
      setFeedback({ type: 'success', text: 'Thank you! Your review with photo and recommendation has been published.' });
      
      // Reset form
      setComment('');
      setPhotos([]);
      setRecommend(true);
      setRating(5);

      setTimeout(() => {
        setShowReviewForm(false);
        setFeedback(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to submit review:', err);
      setFeedback({ type: 'error', text: 'Failed to submit review: ' + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Summary Metrics calculations
  const totalReviewsCount = reviews.length;
  const avgRating = totalReviewsCount > 0 
    ? (reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / totalReviewsCount).toFixed(1)
    : '5.0';

  const recommendCount = reviews.filter(r => r.recommend !== false).length;
  const recommendPercentage = totalReviewsCount > 0 
    ? Math.round((recommendCount / totalReviewsCount) * 100)
    : 100;

  const starDistribution = [5, 4, 3, 2, 1].map(starVal => {
    const count = reviews.filter(r => Math.round(Number(r.rating) || 5) === starVal).length;
    const percentage = totalReviewsCount > 0 ? Math.round((count / totalReviewsCount) * 100) : 0;
    return { starVal, count, fill: `${percentage}%` };
  });

  return (
    <div className="reviews-module" id="reviews">
      {/* Header */}
      <div className="reviews-header">
        <h2 className="reviews-header-title">CUSTOMER REVIEWS</h2>
        <button 
          onClick={() => {
            setShowReviewForm(!showReviewForm);
            setFeedback(null);
          }}
          className="reviews-btn-toggle"
        >
          {showReviewForm ? '✕ CANCEL' : '★ WRITE A REVIEW'}
        </button>
      </div>

      <div className="reviews-layout">
        {/* Rating Breakdown & Stats */}
        <div className="reviews-summary-col">
          <div className="rating-hero-score">
            <span className="rating-big-number">{avgRating}</span>
            <div>
              <div className="rating-stars-text">
                {'★'.repeat(Math.round(Number(avgRating)))}
                {'☆'.repeat(5 - Math.round(Number(avgRating)))}
              </div>
              <div className="rating-count-text">Based on {totalReviewsCount} {totalReviewsCount === 1 ? 'Review' : 'Reviews'}</div>
            </div>
          </div>

          <div className="rating-recommend-rate">
            <span>👍</span>
            <span><strong>{recommendPercentage}%</strong> of reviewers recommend this product</span>
          </div>
          
          <div className="rating-bars-list">
            {starDistribution.map(row => (
              <div key={row.starVal} className="rating-bar-row">
                <span style={{ fontSize: '13px', width: '32px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {row.starVal} ★
                </span>
                <div className="rating-bar-track">
                  <div className="rating-bar-fill" style={{ width: row.fill }}></div>
                </div>
                <span style={{ fontSize: '11px', width: '32px', color: '#94a3b8', textAlign: 'right' }}>
                  {row.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right side: Review Form OR List */}
        <div className="reviews-content-col">
          {showReviewForm ? (
            <div className="review-form-card">
              <h3 className="review-form-title">LEAVE YOUR REVIEW</h3>
              <p className="review-form-desc">
                Reviewing <strong>{product?.name || 'this item'}</strong>. Share your authentic photos & experience to help other shoppers!
              </p>

              {feedback && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  color: feedback.type === 'success' ? '#15803d' : '#dc2626',
                  border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`
                }}>
                  {feedback.text}
                </div>
              )}

              <form onSubmit={handleSubmitReview}>
                {/* 1. Star Rating Picker */}
                <div className="review-form-group">
                  <label className="review-form-label">Overall Rating</label>
                  <div className="star-rating-picker">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`star-btn ${star <= rating ? 'active' : ''}`}
                        onClick={() => setRating(star)}
                        aria-label={`${star} Stars`}
                      >
                        ★
                      </button>
                    ))}
                    <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                      {rating === 5 ? '5 Stars - Excellent' :
                       rating === 4 ? '4 Stars - Very Good' :
                       rating === 3 ? '3 Stars - Average' :
                       rating === 2 ? '2 Stars - Poor' : '1 Star - Terrible'}
                    </span>
                  </div>
                </div>

                {/* 2. Reviewer Suggests / Recommends Product */}
                <div className="review-form-group">
                  <label className="review-form-label">Would you recommend / suggest this product?</label>
                  <div className="recommend-toggle-group">
                    <button
                      type="button"
                      className={`recommend-choice-btn ${recommend === true ? 'selected-yes' : ''}`}
                      onClick={() => setRecommend(true)}
                    >
                      <span>👍</span> Yes, I recommend this product
                    </button>
                    <button
                      type="button"
                      className={`recommend-choice-btn ${recommend === false ? 'selected-no' : ''}`}
                      onClick={() => setRecommend(false)}
                    >
                      <span>👎</span> No, I do not recommend
                    </button>
                  </div>
                </div>

                {/* 3. Name */}
                <div className="review-form-group">
                  <label className="review-form-label">Your Name</label>
                  <input
                    type="text"
                    className="review-form-input"
                    placeholder="Enter your name (e.g. Aman S.)"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                  />
                </div>

                {/* 4. Comment / Review Text */}
                <div className="review-form-group">
                  <label className="review-form-label">Your Review</label>
                  <textarea
                    rows="4"
                    className="review-form-textarea"
                    placeholder="What did you like or dislike about the fit, fabric, and styling?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                  ></textarea>
                </div>

                {/* 5. Photo Upload Option */}
                <div className="review-form-group">
                  <label className="review-form-label">Add Product Photos (Optional)</label>
                  <div 
                    className="photo-upload-zone"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>📷</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      {compressing ? 'Optimizing selected photos...' : 'Click to browse & upload photos'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      Show how the item looks in real life (Max 5 photos, JPG or PNG)
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handlePhotoSelect}
                    disabled={compressing || submitting}
                  />

                  {/* Thumbnail Preview Strip */}
                  {photos.length > 0 && (
                    <div className="photo-preview-grid">
                      {photos.map((photoUrl, idx) => (
                        <div key={idx} className="photo-preview-item">
                          <img src={photoUrl} alt={`Upload preview ${idx + 1}`} className="photo-preview-img" />
                          <button
                            type="button"
                            className="photo-preview-remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePhoto(idx);
                            }}
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={submitting || compressing} 
                  className="btn-submit-review"
                >
                  {submitting ? 'SUBMITTING REVIEW...' : 'PUBLISH REVIEW'}
                </button>
              </form>
            </div>
          ) : (
            <div className="reviews-list">
              {loading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading customer reviews...</div>
              ) : reviews.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px' }}>
                  <p style={{ fontWeight: 600, margin: '0 0 8px' }}>No reviews yet for this product.</p>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Be the first verified customer to write a review!</p>
                </div>
              ) : (
                reviews.map((r, idx) => (
                  <div key={r.id || `review-${idx}`} className="review-item-card">
                    <div className="review-item-header">
                      <div>
                        <span className="review-author-name">{r.userName || 'Verified Buyer'}</span>
                        {r.verifiedPurchase !== false && (
                          <span className="review-verified-badge">✓ Verified Purchase</span>
                        )}
                      </div>
                      <span className="review-date-text">{r.dateFormatted || 'Recent'}</span>
                    </div>

                    <div className="review-stars-display">
                      {'★'.repeat(Number(r.rating) || 5)}
                      {'☆'.repeat(5 - (Number(r.rating) || 5))}
                    </div>

                    {/* Recommendation Badge */}
                    {r.recommend !== false ? (
                      <div>
                        <span className="review-recommend-badge">
                          <span>👍</span> Recommends this product
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="review-not-recommend-badge">
                          <span>👎</span> Does not recommend this product
                        </span>
                      </div>
                    )}

                    <p className="review-body-text">{r.comment || r.reviewText}</p>

                    {/* Review Attached Photos */}
                    {r.images && r.images.length > 0 && (
                      <div className="review-photos-grid">
                        {r.images.map((imgSrc, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={imgSrc}
                            alt={`${r.userName || 'Customer'} review photo ${imgIdx + 1}`}
                            className="review-photo-thumb"
                            onClick={() => setLightboxImg(imgSrc)}
                            title="Click to view full photo"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox for customer review photo */}
      {lightboxImg && (
        <div className="review-lightbox-backdrop" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Review attachment full preview" className="review-lightbox-img" />
        </div>
      )}
    </div>
  );
}
