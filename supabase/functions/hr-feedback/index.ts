// Edge Function que genera un mensaje corto de apoyo a partir de las stats de FC del monitoreo continuo.
import { createClient } from 'npm:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
// gpt-4o-mini: mucho más barato que gpt-4o y sobra para un mensajito de apoyo.
const OPENAI_MODEL   = Deno.env.get('HR_FEEDBACK_MODEL') ?? 'gpt-4o-mini';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Trend = 'rising' | 'falling' | 'stable';

interface HRFeedbackRequest {
  avgBpm:  number;
  minBpm:  number;
  maxBpm:  number;
  trend:   Trend;
  locale?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function systemPrompt(lang: 'es' | 'en'): string {
  if (lang === 'en') {
    return [
      'You are PanicAI in heart-rate monitoring mode.',
      'Every few seconds you receive real-time heart-rate stats and reply with a SHORT warm message (max 2 sentences, ~20 words).',
      'Guidance by zone:',
      '  < 60 BPM  → acknowledge calm rest naturally',
      '  60–99 BPM → warmly confirm everything is fine',
      '  100–129   → gently note the rise, offer one quick breathing tip',
      '  130+      → empathetic and direct: remind the person they are not alone, suggest slow breathing',
      'Never use the raw numbers — say "your heart is calm", "I notice your rhythm rising a little".',
      'No diagnoses, no alarming language. Max 2 sentences.',
    ].join('\n');
  }

  return [
    'Eres PanicAI en modo monitoreo cardíaco.',
    'Cada pocos segundos recibes estadísticas de FC en tiempo real y respondes con un mensaje MUY CORTO y cálido (máximo 2 oraciones, ~20 palabras) en español peruano natural.',
    'Guía por zona:',
    '  < 60 BPM  → comenta con naturalidad que está descansando bien',
    '  60–99 BPM → reafirma con calidez que todo está bien',
    '  100–129   → nótalo suavemente, ofrece una micro-técnica de respiración',
    '  130+      → empático y directo: recuérdale que no está solo/a, sugiere respirar despacio',
    'Nunca uses los números exactos — di "tu corazón está tranquilo", "noto que tu ritmo sube un poco".',
    'Sin diagnósticos ni alarmar. Máximo 2 oraciones.',
  ].join('\n');
}

function userMessage(req: HRFeedbackRequest, lang: 'es' | 'en'): string {
  const trends = {
    es: { rising: 'subiendo', falling: 'bajando', stable: 'estable' },
    en: { rising: 'rising',   falling: 'falling', stable: 'stable'  },
  };
  const t = trends[lang][req.trend];
  if (lang === 'en') {
    return `Heart rate avg ${req.avgBpm} BPM (${req.minBpm}–${req.maxBpm}), trend: ${t}. Give me a short supportive message.`;
  }
  return `FC promedio ${req.avgBpm} BPM (${req.minBpm}–${req.maxBpm}), tendencia: ${t}. Dame un mensaje corto de apoyo.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  if (!OPENAI_API_KEY) return json({ error: 'server_misconfigured' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);

  let body: HRFeedbackRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  if (typeof body.avgBpm !== 'number') return json({ error: 'invalid_body' }, 400);

  const localeRaw = body.locale ?? 'es-PE';
  const lang: 'es' | 'en' = localeRaw.startsWith('en') ? 'en' : 'es';

  const startedAt = Date.now();
  let openaiRes: Response;
  try {
    openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system',  content: systemPrompt(lang) },
          { role: 'user',    content: userMessage(body, lang) },
        ],
        temperature: 0.75,
        max_tokens:  80,
      }),
    });
  } catch (e) {
    console.error('OpenAI fetch failed', e);
    return json({ error: 'ai_unavailable' }, 502);
  }

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    console.error(`OpenAI ${openaiRes.status}: ${errText}`);
    return json({ error: 'ai_failed' }, 502);
  }

  const completion = await openaiRes.json();
  const message: string | undefined = completion?.choices?.[0]?.message?.content;

  // Solo metadata: nunca logueamos el texto (dato de salud sensible).
  const u = completion?.usage ?? {};
  console.log(`hr-feedback | model=${OPENAI_MODEL} | in=${u.prompt_tokens ?? '?'} out=${u.completion_tokens ?? '?'} total=${u.total_tokens ?? '?'} | ${Date.now() - startedAt}ms`);

  if (!message) return json({ error: 'ai_empty' }, 502);

  return json({ message: message.trim() });
});
