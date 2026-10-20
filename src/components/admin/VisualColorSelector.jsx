import { useState, useMemo } from 'react';
import {
  getAllColors,
  getFrequentlyUsedColors,
  searchColors,
  saveCustomColor,
  recordRecentColor,
  normalizeToStandardColor
} from '../../data/colorMaster.js';
import './VisualColorSelector.css';

/**
 * Visual Color Selector Component for Admin Product Form
 *
 * @param {Array} selectedColors - Array of currently selected color objects [{ id, name, hex, slug }]
 * @param {Function} onChange - Callback when selected colors array changes
 * @param {Object|null} imageSuggestion - Optional auto-detected color suggestion { detectedHex, standardColor, confidence }
 * @param {Function} onAcceptSuggestion - Callback when admin clicks "Use Suggested Color"
 * @param {Function} onDismissSuggestion - Callback when admin dismisses the suggestion
 * @param {Function} onDetectFromImage - Optional manual trigger to run detection from active images
 * @param {boolean} hasImages - Whether images are currently uploaded/available
 * @param {Function} showToast - Toast feedback helper
 */
export default function VisualColorSelector({
  selectedColors = [],
  onChange,
  imageSuggestion = null,
  onAcceptSuggestion,
  onDismissSuggestion,
  onDetectFromImage,
  hasImages = false,
  showToast = () => {}
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customHex, setCustomHex] = useState('#2563EB');
  const [customError, setCustomError] = useState('');

  // Current all available colors (Standard + Stored Custom)
  const allMasterColors = useMemo(() => {
    return getAllColors();
  }, [showCustomModal]);

  // Frequently used colors (Dynamic based on usage history)
  const frequentColors = useMemo(() => {
    return getFrequentlyUsedColors();
  }, [selectedColors]);

  // Filtered colors based on search query
  const filteredColors = useMemo(() => {
    if (!searchQuery.trim()) return allMasterColors;
    return searchColors(searchQuery);
  }, [allMasterColors, searchQuery]);

  // Set of selected color IDs for fast O(1) checks
  const selectedIds = useMemo(() => {
    return new Set(
      selectedColors.map(c => {
        const norm = normalizeToStandardColor(c);
        return norm ? norm.id : (c.id || c.name?.toLowerCase());
      })
    );
  }, [selectedColors]);

  // Handle adding a color (Prevents duplicates)
  const handleSelectColor = (color) => {
    const standard = normalizeToStandardColor(color);
    if (!standard) return;

    if (selectedIds.has(standard.id)) {
      // If already selected, provide friendly feedback or toggle
      showToast(`Color "${standard.name}" is already added.`, 'info');
      return;
    }

    recordRecentColor(standard.id);
    const updated = [...selectedColors, standard];
    onChange(updated);
    showToast(`Added ${standard.name}`, 'success');
  };

  // Handle removing a color
  const handleRemoveColor = (colorIdToRemove) => {
    const updated = selectedColors.filter(c => {
      const norm = normalizeToStandardColor(c);
      const cId = norm ? norm.id : (c.id || c.name?.toLowerCase());
      return cId !== colorIdToRemove;
    });
    onChange(updated);
  };

  // Toggle selection
  const handleToggleColor = (color) => {
    const standard = normalizeToStandardColor(color);
    if (!standard) return;

    if (selectedIds.has(standard.id)) {
      handleRemoveColor(standard.id);
    } else {
      handleSelectColor(color);
    }
  };

  // Custom Color Submission
  const handleSaveCustomColor = (e) => {
    e.preventDefault();
    setCustomError('');

    const trimmedName = customName.trim();
    if (!trimmedName) {
      setCustomError('Please enter a color name.');
      return;
    }

    const hexRegex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
    if (!hexRegex.test(customHex.trim())) {
      setCustomError('Please provide a valid HEX color code (e.g. #C41242).');
      return;
    }

    // Check if name already exists in master
    const existing = allMasterColors.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      handleSelectColor(existing);
      setShowCustomModal(false);
      setCustomName('');
      showToast(`Standard color "${existing.name}" found and selected!`, 'info');
      return;
    }

    // Save to master and select
    const newEntry = saveCustomColor({
      name: trimmedName,
      hex: customHex.trim().toUpperCase(),
      aliases: [trimmedName.toLowerCase()]
    });

    if (newEntry) {
      handleSelectColor(newEntry);
      setShowCustomModal(false);
      setCustomName('');
      showToast(`Saved and added custom color "${newEntry.name}"`, 'success');
    }
  };

  return (
    <div className="visual-color-selector" aria-label="Visual Color Selector">

      {/* 1. ACTIVE SELECTED COLORS BAR */}
      <div className="vcs-header-wrap">
        <div className="vcs-heading-left">
          <label className="vcs-label">
            Selected Colors <span className="vcs-count-badge">({selectedColors.length})</span>
          </label>
          <span className="vcs-hint-text">
            {selectedColors.length === 0
              ? 'No colors selected yet. Click swatches below or use image suggestion.'
              : 'These colors will be available as selectable variants for this product.'}
          </span>
        </div>

        {hasImages && onDetectFromImage && (
          <button
            type="button"
            className="vcs-detect-btn"
            onClick={onDetectFromImage}
            title="Scan uploaded product image to detect dominant clothing color"
          >
            <span className="vcs-sparkle-icon">✨</span> Detect from Image
          </button>
        )}
      </div>

      {/* Selected Color Chips */}
      {selectedColors.length > 0 && (
        <div className="vcs-selected-chips-bar" role="region" aria-label="Selected product colors">
          {selectedColors.map((col) => {
            const norm = normalizeToStandardColor(col) || col;
            const cId = norm.id || norm.name?.toLowerCase();
            return (
              <div key={cId} className="vcs-selected-chip" title={`${norm.name} (${norm.hex})`}>
                <span
                  className="vcs-swatch-dot"
                  style={{ backgroundColor: norm.hex }}
                  aria-hidden="true"
                />
                <span className="vcs-chip-name">{norm.name}</span>
                <span className="vcs-chip-hex">{norm.hex}</span>
                <button
                  type="button"
                  className="vcs-chip-remove"
                  onClick={() => handleRemoveColor(cId)}
                  aria-label={`Remove color ${norm.name}`}
                  title="Remove color"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. IMAGE COLOR DETECTION SUGGESTION BANNER */}
      {imageSuggestion && imageSuggestion.standardColor && (
        <div className="vcs-suggestion-banner" role="alert" aria-live="polite">
          <div className="vcs-suggestion-top">
            <div className="vcs-suggestion-badge">
              <span className="vcs-sparkle-icon">🎨</span> Image Color Suggestion
            </div>
            <div className="vcs-confidence-tag" title={`Confidence: ${imageSuggestion.confidence}% based on CIE Lab color distance`}>
              {imageSuggestion.confidence}% Confidence
            </div>
          </div>

          <div className="vcs-suggestion-body">
            <div className="vcs-detected-pair">
              <div className="vcs-pair-label">Detected from photo:</div>
              <div className="vcs-swatch-pill">
                <span
                  className="vcs-swatch-dot"
                  style={{ backgroundColor: imageSuggestion.detectedHex }}
                  aria-hidden="true"
                />
                <span className="vcs-hex-code">{imageSuggestion.detectedHex}</span>
              </div>
            </div>

            <div className="vcs-arrow-separator">➔</div>

            <div className="vcs-detected-pair">
              <div className="vcs-pair-label">Nearest Approved Color:</div>
              <div className="vcs-swatch-pill vcs-suggested-highlight">
                <span
                  className="vcs-swatch-dot"
                  style={{ backgroundColor: imageSuggestion.standardColor.hex }}
                  aria-hidden="true"
                />
                <span className="vcs-suggested-name">{imageSuggestion.standardColor.name}</span>
                <span className="vcs-hex-code">({imageSuggestion.standardColor.hex})</span>
              </div>
            </div>
          </div>

          <div className="vcs-suggestion-actions">
            <button
              type="button"
              className="vcs-btn-accept"
              onClick={() => {
                if (onAcceptSuggestion) {
                  onAcceptSuggestion(imageSuggestion.standardColor);
                } else {
                  handleSelectColor(imageSuggestion.standardColor);
                }
              }}
            >
              ✓ Use Suggested Color ({imageSuggestion.standardColor.name})
            </button>

            <button
              type="button"
              className="vcs-btn-dismiss"
              onClick={onDismissSuggestion}
            >
              Choose Manually
            </button>
          </div>
        </div>
      )}

      {/* 3. FREQUENTLY USED / RECENT COLORS */}
      <div className="vcs-section">
        <div className="vcs-section-header">
          <span className="vcs-section-title">⚡ Frequently Used</span>
          <span className="vcs-section-subtitle">1-Click quick picks</span>
        </div>
        <div className="vcs-swatches-row" role="group" aria-label="Frequently used colors">
          {frequentColors.map(color => {
            const isSelected = selectedIds.has(color.id);
            return (
              <button
                key={color.id}
                type="button"
                className={`vcs-swatch-btn ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleToggleColor(color)}
                aria-pressed={isSelected}
                aria-label={`${color.name}${isSelected ? ' (Selected)' : ''}`}
                title={`${color.name} (${color.hex})`}
              >
                <span
                  className="vcs-swatch-circle"
                  style={{ backgroundColor: color.hex }}
                  aria-hidden="true"
                >
                  {isSelected && <span className="vcs-check-icon">✓</span>}
                </span>
                <span className="vcs-btn-label">{color.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. SEARCHABLE COLOR PALETTE */}
      <div className="vcs-search-row">
        <div className="vcs-search-box">
          <span className="vcs-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="vcs-search-input"
            placeholder="Search color or alias (e.g. rani pink, navy, olive, cream, haldi)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search standardized colors by name or alias"
          />
          {searchQuery && (
            <button
              type="button"
              className="vcs-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear color search"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          className="vcs-custom-trigger-btn"
          onClick={() => setShowCustomModal(!showCustomModal)}
          aria-expanded={showCustomModal}
        >
          {showCustomModal ? '✕ Close Custom' : '+ Custom Color'}
        </button>
      </div>

      {/* 5. CUSTOM COLOR MODAL / DRAWER */}
      {showCustomModal && (
        <div className="vcs-custom-box" role="region" aria-label="Create new standardized color">
          <div className="vcs-custom-header">
            <h4>🎨 Create New Standardized Color</h4>
            <p className="vcs-custom-desc">
              Will be saved to Color Master for consistent selection and shop filtering.
            </p>
          </div>

          <form onSubmit={handleSaveCustomColor} className="vcs-custom-form">
            <div className="vcs-custom-inputs-grid">
              <div className="vcs-form-group">
                <label htmlFor="customColorName">Color Name *</label>
                <input
                  id="customColorName"
                  type="text"
                  placeholder="e.g. Peacock Green, Terracotta, Coral"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="vcs-form-group">
                <label htmlFor="customHexCode">HEX Code *</label>
                <div className="vcs-hex-input-wrap">
                  <input
                    type="color"
                    className="vcs-native-picker"
                    value={customHex}
                    onChange={(e) => setCustomHex(e.target.value.toUpperCase())}
                    title="Choose color visually"
                    aria-label="Visual color picker"
                  />
                  <input
                    id="customHexCode"
                    type="text"
                    placeholder="#RRGGBB"
                    value={customHex}
                    onChange={(e) => setCustomHex(e.target.value.toUpperCase())}
                    maxLength={7}
                  />
                </div>
              </div>

              <div className="vcs-form-group">
                <label>Live Preview</label>
                <div
                  className="vcs-custom-preview-box"
                  style={{ backgroundColor: customHex }}
                  title={`Preview: ${customHex}`}
                >
                  <span className="vcs-preview-text">{customName || 'Preview'}</span>
                </div>
              </div>
            </div>

            {customError && <div className="vcs-error-msg">{customError}</div>}

            <div className="vcs-custom-actions">
              <button type="submit" className="vcs-btn-save-custom">
                Create &amp; Add Standard Color
              </button>
              <button
                type="button"
                className="vcs-btn-cancel-custom"
                onClick={() => {
                  setShowCustomModal(false);
                  setCustomError('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 6. COLOR PALETTE GRID (SEARCH RESULTS OR FULL MASTER) */}
      <div className="vcs-palette-grid-wrapper">
        <div className="vcs-palette-header">
          <span className="vcs-palette-title">
            {searchQuery ? `Search Results (${filteredColors.length})` : 'All Approved Colors'}
          </span>
          <span className="vcs-palette-helper">
            Click any swatch to add to product
          </span>
        </div>

        {filteredColors.length === 0 ? (
          <div className="vcs-empty-state">
            <p>No standard color matches "{searchQuery}".</p>
            <button
              type="button"
              className="vcs-empty-action-btn"
              onClick={() => {
                setCustomName(searchQuery);
                setShowCustomModal(true);
              }}
            >
              + Create "{searchQuery}" as Custom Color
            </button>
          </div>
        ) : (
          <div className="vcs-palette-grid" role="group" aria-label="All color options">
            {filteredColors.map(color => {
              const isSelected = selectedIds.has(color.id);
              return (
                <button
                  key={color.id}
                  type="button"
                  className={`vcs-palette-item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleToggleColor(color)}
                  aria-pressed={isSelected}
                  aria-label={`${color.name} ${color.hex}${isSelected ? ' (Selected)' : ''}`}
                  title={`${color.name} (${color.hex}) - ${color.category || ''}\nAliases: ${(color.aliases || []).join(', ')}`}
                >
                  <span
                    className="vcs-palette-swatch"
                    style={{ backgroundColor: color.hex }}
                    aria-hidden="true"
                  >
                    {isSelected && <span className="vcs-palette-check">✓</span>}
                  </span>
                  <div className="vcs-palette-meta">
                    <span className="vcs-palette-name">{color.name}</span>
                    <span className="vcs-palette-hex">{color.hex}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
