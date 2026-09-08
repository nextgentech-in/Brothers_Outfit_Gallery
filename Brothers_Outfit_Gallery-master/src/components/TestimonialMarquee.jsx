import './TestimonialMarquee.css';

const testimonials = [
  { name: "Rahul S.", rating: 5, text: "Great collection of premium shirts. The fit is perfect and the quality is top-notch." },
  { name: "Amit P.", rating: 5, text: "Best place for men's fashion in town. Their jeans collection is amazing." },
  { name: "Vikram D.", rating: 5, text: "Excellent customer service! Found exactly what I was looking for. Highly recommended." },
  { name: "Rohan M.", rating: 5, text: "The trial rooms are spacious and the staff is very helpful with sizing." },
  { name: "Karan V.", rating: 5, text: "Love the ethnic wear collection here. Bought a kurta for a festival and it was perfect." }
];

export default function TestimonialMarquee() {
  return (
    <div className="testimonial-marquee-wrapper">
      <div className="testimonial-marquee-track">
        {/* First group */}
        <div className="testimonial-marquee-group">
          {testimonials.map((review, i) => (
            <div className="testimonial-card" key={`orig-${i}`}>
              <div className="testimonial-stars">
                {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
              </div>
              <p className="testimonial-text">"{review.text}"</p>
              <span className="testimonial-author">- {review.name}</span>
            </div>
          ))}
        </div>
        {/* Duplicated group for seamless infinite scrolling */}
        <div className="testimonial-marquee-group">
          {testimonials.map((review, i) => (
            <div className="testimonial-card" key={`dup-${i}`}>
              <div className="testimonial-stars">
                {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
              </div>
              <p className="testimonial-text">"{review.text}"</p>
              <span className="testimonial-author">- {review.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
