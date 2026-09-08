import { createContext, useContext, useState, useCallback, useRef } from 'react';

const AdminUIContext = createContext(null);

export function AdminUIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const confirmResolverRef = useRef(null);

  // Trigger branded toast notification
  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Show branded accessible confirmation dialog returning a Promise<boolean>
  const showConfirm = useCallback(({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false
  }) => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmDialog({
        title,
        message,
        confirmText,
        cancelText,
        isDestructive
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(true);
      confirmResolverRef.current = null;
    }
    setConfirmDialog(null);
  }, []);

  const handleCancel = useCallback(() => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(false);
      confirmResolverRef.current = null;
    }
    setConfirmDialog(null);
  }, []);

  return (
    <AdminUIContext.Provider value={{ showToast, showConfirm, toasts, removeToast, confirmDialog, handleConfirm, handleCancel }}>
      {children}
    </AdminUIContext.Provider>
  );
}

export function useAdminUI() {
  const context = useContext(AdminUIContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      showToast: (msg) => console.log(msg),
      showConfirm: async () => window.confirm('Are you sure?')
    };
  }
  return context;
}
