# SnapNote AI — Smart Notes, Summarized Your Way

Turn long notes into clear summaries, key points, and action items — fast and
private **on-device** when possible, powerful **in the cloud** when you need
more. Built with **Firebase AI Logic hybrid inference**.

## What it does

- Paste meeting notes, lecture notes, or an article.
- Pick a summary style: **Brief**, **Detailed**, **Action items**, or **Key points**.
- Press **Summarize**. Short notes run on-device with **Gemini Nano**
  (private, fast, free, works offline); long documents fall back to **Gemini**
  in the cloud. You always see where each summary ran.
- Copy the result, download it as Markdown, and revisit past summaries in
  History (saved on your device).

## How it uses Firebase AI Logic

- `app.js` initializes Firebase and creates the AI service with the
  **Gemini Developer API** backend:
  `getAI(firebaseApp, { backend: new GoogleAIBackend() })`.
- The model is created **on the Summarize click** (a user interaction, as
  required) with an inference mode:
  `getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE })`.
  Modes: `PREFER_ON_DEVICE` (auto), `ONLY_ON_DEVICE`, `ONLY_IN_CLOUD`.
- Responses stream with `generateContentStream()`, and the UI shows
  `response.inferenceSource` (`ON_DEVICE` or `IN_CLOUD`) as a badge.
- App Check is set up in `initFirebase()` (debug token accepted for local
  development — register the token printed in the console under
  Firebase console > App Check > your web app > Manage debug tokens).
- On-device generation is configured with `onDeviceParams` (expected
  inputs/outputs and a system prompt); cloud generation uses
  `inCloudParams` (generation config).

## Run it

No build step. Serve the folder over HTTP (required for ES modules) and open
it in Chrome (desktop, v139+ for on-device inference):

```bash
# from this folder
python3 -m http.server 8080
# then open http://localhost:8080
```

Enable the on-device model in Chrome once:
`chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → Enabled,
then restart Chrome. The Gemini Nano model downloads automatically on first
use (check `await LanguageModel.availability()` in DevTools).

## Connect your Firebase project (2 minutes)

1. Go to https://console.firebase.google.com and create a project (free).
2. Open **Firebase AI Logic**, click **Get started**, choose the
   **Gemini Developer API** provider.
3. In Project settings, add a **Web app** and copy its `firebaseConfig`.
4. Paste the values into `firebase-config.js`, replacing the `YOUR_...`
   placeholders.
5. Reload the page — the banner switches from Demo Mode to Live.

Without a config the app runs in **Demo Mode** with built-in sample data so
the interface can be explored; live AI requires a real Firebase project.
Text inference with Firebase AI Logic is free within usage limits.

## Tech

- Firebase AI Logic JS SDK v13 (`firebase/app`, `firebase/ai`,
  `firebase/app-check`) via CDN import map — no bundler.
- Vanilla HTML/CSS/JS. History in `localStorage`. No data leaves the device
  except the prompt sent to the model you choose.

## License

Apache License 2.0 — see `LICENSE`.
