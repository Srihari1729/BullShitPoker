// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, update, onValue, push, child, remove } from "firebase/database";

// TODO: Replace the following with your app's Firebase project configuration
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAS6RpJwcrAZpc2ID5HWI8em2B9NrYrTW8",
  authDomain: "bullshitpoker-8e193.firebaseapp.com",
  databaseURL: "https://bullshitpoker-8e193-default-rtdb.firebaseio.com",
  projectId: "bullshitpoker-8e193",
  storageBucket: "bullshitpoker-8e193.firebasestorage.app",
  messagingSenderId: "554151620048",
  appId: "1:554151620048:web:4ca019774dc3990e0e5dd5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Export database reference and functions
export { db, ref, set, get, update, onValue, push, child, remove };
