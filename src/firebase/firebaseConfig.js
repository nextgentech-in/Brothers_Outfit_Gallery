import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { app } from './firebaseApp';
export { app } from './firebaseApp';
export { auth, googleProvider } from './firebaseAuth';

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
