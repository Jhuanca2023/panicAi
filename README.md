# PanicAI

App móvil con IA para el acompañamiento personalizado y seguimiento de ataques de pánico en adultos de Lima Metropolitana.

Acompañamiento inmediato durante una crisis mediante una IA conversacional **hands-free** (el usuario solo presiona el botón de pánico una vez y habla), con técnicas terapéuticas validadas, seguimiento de episodios y derivación a recursos de salud reales del Perú.

## Stack

Expo · React Native · TypeScript · Expo Router · Supabase (Auth + DB + Storage) · i18next (es/en) · pnpm.

## Setup

```bash
pnpm install
cp .env.example .env   # rellenar credenciales de Supabase + Google
pnpm start
```

1. Crear un proyecto en [supabase.com](https://supabase.com) y correr las migraciones de [supabase/migrations/](supabase/migrations/) en orden.
2. Rellenar `.env` con `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` y `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
3. Configurar el provider de Google en Supabase Auth.
