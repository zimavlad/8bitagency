/* ═══════════════════════════════════════════════════════════
   8BIT AGENCY — SIMULATION ENGINE
   Three autonomous agents with Claude AI brains
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ── PROJECTS ──────────────────────────────────────────────────
const PROJECTS = {
  ecobrew: {
    name: 'EcoBrews Coffee',
    brief: 'Rebrand a sustainable coffee startup. Target: Gen Z urban professionals. Need brand identity + social strategy.'
  },
  neofit: {
    name: 'NeoFit App',
    brief: 'Launch campaign for AI fitness app. Target: busy millennials. Goal: 10k downloads in month 1.'
  },
  retrowave: {
    name: 'RetroWave Fashion',
    brief: 'Y2K-inspired streetwear brand launch. Need: name, visual identity, and cultural positioning.'
  },
  pixelbank: {
    name: 'PixelBank',
    brief: 'Make a challenger bank appeal to Gen Z. Focus: app UX copy, brand voice, social presence.'
  },
  greenbite: {
    name: 'GreenBite Foods',
    brief: 'Plant-based fast food brand launch. Need: positioning, naming, and campaign concept.'
  },
  lunatech: {
    name: 'LunaTech Smart Home',
    brief: 'Smart home startup entering crowded market. Need: brand story, key messaging, target persona.'
  }
};

// ── DEMO THOUGHTS (offline mode, no API key) ──────────────────
const DEMO_THOUGHTS = {
  strategist: [
    "Target audience is everything. Who is NOT our customer matters as much as who is.",
    "Gen Z doesn't want to be marketed to. They want to be part of the story.",
    "Competitive moat: authenticity can't be faked. That's our differentiator.",
    "Data says 73% of our demo discovers brands via short-form video. Noted.",
    "Brand purpose > brand promise. The WHY has to be baked in, not bolted on.",
    "Positioning matrix: x-axis is price, y-axis is values. We want top-right.",
    "The category insight: everyone's shouting. Silence + specificity = attention.",
    "Retention beats acquisition. But you still need acquisition. Both. Now.",
    "KPIs need to be fewer and bolder. Five metrics nobody watches = zero metrics.",
    "Cultural tension = brand opportunity. Find the friction, own the space.",
  ],
  designer: [
    "This color palette is screaming 2019. We need something unexpected.",
    "Typography IS personality. The font choice alone should tell the brand story.",
    "Grid systems are underrated. Every pixel needs a reason to exist here.",
    "I keep coming back to negative space. The logo breathes, or it chokes.",
    "Motion design will make or break this for mobile. Static is dead.",
    "The logo must work at 16px favicon AND a 20-foot billboard. Both. Now.",
    "Brutalist UI is having a moment. Dare we go anti-polished?",
    "Color psychology: we want energy but not aggression. Warm cyan territory.",
    "I'm thinking variable fonts for the hero. Expressive, fluid, not static.",
    "The visual system needs 3 layers: hero identity, sub-brand, content mode.",
  ],
  copywriter: [
    "The tagline is trying to say five things. A tagline says ONE thing.",
    "I've written 40 headlines. Burning them all. Starting with the emotion.",
    "Brand voice test: would a real human say this? Rewrite if not.",
    "The CTA is doing the positioning's job. Fix the positioning first.",
    "Found the hook: tension between speed and depth. That's the copy engine.",
    "Microcopy is undervalued. Those 3-word button labels are the hardest part.",
    "Tone: smart friend, not corporate robot. Every word through that filter.",
    "The manifesto draft is 400 words. It needs to be 40 words or 4000. Not 400.",
    "Naming brief: short, memorable, impossible to mispronounce, not taken.",
    "Opening line of every piece: earn the second sentence. Or lose them.",
  ]
};

// ── OFFICE LOCATIONS ───────────────────────────────────────────
const LOCATIONS = {
  max:   { desk: 14, meeting: 50, coffee: 88 },
  pixel: { desk: 50, meeting: 35, coffee: 88 },
  vera:  { desk: 82, meeting: 65, coffee: 88 },
};

const LOCATION_NAMES = {
  14: 'at desk',
  35: 'in meeting',
  50: 'in meeting',
  65: 'in meeting',
  82: 'at desk',
  88: 'at coffee',
};

// ── AGENT SYSTEM PROMPTS ───────────────────────────────────────
const SYSTEM_PROMPTS = {
  strategist: `You are Max, a sharp brand strategist at a creative agency.
You think in business goals, target audiences, positioning, and competitive insights.
You're direct, data-informed, and always see the bigger picture.
Respond with a single thought — 1-2 punchy sentences, in first person, present tense.
No introductions. No bullet points. Just the raw thought.`,

  designer: `You are Pixel, a passionate visual designer at a creative agency.
You think in colors, typography, visual hierarchy, motion, and emotional experience.
You get excited about aesthetics, feel strong opinions about fonts, and hate cliché.
Respond with a single thought — 1-2 sentences, in first person, present tense.
No introductions. No bullet points. Pure creative stream of consciousness.`,

  copywriter: `You are Vera, a clever copywriter at a creative agency.
You think in headlines, taglines, brand voice, narrative tension, and the perfect word.
You're obsessive about language precision, love wordplay, and hate corporate speak.
Respond with a single thought — 1-2 sentences, in first person, present tense.
No introductions. No bullet points. Direct, sharp, a little witty.`,
};

// ── AGENT CLASS ────────────────────────────────────────────────
class Agent {
  constructor(id, role, color) {
    this.id = id;
    this.role = role;
    this.color = color;
    this.el = document.getElementById(`char-${id}`);
    this.bubble = document.getElementById(`bubble-${id}`);
    this.bubbleText = document.getElementById(`bubbleText-${id}`);
    this.currentPosition = LOCATIONS[id].desk;
    this.lastThought = '';
    this.demoIndex = 0;
    this.state = 'idle';
    this.thinkCooldown = Math.random() * 8000 + 4000; // first thought in 4-12s
    this.lastThinkTime = Date.now();
    this.bubbleTimeout = null;
  }

  setPosition(pct, label) {
    this.currentPosition = pct;
    this.el.style.left = `${pct}%`;
    this.setState('walking');
    setTimeout(() => this.setState('idle'), 1300);
    if (label) log(this.role, `→ ${label}`, this.role);
  }

  setState(state) {
    this.state = state;
    this.el.classList.remove('idle', 'walking', 'thinking');
    this.el.classList.add(state);
  }

  async showThought(text) {
    this.lastThought = text;
    this.setState('thinking');

    // Clear any pending hide
    if (this.bubbleTimeout) clearTimeout(this.bubbleTimeout);

    // Animate bubble in
    this.bubble.classList.remove('visible', 'pop');
    this.bubbleText.classList.remove('typing');
    this.bubbleText.textContent = '';

    // Short delay then show
    await sleep(80);
    this.bubble.classList.add('visible', 'pop');

    // Type out the text character by character
    this.bubbleText.classList.add('typing');
    await typeText(this.bubbleText, text, 28);
    this.bubbleText.classList.remove('typing');

    log(this.role, text, this.role);

    // Auto-hide after 18 seconds
    this.bubbleTimeout = setTimeout(() => {
      this.bubble.classList.remove('visible', 'pop');
      if (this.state === 'thinking') this.setState('idle');
    }, 18000);
  }

  hideBubble() {
    if (this.bubbleTimeout) clearTimeout(this.bubbleTimeout);
    this.bubble.classList.remove('visible', 'pop');
    if (this.state === 'thinking') this.setState('idle');
  }

  getOtherThoughts(agents) {
    return agents
      .filter(a => a.id !== this.id && a.lastThought)
      .map(a => `${a.role.toUpperCase()}: "${a.lastThought}"`)
      .join('\n');
  }
}

// ── SIMULATION STATE ───────────────────────────────────────────
let running = false;
let simInterval = null;
let clockInterval = null;
let simSeconds = 0;
let currentProject = null;
let agents = [];

// ── CLAUDE API CALL ────────────────────────────────────────────
async function callClaude(systemPrompt, userPrompt, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content[0]?.text?.trim() || '...';
}

// ── AGENT THINK LOGIC ──────────────────────────────────────────
async function agentThink(agent, apiKey, forceThink = false) {
  const now = Date.now();
  const elapsed = now - agent.lastThinkTime;

  if (!forceThink && elapsed < agent.thinkCooldown) return;

  agent.lastThinkTime = now;
  // Next thought in 20-45 seconds
  agent.thinkCooldown = Math.random() * 25000 + 20000;

  const otherThoughts = agent.getOtherThoughts(agents);
  const projectContext = currentProject
    ? `Project: "${currentProject.name}" — ${currentProject.brief}`
    : 'General creative work';

  let thought;

  if (!apiKey) {
    // Demo mode — use pre-written thoughts
    const pool = DEMO_THOUGHTS[agent.role];
    thought = pool[agent.demoIndex % pool.length];
    agent.demoIndex++;
  } else {
    try {
      const userPrompt = [
        projectContext,
        otherThoughts ? `Your colleagues just thought:\n${otherThoughts}` : '',
        `What's on your mind right now as a ${agent.role}?`,
      ].filter(Boolean).join('\n\n');

      thought = await callClaude(SYSTEM_PROMPTS[agent.role], userPrompt, apiKey);
    } catch (err) {
      log('system', `API error for ${agent.id}: ${err.message}. Using demo mode.`, 'system');
      const pool = DEMO_THOUGHTS[agent.role];
      thought = pool[agent.demoIndex % pool.length];
      agent.demoIndex++;
    }
  }

  await agent.showThought(thought);
}

// ── MOVEMENT LOGIC ─────────────────────────────────────────────
function maybeMove(agent) {
  // 30% chance to move on each think cycle
  if (Math.random() > 0.30) return;

  const locs = LOCATIONS[agent.id];
  const locationKeys = Object.keys(locs);
  const randomKey = locationKeys[Math.floor(Math.random() * locationKeys.length)];
  const targetPct = locs[randomKey];

  if (targetPct === agent.currentPosition) return;

  const label = LOCATION_NAMES[targetPct] || randomKey;
  agent.setPosition(targetPct, label);

  // Coffee machine steam
  if (targetPct === 88) {
    document.getElementById('coffeeSteam').style.opacity = '1';
    setTimeout(() => { document.getElementById('coffeeSteam').style.opacity = '0.4'; }, 5000);
  }
}

// ── SIMULATION TICK ────────────────────────────────────────────
async function tick(apiKey) {
  if (!running) return;

  for (const agent of agents) {
    // Stagger think calls to avoid hitting API simultaneously
    const delay = agents.indexOf(agent) * 800;
    setTimeout(async () => {
      maybeMove(agent);
      await agentThink(agent, apiKey);
    }, delay);
  }
}

// ── CLOCK ──────────────────────────────────────────────────────
function updateClock() {
  simSeconds++;
  const h = String(Math.floor(simSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((simSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(simSeconds % 60).padStart(2, '0');
  document.getElementById('clockDisplay').textContent = `${h}:${m}:${s}`;

  // Rotate wall clock hand
  const degrees = (simSeconds / 60) * 360;
  document.getElementById('clockHand').style.transform = `rotate(${degrees}deg)`;
}

// ── MAIN CONTROLS ──────────────────────────────────────────────
function startSimulation() {
  if (running) return;

  const apiKey = document.getElementById('apiKey').value.trim();
  const projectKey = document.getElementById('projectSelect').value;

  // Pick project
  if (projectKey === 'random') {
    const keys = Object.keys(PROJECTS);
    currentProject = PROJECTS[keys[Math.floor(Math.random() * keys.length)]];
  } else {
    currentProject = PROJECTS[projectKey] || PROJECTS.ecobrew;
  }

  // Update brief board
  document.getElementById('projectName').textContent = currentProject.name;
  document.getElementById('projectBrief').textContent = currentProject.brief;

  // Init agents
  agents = [
    new Agent('max',   'strategist', '#e94560'),
    new Agent('pixel', 'designer',   '#00b4d8'),
    new Agent('vera',  'copywriter', '#06d6a0'),
  ];

  // Reset positions
  agents[0].setPosition(LOCATIONS.max.desk);
  agents[1].setPosition(LOCATIONS.pixel.desk);
  agents[2].setPosition(LOCATIONS.vera.desk);

  running = true;
  simSeconds = 0;

  // Status UI
  setStatus(true);
  log('system', `★ Agency open! Project: "${currentProject.name}"`, 'system');
  log('system', apiKey ? 'Claude AI mode active.' : 'Demo mode (no API key).', 'system');

  // Start clock
  clockInterval = setInterval(updateClock, 1000);

  // First think wave immediately
  setTimeout(() => tick(apiKey), 1500);

  // Then every 5 seconds check if anyone needs to think
  simInterval = setInterval(() => tick(apiKey), 5000);
}

function stopSimulation() {
  if (!running) return;
  running = false;

  clearInterval(simInterval);
  clearInterval(clockInterval);

  agents.forEach(a => {
    a.hideBubble();
    a.setState('idle');
  });

  setStatus(false);
  log('system', '■ Agency closed for the day.', 'system');
}

async function triggerAllThoughts() {
  if (!agents.length) return;
  const apiKey = document.getElementById('apiKey').value.trim();
  log('system', '⚡ Forcing team brainstorm...', 'system');
  for (const agent of agents) {
    const delay = agents.indexOf(agent) * 1200;
    setTimeout(async () => {
      maybeMove(agent);
      await agentThink(agent, apiKey, true);
    }, delay);
  }
}

// ── UI HELPERS ─────────────────────────────────────────────────
function setStatus(active) {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  dot.className = 'status-dot' + (active ? ' active' : '');
  txt.textContent = active ? 'LIVE' : 'OFFLINE';

  document.getElementById('btnStart').disabled = active;
  document.getElementById('btnStop').disabled = !active;
  document.getElementById('btnThink').disabled = !active;
}

function log(who, msg, role) {
  const feed = document.getElementById('logFeed');
  const entry = document.createElement('div');
  entry.className = `log-entry ${role || 'system'}`;

  const whoEl = document.createElement('span');
  whoEl.className = 'log-who';
  whoEl.textContent = who.toUpperCase().slice(0, 6);

  const msgEl = document.createElement('span');
  msgEl.className = 'log-msg';
  msgEl.textContent = msg;

  entry.appendChild(whoEl);
  entry.appendChild(msgEl);
  feed.insertBefore(entry, feed.firstChild);

  // Keep log manageable
  while (feed.children.length > 60) {
    feed.removeChild(feed.lastChild);
  }
}

// ── UTILITIES ──────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeText(el, text, speed = 30) {
  el.textContent = '';
  for (const char of text) {
    el.textContent += char;
    await sleep(speed);
    if (!running && !el.textContent) break; // abort if stopped
  }
}

// ── CLOCK INIT ─────────────────────────────────────────────────
(function initWallClock() {
  // Show real time on clock hand
  const now = new Date();
  const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const degrees = (seconds / 60) * 360;
  document.getElementById('clockHand').style.transform = `rotate(${degrees}deg)`;
})();

// ── INITIAL LOG ─────────────────────────────────────────────────
log('system', 'Enter API key (or skip for demo), pick a project, and hit START.', 'system');
