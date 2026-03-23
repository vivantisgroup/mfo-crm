export * from "./firebaseClient";
// re-export the auth helper so apps don't import firebase directly
export { signInWithEmailAndPassword } from "firebase/auth";
export { collection, doc, getDocs, getDoc, setDoc, query, where, orderBy, writeBatch } from "firebase/firestore";
