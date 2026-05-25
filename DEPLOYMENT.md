# Deployment (Render)

## Production URLs

| Service | URL |
|---------|-----|
| Frontend | `https://video-confrencing-frontend.onrender.com` |
| Backend API | `https://video-conferencing-app-769z.onrender.com` |

## Backend environment variables

Set on the **backend** Render service:

```env
NODE_ENV=production
FRONTEND_URL=https://video-confrencing-frontend.onrender.com
DATABASE_URL=<from Render Postgres>
JWT_SECRET=<strong random secret>
LIVEKIT_API_KEY=<from LiveKit Cloud>
LIVEKIT_API_SECRET=<from LiveKit Cloud>
LIVEKIT_URL=https://video-confrencing-xgol7pv4.livekit.cloud
```

`FRONTEND_URL` must match the browser origin exactly (HTTPS, no trailing slash). Do **not** use `http://localhost:3000` in production.

## Frontend environment variables

Set on the **frontend** Render service, then trigger a **new deploy** (build) so `NEXT_PUBLIC_*` values are baked in:

```env
NEXT_PUBLIC_API_URL=https://video-conferencing-app-769z.onrender.com/api
NEXT_PUBLIC_LIVEKIT_URL=wss://video-confrencing-xgol7pv4.livekit.cloud
NEXT_PUBLIC_APP_URL=https://video-confrencing-frontend.onrender.com
```

## Local development

**Backend** `.env`:

```env
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...
```

**Frontend** `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```

## After changing env vars

1. Save env vars in Render dashboard.
2. **Manual Deploy** the backend (required for `FRONTEND_URL` and cookie/CORS code).
3. **Manual Deploy** the frontend after any `NEXT_PUBLIC_*` change.

## Verify auth

1. Open `https://video-confrencing-frontend.onrender.com/login`
2. DevTools → Network → `POST .../api/auth/login`
3. Response: `Set-Cookie` with `SameSite=None; Secure`
4. Next request to `/api/auth/me` includes `Cookie: token=...`
