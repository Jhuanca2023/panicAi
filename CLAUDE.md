# PanicAI

App móvil con IA para el acompañamiento personalizado y seguimiento de ataques de pánico en adultos de Lima Metropolitana. Proyecto de tesis (Cibertec) con visión de producto comercial.

## ¿Qué es PanicAI?

PanicAI brinda **acompañamiento inmediato durante un ataque de pánico**: el usuario presiona una sola vez el botón de "Modo Crisis" y una IA conversacional lo acompaña por voz (hands-free) aplicando técnicas terapéuticas validadas, evalúa su estado en tiempo real, y deriva a recursos de salud reales del Perú cuando es necesario. Registra cada episodio para personalizar el acompañamiento futuro.

Su diferencial frente a competidores internacionales (Rootd, Yana, Wysa) es la **hiperlocalización al contexto peruano**: idioma y modismos locales, líneas de emergencia peruanas (113 opción 5, SAMU 106, Línea 100), mapa de Centros de Salud Mental Comunitarios (CSMC), y reconocimiento de desencadenantes locales (inseguridad, sismos, tráfico de Lima).

## Modelo de negocio

- **Tipo:** App móvil freemium
- **Mercado inicial:** Lima Metropolitana, Perú
- **Monetización:** Plan Free (5 sesiones IA/mes) + Plan Plus S/. 19.90/mes (sesiones ilimitadas). Pago con Yape/Plin.
- **Roadmap (fuera de tesis):** Premium/Premium+ con OpenAI Realtime API (voz bidireccional).

| Feature | Free | Plus |
|---|---|---|
| Sesiones de IA | 5/mes | Ilimitadas |
| Modo Crisis hands-free (voz a texto) | ✓ | ✓ |
| Historial de episodios | ✓ | ✓ |

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| Frontend / App | Expo + React Native + TypeScript |
| Navegación | Expo Router (file-based) |
| Auth | Supabase Auth (email + Google) |
| Base de datos | Supabase (PostgreSQL) + RLS |
| Storage | Supabase Storage (avatares) |
| i18n | expo-localization + i18next + react-i18next (es / en) |
| Package manager | pnpm (`node-linker=hoisted`) |
| IA conversacional (roadmap) | OpenAI Whisper (STT) + GPT-4o + VAD local + TTS del SO |
| Backend IA (roadmap) | Supabase Edge Functions |
| Biométricos (roadmap) | HealthKit / Health Connect (BPM de smartwatch) |

> El stack base (Supabase + Expo + Auth + perfil) está espejado del proyecto hermano **groci-app** para no reinventar la rueda.

## Arquitectura del repo

```
panicAI/
├── CLAUDE.md
├── app.json · eas.json · tsconfig.json · .npmrc
├── .env(.example)          ← EXPO_PUBLIC_SUPABASE_* y GOOGLE_WEB_CLIENT_ID
├── app/                    ← Expo Router (file-based)
│   ├── _layout.tsx         ← providers + gating de auth
│   ├── index.tsx           ← redirect a (tabs)
│   ├── (auth)/             ← login, register (email + Google)
│   ├── onboarding.tsx      ← bienvenida → síntomas → permiso de micrófono
│   ├── crisis.tsx          ← Modo Crisis: chat de texto con la IA (fullScreenModal)
│   └── (tabs)/             ← index (botón de pánico) · perfil
├── components/             ← ConfirmModal, GoogleLogo, Snackbar, SymptomSelector
├── hooks/                  ← useAuth, useProfile, useSymptoms, useTheme, useSnackbar
├── lib/                    ← supabase, oauth, authErrors, theme, crisisChat
├── i18n/                   ← index + locales/{es,en}.json
└── supabase/
    ├── migrations/         ← 0001 profiles · 0002 avatars · 0003 delete · 0004 symptoms · 0005 ai_usage
    └── functions/          ← crisis-chat (Edge Function: system prompt peruano + GPT-4o + derivación)
```

**Onboarding (4 pasos):** bienvenida → sobre ti (nombre + género, opcionales) → síntomas → permiso de micrófono. Nombre y género se inyectan en el system prompt para personalizar el trato.

## Modelo de datos (actual)

| Entidad | Descripción |
|---|---|
| `profiles` | Extiende `auth.users`. `display_name`, `avatar_url`, `locale`, `gender` (opcional), `plan` (free/plus), `has_completed_onboarding`. Se crea por trigger en el signup. |
| `symptoms` | Catálogo preset de síntomas (DSM-5), `key` + `names` jsonb (es/en) + `category`. Lectura pública. |
| `user_symptoms` | Síntomas habituales del usuario: FK a `symptoms` (preset) **o** `custom_label` (texto libre). RLS dueño. |
| `ai_usage` | Uso de sesiones de IA por (user_id, period mensual). Cap del plan Free (5/mes); Plus ilimitado. |

**Onboarding:** se dispara en el primer login **o** cuando el usuario no tiene síntomas registrados (gate en `app/_layout.tsx`: `!has_completed_onboarding || userSymptoms.length === 0`). Los síntomas se editan/agregan/eliminan también desde el perfil (mismo `SymptomSelector`, persistencia en vivo vía `useSymptoms`).

## Modo Crisis (Fase A — chat de texto)

- **Arquitectura (del Documento Técnico):** la app NUNCA tiene la key de OpenAI. `app/crisis.tsx` → `lib/crisisChat.ts` → Edge Function `crisis-chat` → GPT-4o. La key vive como secreto del servidor (`OPENAI_API_KEY`).
- **System prompt** hiperlocalizado (peruano) armado en el servidor, inyectando los síntomas del usuario. Reglas: tono cercano, frases cortas, técnicas 4-7-8 / 5-4-3-2-1, derivación a Línea 113 op.5 / SAMU 106 / Línea 100, no diagnostica.
- **Sesión = una crisis completa.** El primer mensaje (`newSession: true`) verifica e incrementa el cap mensual del plan Free.
- **Modelo configurable** por secreto `OPENAI_MODEL` (default `gpt-4o`). `OPENAI_API_KEY` ya seteada; función desplegada.
- **Derivación inteligente (Fase C):** la IA emite un marcador `[[REFERRAL:113|106|100]]` al final cuando detecta crisis severa / emergencia médica / violencia familiar. El servidor lo extrae (`extractReferral`) y devuelve `referral` aparte; `app/crisis.tsx` muestra una tarjeta de llamada destacada (tel:). Líneas en `lib/emergencyLines.ts`.

**Pendiente (roadmap):** voz hands-free (VAD + Whisper STT + TTS), `episodes` (historial de crisis), `emergency_contacts`, `health_resources` (mapa CSMC).

## i18n

UI multi-idioma desde el día uno (es base, en). Sin strings hardcodeados: todo en `i18n/locales/`. El idioma se sincroniza con `profiles.locale` (BCP 47, default `es-PE`).

## Setup local

1. `pnpm install`
2. Crear proyecto en [supabase.com](https://supabase.com) y correr las migraciones de `supabase/migrations/` (en orden).
3. Copiar `.env.example` → `.env` y rellenar `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
4. Configurar el provider de Google en Supabase Auth (mismo Web Client ID).
5. `pnpm start` (requiere dev client / `expo prebuild` por los módulos nativos: google-signin).

## Alcance del MVP de tesis (prioridad)

**Alta:** Modo Crisis hands-free (botón de pánico + voz) · IA con lenguaje peruano (system prompt) · botón Línea 113 · perfil de síntomas + historial de episodios.
**Si el tiempo lo permite:** mapa básico de 5–10 CSMC de Lima · 2–3 desencadenantes locales.
**Roadmap (no en tesis):** mapa completo de los 433 CSMC · quechua · Realtime API.

## Documentos fuente

Los `.docx`/`.xlsx` en la raíz contienen el desarrollo conceptual: informe de proyecto, documento técnico (arquitectura hands-free), análisis financiero (planes y precios), y estrategia de nacionalización (hiperlocalización).
