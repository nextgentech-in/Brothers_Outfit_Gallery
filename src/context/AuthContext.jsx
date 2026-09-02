import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider } from '../firebase/firebaseConfig';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  signInWithRedirect
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

      const adminEmails = [
        import.meta.env.VITE_ADMIN_EMAIL,
        'setupatel01@gmail.com',
        'setupatel441@gmail.com'
      ];

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
        console.error("Failed admin check:", e.message);
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!isAdmin && data.email && adminEmails.includes(data.email)) {
          isAdmin = true;
        }
        setUserProfile({ id: docSnap.id, ...data, isAdmin });
      } else {
        // Auto-create basic profile for new users (e.g. Google Sign-In)
        const newProfile = {
          fullName: auth.currentUser?.displayName || effectiveEmail.split('@')[0] || 'User',
          email: effectiveEmail,
          phone: auth.currentUser?.phoneNumber || '',
          age: '',
          address: { line1: '', city: '', state: '', pincode: '' },
          provider: auth.currentUser?.providerData?.[0]?.providerId || 'google.com',
          createdAt: serverTimestamp()
        };

        try {
          await setDoc(docRef, newProfile, { merge: true });
        } catch (e) {
          console.error("Error creating default profile doc:", e);
        }

        setUserProfile({ id: uid, ...newProfile, isAdmin });
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

  async function loginWithGoogle() {
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error.code === 'auth/popup-blocked') {
        return await signInWithRedirect(auth, googleProvider);
      }
      throw error;
    }
  }

  // Create or update a profile document in Firestore natively
  async function updateFirestoreProfile(uid, data) {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
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
