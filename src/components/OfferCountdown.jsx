import { useState, useEffect } from 'react';

/**
 * Calculates remaining time until offerEndAt.
 * Returns an object with the formatted timer and an urgency message.
 */
export default function OfferCountdown({ offerEndAt, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!offerEndAt) return;

    function calculateTime() {
      const now = new Date();
      const end = new Date(offerEndAt);
      const diff = end - now;

      if (diff <= 0) {
        if (onExpire) onExpire();
        return null;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let urgencyMessage = "ENDING SOON";
      if (days === 0 && hours < 1) {
        urgencyMessage = "FINAL HOUR";
      } else if (days === 0 && hours < 6) {
        urgencyMessage = "HURRY — ENDING SOON";
      } else if (days === 0) {
        urgencyMessage = "ENDS TODAY";
      }

      let formattedTime = "";
      if (days > 0) {
        formattedTime = `${String(days).padStart(2, '0')}D : ${String(hours).padStart(2, '0')}H : ${String(minutes).padStart(2, '0')}M : ${String(seconds).padStart(2, '0')}S`;
      } else if (hours > 0) {
        formattedTime = `${String(hours).padStart(2, '0')}H : ${String(minutes).padStart(2, '0')}M : ${String(seconds).padStart(2, '0')}S`;
      } else {
        formattedTime = `${String(minutes).padStart(2, '0')}M : ${String(seconds).padStart(2, '0')}S`;
      }

      return { formattedTime, urgencyMessage };
    }

    // Initial calculation
    setTimeLeft(calculateTime());

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTime();
      setTimeLeft(remaining);
      if (!remaining && onExpire) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [offerEndAt, onExpire]);

  if (!timeLeft) return null;

  return (
    <div className="offer-countdown">
      <div className="offer-countdown__message">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {timeLeft.urgencyMessage}
      </div>
      <div className="offer-countdown__timer">
        {timeLeft.formattedTime}
      </div>
    </div>
  );
}
