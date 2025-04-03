// js/firebase-config.js

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    updateProfile  // Add this import
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    getDocs,
    orderBy,
    limit,
    startAfter,
    Timestamp,
    arrayUnion,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDLztoc272ZAP8Uy524n8z_x0TjgX0wb50",
  authDomain: "budget-assessment-system-1d840.firebaseapp.com",
  projectId: "budget-assessment-system-1d840",
  storageBucket: "budget-assessment-system-1d840.firebaseapp.com",
  messagingSenderId: "852745387240",
  appId: "1:852745387240:web:3bb0f6f684491c96505d5d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export the Firebase services
export {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile,  // Add this export
  db,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  arrayUnion,
  serverTimestamp,
  onSnapshot
};