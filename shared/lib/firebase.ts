import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate Firebase configuration
const validateConfig = () => {
  const required = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ];

  const missing = required.filter(key => !import.meta.env[key] || import.meta.env[key] === '');
  
  if (missing.length > 0) {
    console.error('❌ Missing Firebase environment variables:', missing);
    console.error('Please check your .env file and ensure all Firebase config values are set.');
    throw new Error(`Missing Firebase configuration: ${missing.join(', ')}`);
  }

  // Check if values are not placeholders
  if (firebaseConfig.apiKey?.includes('your-') || firebaseConfig.projectId?.includes('your-')) {
    console.warn('⚠️  Firebase configuration may contain placeholder values. Please update your .env file.');
  }

  console.log('✅ Firebase configuration validated');
  console.log(`   Project: ${firebaseConfig.projectId}`);
};

// Validate and initialize Firebase
try {
  validateConfig();
} catch (error) {
  console.error('Firebase configuration error:', error);
  throw error;
}

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  try {
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase app initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
} else {
  app = getApps()[0];
  console.log('✅ Using existing Firebase app instance');
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Verify services are initialized
console.log('✅ Firebase services initialized:', {
  auth: !!auth,
  firestore: !!db,
  storage: !!storage,
});

export default app;
