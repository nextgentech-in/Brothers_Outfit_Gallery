import { useRef } from 'react';
import { useAdminUI } from '../../context/AdminUIContext';
import { useFocusTrap } from '../../utils/a11yUtils';
import './AdminConfirmModal.css';

export default function AdminConfirmModal() {
  const { confirmDialog, handleConfirm, handleCancel } = useAdminUI();
  const modalRef = useRef(null);

  useFocusTrap(modalRef, !!confirmDialog, handleCancel);

  if (!confirmDialog) return null;

  const {
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false
  } = confirmDialog;

  return (
    <div className="admin-confirm-backdrop" onClick={handleCancel}>
      <div 
        ref={modalRef}
        className="admin-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`admin-confirm-icon ${isDestructive ? 'destructive' : 'info'}`}>
          {isDestructive ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          )}
        </div>

        <div className="admin-confirm-content">
          <h3 id="admin-confirm-title" className="admin-confirm-title">{title}</h3>
          <p className="admin-confirm-message">{message}</p>
        </div>

        <div className="admin-confirm-actions">
          <button
            type="button"
            className="admin-confirm-btn admin-confirm-btn--cancel"
            onClick={handleCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`admin-confirm-btn ${isDestructive ? 'admin-confirm-btn--danger' : 'admin-confirm-btn--primary'}`}
            onClick={handleConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
