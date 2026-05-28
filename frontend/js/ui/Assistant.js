// js/ui/Assistant.js
// Front-end pool design assistant. It works locally with deterministic design rules,
// and can be connected to a real AI backend later by setting window.POOL_ASSISTANT_ENDPOINT.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value, step = 0.05) {
  return Math.round(value / step) * step;
}

function formatM(value) {
  return `${Number(value || 0).toFixed(2)} m`;
}

function getPoolApp() {
  return window.poolApp || null;
}

function dispatchInput(el) {
  if (!el) return;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function setRange(id, value) {
  const el = document.getElementById(id);
  if (!el) return false;
  const min = Number(el.min || -Infinity);
  const max = Number(el.max || Infinity);
  const step = Number(el.step || 0.05);
  const next = clamp(roundToStep(Number(value), step), min, max);
  el.value = String(next);
  dispatchInput(el);
  return true;
}

function setSelect(id, value) {
  const el = document.getElementById(id);
  if (!el) return false;
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function clickButton(selector) {
  const el = document.querySelector(selector);
  if (!el) return false;
  el.click();
  return true;
}

function setStepBenchMode(mode) {
  return clickButton(`[data-step-bench-mode="${mode}"]`);
}

function setStepPosition(position) {
  return clickButton(`[data-step-position="${position}"]`);
}

function setStepShape(shape) {
  return clickButton(`[data-step-shape="${shape}"]`);
}

function openPanel(panelName) {
  if (typeof window.openPanelFromCode === "function") {
    window.openPanelFromCode(panelName);
    return true;
  }
  const btn = document.querySelector(`.icon-btn[data-panel="${panelName}"]`);
  if (btn) {
    btn.click();
    return true;
  }
  return false;
}

function summarizeCurrentDesign(app = getPoolApp()) {
  const p = app?.poolParams || {};
  const ratio = Number(p.width) ? Number(p.length) / Number(p.width) : 0;
  const slopeDepth = Math.max(0, Number(p.deep || 0) - Number(p.shallow || 0));
  const stepMode = p.stepBenchMode === "stepsOnly" ? "steps only" : "bench seat";
  const notes = [
    `Current design: ${p.shape || "rectangular"} pool, ${formatM(p.length)} x ${formatM(p.width)}.`,
    `Depths: shallow ${formatM(p.shallow)}, deep ${formatM(p.deep)} with ${formatM(p.shallowFlat)} shallow flat and ${formatM(p.deepFlat)} deep flat.`,
    `Entry: ${p.stepCount || 0} steps, ${stepMode}, ${p.stepPosition || "centre"} position, ${p.stepShape || "rectangle"} shape.`
  ];

  if (ratio > 3) notes.push("This is reading as a lap-style pool because the length-to-width ratio is high.");
  if (ratio > 0 && ratio < 1.5) notes.push("This is reading as a compact/plunge-style pool because the length-to-width ratio is short.");
  if (slopeDepth > 1.4) notes.push("The depth change is quite aggressive; keep an eye on the transition comfort and usable shallow area.");
  if ((p.stepCount || 0) < 2) notes.push("Consider at least 2–3 entry steps for a more practical entry sequence.");
  if (p.stepBenchMode === "bench") notes.push("Bench mode is a good social/swim-out option; keep the floor transition tied to the bench edge.");
  if (p.stepBenchMode === "stepsOnly") notes.push("Steps-only mode keeps the transition from the entry wall, which gives you the clean tiered step stack you have been tuning.");

  return notes.join("\n");
}

function applyPreset(kind) {
  const actions = [];

  if (kind === "family") {
    setSelect("shape", "rectangular");
    setRange("length", 9);
    setRange("width", 4.2);
    setRange("shallow", 1.1);
    setRange("deep", 2.0);
    setRange("shallowFlat", 2.6);
    setRange("deepFlat", 1.6);
    setRange("stepCount", 3);
    setRange("stepDepth", 0.2);
    setRange("stepWidth", 3.2);
    setStepBenchMode("bench");
    setStepPosition("center");
    setStepShape("rectangle");
    openPanel("steps");
    actions.push("Applied a balanced family-pool starting point: wider shallow area, 3 steps, and a bench seat.");
  }

  if (kind === "lap") {
    setSelect("shape", "rectangular");
    setRange("length", 14);
    setRange("width", 3);
    setRange("shallow", 1.2);
    setRange("deep", 1.8);
    setRange("shallowFlat", 3);
    setRange("deepFlat", 2);
    setRange("stepCount", 3);
    setRange("stepWidth", 1.5);
    setStepBenchMode("stepsOnly");
    setStepPosition("left");
    setStepShape("rectangle");
    openPanel("shape");
    actions.push("Applied a lap-pool layout: long, narrow, and steps pushed to one side so the swim lane stays clearer.");
  }

  if (kind === "plunge") {
    setSelect("shape", "rectangular");
    setRange("length", 5);
    setRange("width", 3);
    setRange("shallow", 1.2);
    setRange("deep", 1.6);
    setRange("shallowFlat", 1.5);
    setRange("deepFlat", 1);
    setRange("stepCount", 2);
    setRange("stepWidth", 2.4);
    setStepBenchMode("bench");
    setStepPosition("center");
    openPanel("shape");
    actions.push("Applied a compact plunge-pool layout with a simple bench/entry arrangement.");
  }

  return actions.join("\n");
}

function addSpaIfNeeded() {
  const app = getPoolApp();
  if (app?.spa) return "A spa is already in the design. Select the spa panel to edit its size and shape.";
  setSelect("spaShape", "square");
  const btn = document.getElementById("addRemoveSpa");
  if (btn && /add spa/i.test(btn.textContent || "")) {
    btn.click();
    openPanel("spa");
    return "Added a square spa starting point. You can move it into the pool or snap it to a wall.";
  }
  openPanel("spa");
  return "Opened the spa controls. Use Add Spa to place one in the model.";
}

function makeLocalAssistantResponse(prompt) {
  const text = String(prompt || "").toLowerCase();
  const actions = [];

  if (/review|check|analyse|analyze|suggest|current/.test(text)) {
    return summarizeCurrentDesign();
  }

  if (/family|kids|children/.test(text)) actions.push(applyPreset("family"));
  if (/lap|swim lane|training/.test(text)) actions.push(applyPreset("lap"));
  if (/plunge|small|compact/.test(text)) actions.push(applyPreset("plunge"));

  const sizeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:m|metre|meter)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)/i);
  if (sizeMatch) {
    setRange("length", Number(sizeMatch[1]));
    setRange("width", Number(sizeMatch[2]));
    actions.push(`Set the pool size to about ${sizeMatch[1]} m x ${sizeMatch[2]} m.`);
  }

  if (/bench/.test(text)) {
    setStepBenchMode("bench");
    openPanel("steps");
    actions.push("Set the entry layout to Bench Seat.");
  }
  if (/steps only|step only|no bench/.test(text)) {
    setStepBenchMode("stepsOnly");
    openPanel("steps");
    actions.push("Set the entry layout to Steps Only.");
  }
  if (/add.*spa|spa/.test(text)) actions.push(addSpaIfNeeded());
  if (/deep/.test(text) && /deeper|make.*deep|increase/.test(text)) {
    const app = getPoolApp();
    setRange("deep", Number(app?.poolParams?.deep || 2.0) + 0.3);
    actions.push("Increased the deep end by 300 mm.");
  }
  if (/shallow/.test(text) && /larger|more|increase|family/.test(text)) {
    const app = getPoolApp();
    setRange("shallowFlat", Number(app?.poolParams?.shallowFlat || 2.0) + 0.5);
    actions.push("Increased the shallow flat by 500 mm.");
  }
  if (/wider/.test(text)) {
    const app = getPoolApp();
    setRange("width", Number(app?.poolParams?.width || 5) + 0.5);
    actions.push("Made the pool 500 mm wider.");
  }
  if (/narrower/.test(text)) {
    const app = getPoolApp();
    setRange("width", Number(app?.poolParams?.width || 5) - 0.5);
    actions.push("Made the pool 500 mm narrower.");
  }
  if (/longer/.test(text)) {
    const app = getPoolApp();
    setRange("length", Number(app?.poolParams?.length || 10) + 1.0);
    actions.push("Made the pool 1 m longer.");
  }
  if (/shorter/.test(text)) {
    const app = getPoolApp();
    setRange("length", Number(app?.poolParams?.length || 10) - 1.0);
    actions.push("Made the pool 1 m shorter.");
  }

  const applied = actions.filter(Boolean).join("\n");
  if (applied) return `${applied}\n\n${summarizeCurrentDesign()}`;

  return "I can help with pool layout changes like: make this a family pool, make it a lap pool, add a spa, use steps only, use bench seat, make it wider/longer, or review this design.";
}

async function askOptionalBackend(prompt) {
  const endpoint = window.POOL_ASSISTANT_ENDPOINT;
  if (!endpoint) return null;
  try {
    const app = getPoolApp();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, poolParams: app?.poolParams || {} })
    });
    if (!res.ok) throw new Error(`Assistant endpoint failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[PoolAssistant] Backend unavailable; using local assistant.", err);
    return null;
  }
}

export function setupPoolAssistant(app) {
  const root = document.getElementById("poolAssistant");
  const messages = document.getElementById("assistantMessages");
  const form = document.getElementById("assistantForm");
  const input = document.getElementById("assistantInput");
  if (!root || !messages || !form || !input || root.dataset.ready === "true") return;
  root.dataset.ready = "true";

  function addMessage(role, content) {
    const el = document.createElement("div");
    el.className = `assistant-message ${role === "user" ? "assistant-user" : "assistant-bot"}`;
    el.textContent = content;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  async function handlePrompt(prompt) {
    const clean = String(prompt || "").trim();
    if (!clean) return;
    addMessage("user", clean);
    input.value = "";

    const backend = await askOptionalBackend(clean);
    if (backend?.message) {
      addMessage("bot", backend.message);
      return;
    }

    addMessage("bot", makeLocalAssistantResponse(clean));
  }

  addMessage("bot", "Hi — I can help design the pool, apply starter layouts, add a spa, switch step modes, or review the current proportions. Try: ‘make this a family pool’ or ‘review this design’. ");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    handlePrompt(input.value);
  });

  root.querySelectorAll("[data-assistant-prompt]").forEach((btn) => {
    btn.addEventListener("click", () => handlePrompt(btn.dataset.assistantPrompt));
  });

  document.addEventListener("assistantPanelOpened", () => {
    if (messages.children.length <= 1) addMessage("bot", summarizeCurrentDesign(app));
  });
}
