/**
 * Flat garment illustrations for the size guide, in the style of a
 * measurement spec sheet: soft garment fill, dashed measurement lines and
 * black label tags. Each garment has one or two views (front / back) and each
 * measurement carries a `key` so the size guide can print the selected size's
 * value inside the tag.
 */

const FILL = '#E4E7EB';
const SEAM = '#9AA3AD';
const OUTLINE = '#6B7480';

function Tag({ x, y, text, anchor = 'start' }) {
  const width = Math.max(40, text.length * 6.6 + 16);
  const left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x;
  return (
    <g className="sg-tag">
      <rect x={left} y={y - 10} width={width} height={20} fill="#111111" />
      <text
        x={left + width / 2}
        y={y + 4}
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="11"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontWeight="600"
        letterSpacing="0.2"
      >
        {text}
      </text>
    </g>
  );
}

function Measure({ x1, y1, x2, y2 }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#111111" strokeWidth="1.5" strokeDasharray="5 4" />
      <circle cx={x1} cy={y1} r="2.4" fill="#111111" />
      <circle cx={x2} cy={y2} r="2.4" fill="#111111" />
    </g>
  );
}

const base = { fill: FILL, stroke: OUTLINE, strokeWidth: 1.4, strokeLinejoin: 'round' };
const seam = { fill: 'none', stroke: SEAM, strokeWidth: 1.1, strokeLinecap: 'round' };

/* ─────────────────────────── Garment shapes ─────────────────────────── */

const TEE_BODY = 'M120 40 Q150 64 180 40 L230 58 L272 122 L240 142 L218 112 L218 310 L82 310 L82 112 L60 142 L28 122 L70 58 Z';
const teeFront = (
  <>
    <path d={TEE_BODY} {...base} />
    <path d="M116 42 Q150 76 184 42" {...seam} strokeWidth="2" />
    <path d="M36 128 L64 146 M264 128 L236 146" {...seam} />
    <path d="M82 298 L218 298" {...seam} />
  </>
);
const teeBack = (
  <>
    <path d="M120 40 Q150 50 180 40 L230 58 L272 122 L240 142 L218 112 L218 310 L82 310 L82 112 L60 142 L28 122 L70 58 Z" {...base} />
    <path d="M118 42 Q150 56 182 42" {...seam} strokeWidth="2" />
    <path d="M36 128 L64 146 M264 128 L236 146" {...seam} />
    <path d="M82 298 L218 298" {...seam} />
  </>
);

const SHIRT_BODY = 'M118 36 L182 36 L232 56 L276 290 L250 296 L222 130 L222 314 Q150 332 78 314 L78 130 L50 296 L24 290 L68 56 Z';
const shirtFront = (
  <>
    <path d={SHIRT_BODY} {...base} />
    <path d="M118 36 L150 54 L182 36 L174 66 L150 52 L126 66 Z" fill="#F4F5F7" stroke={OUTLINE} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M150 54 L150 324" {...seam} />
    {[84, 124, 164, 204, 244, 284].map((cy) => <circle key={cy} cx="150" cy={cy} r="2.6" fill="#FFFFFF" stroke={SEAM} />)}
    <path d="M27 276 L52 282 M273 276 L248 282" {...seam} />
    <path d="M96 118 L128 118 L128 146 L96 146 Z" {...seam} />
  </>
);
const shirtBack = (
  <>
    <path d={SHIRT_BODY} {...base} />
    <path d="M118 36 Q150 44 182 36" {...seam} strokeWidth="2" />
    <path d="M70 74 Q150 88 230 74" {...seam} />
    <path d="M150 82 L150 96" {...seam} />
    <path d="M27 276 L52 282 M273 276 L248 282" {...seam} />
  </>
);

const KURTA_BODY = 'M122 34 L178 34 L228 54 L268 268 L244 274 L218 130 L220 352 L80 352 L82 130 L56 274 L32 268 L72 54 Z';
const kurtaFront = (
  <>
    <path d={KURTA_BODY} {...base} />
    <path d="M122 34 Q150 44 178 34 L178 24 Q150 34 122 24 Z" fill="#F4F5F7" stroke={OUTLINE} strokeWidth="1.2" />
    <path d="M150 40 L150 150" {...seam} />
    {[62, 92, 122].map((cy) => <circle key={cy} cx="150" cy={cy} r="2.4" fill="#FFFFFF" stroke={SEAM} />)}
    <path d="M81 300 L81 352 M219 300 L219 352" stroke="#FFFFFF" strokeWidth="2" />
    <path d="M36 256 L58 262 M264 256 L242 262" {...seam} />
  </>
);
const kurtaBack = (
  <>
    <path d={KURTA_BODY} {...base} />
    <path d="M122 34 Q150 40 178 34 L178 24 Q150 30 122 24 Z" fill="#F4F5F7" stroke={OUTLINE} strokeWidth="1.2" />
    <path d="M81 300 L81 352 M219 300 L219 352" stroke="#FFFFFF" strokeWidth="2" />
    <path d="M36 256 L58 262 M264 256 L242 262" {...seam} />
  </>
);

const HOODIE_BODY = 'M110 46 L70 62 L26 288 L52 296 L82 140 L80 300 L220 300 L218 140 L248 296 L274 288 L230 62 L190 46 Q150 70 110 46 Z';
const hoodieFront = (
  <>
    <path d={HOODIE_BODY} {...base} />
    <path d="M110 46 Q100 0 150 0 Q200 0 190 46 Q150 70 110 46 Z" {...base} />
    <path d="M124 44 Q122 14 150 12 Q178 14 176 44 Q150 60 124 44 Z" fill="#CDD2D8" stroke={SEAM} />
    <path d="M80 300 L220 300 L220 318 L80 318 Z" {...base} />
    <path d="M26 288 L52 296 L49 312 L23 304 Z M274 288 L248 296 L251 312 L277 304 Z" {...base} />
    <path d="M108 218 L192 218 L208 290 L92 290 Z" {...seam} />
    <path d="M140 58 L136 100 M160 58 L164 100" {...seam} />
  </>
);
const hoodieBack = (
  <>
    <path d={HOODIE_BODY} {...base} />
    <path d="M110 46 Q100 0 150 0 Q200 0 190 46 Q150 70 110 46 Z" {...base} />
    <path d="M150 2 L150 56" {...seam} />
    <path d="M80 300 L220 300 L220 318 L80 318 Z" {...base} />
    <path d="M26 288 L52 296 L49 312 L23 304 Z M274 288 L248 296 L251 312 L277 304 Z" {...base} />
  </>
);

const JEANS_LEGS = 'M78 40 L66 360 L142 360 L150 122 L158 360 L234 360 L222 40 Z';
const jeansFront = (
  <>
    <path d={JEANS_LEGS} {...base} />
    <path d="M80 20 L220 20 L222 40 L78 40 Z" {...base} />
    <path d="M100 18 L100 42 M150 18 L150 42 M200 18 L200 42" stroke={OUTLINE} strokeWidth="2.4" />
    <path d="M150 40 L150 112 Q150 122 160 122" {...seam} />
    <path d="M84 44 Q108 74 116 42 M216 44 Q192 74 184 42" {...seam} />
    <path d="M67 348 L141 348 M159 348 L233 348" {...seam} />
    <circle cx="150" cy="30" r="3" fill="#FFFFFF" stroke={OUTLINE} />
  </>
);
const jeansBack = (
  <>
    <path d={JEANS_LEGS} {...base} />
    <path d="M80 20 L220 20 L222 40 L78 40 Z" {...base} />
    <path d="M186 23 L210 23 L210 36 L186 36 Z" fill="#8B5E3C" />
    <path d="M78 64 Q150 52 222 64" {...seam} />
    <path d="M94 80 L138 76 L140 118 L118 130 L98 120 Z M162 76 L206 80 L202 120 L182 130 L160 118 Z" {...seam} />
    <path d="M67 348 L141 348 M159 348 L233 348" {...seam} />
  </>
);

const SHORTS_LEGS = 'M78 40 L62 220 L144 226 L150 110 L156 226 L238 220 L222 40 Z';
const shortsFront = (
  <>
    <path d={SHORTS_LEGS} {...base} />
    <path d="M80 20 L220 20 L222 40 L78 40 Z" {...base} />
    <path d="M100 18 L100 42 M150 18 L150 42 M200 18 L200 42" stroke={OUTLINE} strokeWidth="2.4" />
    <path d="M150 40 L150 100 Q150 110 160 110" {...seam} />
    <path d="M84 44 Q108 74 116 42 M216 44 Q192 74 184 42" {...seam} />
    <path d="M63 208 L143 214 M157 214 L237 208" {...seam} />
  </>
);
const shortsBack = (
  <>
    <path d={SHORTS_LEGS} {...base} />
    <path d="M80 20 L220 20 L222 40 L78 40 Z" {...base} />
    <path d="M78 62 Q150 50 222 62" {...seam} />
    <path d="M96 76 L136 72 L138 108 L118 118 L100 110 Z M164 72 L204 76 L200 110 L182 118 L162 108 Z" {...seam} />
    <path d="M63 208 L143 214 M157 214 L237 208" {...seam} />
  </>
);

const footTop = (
  <>
    <path d="M150 30 C200 30 214 90 210 150 C206 210 196 260 196 300 C196 336 172 350 150 350 C126 350 106 336 106 300 C106 250 92 200 92 140 C92 70 110 30 150 30 Z" {...base} />
    <path d="M150 52 C186 52 194 100 192 146 C190 196 180 240 180 292 C180 318 166 330 150 330 C132 330 122 318 122 292 C122 244 110 196 110 146 C110 92 120 52 150 52 Z" {...seam} />
  </>
);

const beltFlat = (
  <>
    <path d="M70 52 L300 52 Q312 52 312 64 L312 76 Q312 88 300 88 L70 88 Z" {...base} />
    <path d="M18 40 L72 40 L72 100 L18 100 Z" fill="none" stroke={OUTLINE} strokeWidth="5" strokeLinejoin="round" />
    <path d="M30 70 L84 70" stroke={OUTLINE} strokeWidth="4" strokeLinecap="round" />
    <path d="M78 58 L300 58 M78 82 L300 82" {...seam} strokeDasharray="3 3" />
    {[214, 234, 254, 274, 294].map((cx) => <circle key={cx} cx={cx} cy="70" r="3.4" fill="#FFFFFF" stroke={OUTLINE} />)}
  </>
);

/* ─────────────────────────── Garment specs ─────────────────────────── */

export const GARMENTS = {
  tee: {
    viewBox: '0 0 300 330',
    views: [
      {
        name: 'Front',
        art: teeFront,
        measures: [
          { key: 'chest', label: 'Chest', line: [82, 126, 218, 126], tag: [150, 112, 'middle'] },
          { key: 'length', label: 'Length', line: [196, 48, 196, 310], tag: [204, 250, 'start'] },
        ],
      },
      {
        name: 'Back',
        art: teeBack,
        measures: [
          { key: 'shoulder', label: 'Shoulder', line: [70, 58, 230, 58], tag: [150, 36, 'middle'] },
          { key: 'sleeve', label: 'Sleeve', line: [70, 58, 44, 132], tag: [14, 160, 'start'] },
        ],
      },
    ],
  },
  shirt: {
    viewBox: '0 0 300 340',
    views: [
      {
        name: 'Front',
        art: shirtFront,
        measures: [
          { key: 'chest', label: 'Chest', line: [78, 156, 222, 156], tag: [150, 142, 'middle'] },
          { key: 'length', label: 'Length', line: [204, 44, 204, 320], tag: [212, 230, 'start'] },
        ],
      },
      {
        name: 'Back',
        art: shirtBack,
        measures: [
          { key: 'shoulder', label: 'Shoulder', line: [68, 56, 232, 56], tag: [150, 30, 'middle'] },
          { key: 'sleeve', label: 'Sleeve', line: [68, 56, 37, 293], tag: [8, 320, 'start'] },
        ],
      },
    ],
  },
  kurta: {
    viewBox: '0 0 300 370',
    views: [
      {
        name: 'Front',
        art: kurtaFront,
        measures: [
          { key: 'chest', label: 'Chest', line: [82, 160, 218, 160], tag: [150, 180, 'middle'] },
          { key: 'length', label: 'Length', line: [196, 38, 196, 352], tag: [204, 300, 'start'] },
        ],
      },
      {
        name: 'Back',
        art: kurtaBack,
        measures: [
          { key: 'shoulder', label: 'Shoulder', line: [72, 54, 228, 54], tag: [150, 74, 'middle'] },
          { key: 'sleeve', label: 'Sleeve', line: [72, 54, 44, 271], tag: [10, 298, 'start'] },
        ],
      },
    ],
  },
  hoodie: {
    viewBox: '0 0 300 330',
    views: [
      {
        name: 'Front',
        art: hoodieFront,
        measures: [
          { key: 'chest', label: 'Chest', line: [82, 150, 218, 150], tag: [150, 136, 'middle'] },
          { key: 'length', label: 'Length', line: [206, 52, 206, 318], tag: [212, 200, 'start'] },
        ],
      },
      {
        name: 'Back',
        art: hoodieBack,
        measures: [
          { key: 'shoulder', label: 'Shoulder', line: [70, 62, 230, 62], tag: [150, 84, 'middle'] },
          { key: 'sleeve', label: 'Sleeve', line: [70, 62, 36, 300], tag: [6, 326, 'start'] },
        ],
      },
    ],
  },
  jeans: {
    viewBox: '0 0 300 375',
    views: [
      {
        name: 'Front',
        art: jeansFront,
        measures: [
          { key: 'waist', label: 'Waist', line: [80, 10, 220, 10], tag: [74, 10, 'end'] },
          { key: 'thigh', label: 'Thigh', line: [154, 150, 226, 150], tag: [232, 150, 'start'] },
          { key: 'inseam', label: 'Inseam', line: [151, 126, 156, 358], tag: [164, 300, 'start'] },
        ],
      },
      {
        name: 'Back',
        art: jeansBack,
        measures: [
          { key: 'hip', label: 'Hip', line: [74, 96, 226, 96], tag: [68, 96, 'end'] },
          { key: 'outseam', label: 'Outseam', line: [230, 22, 240, 358], tag: [244, 290, 'start'] },
        ],
      },
    ],
  },
  shorts: {
    viewBox: '0 0 300 240',
    views: [
      {
        name: 'Front',
        art: shortsFront,
        measures: [
          { key: 'waist', label: 'Waist', line: [80, 10, 220, 10], tag: [74, 10, 'end'] },
          { key: 'inseam', label: 'Inseam', line: [151, 114, 152, 224], tag: [160, 180, 'start'] },
        ],
      },
      {
        name: 'Back',
        art: shortsBack,
        measures: [
          { key: 'hip', label: 'Hip', line: [72, 92, 228, 92], tag: [66, 92, 'end'] },
          { key: 'length', label: 'Length', line: [230, 22, 244, 220], tag: [248, 150, 'start'] },
        ],
      },
    ],
  },
  foot: {
    viewBox: '0 0 300 380',
    views: [
      {
        name: 'Top view',
        art: footTop,
        measures: [
          { key: 'length', label: 'Foot Length', line: [240, 30, 240, 350], tag: [150, 370, 'middle'] },
        ],
      },
    ],
  },
  belt: {
    viewBox: '0 0 330 150',
    views: [
      {
        name: 'Flat',
        art: beltFlat,
        measures: [
          { key: 'length', label: 'Belt Length', line: [72, 118, 254, 118], tag: [163, 138, 'middle'] },
        ],
      },
    ],
  },
};

/**
 * Renders one view of a garment. `valueFor(key)` returns a display value for
 * the selected size (e.g. `41.5"`) or null, and is printed inside the tag.
 */
export function GarmentView({ garment, view, valueFor, hasMeasure }) {
  const spec = GARMENTS[garment];
  if (!spec || !view) return null;
  // Only draw callouts the size chart actually lists (falls back to all of them).
  const shown = hasMeasure ? view.measures.filter((m) => hasMeasure(m.key)) : view.measures;
  const measures = shown.length ? shown : view.measures;
  // Pad the drawing so tags that carry a value never get clipped at the edges.
  const [vx, vy, vw, vh] = spec.viewBox.split(' ').map(Number);
  const padX = 46;
  const padY = 14;
  return (
    <svg
      viewBox={`${vx - padX} ${vy - padY} ${vw + padX * 2} ${vh + padY * 2}`}
      className="sg-garment-svg"
      role="img"
      aria-label={`${view.name} view with measurement points`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      {view.art}
      {measures.map((m) => (
        <Measure key={`${m.key}-line`} x1={m.line[0]} y1={m.line[1]} x2={m.line[2]} y2={m.line[3]} />
      ))}
      {measures.map((m) => {
        const value = valueFor ? valueFor(m.key) : null;
        return (
          <Tag
            key={`${m.key}-tag`}
            x={m.tag[0]}
            y={m.tag[1]}
            anchor={m.tag[2]}
            text={value ? `${m.label} ${value}` : m.label}
          />
        );
      })}
    </svg>
  );
}
