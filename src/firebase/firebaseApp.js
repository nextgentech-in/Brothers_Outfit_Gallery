import { getApp, getApps, initializeApp } from 'firebase/app';

// Firebase web identifiers are intentionally public. Keep the API key in the
// deployment environment so it can be rotated and domain/API restricted.
const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
if (!firebaseApiKey) {
  throw new Error('Missing VITE_FIREBASE_API_KEY. Configure the Firebase web app before starting the client.');
}

const rawAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'brothersoutfitgallary.firebaseapp.com';
const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'brothersoutfitgallary';
const rawStorage = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'brothersoutfitgallary.firebasestorage.app';

export const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: rawAuthDomain.replace(/brothersoutfitgallery\.firebaseapp\.com/g, 'brothersoutfitgallary.firebaseapp.com'),
  projectId: rawProjectId === 'brothersoutfitgallery' ? 'brothersoutfitgallary' : rawProjectId,
  storageBucket: rawStorage.replace(/brothersoutfitgallery/g, 'brothersoutfitgallary'),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '463078313603',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:463078313603:web:1212678d7d41a3c02115b6'
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
