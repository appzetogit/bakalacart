# Flutter / Mobile API Compatibility

This document describes backend API behavior for the Flutter mobile app and lists issues that can cause **infinite loading** or parsing failures.

## Backend Changes Made for Flutter Compatibility

1. **Request/response logging** – Every API request is logged with method, path, status code, duration, `origin`, and whether `Authorization` / `x-refresh-token` are present. Use server logs to confirm the Flutter app is hitting the server and what status codes it gets.

2. **Consistent JSON responses** – Every response (success and error) now has the same shape: `{ success, message, data }`. Success: `data` is the payload; error: `data` is always `null` (and optionally `errors`). Content-Type is set to `application/json` explicitly.

3. **Rate limiter (429)** – In production, rate limiting returns JSON `{ success: false, message: "..." }` with status 429, not HTML or plain text.

4. **404 and global error handler** – Always return JSON with no `undefined` fields so Flutter/Dart parsing does not break.

5. **CORS** – Requests with **no origin** (typical for mobile apps) are allowed. Allowed headers include `Authorization`, `Content-Type`, `X-Refresh-Token`, `x-refresh-token`.

6. **App startup APIs** – All public endpoints called before login now:
   - Return valid JSON with structure `{ success, message, data }` (see [STARTUP_APIS.md](./STARTUP_APIS.md)).
   - Use `asyncHandler` so no request hangs on unhandled promise rejection.
   - Avoid `undefined` in response data (use `null` or omit); optional fields use `?? null` or `?? []` / `?? ''` where appropriate.

---

## Potential Issues That Can Cause Infinite Loading in Flutter

### 1. **Authentication headers not sent**

- **Protected routes** (e.g. `/api/order`, `/api/user/profile`, `/api/restaurant/list` for owner) require:
  - `Authorization: Bearer <accessToken>`
- If the Flutter app does not attach the token, the server returns **401** with JSON. If the app does not handle 401 (e.g. redirect to login or refresh token), the UI may keep loading.
- **Action:** Ensure Flutter sends `Authorization: Bearer <accessToken>` on every request after login. Check server logs for `auth=no` on routes that should be authenticated.

### 2. **Refresh token not sent (mobile cannot use cookies)**

- Refresh endpoint: `POST /api/auth/refresh-token`
- Server accepts refresh token from:
  - Cookie: `user_refreshToken` or `refreshToken`
  - Header: `x-refresh-token` or `X-Refresh-Token`
- Mobile apps often cannot rely on cookies. If Flutter only stores the refresh token in memory/storage and does **not** send it in the `x-refresh-token` header when calling refresh-token, the server returns **401** and the app may stay in a loading or logged-out state.
- **Action:** Flutter must send `x-refresh-token: <refreshToken>` in the body or header when calling `/api/auth/refresh-token`. Check logs for `refresh=yes`/`refresh=no`.

### 3. **Wrong base URL or path**

- If the Flutter app points to the wrong server URL or uses a path like `/api/v1/...` while the backend uses `/api/...`, requests may 404 or never reach the server, causing infinite loading.
- **Action:** Confirm Flutter base URL matches the backend (e.g. `https://your-api.com` or `http://10.0.2.2:5000` for Android emulator). Check server logs to see if requests are received.

### 4. **Parsing response shape**

- Success: `{ success: true, message: string, data: object | array | null }`
- Error: `{ success: false, message: string, data: null, errors?: any }`
- If Flutter expects a different shape (e.g. `response.data.data` or a different key for the list), parsing may throw and the app may not leave the loading state.
- **Action:** Ensure Flutter models match the above. For example, list of restaurants is under `data.restaurants` and `data.total` for `GET /api/restaurant/list`. You can always read `response.data` (null on error).

### 5. **Optional fields null/undefined**

- User object in login/verify-otp may have `email: null` (phone-only signup) or `phone: null` (email-only). If Flutter assumes these are always non-null strings, access can throw and break the flow.
- **Action:** In Flutter, treat `email` and `phone` as nullable (e.g. `String?`) and handle null before displaying or saving.

### 6. **CORS / network (web vs mobile)**

- CORS is configured to allow requests with **no origin** (typical for mobile). So CORS is unlikely to block a native Flutter app. If the app uses a WebView or web build, ensure the origin is in the allowed list or that the backend allows it in development.
- **Action:** For “infinite loading” with no error, check device/emulator network: can it reach the server? Use server request logs to confirm.

### 7. **Async handlers not returning / unhandled rejection**

- Most routes use `asyncHandler` or internal try/catch and call `successResponse`/`errorResponse`. If any async handler throws without being caught, Express may never send a response and the client will hang (infinite loading).
- **Action:** Backend has been reviewed for consistent JSON and error handling. If a specific endpoint hangs, check server logs for that path and add try/catch in that controller if needed.

### 8. **Calls that require auth but are called before login**

- Examples: `GET /api/order`, `GET /api/user/profile`, `GET /api/user/addresses`. If Flutter calls these before storing or sending the access token, the server returns 401. If the app does not handle 401 and retry with refresh or redirect to login, the screen may stay in loading.
- **Action:** Call these only after login and only with a valid `Authorization: Bearer <accessToken>`. Implement 401 handling: try refresh token, then redirect to login on failure.

---

## API Endpoints Commonly Used by Mobile (User flow)

| Method | Path | Auth | Notes |
|--------|------|------|------|
| GET | `/health` | No | JSON: success, message, data (status, timestamp, uptime) |
| GET | `/api/startup-check` | No | No DB; instant. Use to verify base URL. |
| GET | `/api/app-init` | No | **Single startup call:** env + settings in one response. Use instead of env + settings separately. |
| GET | `/api/env/public` | No | Public env (e.g. maps key). Always `{ success, message, data }`. |
| GET | `/api/settings` | No | Same as `/api/business-settings/public` (company name, logo, maintenance). |
| GET | `/api/zones/detect?lat=&lng=` | No | Zone detection. `data` has status, zoneId, zone, message (no undefined). |
| POST | `/api/auth/send-otp` | No | Body: phone or email, purpose |
| POST | `/api/auth/verify-otp` | No | Body: phone/email, otp, purpose, name? |
| POST | `/api/auth/refresh-token` | No | Header: x-refresh-token or X-Refresh-Token or cookie. **Missing token → 401 JSON (not 500). Do not retry in a loop.** |
| POST | `/api/auth/logout` | No | Clears cookies; mobile may ignore |
| GET | `/api/user/profile` | **Yes** | User profile. Optional fields (email, phone, etc.) are null when absent. |
| GET | `/api/restaurant/list` | No | List restaurants |
| GET | `/api/restaurant/:id/menu` | No | Restaurant menu |
| POST | `/api/order/calculate` | No | Cart calculation |
| POST | `/api/order` | **Yes** | Create order |
| GET | `/api/order` | **Yes** | User orders |
| GET | `/api/order/:id` | **Yes** | Order details |
| GET | `/api/user/profile` | **Yes** | User profile |
| GET | `/api/user/addresses` | **Yes** | User addresses |

---

## Debugging Checklist

1. **Server logs** – After each request you should see a line like:  
   `[API] GET /api/restaurant/list → 200 45ms origin=(no origin) auth=no`
2. **Flutter** – Log the exact request URL, headers (redact token value), and response status code.
3. **401 on protected routes** – Verify `Authorization: Bearer <token>` is set and token is not expired.
4. **Refresh token** – Verify Flutter sends `x-refresh-token` for `POST /api/auth/refresh-token` when cookies are not used.
5. **Parsing** – Ensure Flutter uses the same keys as above (`success`, `message`, `data`) and handles null for optional user fields.

---

## Still stuck? Debug steps

### Option A: Use a single startup call (recommended)

Instead of calling `/api/env/public`, `/api/settings`, etc. in parallel (where one failing can leave the app spinning), call **one** endpoint:

- **GET `/api/app-init`** (no auth)

Response: `{ success: true, message: "App init loaded", data: { env: { VITE_GOOGLE_MAPS_API_KEY: "..." }, settings: { companyName, logo, favicon, maintenanceMode }, timestamp } }`.

If DB fails, the backend still returns 200 with safe defaults. Use this as the only “config” call on app start; then do refresh-token or show login. This removes the “one of several calls hangs or fails” case.

### Option B: Confirm the app reaches the backend

1. **Confirm the app reaches the backend**
   - Start the backend and watch the terminal. You should see `[API] IN  GET /path` as soon as a request hits.
   - In Flutter, call **GET `{baseUrl}/api/startup-check`** first (no auth). It returns instantly with `{ success: true, message: "Backend reachable", data: { ok: true } }`. If this fails or never returns, the problem is **base URL or network**, not the other APIs.

2. **Base URL from the Flutter app**
   - **Android emulator:** use `http://10.0.2.2:5000` (not `localhost`).
   - **iOS simulator:** `http://127.0.0.1:5000` or your machine’s LAN IP.
   - **Real device:** use your computer’s IP, e.g. `http://192.168.x.x:5000`, and ensure the device and backend are on the same network.

3. **If you see no `[API] IN` lines when opening the app**
   - The Flutter app is not reaching this server. Fix base URL, firewall, or VPN.

4. **If you see `[API] IN` but no `[API] OUT` for a path**
   - That request is hanging (no response sent). Note the path and check the backend for that route (DB slow, unhandled error).

5. **If you see `[API] OUT ... → 4xx/5xx`**
   - Backend is responding with an error. Check status and response body; fix the request or backend for that endpoint.

### Option C: Run this diagnostic and share the result

1. Start the backend (`npm run dev` in backend folder). Leave the terminal visible.
2. Set Flutter base URL to the correct one (see Base URL below).
3. Open the Flutter app (splash / login screen).
4. In the **backend** terminal you should see lines like:
   - `[API] IN  GET /api/...` when a request arrives
   - `[API] OUT GET /api/... → 200 50ms` when the response is sent
5. Copy and note:
   - Do you see **any** `[API] IN` lines? (If **no** → app is not reaching the server; fix URL/network.)
   - For each `[API] IN`, do you see a matching `[API] OUT`? (If **no** for some path → that request is hanging.)
   - What status codes appear after `→`? (401, 404, 500 → need to fix that endpoint or client logic.)

This tells us whether the issue is connectivity, a hanging request, or a failing endpoint.

---

## Login screen / startup APIs (spinner and retries)

These are often called when the app opens or when the login screen loads:

| Endpoint | Auth | Behavior |
|----------|------|----------|
| `POST /api/auth/refresh-token` | No | If **no** refresh token is sent (first launch, or cleared storage): returns **401** with `{ success: false, message: "Refresh token not found", data: null }`. This is **not** a server error. **Do not retry** on 401 for this endpoint — show login screen once. |
| `GET /api/user/profile` | Yes | Requires `Authorization: Bearer <accessToken>`. If token missing/expired → 401. Client should try refresh-token once; if refresh returns 401, stop and show login. |
| `GET /api/env/public` | No | Always returns 200 and `{ success, message, data }`. No undefined in `data`. |
| `GET /api/settings` | No | Alias for business-settings/public. Returns 200 with company name, logo, maintenance. |
| `GET /api/zones/detect?lat=&lng=` | No | Returns 200 with zone data; optional fields use `null`. |

### What can cause the login spinner to repeatedly appear and disappear?

1. **Retrying refresh-token on 401** – When there is no refresh token (e.g. first open or after logout), the backend correctly returns 401. If the client **retries** refresh-token again and again, the UI can show spinner → 401 → spinner → 401 in a loop. **Fix:** On 401 from `POST /api/auth/refresh-token`, **do not retry**. Show the login screen and stop.
2. **Calling /api/user/profile before having a token** – If the app calls profile on startup, gets 401, then tries refresh, gets 401 (no token), and then **retries** the whole flow (e.g. profile again), you get a loop. **Fix:** Call refresh once; if 401, go to login and do not call profile until the user has logged in.
3. **Inconsistent or non-JSON response** – If the client ever receives HTML or a body without `success`/`message`/`data`, parsing can throw and the app might retry or show spinner forever. Backend now ensures all these endpoints return JSON with `{ success, message, data }` (with `data: null` on error).
4. **5xx from an endpoint** – If any of these returned 500, the client might retry. Backend avoids 500 for “missing refresh token” (returns 401). Other errors (e.g. DB down) still return 500 JSON; client should limit retries (e.g. max 1–2) and then show an error message instead of spinning.
