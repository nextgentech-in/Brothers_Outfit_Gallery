import { useState } from 'react';

export default function ReviewsModule() {
  const [showReviewForm, setShowReviewForm] = useState(false);

  return (
    <div style={{ marginTop: '64px', padding: '0 24px' }} id="reviews">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid #eee', paddingBottom: '24px' }}>
        <h2 style={{ 
          fontFamily: 'var(--font-heading)',
          fontSize: '24px',
          fontWeight: 800,
          color: 'var(--color-heading)',
          margin: 0,
          letterSpacing: '1px'
        }}>
          CUSTOMER REVIEWS
        </h2>
        <button 
          onClick={() => setShowReviewForm(!showReviewForm)}
          style={{
            background: 'none',
            border: '1px solid var(--color-heading)',
            padding: '10px 24px',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: '12px',
            letterSpacing: '1px',
            cursor: 'pointer',
            transition: 'background 0.3s'
          }}
        >
          {showReviewForm ? 'CANCEL' : 'WRITE A REVIEW'}
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px' }}>
        {/* Rating Summary */}
        <div style={{ minWidth: '300px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
            <span style={{ fontSize: '48px', fontWeight: 800, color: 'var(--color-heading)', lineHeight: 1 }}>4.8</span>
            <div>
              <div style={{ fontSize: '18px', color: '#111', letterSpacing: '4px', marginBottom: '4px' }}>★★★★★</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Based on 124 Reviews</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { val: 5, fill: '85%' },
              { val: 4, fill: '10%' },
              { val: 3, fill: '3%' },
              { val: 2, fill: '2%' },
              { val: 1, fill: '0%' }
            ].map(row => (
              <div key={row.val} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', width: '24px', color: 'var(--color-text-muted)' }}>{row.val} ★</span>
                <div style={{ flex: 1, height: '6px', background: '#f5f5f5', borderRadius: '3px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: row.fill, background: 'var(--color-heading)', borderRadius: '3px' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form Or Review List */}
        <div style={{ flex: 2, minWidth: '300px' }}>
          {showReviewForm ? (
            <div style={{ background: '#fcfcfc', border: '1px solid #eee', padding: '32px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 16px', letterSpacing: '1px' }}>LEAVE YOUR REVIEW</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>Since you purchased this item securely, you are authorized to leave feedback.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <select style={{ padding: '12px', border: '1px solid #ddd', fontFamily: 'var(--font-body)' }}>
                  <option>5 Stars - Excellent</option>
                  <option>4 Stars - Good</option>
                  <option>3 Stars - Average</option>
                  <option>2 Stars - Poor</option>
                  <option>1 Star - Terrible</option>
                </select>
                <textarea rows="4" placeholder="Write your review here..." style={{ padding: '12px', border: '1px solid #ddd', fontFamily: 'var(--font-body)', resize: 'vertical' }}></textarea>
                <button onClick={() => { alert('Review submitted for moderation!'); setShowReviewForm(false); }} style={{ 
                  background: 'var(--color-heading)', color: '#fff', border: 'none', padding: '12px', fontWeight: 700, letterSpacing: '1px', cursor: 'pointer' 
                }}>SUBMIT REVIEW</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              <div style={{ paddingBottom: '24px', borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-heading)' }}>Rahul K.</span>
                    <span style={{ fontSize: '12px', color: '#2e7d32', marginLeft: '8px', fontWeight: 600 }}>✓ Verified Purchase</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>2 days ago</span>
                </div>
                <div style={{ color: '#111', fontSize: '12px', letterSpacing: '2px', marginBottom: '12px' }}>★★★★★</div>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text)' }}>
                  Exceptional quality! The fitting was absolutely perfect matching the measurements directly provided in the Size Guide. Will be buying another colour next month.
                </p>
              </div>

              <div style={{ paddingBottom: '24px', borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-heading)' }}>Sameer Patel</span>
                    <span style={{ fontSize: '12px', color: '#2e7d32', marginLeft: '8px', fontWeight: 600 }}>✓ Verified Purchase</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>1 week ago</span>
                </div>
                <div style={{ color: '#111', fontSize: '12px', letterSpacing: '2px', marginBottom: '12px' }}>★★★★☆</div>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text)' }}>
                  Very decent build specifically the premium fabric textures used. Docked a star simply because delivery was delayed by an extra day. Overall extremely satisfied.
                </p>
              </div>
              
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
