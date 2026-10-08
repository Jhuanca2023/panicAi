// Edge Function que pide a GPT-4o-mini un resumen estructurado (JSON) del episodio al cerrar el Modo Crisis.
import { createClient } from 'npm:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUMMARY_MODEL = Deno.env.get('EPISODE_SUMMARY_MODEL') ?? 'gpt-4o-mini';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ChatRole = 'user' | 'assistant';
interface ChatMessage { role: ChatRole; content: string }

interface SummaryRequest {
  messages: ChatMessage[];
  hr?: { avg: number; min: number; max: number } | null;
  durationSec?: number;
  locale?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Saneo del objeto que devuelve el modelo, con defaults defensivos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitize(raw: any) {
  const severity = ['mild', 'moderate', 'severe'].includes(raw?.severity) ? raw.severity : 'moderate';
  const outcome = ['improved', 'same', 'escalated'].includes(raw?.outcome) ? raw.outcome : 'same';
  const symptoms = Array.isArray(raw?.symptoms)
    ? raw.symptoms.filter((s: unknown) => typeof s === 'string').slice(0, 12)
    : [];
  const techniques = Array.isArray(raw?.techniques)
    ? raw.techniques
        .filter((tk: unknown) => tk && typeof tk === 'object')
        .map((tk: { name?: unknown; effective?: unknown }) => ({
          name: typeof tk.name === 'string' ? tk.name : 'técnica',
          effective: !!tk.effective,
        }))
        .slice(0, 8)
    : [];
  const summary = typeof raw?.summary === 'string' ? raw.summary.trim().slice(0, 600) : '';
  return { severity, outcome, symptoms, techniques, summary };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not configured');
    return json({ error: 'server_misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);

  let body: SummaryRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) return json({ error: 'empty_messages' }, 400);

  const lang: 'es' | 'en' = (body.locale ?? 'es-PE').startsWith('en') ? 'en' : 'es';
  const hr = body.hr ?? null;

  const transcript = messages
    .slice(-40)
    .map((m) => `${m.role === 'user' ? 'Persona' : 'IA'}: ${m.content}`)
    .join('\n');

  const hrLine = hr
    ? `Datos de frecuencia cardíaca durante el episodio: promedio ${hr.avg} bpm, mínimo ${hr.min} bpm, máximo ${hr.max} bpm.`
    : 'No se registró frecuencia cardíaca (sin wearable).';

  const langInstruction = lang === 'en'
    ? 'Write "symptoms" and "summary" in English.'
    : 'Escribe "symptoms" y "summary" en español.';

  const systemPrompt = [
    'Eres un analista clínico que resume un episodio de ataque de pánico a partir de la conversación de acompañamiento.',
    'Devuelve EXCLUSIVAMENTE un objeto JSON válido con EXACTAMENTE estas claves:',
    '{',
    '  "severity": "mild" | "moderate" | "severe",',
    '  "symptoms": string[],            // síntomas que la persona mencionó (frases cortas)',
    '  "techniques": [ { "name": string, "effective": boolean } ],  // técnicas aplicadas (p.ej. "4-7-8 breathing", "5-4-3-2-1 grounding") y si ayudaron',
    '  "outcome": "improved" | "same" | "escalated",  // cómo terminó la persona',
    '  "summary": string                // 2-3 frases, tono cálido, en segunda persona',
    '}',
    'Reglas: básate SOLO en la conversación. Si una técnica se aplicó pero no se ve mejoría, marca effective=false. No inventes síntomas no mencionados. No incluyas claves extra ni texto fuera del JSON.',
    langInstruction,
  ].join('\n');

  const userContent = `Conversación del episodio:\n${transcript}\n\n${hrLine}`;

  const startedAt = Date.now();
  let openaiRes: Response;
  try {
    openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (e) {
    console.error('OpenAI fetch failed', e);
    return json({ error: 'ai_unavailable' }, 502);
  }

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    console.error(`OpenAI returned ${openaiRes.status}: ${errText}`);
    return json({ error: 'ai_failed', status: openaiRes.status }, 502);
  }

  const completion = await openaiRes.json();
  const content: string | undefined = completion?.choices?.[0]?.message?.content;

  // Solo metadata: nunca el contenido.
  const u = completion?.usage ?? {};
  console.log(`episode-summary | model=${SUMMARY_MODEL} | in=${u.prompt_tokens ?? '?'} out=${u.completion_tokens ?? '?'} total=${u.total_tokens ?? '?'} | ${Date.now() - startedAt}ms`);

  if (!content) return json({ error: 'ai_empty' }, 502);

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: 'ai_bad_json' }, 502);
  }

  return json(sanitize(parsed));
});
