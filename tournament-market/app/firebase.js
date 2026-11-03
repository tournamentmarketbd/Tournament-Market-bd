import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCz34C9Sgq53sdrXMPE5vFj9eHMKbgfEUI",
  authDomain: "tournament-market-bd.firebaseapp.com",
  projectId: "tournament-market-bd",
  storageBucket: "tournament-market-bd.firebasestorage.app",
  messagingSenderId: "114600298513",
  appId: "1:114600298513:web:ae5bda7f5fe86bbdee89b0",
  measurementId: "G-W8FBR7HNLZ"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();