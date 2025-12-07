import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyC4drxf0WZZWDhk9wP2yWB077XibEIXct8",
  authDomain: "call-track-d1699.firebaseapp.com",
  projectId: "call-track-d1699",
  storageBucket: "call-track-d1699.firebasestorage.app",
  messagingSenderId: "483015685810",
  appId: "1:483015685810:web:7ea3e4938cc8e8f5f3fbab"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
