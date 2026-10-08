# Backlog — PanicAI

Tareas del proyecto, priorizadas. Fuente de verdad para el GitHub Project.
Las marcadas como ✅ ya están hechas; el resto son issues asignables.

**Leyenda de prioridad:**
- 🔴 `prioridad:alta` — núcleo del MVP de tesis
- 🟡 `prioridad:media` — diferenciador (si el tiempo lo permite)
- 🟢 `prioridad:producto` — calidad / pulido
- ⚙️ `infra` — equipo / tooling
- 🔵 `roadmap` — fuera del alcance de la tesis

**Leyenda de área** (para repartir entre frontend y backend):
- `area:backend` — Supabase: base de datos (migraciones, RLS), Edge Functions (Deno), OpenAI, secretos. No hay servidor aparte.
- `area:frontend` — app React Native / Expo (UI).

> El dev de backend filtra sus tareas con `label:area:backend`.
> **Tareas backend:** #1, #2 (Whisper STT), #4, #6 (tabla `health_resources`), #7, #14, #15, #17, #18, #19.
> **Orden sugerido (MVP):** #19 (acceso Supabase) → #1 → #4 → #7 → #2 → #6.

---

## ✅ Hecho

- Setup base (Expo + Supabase + pnpm), espejado de groci-app
- Auth: registro/login por email + Google (build nativo) + compatibilidad Expo Go
- Onboarding (bienvenida → sobre ti → síntomas → micrófono)
- Perfil de síntomas (catálogo DSM-5 + custom, editable desde perfil)
- Nombre + género opcionales (inyectados en el prompt)
- Modo Crisis — chat de texto con IA peruana (Fase A)
- Derivación inteligente a líneas peruanas 113/106/100 (Fase C)
- Contacto de emergencia (perfil + la IA puede ofrecer marcarlo)

---

## 🔴 MVP — Prioridad alta

### 1. Historial de episodios (Fase B)
Al cerrar una crisis, generar un resumen estructurado (GPT-4o-mini) y guardarlo.
- Migración: tabla `episodes` (user_id, started_at, ended_at, duration, severity, symptoms[], techniques[], outcome, summary).
- Edge Function: al finalizar, generar JSON del episodio a partir de la conversación.
- Pantalla Historial: lista de episodios + métricas (duración, técnicas que funcionaron).
- **Depende de:** Modo Crisis (hecho).

### 2. Voz hands-free (Fase D)
El usuario habla sin tocar la pantalla.
- VAD (detección de voz) — Picovoice o WebRTC VAD.
- Whisper STT (voz → texto) vía Edge Function.
- TTS del sistema (lectura de respuestas) — expo-speech.
- Indicador visual de micrófono pulsante + reactivación automática.
- **Nota:** la más compleja; va encima del chat ya funcional.

### 3. Cierre de sesión + heartbeats
- Botón "Ya estoy bien" para cerrar la crisis.
- Check-ins automáticos si el usuario no responde (3 / 6 / 9 min).
- A los 9 min sin respuesta, ofrecer llamar a Línea 113.

### 4. Evaluación continua del estado
- La IA evalúa en cada turno si el usuario mejora / estable / empeora.
- Si empeora, cambia de técnica; si mejora, inicia cierre suave.

### 5. Contador de sesiones restantes (plan Free)
- Mostrar "3 de 5 sesiones" en home / antes de iniciar crisis.
- Leer de `ai_usage` (ya existe).

---

## 🟡 MVP — Diferenciador (si el tiempo lo permite)

### 6. Mapa básico de CSMC de Lima
- 5–10 Centros de Salud Mental Comunitarios principales.
- Geolocalización + lista/mapa con horarios e indicaciones.

### 7. Reconocimiento de desencadenantes locales
- La IA reconoce inseguridad / sismos / tráfico de Lima / presión económica.
- Ampliar el system prompt (baja complejidad).

### 8. Pantalla de planes (Free vs Plus)
- Comparativa de planes + CTA a Plus (S/. 19.90).

---

## 🟢 Producto / calidad

### 9. Branding
- Logo, ícono de la app, splash screen.

### 10. Pantalla de Configuración
- Tema (claro/oscuro/sistema), preferencias de notificaciones.

### 11. Modo offline
- Técnicas precargadas (respiración 4-7-8, grounding 5-4-3-2-1) sin conexión.
- Detectar pérdida de red y sincronizar al volver.

---

## ⚙️ Infra / equipo

### 12. Push inicial del código al repo
- Subir todo el proyecto a GitHub (bloqueante para el equipo).

### 13. Definir flujo de ramas
- main protegida + feature branches + PRs con review.

---

## 🔵 Roadmap (fuera de tesis)

### 14. Pago Yape / Plin
### 15. Mapa completo de los 433 CSMC del Perú
### 16. Biométricos — HealthKit / Health Connect (BPM de smartwatch)
### 17. Voz bidireccional — OpenAI Realtime API (planes Premium)
### 18. Soporte en quechua

### 19. Detección de temblor/agitación (acelerómetro)
Idea: usar `expo-sensors` (acelerómetro) para medir cuánto se agita el teléfono
durante una crisis y pasar ese nivel (calmo / leve / fuerte) a la IA como señal
de contexto, para que reconozca con empatía el temblor de manos (síntoma común
de pánico) y personalice el acompañamiento.

⚠️ **Encuadre obligatorio:** se posiciona como *señal de agitación/temblor*, NO
como detección de convulsiones. Un acelerómetro **no puede** diagnosticar una
convulsión/crisis epiléptica (no distingue temblor de pánico, convulsión, o
agitar el teléfono). Afirmar lo contrario sería médicamente incorrecto y
riesgoso, y contradice el principio "la app no diagnostica". Las emergencias
médicas reales se manejan por la derivación a SAMU 106 ya existente.

Factible en Expo Go. Esfuerzo: medio (hook de sensor + nivel en el system prompt).
