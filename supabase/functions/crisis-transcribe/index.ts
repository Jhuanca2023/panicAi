// Edge Function que transcribe el audio del Modo Crisis con OpenAI Whisper.
import { createClient } from 'npm:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const WHISPER_MODEL = Deno.env.get('WHISPER_MODEL') ?? 'whisper-1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const file = form.get('file');

  if (!(file instanceof File) && !(file instanceof Blob)) {
    return json({ error: 'no_audio' }, 400);
  }

  // Forzar el idioma evita que Whisper alucine transcripciones en otros idiomas sobre silencio/ruido.
  const localeRaw = (form.get('locale') as string) ?? 'es-PE';
  const lang = localeRaw.startsWith('en') ? 'en' : 'es';

  const whisperForm = new FormData();
  whisperForm.append('file', file, 'audio.m4a');
  whisperForm.append('model', WHISPER_MODEL);
  whisperForm.append('language', lang);
  // verbose_json trae duración + no_speech_prob/avg_logprob para descartar alucinaciones sobre silencio.
  whisperForm.append('response_format', 'verbose_json');

  const startedAt = Date.now();
  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: whisperForm,
    });
  } catch (e) {
    console.error('Whisper fetch failed', e);
    return json({ error: 'stt_unavailable' }, 502);
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Whisper returned ${res.status}: ${errText}`);
    return json({ error: 'stt_failed', status: res.status }, 502);
  }

  const data = await res.json();

  // Anti-alucinación: audio muy corto o con alta probabilidad de "sin voz" devuelve vacío.
  const duration: number = data?.duration ?? 0;
  const segments: { no_speech_prob?: number; avg_logprob?: number }[] = data?.segments ?? [];
  const avgNoSpeech = segments.length
    ? segments.reduce((a, s) => a + (s.no_speech_prob ?? 0), 0) / segments.length
    : 0;
  const avgLogprob = segments.length
    ? segments.reduce((a, s) => a + (s.avg_logprob ?? 0), 0) / segments.length
    : 0;

  const text = (data?.text ?? '').trim();
  const isLikelySilence =
    duration < 0.4 || avgNoSpeech > 0.7 || (avgLogprob !== 0 && avgLogprob < -1.0);

  // Solo metadata: nunca logueamos el texto transcrito (dato sensible).
  console.log(`crisis-transcribe | model=${WHISPER_MODEL} | audio=${duration}s | noSpeech=${avgNoSpeech.toFixed(2)} logprob=${avgLogprob.toFixed(2)} | discard=${isLikelySilence} | ${Date.now() - startedAt}ms`);

  return json({ text: isLikelySilence ? '' : text });
});
