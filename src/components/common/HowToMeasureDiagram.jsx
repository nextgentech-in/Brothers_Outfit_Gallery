import React from 'react';

/**
 * High-quality vector technical fashion flats for garment measurement.
 * Modeled directly after standard apparel specification sheets:
 * - Ultra-crisp vector lines (infinite resolution, retina ready)
 * - Measurement callouts with dashed guidelines and directional arrows
 * - Front and Back perspectives
 * - Zero network latency and zero broken-image risk
 */
export default function HowToMeasureDiagram({ category = 'shirts' }) {
  const cat = (category || '').toLowerCase();
  const isBottomwear = cat.includes('jean') || cat.includes('trouser') || cat.includes('pant') || cat.includes('short');

  return (
    <div className="how-to-measure-diagram-container">
      <div className="htm-diagram-header">
        <h3 className="htm-diagram-title">HOW TO MEASURE</h3>
        <div className="htm-diagram-rule" />
      </div>

      {!isBottomwear ? (
        /* ───────── Tops / Shirts / T-Shirts / Jackets Diagram ───────── */
        <div className="htm-figures-row">
          
          {/* FRONT VIEW */}
          <div className="htm-figure-card">
            <div className="htm-svg-wrap">
              <svg 
                viewBox="0 0 280 320" 
                className="htm-garment-svg" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Arrow markers for double-ended measurement lines */}
                  <marker id="htm-arrow-start" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 8 1.5 L 2 5 L 8 8.5" fill="none" stroke="#E07A5F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </marker>
                  <marker id="htm-arrow-end" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 2 1.5 L 8 5 L 2 8.5" fill="none" stroke="#E07A5F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </marker>
                </defs>

                {/* ── Garment Outline: Shirt Front ── */}
                <g stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {/* Left Sleeve */}
                  <path d="M 64 68 L 22 240 L 42 242 L 72 136 Z" />
                  {/* Left Cuff */}
                  <path d="M 22 240 L 42 242 L 40 256 L 20 254 Z" />
                  <circle cx="31" cy="248" r="1.5" fill="#1a1a1a" />

                  {/* Right Sleeve */}
                  <path d="M 216 68 L 258 240 L 238 242 L 208 136 Z" />
                  {/* Right Cuff */}
                  <path d="M 258 240 L 238 242 L 240 256 L 260 254 Z" />
                  <circle cx="249" cy="248" r="1.5" fill="#1a1a1a" />

                  {/* Main Body */}
                  <path d="M 64 68 L 108 38 L 172 38 L 216 68 L 208 136 Q 200 195 212 258 Q 140 274 68 258 Q 80 195 72 136 Z" />

                  {/* Center Front Placket */}
                  <line x1="134" y1="46" x2="134" y2="265" stroke="#1a1a1a" strokeWidth="1.2" />
                  <line x1="146" y1="46" x2="146" y2="265" stroke="#1a1a1a" strokeWidth="1.2" />

                  {/* Placket Buttons */}
                  <circle cx="140" cy="58" r="2" fill="#ffffff" stroke="#1a1a1a" strokeWidth="1" />
                  <circle cx="140" cy="94" r="2" fill="#ffffff" stroke="#1a1a1a" strokeWidth="1" />
                  <circle cx="140" cy="130" r="2" fill="#ffffff" stroke="#1a1a1a" strokeWidth="1" />
                  <circle cx="140" cy="166" r="2" fill="#ffffff" stroke="#1a1a1a" strokeWidth="1" />
                  <circle cx="140" cy="202" r="2" fill="#ffffff" stroke="#1a1a1a" strokeWidth="1" />
                  <circle cx="140" cy="238" r="2" fill="#ffffff" stroke="#1a1a1a" strokeWidth="1" />

                  {/* Spread Collar */}
                  <path d="M 108 38 Q 140 46 172 38 L 158 64 L 140 50 L 122 64 Z" fill="#ffffff" />
                  {/* Collar crease lines */}
                  <line x1="108" y1="38" x2="122" y2="64" />
                  <line x1="172" y1="38" x2="158" y2="64" />
                  <path d="M 122 64 L 140 48 L 158 64" fill="#f8fafc" />

                  {/* Side Hem curves */}
                  <path d="M 68 258 Q 62 250 56 248" stroke="#1a1a1a" strokeWidth="1" />
                  <path d="M 212 258 Q 218 250 224 248" stroke="#1a1a1a" strokeWidth="1" />
                </g>

                {/* ── Measurement Callout Overlay: Front ── */}
                <g stroke="#E07A5F" strokeWidth="1.5" strokeDasharray="4 3">
                  {/* 1. Chest Line */}
                  <line 
                    x1="73" y1="136" 
                    x2="207" y2="136" 
                    markerStart="url(#htm-arrow-start)" 
                    markerEnd="url(#htm-arrow-end)" 
                  />

                  {/* 2. Front Length Line */}
                  <line 
                    x1="174" y1="46" 
                    x2="174" y2="267" 
                    markerStart="url(#htm-arrow-start)" 
                    markerEnd="url(#htm-arrow-end)" 
                  />

                  {/* 3. Sleeve Length Line */}
                  <line 
                    x1="220" y1="78" 
                    x2="254" y2="238" 
                    markerStart="url(#htm-arrow-start)" 
                    markerEnd="url(#htm-arrow-end)" 
                  />
                </g>

                {/* ── Measurement Labels: Front ── */}
                {/* Chest Label */}
                <g transform="translate(100, 126)">
                  <rect x="-2" y="-12" width="56" height="15" fill="#ffffff" fillOpacity="0.9" rx="3" />
                  <text x="0" y="0" fill="#E07A5F" fontSize="10.5" fontFamily="sans-serif" fontWeight="700">1 Chest</text>
                </g>

                {/* Front Length Label */}
                <g transform="translate(178, 150)">
                  <rect x="-2" y="-12" width="68" height="15" fill="#ffffff" fillOpacity="0.9" rx="3" />
                  <text x="0" y="0" fill="#E07A5F" fontSize="10" fontFamily="sans-serif" fontWeight="600">Front length</text>
                </g>

                {/* Sleeve Length Label */}
                <g transform="translate(230, 168)">
                  <rect x="-2" y="-12" width="70" height="15" fill="#ffffff" fillOpacity="0.9" rx="3" />
                  <text x="0" y="0" fill="#E07A5F" fontSize="9.5" fontFamily="sans-serif" fontWeight="600">Sleeve length</text>
                </g>
              </svg>
            </div>
            <span className="htm-figure-caption">FRONT</span>
          </div>

          {/* BACK VIEW */}
          <div className="htm-figure-card">
            <div className="htm-svg-wrap">
              <svg 
                viewBox="0 0 280 320" 
                className="htm-garment-svg" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* ── Garment Outline: Shirt Back ── */}
                <g stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {/* Left Sleeve Back */}
                  <path d="M 64 68 L 22 240 L 42 242 L 72 136 Z" />
                  <path d="M 22 240 L 42 242 L 40 256 L 20 254 Z" />
                  <circle cx="31" cy="248" r="1.5" fill="#1a1a1a" />

                  {/* Right Sleeve Back */}
                  <path d="M 216 68 L 258 240 L 238 242 L 208 136 Z" />
                  <path d="M 258 240 L 238 242 L 240 256 L 260 254 Z" />
                  <circle cx="249" cy="248" r="1.5" fill="#1a1a1a" />

                  {/* Main Body Back */}
                  <path d="M 64 68 L 108 38 L 172 38 L 216 68 L 208 136 Q 200 195 212 258 Q 140 274 68 258 Q 80 195 72 136 Z" />

                  {/* Back Collar */}
                  <path d="M 108 38 Q 140 32 172 38 Q 140 44 108 38 Z" fill="#ffffff" />

                  {/* Back Yoke Seam */}
                  <path d="M 68 84 Q 140 90 212 84" stroke="#1a1a1a" strokeWidth="1.4" />
                  {/* Subtle Yoke Double Stitch */}
                  <path d="M 68 87 Q 140 93 212 87" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2 2" />

                  {/* Back pleat or drape indication */}
                  <line x1="140" y1="92" x2="140" y2="120" stroke="#cbd5e1" strokeWidth="1" strokeLinecap="round" />
                </g>

                {/* ── Measurement Callout Overlay: Back ── */}
                <g stroke="#E07A5F" strokeWidth="1.5" strokeDasharray="4 3">
                  {/* Shoulder Line across yoke seam */}
                  <line 
                    x1="64" y1="68" 
                    x2="216" y2="68" 
                    markerStart="url(#htm-arrow-start)" 
                    markerEnd="url(#htm-arrow-end)" 
                  />
                </g>

                {/* ── Measurement Labels: Back ── */}
                <g transform="translate(118, 58)">
                  <rect x="-4" y="-12" width="52" height="15" fill="#ffffff" fillOpacity="0.9" rx="3" />
                  <text x="0" y="0" fill="#E07A5F" fontSize="10.5" fontFamily="sans-serif" fontWeight="700">Shoulder</text>
                </g>
              </svg>
            </div>
            <span className="htm-figure-caption">BACK</span>
          </div>

        </div>
      ) : (
        /* ───────── Bottomwear / Jeans / Trousers Diagram ───────── */
        <div className="htm-figures-row">
          
          {/* TROUSERS FRONT */}
          <div className="htm-figure-card">
            <div className="htm-svg-wrap">
              <svg 
                viewBox="0 0 280 320" 
                className="htm-garment-svg" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Outline: Trousers Front */}
                <g stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {/* Waistband */}
                  <path d="M 80 40 L 200 40 L 202 56 L 78 56 Z" fill="#ffffff" />
                  <circle cx="140" cy="48" r="2.5" fill="#1a1a1a" />
                  {/* Belt Loops */}
                  <line x1="94" y1="40" x2="94" y2="56" strokeWidth="1.8" />
                  <line x1="186" y1="40" x2="186" y2="56" strokeWidth="1.8" />

                  {/* Fly */}
                  <path d="M 140 56 L 140 106 Q 146 112 152 112" stroke="#1a1a1a" strokeWidth="1.2" />

                  {/* Curved Front Pockets */}
                  <path d="M 80 56 Q 96 66 98 90" stroke="#1a1a1a" strokeWidth="1.2" />
                  <path d="M 200 56 Q 184 66 182 90" stroke="#1a1a1a" strokeWidth="1.2" />

                  {/* Legs Outline */}
                  <path d="M 78 56 Q 72 120 74 270 L 126 270 L 138 122 L 142 122 L 154 270 L 206 270 Q 208 120 202 56 Z" />

                  {/* Hem Cuffs */}
                  <line x1="74" y1="264" x2="126" y2="264" stroke="#94a3b8" strokeWidth="1" />
                  <line x1="154" y1="264" x2="206" y2="264" stroke="#94a3b8" strokeWidth="1" />
                </g>

                {/* Measurement Lines: Front */}
                <g stroke="#E07A5F" strokeWidth="1.5" strokeDasharray="4 3">
                  {/* 1. Waist */}
                  <line x1="78" y1="34" x2="202" y2="34" markerStart="url(#htm-arrow-start)" markerEnd="url(#htm-arrow-end)" />
                  {/* 2. Thigh */}
                  <line x1="74" y1="135" x2="138" y2="135" markerStart="url(#htm-arrow-start)" markerEnd="url(#htm-arrow-end)" />
                  {/* 3. Inseam */}
                  <line x1="140" y1="126" x2="126" y2="270" markerStart="url(#htm-arrow-start)" markerEnd="url(#htm-arrow-end)" />
                  {/* 4. Length */}
                  <line x1="64" y1="40" x2="64" y2="270" markerStart="url(#htm-arrow-start)" markerEnd="url(#htm-arrow-end)" />
                </g>

                {/* Labels: Front */}
                <g transform="translate(125, 26)">
                  <rect x="-2" y="-11" width="38" height="14" fill="#ffffff" fillOpacity="0.9" rx="3" />
                  <text x="0" y="0" fill="#E07A5F" fontSize="10" fontFamily="sans-serif" fontWeight="700">Waist</text>
                </g>
                <g transform="translate(90, 128)">
                  <rect x="-2" y="-11" width="36" height="14" fill="#ffffff" fillOpacity="0.9" rx="3" />
                  <text x="0" y="0" fill="#E07A5F" fontSize="9.5" fontFamily="sans-serif" fontWeight="600">Thigh</text>
                </g>
                <g transform="translate(142, 200)">
                  <rect x="-2" y="-11" width="44" height="14" fill="#ffffff" fillOpacity="0.9" rx="3" />
                  <text x="0" y="0" fill="#E07A5F" fontSize="9.5" fontFamily="sans-serif" fontWeight="600">Inseam</text>
                </g>
                <g transform="translate(24, 155)">
                  <rect x="-2" y="-11" width="42" height="14" fill="#ffffff" fillOpacity="0.9" rx="3" />
                  <text x="0" y="0" fill="#E07A5F" fontSize="9.5" fontFamily="sans-serif" fontWeight="600">Length</text>
                </g>
              </svg>
            </div>
            <span className="htm-figure-caption">FRONT</span>
          </div>

          {/* TROUSERS BACK */}
          <div className="htm-figure-card">
            <div className="htm-svg-wrap">
              <svg 
                viewBox="0 0 280 320" 
                className="htm-garment-svg" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Outline: Trousers Back */}
                <g stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {/* Waistband */}
                  <path d="M 80 40 L 200 40 L 202 56 L 78 56 Z" fill="#ffffff" />
                  {/* Belt Loops */}
                  <line x1="94" y1="40" x2="94" y2="56" strokeWidth="1.8" />
                  <line x1="140" y1="40" x2="140" y2="56" strokeWidth="1.8" />
                  <line x1="186" y1="40" x2="186" y2="56" strokeWidth="1.8" />

                  {/* Back Yoke V-Seam */}
                  <path d="M 78 72 L 140 84 L 202 72" stroke="#1a1a1a" strokeWidth="1.2" />

                  {/* Back Patch Pockets */}
                  <path d="M 94 92 L 126 92 L 124 126 L 110 136 L 96 126 Z" stroke="#1a1a1a" strokeWidth="1.2" />
                  <path d="M 154 92 L 186 92 L 184 126 L 170 136 L 156 126 Z" stroke="#1a1a1a" strokeWidth="1.2" />

                  {/* Legs Outline */}
                  <path d="M 78 56 Q 72 120 74 270 L 126 270 L 138 126 L 142 126 L 154 270 L 206 270 Q 208 120 202 56 Z" />
                </g>

                {/* Measurement Lines: Back */}
                <g stroke="#E07A5F" strokeWidth="1.5" strokeDasharray="4 3">
                  {/* Hip Line across widest point */}
                  <line x1="74" y1="108" x2="206" y2="108" markerStart="url(#htm-arrow-start)" markerEnd="url(#htm-arrow-end)" />
                </g>

                {/* Labels: Back */}
                <g transform="translate(132, 102)">
                  <rect x="-4" y="-11" width="30" height="14" fill="#ffffff" fillOpacity="0.9" rx="3" />
                  <text x="0" y="0" fill="#E07A5F" fontSize="10" fontFamily="sans-serif" fontWeight="700">Hip</text>
                </g>
              </svg>
            </div>
            <span className="htm-figure-caption">BACK</span>
          </div>

        </div>
      )}
    </div>
  );
}
