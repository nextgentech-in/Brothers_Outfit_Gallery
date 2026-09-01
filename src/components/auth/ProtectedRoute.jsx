import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { currentUser, userProfile } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // If a Google user logged in but doesn't have required firestore fields 
  // (like generic mobile/age), block access to dashboard and push to completion logic dynamically
  if (currentUser && !userProfile && window.location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />;
  }
  
  return children;
}
