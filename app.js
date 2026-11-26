// SnapNote AI — Summarize notes with Firebase AI Logic (hybrid inference).
// On-device (Gemini Nano) first when possible, cloud (Gemini) fallback.
// ---------------------------------------------------------------------------
import { initializeApp } from "firebase/app";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from "firebase/ai";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { firebaseConfig, isConfigured } from "./firebase-config.js";

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const notesInput = $("notesInput");
const wordCountEl = $("wordCount");
const readTimeEl = $("readTime");
const summarizeBtn = $("summarizeBtn");
const statusLine = $("statusLine");
const outputEl = $("output");
const sourceBadge = $("sourceBadge");
const copyBtn = $("copyBtn");
const downloadBtn = $("downloadBtn");
const newBtn = $("newBtn");
const historyList = $("historyList");
const historyEmpty = $("historyEmpty");
const demoBanner = $("demoBanner");
const engineBadge = $("engineBadge");

let firebaseApp = null;
let ai = null;
let lastSummaryText = "";
let lastMeta = null;

// ---------------------------------------------------------------------------
// Sample notes
// ---------------------------------------------------------------------------
const SAMPLES = {
  meeting: `Team Sync — Nov 25, 2026
Attendees: Priya, Marco, June, Sam.
1. Q4 launch: the new onboarding flow ships Dec 3. Priya owns the final QA pass, due Dec 1.
2. Pricing: we will keep the current tiers through January. Marco will draft the announcement by Nov 28.
3. Support: ticket volume is up 18% this week, mostly password resets. June will ship a self-serve reset page by Dec 5.
4. Hiring: two engineering roles open. Sam will post the backend role this Friday.
5. Next sync: Tuesday Dec 2, same time.`,
  lecture: `Biology 201 — Photosynthesis (Lecture 12)
Photosynthesis converts light energy into chemical energy stored in glucose. It happens in chloroplasts, mainly in the palisade mesophyll of leaves. Two stages: light-dependent reactions and the Calvin cycle. Light reactions occur on thylakoid membranes; they split water, release oxygen, and produce ATP and NADPH. The Calvin cycle runs in the stroma and uses ATP and NADPH to fix carbon dioxide into sugar (G3P). Key factors: light intensity, CO2 concentration, and temperature. At low light, the rate is limited by light; at high light, CO2 becomes the limiting factor. C4 plants (like corn) minimize photorespiration by separating carbon fixation in space; CAM plants (like cacti) separate it in time, opening stomata at night. Exam tip: be able to draw and label the chloroplast and write the overall equation: 6CO2 + 6H2O + light -> C6H12O6 + 6O2.`,
  article: `Why Sleep Matters More Than You Think
Most adults need 7 to 9 hours of sleep, yet a third of us regularly get less than 7. Short sleep is linked to weaker memory, slower reaction times, and a higher risk of heart disease and diabetes. During deep sleep, the brain clears metabolic waste and consolidates memories; REM sleep supports emotional processing and creativity. The biggest disruptors are irregular schedules, late caffeine, and screens before bed. Experts recommend a fixed wake time, no caffeine after 2 p.m., a cool dark bedroom, and no screens in the last hour before bed. Even a 20-minute nap can restore alertness, but naps after 3 p.m. can make nighttime sleep harder. The takeaway: sleep is not lost time — it is when the brain does essential maintenance.`,
};

// ---------------------------------------------------------------------------
// Demo mode (no Firebase config): a small local extractive summarizer so the
// interface can be explored. Clearly labeled; live AI needs a real config.
// ---------------------------------------------------------------------------
function demoSummarize(text, style) {
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
  const scored = sentences.map((s) => {
    let score = 0;
    if (/\d/.test(s)) score += 2;
    if (/will|should|must|due|by\s+\w+\s+\d/i.test(s)) score += 2;
    score += Math.min(s.split(" ").length, 25) / 25;
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  if (style === "actions") {
    const items = scored.slice(0, 5).map((x) => `- [ ] ${x.s}`);
    return `### Action items (demo)\n\n${items.join("\n")}\n\n_Demo Mode: connect Firebase to generate live action items with AI._`;
  }
  if (style === "keypoints") {
    const items = scored.slice(0, 6).map((x) => `- ${x.s}`);
    return `### Key points (demo)\n\n${items.join("\n")}\n\n_Demo Mode: connect Firebase to generate live key points with AI._`;
  }
  const pick = scored.slice(0, style === "detailed" ? 6 : 3).map((x) => x.s);
  const head = style === "detailed" ? "Detailed summary (demo)" : "Brief summary (demo)";
  return `### ${head}\n\n${pick.join(" ")}\n\n_Demo Mode: connect Firebase to generate a live AI summary._`;
}

// ---------------------------------------------------------------------------
// Firebase setup
// ---------------------------------------------------------------------------
function initFirebase() {
  if (!isConfigured) return false;
  try {
    firebaseApp = initializeApp(firebaseConfig);
    // App Check is required by Firebase AI Logic. For local development and
    // demos, a debug token is accepted: the SDK prints a token in the
    // console — register it under Firebase console > App Check > your web
    // app > Manage debug tokens. Replace the provider with your real
    // reCAPTCHA v3 site key for production.
    try {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider("6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (e) {
      console.warn("App Check setup skipped:", e);
    }
    ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
    return true;
  } catch (e) {
    console.error("Firebase init failed:", e);
    return false;
  }
}

function inferenceModeFromSelect() {
  const v = document.getElementById("modeSelect").value;
  if (v === "device-only") return InferenceMode.ONLY_ON_DEVICE;
  if (v === "cloud-only") return InferenceMode.ONLY_IN_CLOUD;
  return InferenceMode.PREFER_ON_DEVICE;
}

function stylePrompt(style) {
  switch (style) {
    case "detailed":
      return "Write a clear, well-organized detailed summary of the following notes. Use short paragraphs, keep every important fact, decision, and number, and do not add anything that is not in the notes.";
    case "actions":
      return "Extract the action items from the following notes. Return a markdown list. Each item starts with '- [ ] ', then the task, then the owner in parentheses if mentioned, then the due date if mentioned. If there are no action items, say so in one sentence.";
    case "keypoints":
      return "Extract the key points from the following notes as a markdown bullet list. Each bullet is one key point, concise, no more than 15 words. Maximum 8 bullets. Do not add anything that is not in the notes.";
    case "brief":
    default:
      return "Summarize the following notes in 3 to 5 sentences. Be concise and preserve the key facts, decisions, and numbers. Do not add anything that is not in the notes.";
  }
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMarkdown(text) {
  const lines = escapeHtml(text).split("\n");
  let html = "";
  let inList = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("### ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3>${t.slice(4)}</h3>`;
    } else if (t.startsWith("- ") || t.startsWith("• ")) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${t.slice(2)}</li>`;
    } else if (t === "") {
      if (inList) { html += "</ul>"; inList = false; }
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${t}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function setSourceBadge(source) {
  sourceBadge.hidden = false;
  sourceBadge.className = "source-badge";
  if (source === "ON_DEVICE") {
    sourceBadge.textContent = "● On-device · Gemini Nano";
    sourceBadge.classList.add("source-device");
  } else if (source === "IN_CLOUD") {
    sourceBadge.textContent = "● Cloud · Gemini";
    sourceBadge.classList.add("source-cloud");
  } else {
    sourceBadge.textContent = "● Demo Mode";
    sourceBadge.classList.add("source-demo");
  }
}

function updateCounts() {
  const text = notesInput.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  wordCountEl.textContent = `${words} word${words === 1 ? "" : "s"}`;
  readTimeEl.textContent = words ? `· ~${Math.max(1, Math.round(words / 200))} min read` : "";
}

function setBusy(busy) {
  summarizeBtn.disabled = busy;
  summarizeBtn.textContent = busy ? "Summarizing…" : "✦ Summarize";
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------
const HISTORY_KEY = "snapnote-history-v1";
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}
function saveHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 8))); }
  catch { /* storage unavailable */ }
}
function renderHistory() {
  const items = loadHistory();
  historyList.innerHTML = "";
  historyEmpty.hidden = items.length > 0;
  items.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="h-title"></span><span class="h-meta"></span>`;
    li.querySelector(".h-title").textContent = item.title;
    li.querySelector(".h-meta").textContent =
      `${item.style} · ${item.source === "ON_DEVICE" ? "on-device" : item.source === "IN_CLOUD" ? "cloud" : "demo"}`;
    li.addEventListener("click", () => {
      notesInput.value = item.input;
      updateCounts();
      outputEl.innerHTML = renderMarkdown(item.summary);
      lastSummaryText = item.summary;
      lastMeta = item;
      setSourceBadge(item.source);
      copyBtn.disabled = false;
      downloadBtn.disabled = false;
      newBtn.disabled = false;
      statusLine.textContent = "Loaded a previous summary.";
    });
    historyList.appendChild(li);
  });
}
function addToHistory(input, summary, style, source) {
  const items = loadHistory();
  const title = input.replace(/\s+/g, " ").trim().slice(0, 48) || "Untitled notes";
  items.unshift({
    id: Date.now(), title, input, summary, style, source,
    createdAt: new Date().toISOString(),
  });
  saveHistory(items);
  renderHistory();
}

// ---------------------------------------------------------------------------
// Summarize
// ---------------------------------------------------------------------------
async function summarize() {
  const text = notesInput.value.trim();
  if (!text) {
    statusLine.textContent = "Paste some notes first — or try a sample on the left.";
    notesInput.focus();
    return;
  }
  const style = document.querySelector('input[name="style"]:checked').value;
  setBusy(true);
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
  newBtn.disabled = true;
  outputEl.innerHTML = "<p class=\"placeholder\">Summarizing…</p>";
  sourceBadge.hidden = true;

  // Demo mode: no Firebase config yet.
  if (!isConfigured || !ai) {
    await new Promise((r) => setTimeout(r, 500));
    const summary = demoSummarize(text, style);
    lastSummaryText = summary;
    lastMeta = { style, source: "DEMO" };
    outputEl.innerHTML = renderMarkdown(summary);
    setSourceBadge("DEMO");
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
    newBtn.disabled = false;
    addToHistory(text, summary, style, "DEMO");
    statusLine.textContent = "Demo Mode — add your Firebase config in firebase-config.js for live AI.";
    setBusy(false);
    return;
  }

  // Live mode: Firebase AI Logic, hybrid inference.
  // NOTE: getGenerativeModel is called here, on the button click, because
  // the inference mode requires a user interaction.
  try {
    const model = getGenerativeModel(ai, {
      mode: inferenceModeFromSelect(),
      inCloudParams: {
        model: "gemini-2.5-flash",
        generationConfig: { maxOutputTokens: 1200, temperature: 0.4 },
      },
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: "text", languages: ["en"] }],
          expectedOutputs: [{ type: "text", languages: ["en"] }],
          initialPrompts: [
            {
              role: "system",
              content: [{ type: "text", value: "You are a concise, accurate note summarizer. Only use information from the notes provided." }],
            },
          ],
        },
      },
    });

    const prompt = `${stylePrompt(style)}\n\nNotes:\n${text}`;
    const result = await model.generateContentStream(prompt);
    let full = "";
    for await (const chunk of result.stream) {
      full += chunk.text();
      outputEl.innerHTML = renderMarkdown(full);
    }
    const response = await result.response;
    const source = response.inferenceSource || "IN_CLOUD";
    lastSummaryText = full;
    lastMeta = { style, source };
    outputEl.innerHTML = renderMarkdown(full);
    setSourceBadge(source);
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
    newBtn.disabled = false;
    addToHistory(text, full, style, source);
    statusLine.textContent =
      source === "ON_DEVICE"
        ? "Summarized on-device with Gemini Nano — private, fast, and free."
        : "Summarized in the cloud with Gemini.";
  } catch (e) {
    console.error(e);
    const msg = (e && e.message) || String(e);
    outputEl.innerHTML = `<p class="placeholder">Could not summarize: ${escapeHtml(msg)}</p>`;
    if (/on-device|ONLY_ON_DEVICE|not available/i.test(msg)) {
      statusLine.textContent = "On-device inference is not available in this browser. Try the Auto or Cloud mode.";
    } else {
      statusLine.textContent = "Something went wrong. Check your Firebase config and connection, then try again.";
    }
  } finally {
    setBusy(false);
  }
}

// ---------------------------------------------------------------------------
// Wire up UI
// ---------------------------------------------------------------------------
notesInput.addEventListener("input", updateCounts);
summarizeBtn.addEventListener("click", summarize);
$("clearBtn").addEventListener("click", () => {
  notesInput.value = "";
  updateCounts();
  notesInput.focus();
});
document.querySelectorAll("[data-sample]").forEach((btn) => {
  btn.addEventListener("click", () => {
    notesInput.value = SAMPLES[btn.dataset.sample] || "";
    updateCounts();
    statusLine.textContent = "Sample loaded — press Summarize to try it.";
  });
});
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastSummaryText);
    statusLine.textContent = "Summary copied to clipboard.";
  } catch {
    statusLine.textContent = "Copy failed — select the text and copy it manually.";
  }
});
downloadBtn.addEventListener("click", () => {
  const blob = new Blob([`# SnapNote AI summary\n\n${lastSummaryText}\n`], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "snapnote-summary.md";
  a.click();
  URL.revokeObjectURL(url);
});
newBtn.addEventListener("click", () => {
  notesInput.value = "";
  outputEl.innerHTML = "<p class=\"placeholder\">Your summary will appear here. Pick a sample on the left, or paste your own notes, then press <strong>Summarize</strong>.</p>";
  lastSummaryText = "";
  sourceBadge.hidden = true;
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
  newBtn.disabled = true;
  updateCounts();
  notesInput.focus();
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
updateCounts();
renderHistory();
if (!isConfigured) {
  demoBanner.hidden = false;
  engineBadge.textContent = "Demo Mode";
  statusLine.textContent = "Demo Mode — add your Firebase config in firebase-config.js to enable live AI.";
} else {
  const ok = initFirebase();
  if (ok) {
    engineBadge.textContent = "Firebase AI Logic · Live";
    statusLine.textContent = "Connected to Firebase AI Logic. Short notes run on-device; long documents use the cloud.";
  } else {
    demoBanner.hidden = false;
    engineBadge.textContent = "Demo Mode";
    statusLine.textContent = "Firebase could not be initialized — running in Demo Mode. Check firebase-config.js.";
  }
}
