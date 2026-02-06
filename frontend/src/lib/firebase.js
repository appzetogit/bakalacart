import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging';

// Firebase configuration - Hardcoded to ensure consistency across all environments
const firebaseConfig = {
  apiKey: "AIzaSyDqWg8g4sxwElZ12nxVLjUe7wqCnSuDV3g",
  authDomain: "bakala-ed61d.firebaseapp.com",
  projectId: "bakala-ed61d",
  appId: "1:41650386026:web:495621e0f3e2424332c613",
  messagingSenderId: "41650386026",
  storageBucket: "bakala-ed61d.firebasestorage.app",
  measurementId: "G-S49CP0DW74"
};

// Initialize Firebase app only once
let app;
let firebaseAuth;
let googleProvider;
let messaging;

// Function to ensure Firebase is initialized
function ensureFirebaseInitialized() {
  try {
    const existingApps = getApps();
    if (existingApps.length === 0) {
      app = initializeApp(firebaseConfig);
      console.log('Firebase initialized successfully [v3] with config:', {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain,
        apiKey: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 20) + '...' : 'missing'
      });
    } else {
      app = existingApps[0];
      console.log('Firebase app already initialized [v3], reusing existing instance with project:', app.options.projectId);
    }

    // Initialize Auth - ensure it's connected to the app
    if (!firebaseAuth) {
      firebaseAuth = getAuth(app);
      if (!firebaseAuth) {
        throw new Error('Failed to get Firebase Auth instance');
      }
      console.log('Firebase Auth initialized successfully', {
        app: app.name,
        authApp: firebaseAuth.app.name
      });
    }

    // Initialize Google Provider
    if (!googleProvider) {
      googleProvider = new GoogleAuthProvider();
      // Add scopes if needed
      googleProvider.addScope('email');
      googleProvider.addScope('profile');
      // Note: Don't set custom client_id - Firebase uses its own OAuth client
      console.log('Google Auth Provider initialized');
    }

    // Initialize Messaging
    if (!messaging) {
      try {
        messaging = getMessaging(app);
        console.log('Firebase Messaging initialized successfully');
      } catch (messagingError) {
        console.warn('Firebase Messaging could not be initialized (likely not supported in this browser):', messagingError.message);
      }
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    console.error('Firebase config used:', firebaseConfig);
    throw error;
  }
}

// Initialize immediately
ensureFirebaseInitialized();

export const firebaseApp = app;
export { firebaseAuth, googleProvider, messaging, getToken, onMessage, deleteToken, ensureFirebaseInitialized };


