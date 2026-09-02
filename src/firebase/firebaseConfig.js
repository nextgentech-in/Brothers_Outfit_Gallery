import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// Ensure you have a .env file locally containing these VITE_ prefixed keys.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB7HF5zw63Rt2sxj2BiIGx3AgPZTqoxgvw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "brothersoutfitgallary.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "brothersoutfitgallary",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "brothersoutfitgallary.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "463078313603",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:463078313603:web:1212678d7d41a3c02115b6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

