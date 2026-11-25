// ---------------------------------------------------------------------------
// SnapNote AI — Firebase configuration
// ---------------------------------------------------------------------------
// HOW TO CONNECT YOUR OWN FIREBASE PROJECT (2 minutes):
//  1. Go to https://console.firebase.google.com and create a project (free).
//  2. Open "Firebase AI Logic", click Get started, and choose the
//     "Gemini Developer API" provider.
//  3. In Project settings, add a Web app (</>) and copy its firebaseConfig.
//  4. Paste the values below, replacing the "YOUR_..." placeholders.
//  5. (Recommended) Enable App Check in the console; debug tokens are fine
//     for local testing — see app.js initializeAppCheck().
// ---------------------------------------------------------------------------
// If the placeholders are left in place, the app runs in Demo Mode with
// built-in sample data so the interface can be explored without a project.
// ---------------------------------------------------------------------------

export const firebaseConfig = {
  apiKey: "AIzaSyDbxknFS842EodwBOpGXA6pmMXiu2qkN8k",
  authDomain: "buildhybridai-2026-c82c1.firebaseapp.com",
  projectId: "buildhybridai-2026-c82c1",
  storageBucket: "buildhybridai-2026-c82c1.firebasestorage.app",
  messagingSenderId: "49172039702",
  appId: "1:49172039702:web:796229ae032823cd61cd37",
};

export const isConfigured =
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId !== "YOUR_PROJECT_ID";
