import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminRoute({ children }) {
  const { currentUser, userProfile } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Wait for the trusted profile/admin-role check before rendering admin pages.
  if (!userProfile) {
    return null;
  }

  // Use the isAdmin flag attached to userProfile by AuthContext
  if (!userProfile.isAdmin) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}
