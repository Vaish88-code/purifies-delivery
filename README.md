# Purifies Delivery App

Delivery driver app for assigned orders and live map tracking.

## Setup

```bash
npm install
cp .env.example .env
# Fill in Firebase values in .env
npm run dev
```

## Scripts

- `npm run dev` — local dev server (port 3003)
- `npm run build` — production build
- `npm run preview` — preview production build

## Deploy (Netlify)

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- Add Firebase `VITE_*` environment variables in Netlify site settings.
