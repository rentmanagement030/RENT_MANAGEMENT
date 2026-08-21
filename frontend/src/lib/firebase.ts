import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAkFELKvCr7hWRZC3ThjsiGi3JrswLuO5A",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "c2d-rentals.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "c2d-rentals",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "c2d-rentals.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "359737364583",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:359737364583:web:97aa8ad050d2d9df55c4c2",
};

export const isFirebaseConfigured = true;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
