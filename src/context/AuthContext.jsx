import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider } from '../firebase/firebaseConfig';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch or create profile logic
  const fetchUserProfile = async (uid) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      let isAdmin = false;
      const effectiveEmail = auth.currentUser?.email || '';

      // Hardcoded fallback emails since env variables are missing on host 
      const adminEmails = [
        import.meta.env.VITE_ADMIN_EMAIL,
        'setupatel01@gmail.com',
        'setupatel441@gmail.com'
      ];

      // Environment variable fallback matching for easy development bypass
      if (effectiveEmail && adminEmails.includes(effectiveEmail)) {
        isAdmin = true;
      }

      try {
        const adminRef = doc(db, 'admins', uid);
        const adminSnap = await getDoc(adminRef);
        if (adminSnap.exists() && adminSnap.data().role === 'admin') {
          isAdmin = true;
        }
      } catch (e) {
        console.error("Failed admin check (Check Firestore Security Rules):", e.message);
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        // Fallback for data.email if empty effectiveEmail
        if (!isAdmin && data.email && adminEmails.includes(data.email)) {
          isAdmin = true;
        }
        setUserProfile({ id: docSnap.id, ...data, isAdmin });
      } else {
        if (isAdmin) {
          // Inject basic profile for admins so they aren't blocked by completion logic
          setUserProfile({ id: uid, email: effectiveEmail, isAdmin });
        } else {
          setUserProfile(null); // Triggers Complete Profile if needed
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  function signup(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider);
  }

  // Create or update a profile document in Firestore natively
  async function updateFirestoreProfile(uid, data) {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
    // Re-fetch straight out to update active memory
    await fetchUserProfile(uid);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    login,
    signup,
    logout,
    loginWithGoogle,
    updateFirestoreProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
