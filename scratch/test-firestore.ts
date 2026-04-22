import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Note: This requires GOOGLE_APPLICATION_CREDENTIALS set or running in a GCP environment
async function test() {
  try {
    const app = initializeApp({
       projectId: "akros-24eab"
    });
    const db = getFirestore(app, "ai-studio-00a66f96-84b8-4db1-a7c4-02fa21862601");
    
    console.log("Searching for alumnas...");
    const snap = await db.collection('alumnas').limit(1).get();
    console.log("Result count:", snap.size);
    if (snap.size > 0) {
       console.log("Success! Can read alumnas from server.");
    } else {
       console.log("No alumnas found, but query worked.");
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
