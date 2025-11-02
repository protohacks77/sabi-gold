
// FIX: Use Firebase compat for initialization to resolve missing export error.
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/auth";

// Hardcoded Firebase configuration as per user request
const firebaseConfig = {
  apiKey: "AIzaSyChO2Ss2gi_D0hAN8czBmn6mXD1IGnt8BE",
  authDomain: "sabi-gold-mine.firebaseapp.com",
  projectId: "sabi-gold-mine",
  storageBucket: "sabi-gold-mine.firebasestorage.app",
  messagingSenderId: "198912278013",
  appId: "1:198912278013:web:1ff1a354297debc254ad94"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Initialize Cloud Firestore and get a reference to the service
const db = firebase.firestore();

// Initialize Firebase Authentication and get a reference to the service
const auth = firebase.auth();

export { db, auth };