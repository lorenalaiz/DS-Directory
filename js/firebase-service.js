import { firebaseConfig } from './config.js';
import { FIRESTORE_COLLECTION } from './config.js';

firebase.initializeApp(firebaseConfig);

export const db = firebase.firestore();
export const auth = firebase.auth();
export const storage = firebase.storage();

export const storageService = {
   async get(key, shared){
    try{
      const snap = await db.collection(FIRESTORE_COLLECTION).doc(key).get();
      if(!snap.exists) return null;
      const data = snap.data();
      return { key, value: data.value, shared: !!shared };
    }catch(e){
      throw new Error('Storage get failed: ' + e.message);
    }
  },
  async set(key, value, shared){
    try{
      await db.collection(FIRESTORE_COLLECTION).doc(key).set({ value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      return { key, value, shared: !!shared };
    }catch(e){
      throw new Error('Storage set failed: ' + e.message);
    }
  },
  async delete(key, shared){
    try{
      await db.collection(FIRESTORE_COLLECTION).doc(key).delete();
      return { key, deleted: true, shared: !!shared };
    }catch(e){
      throw new Error('Storage delete failed: ' + e.message);
    }
  },
  async list(prefix, shared){
    try{
      const snapshot = await db.collection(FIRESTORE_COLLECTION).get();
      const keys = snapshot.docs.map(d=>d.id).filter(k=>!prefix || k.startsWith(prefix));
      return { keys, prefix, shared: !!shared };
    }catch(e){
      throw new Error('Storage list failed: ' + e.message);
    }
  }
};