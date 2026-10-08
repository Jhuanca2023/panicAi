# Guía de setup para el equipo — PanicAI

Cómo correr PanicAI de forma local en tu computadora y probarla en tu teléfono
con **Expo Go** (sin instalar Android Studio ni Xcode).

---

## 0. Requisitos previos (instalar una sola vez)

| Herramienta | Para qué | Cómo |
|---|---|---|
| **Node.js 20+** | correr JS | [nodejs.org](https://nodejs.org) o `nvm install 20` |
| **pnpm** | gestor de paquetes | `npm install -g pnpm` |
| **Git** | clonar el repo | ya lo tienes |
| **Expo Go** (en tu teléfono) | abrir la app | App Store / Play Store |

Verifica:

```bash
node -v    # v20 o superior
pnpm -v
```

> No necesitas Android Studio ni Xcode. Tu teléfono y tu computadora deben
> estar en la **misma red WiFi**.

---

## 1. Clonar el repo (si no lo hiciste)

```bash
git clone <URL-del-repo> panicAI
cd panicAI
```

## 2. Instalar dependencias

```bash
pnpm install
```

## 3. Configurar las credenciales (.env)

El archivo `.env` **no está en el repo** (tiene secretos). Pídeselo a Jesús por
un canal privado (NO por git/chat público) y créalo en la raíz:

```bash
cp .env.example .env
# luego pega los valores reales que te pasaron en .env
```

Tiene 3 variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Todos usamos el **mismo proyecto Supabase**,
así que comparten los mismos datos de prueba (no hay que tocar la base de datos).

## 4. Levantar el proyecto

```bash
pnpm start
```

Aparece un **QR** en la terminal. Ábrelo con **Expo Go**:
- **Android:** abre Expo Go → "Scan QR code" → escanea.
- **iOS:** abre la cámara → escanea el QR → "Abrir en Expo Go".

La app carga en tu teléfono con **Fast Refresh** (los cambios de código se ven
al instante). ¡Listo para desarrollar! 🎉

> Si el QR no conecta (redes con aislamiento de clientes, VPN, etc.), corre:
> `pnpm start --tunnel`

---

## Qué funciona en Expo Go

| Función | En Expo Go |
|---|---|
| Registro / Login con **email** | ✅ |
| **Modo Crisis** (chat con IA) | ✅ |
| Onboarding, perfil, síntomas, contacto de emergencia | ✅ |
| Permiso de micrófono | ✅ |
| Login con **Google** | ❌ — el botón se oculta en Expo Go *(ver nota)* |

> **Login con Google:** usa un módulo nativo que Expo Go no incluye, así que el
> botón **no aparece** en Expo Go. Para desarrollar usen **login con email**
> (funciona perfecto). El login con Google solo está disponible en el build
> nativo de Jesús. Esto no afecta nada del desarrollo del resto de la app.

---

## Problemas comunes

- **El QR no conecta** → teléfono y compu en la **misma WiFi**. Si persiste:
  `pnpm start --tunnel`.
- **Pantalla en blanco / error rojo al abrir** → revisa que el `.env` exista y
  esté completo (paso 3), luego reinicia `pnpm start` (tecla `r` para recargar).
- **`EXPO_PUBLIC_... is undefined`** → falta el `.env` o una variable. Revisa el
  paso 3 y reinicia el server.
- **Cambié código y no se actualiza** → en la terminal de `pnpm start` presiona
  `r` para recargar, o agita el teléfono → "Reload".

---

## Avanzado: build nativo (solo si necesitas Google login o probar como app real)

Esto **NO es necesario** para el desarrollo normal. Solo si quieres el login con
Google o probar la app como build independiente, necesitas Android Studio (o
Xcode en Mac) y:

```bash
npx expo run:android   # o run:ios
```

Esto compila una app nativa "PanicAI" que reemplaza a Expo Go. Para Google
login además hay que registrar el SHA-1 de tu máquina en Google Cloud (coordínalo
con Jesús).
