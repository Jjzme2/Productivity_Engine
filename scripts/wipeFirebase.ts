import { initializeApp } from 'firebase/app'
import { getFirestore, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore'

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const wipeCollections = async () => {
  const collections = ['accounts', 'transactions', 'budgets', 'financial_goals', 'net_worth', 'dates']
  const userId = 'local'
  
  for (const c of collections) {
    console.log(`Wiping collection: ${c}...`)
    try {
      const q = query(collection(db, c), where('userId', '==', userId))
      const snap = await getDocs(q)
      let count = 0
      for (const d of snap.docs) {
        await deleteDoc(d.ref)
        count++
      }
      console.log(`Deleted ${count} documents from ${c}`)
    } catch (e) {
      console.error(`Error wiping ${c}:`, e)
    }
  }
  
  console.log('Firebase wipe complete.')
  process.exit(0)
}

wipeCollections()
