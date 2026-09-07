import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";

// Normalize authDomain and project id to guarantee valid Firebase project credentials
const rawAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "brothersoutfitgallary.firebaseapp.com";
const normalizedAuthDomain = rawAuthDomain.replace(/brothersoutfitgallery\.firebaseapp\.com/g, "brothersoutfitgallary.firebaseapp.com");

const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "brothersoutfitgallary";
const normalizedProjectId = rawProjectId === "brothersoutfitgallery" ? "brothersoutfitgallary" : rawProjectId;

const rawStorage = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "brothersoutfitgallary.firebasestorage.app";
const normalizedStorage = rawStorage.replace(/brothersoutfitgallery/g, "brothersoutfitgallary");

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB7HF5zw63Rt2sxj2BiIGx3AgPZTqoxgvw",
  authDomain: normalizedAuthDomain,
  projectId: normalizedProjectId,
  storageBucket: normalizedStorage,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "463078313603",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:463078313603:web:1212678d7d41a3c02115b6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Cloud Firestore with persistent local cache for instant loading & 0 network latency
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;


