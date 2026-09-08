import { useAdminUI } from '../../context/AdminUIContext';
import './AdminToast.css';

export default function AdminToast() {
  const { toasts, removeToast } = useAdminUI();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="admin-toast-container" aria-live="polite" role="region">
      {toasts.map((toast) => (
        <div key={toast.id} className={`admin-toast-item admin-toast-item--${toast.type || 'info'}`}>
          <div className="admin-toast-icon">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '✕'}
            {toast.type === 'warning' && '⚠'}
            {(!toast.type || toast.type === 'info') && 'ℹ'}
          </div>
          <div className="admin-toast-msg">{toast.message}</div>
          <button
            type="button"
            className="admin-toast-close"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
