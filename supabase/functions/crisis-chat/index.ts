// Edge Function del Modo Crisis: arma el system prompt peruano y devuelve la respuesta de GPT-4o.
import { createClient } from 'npm:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o';

const FREE_MONTHLY_SESSIONS = 5;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ChatRole = 'user' | 'assistant';
interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface CrisisChatRequest {
  messages: ChatMessage[];
  /** true en el primer mensaje de una crisis: cuenta una sesión. */
  newSession?: boolean;
  /** BCP 47 del cliente; cae al locale del perfil si no viene. */
  locale?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface PriorEpisode {
  severity?: string;
  symptoms?: string[];
  techniques?: { name: string; effective: boolean }[];
  outcome?: string;
  hr?: { avg: number; min: number; max: number } | null;
}

// Resume los últimos episodios en patrones (síntomas, técnicas, BPM) para el system prompt.
function buildEpisodeContext(episodes: PriorEpisode[], lang: 'es' | 'en'): string {
  if (!episodes || episodes.length === 0) return '';

  const sympCount: Record<string, number> = {};
  const techYes: Record<string, number> = {};
  const techNo: Record<string, number> = {};
  let hrMin = Infinity, hrMax = 0, hrSeen = false;

  for (const e of episodes) {
    for (const s of e.symptoms ?? []) sympCount[s] = (sympCount[s] ?? 0) + 1;
    for (const tk of e.techniques ?? []) {
      const bucket = tk.effective ? techYes : techNo;
      bucket[tk.name] = (bucket[tk.name] ?? 0) + 1;
    }
    if (e.hr) { hrSeen = true; hrMin = Math.min(hrMin, e.hr.min); hrMax = Math.max(hrMax, e.hr.max); }
  }

  const topSymptoms = Object.entries(sympCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s);
  const worked = Object.keys(techYes);
  const notWorked = Object.keys(techNo).filter((n) => !techYes[n]);

  const lines: string[] = [];
  if (lang === 'en') {
    lines.push(`CONTEXT FROM PAST EPISODES (use it to personalize and spot patterns; weave it in naturally, never read it out robotically). Based on the last ${episodes.length} episode(s):`);
    if (topSymptoms.length) lines.push(`- Frequent symptoms: ${topSymptoms.join(', ')}.`);
    if (worked.length) lines.push(`- Techniques that worked before (PRIORITIZE them): ${worked.join(', ')}.`);
    if (notWorked.length) lines.push(`- Techniques that did NOT help (use them only as a last resort): ${notWorked.join(', ')}.`);
    if (hrSeen) lines.push(`- Typical heart rate during their crises: about ${Math.round(hrMin)}-${Math.round(hrMax)} bpm.`);
  } else {
    lines.push(`CONTEXTO DE EPISODIOS PREVIOS (úsalo para personalizar y reconocer patrones; intégralo con naturalidad, nunca lo recites como robot). Basado en los últimos ${episodes.length} episodio(s):`);
    if (topSymptoms.length) lines.push(`- Síntomas frecuentes: ${topSymptoms.join(', ')}.`);
    if (worked.length) lines.push(`- Técnicas que le funcionaron antes (PRIORÍZALAS): ${worked.join(', ')}.`);
    if (notWorked.length) lines.push(`- Técnicas que NO mostraron mejoría (úsalas solo como último recurso): ${notWorked.join(', ')}.`);
    if (hrSeen) lines.push(`- BPM típico en sus crisis: alrededor de ${Math.round(hrMin)}-${Math.round(hrMax)} bpm.`);
  }
  return lines.length > 1 ? lines.join('\n') : '';
}
//contruir el prom
function buildSystemPrompt(
  symptoms: string[],
  lang: 'es' | 'en',
  person: { name: string | null; gender: string | null },
  hasEmergencyContact: boolean,
  emergencyContactName: string | null,
  recentContext: string,
): string {
  const symptomsLine = symptoms.length
    ? `Síntomas que esta persona suele sentir durante sus crisis: ${symptoms.join(', ')}.`
    : 'Esta persona aún no registró sus síntomas habituales.';

  const genderEs: Record<string, string> = {
    female: 'se identifica como mujer', male: 'se identifica como hombre',
    nonbinary: 'se identifica como persona no binaria', prefer_not: '',
  };
  const genderEn: Record<string, string> = {
    female: 'identifies as a woman', male: 'identifies as a man',
    nonbinary: 'identifies as non-binary', prefer_not: '',
  };
  const personEs = [
    person.name ? `La persona se llama ${person.name}; úsalo con naturalidad para dar cercanía (sin repetirlo en exceso).` : '',
    person.gender && genderEs[person.gender] ? `La persona ${genderEs[person.gender]}; usa concordancia de género apropiada.` : '',
  ].filter(Boolean).join(' ');
  const personEn = [
    person.name ? `The person's name is ${person.name}; use it naturally for warmth (without overusing it).` : '',
    person.gender && genderEn[person.gender] ? `The person ${genderEn[person.gender]}.` : '',
  ].filter(Boolean).join(' ');

  // La IA añade un marcador [[REFERRAL:code]] al final; el servidor lo extrae y nunca llega al usuario.
  const contactLineEn = hasEmergencyContact
    ? `- The person wants to call their trusted emergency contact${emergencyContactName ? ` (${emergencyContactName})` : ''} → [[REFERRAL:contact]].`
    : '';
  const contactLineEs = hasEmergencyContact
    ? `- La persona quiere llamar a su contacto de emergencia de confianza${emergencyContactName ? ` (${emergencyContactName})` : ''} → [[REFERRAL:contact]].`
    : '';

  const referralRulesEn = [
    'REFERRAL PROTOCOL — whenever a situation matches (including when the person ASKS to call a line), append EXACTLY ONE marker on its own line at the very end of your message. Whenever you mention a number/line in your reply, you MUST also append its marker:',
    '- Severe crisis, self-harm or suicidal ideation → [[REFERRAL:113]] (Peru mental-health line 113, option 5).',
    '- Signs of a medical emergency, or the person asks for medical help → [[REFERRAL:106]] (SAMU).',
    '- The crisis is tied to family or domestic violence → [[REFERRAL:100]] (Línea 100).',
    contactLineEn,
    'You CANNOT make phone calls yourself — NEVER say that you will call or dial a number for them. When you append a marker, a tappable call button appears below your message; invite the person to tap it, e.g. "If you want, tap the button below to call line 113." Do NOT add a marker for an ordinary panic attack with no line mentioned. Never write the marker text inside your spoken sentences — let it stand alone at the end.',
  ];
  const referralRulesEs = [
    'PROTOCOLO DE DERIVACIÓN — siempre que la situación lo amerite (incluido cuando la persona PIDA llamar a una línea), añade EXACTAMENTE UN marcador en su propia línea al final de tu mensaje. Cada vez que menciones un número/línea en tu respuesta, DEBES añadir su marcador:',
    '- Crisis severa, autolesión o ideación suicida → [[REFERRAL:113]] (Línea 113 opción 5 del MINSA, salud mental).',
    '- Señales de emergencia médica, o si la persona pide ayuda médica → [[REFERRAL:106]] (SAMU).',
    '- La crisis está ligada a violencia familiar o doméstica → [[REFERRAL:100]] (Línea 100).',
    contactLineEs,
    'TÚ NO puedes hacer llamadas — NUNCA digas que vas a marcar o llamar por la persona. Cuando añadas un marcador, debajo de tu mensaje aparece un botón de llamada que la persona puede tocar; invítala a tocarlo, por ejemplo "Si quieres, toca el botón de abajo para llamar a la Línea 113." NO agregues marcador para un ataque de pánico común sin línea mencionada. Nunca escribas el texto del marcador dentro de tus frases: déjalo solo al final.',
  ];

  if (lang === 'en') {
    const en = symptoms.length
      ? `Symptoms this person usually feels during their attacks: ${symptoms.join(', ')}.`
      : 'This person has not registered their usual symptoms yet.';
    return [
      'You are PanicAI, an empathetic companion that supports adults in Lima, Peru, DURING a panic attack, in real time.',
      'CRITICAL: Reply in the SAME language the person uses in each message — if they write in Spanish, reply in Spanish; if in English, reply in English. Match their language every time.',
      personEn,
      en,
      recentContext,
      'Your goals, in order: (1) help them feel they are not alone, (2) guide their breathing and grounding, (3) calmly assess whether they are improving or worsening.',
      'Style: warm, close, Peruvian Spanish/English, short sentences. The person is panicking — keep replies brief (2-4 sentences), one instruction at a time. Never lecture.',
      'Validated techniques you may guide: 4-7-8 breathing, 5-4-3-2-1 grounding, naming what they feel. Adapt to what works for them.',
      'COMPLETE every exercise fully before moving on. In 5-4-3-2-1 grounding guide through all five senses/counts; if the person only names some (e.g. 3 of 5 things), warmly ask for the rest instead of treating it as done. In 4-7-8 breathing complete the cycle. Only acknowledge an exercise as helpful once it is actually finished.',
      'When you START guiding a breathing exercise, append a marker on its own line at the very end of that message to launch an on-screen breathing animation with haptics: [[BREATHING:478]] for 4-7-8 (calming), [[BREATHING:box]] for box breathing (4-4-4-4), or [[BREATHING:calm]] for simple 4-6 breathing. Pick the one you are guiding. Add it ONLY when you actually begin the exercise, not when merely mentioning it.',
      'You are NOT a doctor and do not diagnose.',
      ...referralRulesEn,
      'Never invent Peruvian resources beyond: Línea 113 opción 5 (mental health), SAMU 106 (medical emergency), Línea 100 (family violence).',
    ].filter(Boolean).join('\n');
  }

  return [
    'Eres PanicAI, un acompañante empático que asiste a adultos de Lima, Perú, DURANTE un ataque de pánico, en tiempo real.',
    'CRÍTICO: Responde en el MISMO idioma en que la persona escribe cada mensaje — si escribe en español, responde en español; si escribe en inglés, responde en inglés. Acompasa su idioma siempre.',
    personEs,
    symptomsLine,
    recentContext,
    'Tus objetivos, en orden: (1) que sienta que no está solo/a, (2) guiar su respiración y anclaje (grounding), (3) evaluar con calma si está mejorando o empeorando.',
    'Estilo: cálido, cercano, español peruano natural (sin caer en exceso de jerga), frases cortas. La persona está en pánico: respuestas BREVES (2 a 4 frases), una sola indicación a la vez. Nunca sermonees.',
    'Técnicas validadas que puedes guiar: respiración 4-7-8, anclaje 5-4-3-2-1, nombrar lo que siente. Adáptate a lo que le funcione.',
    'COMPLETA cada ejercicio del todo antes de avanzar. En el anclaje 5-4-3-2-1 guía por los cinco sentidos/conteos; si la persona solo nombra algunos (p. ej. 3 de 5 cosas), invítala con calidez a completar el resto en vez de darlo por hecho. En la respiración 4-7-8 completa el ciclo. Solo reconoce un ejercicio como útil cuando realmente se terminó.',
    'Cuando INICIES un ejercicio de respiración, añade un marcador en su propia línea al final de ese mensaje para lanzar una animación de respiración en pantalla con vibración: [[BREATHING:478]] para 4-7-8 (relajante), [[BREATHING:box]] para respiración cuadrada (4-4-4-4), o [[BREATHING:calm]] para respiración simple 4-6. Elige la que estás guiando. Agrégalo SOLO cuando realmente empieces el ejercicio, no al solo mencionarlo.',
    'NO eres médico y no diagnosticas.',
    'Reconoce desencadenantes peruanos comunes (inseguridad, sismos, tráfico de Lima, presión económica) cuando la persona los mencione.',
    ...referralRulesEs,
    'Nunca inventes recursos peruanos más allá de: Línea 113 opción 5 (salud mental), SAMU 106 (emergencia médica), Línea 100 (violencia familiar).',
  ].filter(Boolean).join('\n');
}

// Extrae el marcador [[REFERRAL:code]]; si no vino pero el texto menciona una línea, lo infiere.
function extractReferral(
  reply: string,
  hasEmergencyContact: boolean,
): { text: string; referral: string | null } {
  const re = /\[\[\s*REFERRAL\s*:\s*(113|106|100|contact)\s*\]\]/i;
  const match = reply.match(re);
  let referral = match ? match[1].toLowerCase() : null;
  let text = reply.replace(re, '').trim();

  // Fallback por prioridad: 113 (salud mental) > 106 (SAMU) > 100 (violencia).
  if (!referral) {
    if (/\b113\b/.test(text)) referral = '113';
    else if (/\b106\b/.test(text) || /\bSAMU\b/i.test(text)) referral = '106';
    else if (/l[íi]nea\s*100\b/i.test(text) || /\b100\b/.test(text)) referral = '100';
  }

  if (referral === 'contact' && !hasEmergencyContact) referral = null;

  return { text, referral };
}

// Extrae [[BREATHING]] o [[BREATHING:478|box|calm]] (default 478) que activa la guía en la app.
function extractBreathing(reply: string): { text: string; breathing: string | null } {
  const re = /\[\[\s*BREATHING(?::\s*(478|box|calm))?\s*\]\]/i;
  const match = reply.match(re);
  const breathing = match ? (match[1]?.toLowerCase() ?? '478') : null;
  const text = reply.replace(re, '').trim();
  return { text, breathing };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not configured');
    return json({ error: 'server_misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  // Cliente con el JWT del usuario para que RLS aplique como ese usuario.
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  let body: CrisisChatRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) return json({ error: 'empty_messages' }, 400);
  for (const m of messages) {
    if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      return json({ error: 'invalid_messages' }, 400);
    }
  }
  const trimmedMessages = messages.slice(-20);

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, locale, display_name, gender, emergency_contact_name, emergency_contact_phone')
    .eq('id', userId)
    .maybeSingle();

  const emergencyContactName = (profile?.emergency_contact_name as string) ?? null;
  const emergencyContactPhone = (profile?.emergency_contact_phone as string) ?? null;
  const hasEmergencyContact = !!emergencyContactPhone;

  const plan = (profile?.plan as string) ?? 'free';
  const localeRaw = body.locale ?? profile?.locale ?? 'es-PE';
  const lang: 'es' | 'en' = localeRaw.startsWith('en') ? 'en' : 'es';

  // Cap mensual: solo en el primer mensaje de la sesión y solo plan Free.
  if (body.newSession && plan !== 'plus') {
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    const period = periodStart.toISOString().slice(0, 10);

    const { data: usage } = await supabase
      .from('ai_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('period', period)
      .maybeSingle();

    const used = usage?.count ?? 0;
    if (used >= FREE_MONTHLY_SESSIONS) {
      return json({ error: 'rate_limited', limit: FREE_MONTHLY_SESSIONS, used }, 429);
    }

    // No bloqueamos el chat si el upsert falla, solo lo logueamos.
    const { error: upsertErr } = await supabase
      .from('ai_usage')
      .upsert(
        { user_id: userId, period, count: used + 1, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,period' },
      );
    if (upsertErr) console.error('ai_usage upsert error', upsertErr);
  }

  const { data: userSymptoms } = await supabase
    .from('user_symptoms')
    .select('custom_label, symptoms(names)')
    .eq('user_id', userId);

  const symptomNames: string[] = [];
  for (const row of userSymptoms ?? []) {
    const r = row as { custom_label: string | null; symptoms: { names: Record<string, string> } | null };
    if (r.custom_label) {
      symptomNames.push(r.custom_label);
    } else if (r.symptoms?.names) {
      symptomNames.push(r.symptoms.names[lang] ?? r.symptoms.names.es ?? '');
    }
  }
  const cleanSymptoms = symptomNames.filter(Boolean);

  // Últimos 5 episodios como contexto de patrones para personalizar la atención.
  const { data: priorEpisodes } = await supabase
    .from('episodes')
    .select('severity, symptoms, techniques, outcome, hr')
    .order('started_at', { ascending: false })
    .limit(5);
  const recentContext = buildEpisodeContext((priorEpisodes ?? []) as PriorEpisode[], lang);

  const systemPrompt = buildSystemPrompt(
    cleanSymptoms,
    lang,
    {
      name: (profile?.display_name as string) ?? null,
      gender: (profile?.gender as string) ?? null,
    },
    hasEmergencyContact,
    emergencyContactName,
    recentContext,
  );

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
          { role: 'system', content: systemPrompt },
          ...trimmedMessages,
        ],
        temperature: 0.7,
        max_tokens: 300,
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
  const reply: string | undefined = completion?.choices?.[0]?.message?.content;

  // Solo metadata (tokens/latencia): nunca logueamos el contenido de la conversación.
  const u = completion?.usage ?? {};
  console.log(`crisis-chat | model=${OPENAI_MODEL} | in=${u.prompt_tokens ?? '?'} out=${u.completion_tokens ?? '?'} total=${u.total_tokens ?? '?'} | ${Date.now() - startedAt}ms`);

  if (!reply) return json({ error: 'ai_empty' }, 502);

  const { text, referral } = extractReferral(reply, hasEmergencyContact);
  const { text: cleanText, breathing } = extractBreathing(text);

  const contact = referral === 'contact'
    ? { name: emergencyContactName, phone: emergencyContactPhone }
    : null;

  return json({ reply: cleanText, referral, contact, breathing });
});
