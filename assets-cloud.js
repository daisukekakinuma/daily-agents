import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,doc,runTransaction,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
import {emptyState,validate} from './assets-model.js';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
let user=null,stop=null;
export const login=()=>signInWithPopup(auth,new GoogleAuthProvider());
export const logout=()=>signOut(auth);
const ref=uid=>doc(db,'users',uid,'household','assets');
export function watch(changed,received,failed){return onAuthStateChanged(auth,u=>{stop?.();user=u;changed(u);if(u){const uid=u.uid;stop=onSnapshot(ref(uid),snap=>{if(user?.uid!==uid)return;try{received(snap.exists()?validate(snap.data()):emptyState());}catch(e){failed(e);}},failed);}});}
export async function save(state,revision){
  if(!user)throw Error('ログインしてください');const uid=user.uid;validate(state);
  await runTransaction(db,async tx=>{const r=ref(uid),snap=await tx.get(r);if((snap.exists()?snap.data().revision:0)!==revision)throw Error('別の端末で更新されました。画面を閉じて最新データで入力し直してください');if(user?.uid!==uid)throw Error('ログイン状態が変わりました');tx.set(r,{...state,revision:revision+1});});
}
