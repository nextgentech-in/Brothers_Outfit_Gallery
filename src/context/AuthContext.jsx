import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase/firebaseAuth';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from 'firebase/auth';

const AuthContext = createContext();

let phoneRecaptchaVerifier = null;
const ADMIN_PHONE_NUMBERS = new Set(
  (import.meta.env.VITE_ADMIN_PHONE_NUMBERS || '')
    .split(',')
    .map(phone => String(phone).replace(/\D/g, '').slice(-10))
    .filter(phone => /^[6-9]\d{9}$/.test(phone))
);

const toIndianE164 = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(digits)) {
    throw new Error('Enter a valid 10-digit Indian mobile number.');
  }
  return `+91${digits}`;
};

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
      const [{ doc, getDoc, setDoc, serverTimestamp }, { db }] = await Promise.all([
        import('firebase/firestore'),
        import('../firebase/firebaseConfig')
      ]);
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      let isAdmin = false;
      const effectiveEmail = authUser?.email || auth.currentUser?.email || '';
      const effectivePhone = String(authUser?.phoneNumber || auth.currentUser?.phoneNumber || '').replace(/\D/g, '').slice(-10);

      const adminEmails = [
        import.meta.env.VITE_ADMIN_EMAIL,
        'setupatel01@gmail.com',
        'setupatel441@gmail.com'
      ];

      if ((effectiveEmail && adminEmails.includes(effectiveEmail)) || ADMIN_PHONE_NUMBERS.has(effectivePhone)) {
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
        // Auto-create a basic profile for newly authenticated users.
        const newProfile = {
          fullName: authUser?.displayName || auth.currentUser?.displayName || effectiveEmail.split('@')[0] || 'User',
          email: effectiveEmail,
          phone: authUser?.phoneNumber || auth.currentUser?.phoneNumber || '',
          birthdate: '',
          age: '',
          address: { line1: '', city: '', state: '', pincode: '' },
          provider: authUser?.providerData?.[0]?.providerId || 'phone',
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

  async function startPhoneSignIn(phone, recaptchaContainerId) {
    const phoneNumber = toIndianE164(phone);
    const container = document.getElementById(recaptchaContainerId);
    if (!container) throw new Error('Phone verification is not ready. Please try again.');

    // Clear a previous challenge before creating a new one, including after a failed attempt.
    if (phoneRecaptchaVerifier) {
      phoneRecaptchaVerifier.clear();
      phoneRecaptchaVerifier = null;
    }
    container.replaceChildren();

    phoneRecaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: 'invisible'
    });

    try {
      await phoneRecaptchaVerifier.render();
      return await signInWithPhoneNumber(auth, phoneNumber, phoneRecaptchaVerifier);
    } catch (error) {
      phoneRecaptchaVerifier.clear();
      phoneRecaptchaVerifier = null;
      throw error;
    }
  }

  async function verifyPhoneSignIn(confirmationResult, verificationCode) {
    if (!confirmationResult) throw new Error('Request a verification code first.');
    const code = String(verificationCode || '').trim();
    if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit verification code.');

    const result = await confirmationResult.confirm(code);
    if (result?.user) {
      setCurrentUser(result.user);
      fetchUserProfile(result.user.uid, result.user).catch(err => console.warn(err));
    }
    return result;
  }

  // Create or update a profile document in Firestore natively
  async function updateFirestoreProfile(uid, data) {
    const [{ doc, setDoc, serverTimestamp }, { db }] = await Promise.all([
      import('firebase/firestore'),
      import('../firebase/firebaseConfig')
    ]);
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
    await fetchUserProfile(uid, currentUser);
  }

  useEffect(() => {
    // Safety timer: Never block rendering on blank screen for more than 1.5s
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

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

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  const value = {
    currentUser,
    userProfile,
    login,
    signup,
    logout,
    startPhoneSignIn,
    verifyPhoneSignIn,
    updateFirestoreProfile,
    resetPassword
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
