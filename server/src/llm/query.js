import { buildLlmContext } from '../services/orgs.js';

const SYSTEM_PROMPT = `You are the FieldPulse operations analyst for HQ 6 Armoured Division.
Answer using only the provided ORBAT, equipment holdings, and recent events.
Be precise with numbers and unit names. Prefer short structured answers.
If data is insufficient, say what is missing.
Do not invent classified details beyond the provided synthetic dataset.`;

function buildUserPrompt(question, ctx) {
  return [
    `Question: ${question}`,
    `Division: ${JSON.stringify(ctx.division)}`,
    `Formations: ${JSON.stringify(ctx.formations)}`,
    `Battalions: ${JSON.stringify(ctx.battalions)}`,
    `Equipment: ${JSON.stringify(ctx.equipment)}`,
    `Events: ${JSON.stringify(ctx.recent_events)}`,
  ].join('\n');
}

function summariseLocally(question, ctx) {
  const q = question.toLowerCase();
  const armour = (ctx.equipment || []).filter((e) => e.category === 'MBT' || e.category === 'APC');
  const bridges = (ctx.equipment || []).filter((e) => e.category === 'Bridging');
  const lowReady = (ctx.formations || [])
    .filter((o) => o.org_level === 'brigade' || o.org_level === 'group')
    .sort((a, b) => a.readiness_pct - b.readiness_pct)
    .slice(0, 5);

  if (q.includes('tank') || q.includes('mbt') || q.includes('armour') || q.includes('apc')) {
    const mbt = armour.filter((e) => e.category === 'MBT');
    const apc = armour.filter((e) => e.category === 'APC');
    const mbtSvc = mbt.reduce((s, e) => s + e.serviceable, 0);
    const mbtHeld = mbt.reduce((s, e) => s + e.held, 0);
    const apcSvc = apc.reduce((s, e) => s + e.serviceable, 0);
    return {
      mode: 'rules',
      provider: 'Rules engine',
      model: null,
      answer: `Across 6 Armd Div holdings: MBT serviceable ${mbtSvc}/${mbtHeld}; APC serviceable ${apcSvc}. Primary types: VT-4/Haider, Al-Khalid-I, M113/Talha/VCC family.`,
      sources: [
        { label: 'MBT types', detail: `${mbt.length} nomenclature rows in holdings` },
        { label: 'APC types', detail: `${apc.length} nomenclature rows in holdings` },
      ],
      evidence_rows: [...mbt, ...apc.slice(0, 8)].map((r) => ({
        category: r.category,
        item: r.nomenclature,
        held: r.held,
        serviceable: r.serviceable,
        deployed: r.deployed,
      })),
    };
  }

  if (q.includes('bridge') || q.includes('engineer')) {
    const svc = bridges.reduce((s, e) => s + e.serviceable, 0);
    const held = bridges.reduce((s, e) => s + e.held, 0);
    return {
      mode: 'rules',
      provider: 'Rules engine',
      model: null,
      answer: `Engineer bridging assets serviceable ${svc}/${held} (Type 79A ribbon, AVLB, AM 50B). See 313/314 Assault Engineers under Div Troops.`,
      sources: [{ label: 'Bridging', detail: `${bridges.length} bridging equipment types` }],
      evidence_rows: bridges.map((r) => ({
        category: r.category,
        item: r.nomenclature,
        held: r.held,
        serviceable: r.serviceable,
        deployed: r.deployed,
      })),
    };
  }

  if (q.includes('signal') || q.includes('comms') || q.includes('communication') || q.includes('satcom')) {
    const sig = (ctx.equipment || []).filter((e) => e.category === 'C2' || e.category === 'EW');
    return {
      mode: 'rules',
      provider: 'Rules engine',
      model: null,
      answer: `Signals/C2 picture from equipment totals: ${sig.map((s) => `${s.nomenclature} svc ${s.serviceable}/${s.held}`).join('; ') || 'no C2 rows'}.`,
      sources: [{ label: 'C2 / EW', detail: `${sig.length} communications-related types` }],
      evidence_rows: sig.map((r) => ({
        category: r.category,
        item: r.nomenclature,
        held: r.held,
        serviceable: r.serviceable,
        deployed: r.deployed,
      })),
    };
  }

  if (q.includes('readiness') || q.includes('lowest') || q.includes('weak')) {
    return {
      mode: 'rules',
      provider: 'Rules engine',
      model: null,
      answer: `Lowest readiness formations: ${lowReady
        .map((o) => `${o.short_name} (${Math.round(o.readiness_pct)}%)`)
        .join(', ')}. Division overall ${Math.round(ctx.division.readiness_pct)}%.`,
      sources: [{ label: 'Formations', detail: 'Sorted brigade / group readiness' }],
      evidence_rows: lowReady.map((o) => ({
        category: o.org_level,
        item: o.short_name,
        held: o.personnel_authorised,
        serviceable: o.personnel_present,
        deployed: o.readiness_pct,
      })),
    };
  }

  if (q.includes('wartime') || q.includes('mangla') || q.includes('8')) {
    const wartime = [...(ctx.formations || []), ...(ctx.battalions || [])].filter((o) => o.wartime_only);
    return {
      mode: 'rules',
      provider: 'Rules engine',
      model: null,
      answer: `Wartime/attached elements: ${wartime.map((o) => o.short_name).join(', ') || 'none'}. 8 Armd Bde Gp is Mangla-based and normally under corps control.`,
      sources: [{ label: 'Wartime ORBAT', detail: `${wartime.length} attached / wartime-flagged elements` }],
      evidence_rows: wartime.map((o) => ({
        category: o.arm || o.org_level || 'unit',
        item: o.short_name,
        held: '—',
        serviceable: '—',
        deployed: o.readiness_pct ?? '—',
      })),
    };
  }

  return {
    mode: 'rules',
    provider: 'Rules engine',
    model: null,
    answer:
      `6 Armd Div (${ctx.division.location}) readiness ${Math.round(ctx.division.readiness_pct)}%. ` +
      `${(ctx.formations || []).length} formations / ${(ctx.battalions || []).length} battalions loaded. ` +
      'Ask about tanks/APCs, bridging, signals/comms, readiness, or wartime attachments. Set GROQ_API_KEY for broader NL answers.',
    sources: [
      { label: 'Division', detail: `${ctx.division.code} · ${ctx.division.location}` },
      { label: 'Formations', detail: `${(ctx.formations || []).length} higher-level orgs` },
    ],
    evidence_rows: (ctx.formations || [])
      .filter((o) => o.org_level === 'brigade' || o.org_level === 'group')
      .map((o) => ({
        category: o.org_level,
        item: o.short_name,
        held: o.personnel_authorised,
        serviceable: o.personnel_present,
        deployed: o.readiness_pct,
      })),
  };
}

async function chatCompletions({ baseUrl, apiKey, model, question, ctx, mode }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(question, ctx) },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${mode} error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return {
    mode,
    model,
    provider: mode === 'groq' ? 'Groq' : mode === 'openai' ? 'OpenAI' : mode,
    answer: data.choices?.[0]?.message?.content?.trim() || 'No answer returned.',
    sources: [
      {
        label: 'Formations',
        detail: `${(ctx.formations || []).length} division / brigade / group records`,
      },
      {
        label: 'Battalions',
        detail: `${(ctx.battalions || []).length} unit readiness summaries`,
      },
      {
        label: 'Equipment',
        detail: `${(ctx.equipment || []).length} type totals (held / serviceable / deployed)`,
      },
      {
        label: 'Events',
        detail: `${(ctx.recent_events || []).length} recent operational notes`,
      },
    ],
  };
}

/** Groq free tier — OpenAI-compatible API. https://console.groq.com */
async function answerWithGroq(question, ctx) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  return chatCompletions({
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    apiKey,
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    question,
    ctx,
    mode: 'groq',
  });
}

/** Optional paid OpenAI fallback */
async function answerWithOpenAI(question, ctx) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  return chatCompletions({
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    question,
    ctx,
    mode: 'openai',
  });
}

export async function runOperatorQuery(question) {
  if (!question || typeof question !== 'string' || !question.trim()) {
    const err = new Error('question is required');
    err.status = 400;
    throw err;
  }

  const ctx = await buildLlmContext();
  if (!ctx) {
    const err = new Error('No division data seeded');
    err.status = 503;
    throw err;
  }

  const q = question.trim();

  try {
    const groq = await answerWithGroq(q, ctx);
    if (groq) return groq;
  } catch (err) {
    console.warn('Groq query failed:', err.message);
  }

  try {
    const openai = await answerWithOpenAI(q, ctx);
    if (openai) return openai;
  } catch (err) {
    console.warn('OpenAI query failed, falling back to rules:', err.message);
  }

  return summariseLocally(q, ctx);
}
