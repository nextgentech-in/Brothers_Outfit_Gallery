import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider } from '../firebase/firebaseConfig';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
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

  // Fetch or create profile logic asynchronously
  const fetchUserProfile = async (uid, authUser) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      let isAdmin = false;
      const effectiveEmail = authUser?.email || auth.currentUser?.email || '';

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
        console.warn("Admin doc check skipped:", e.message);
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
          fullName: authUser?.displayName || auth.currentUser?.displayName || effectiveEmail.split('@')[0] || 'User',
          email: effectiveEmail,
          phone: authUser?.phoneNumber || auth.currentUser?.phoneNumber || '',
          birthdate: '',
          age: '',
          address: { line1: '', city: '', state: '', pincode: '' },
          provider: authUser?.providerData?.[0]?.providerId || 'google.com',
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
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result && result.user) {
        setCurrentUser(result.user);
        fetchUserProfile(result.user.uid, result.user).catch(err => console.warn(err));
      }
      return result;
    } catch (error) {
      if (error.code === 'auth/popup-blocked') {
        console.warn("Popup blocked by browser, falling back to redirect...");
        const provider = new GoogleAuthProvider();
        return await signInWithRedirect(auth, provider);
      }
      throw error;
    }
  }

  // Create or update a profile document in Firestore natively
  async function updateFirestoreProfile(uid, data) {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
    await fetchUserProfile(uid, currentUser);
  }

  useEffect(() => {
    // Safety timer: Never block rendering on blank screen for more than 1.5s
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    // Process redirect sign in results (from Google redirect)
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          setCurrentUser(result.user);
          fetchUserProfile(result.user.uid, result.user).catch(err => console.error(err));
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Redirect sign-in check:", err.message);
        setLoading(false);
      });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(safetyTimer);
      setCurrentUser(user);
      if (user) {
        // Fetch profile in background without blocking app render
        fetchUserProfile(user.uid, user).catch(err => console.error(err));
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
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
      {loading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#090a0f',
          color: '#ffffff',
          fontFamily: 'Outfit, sans-serif'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#eab308',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite'
          }} />
          <p style={{ marginTop: '14px', fontSize: '12px', letterSpacing: '1.5px', opacity: 0.8, textTransform: 'uppercase' }}>
            Loading Brothers Outfit...
          </p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}
