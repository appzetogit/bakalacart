# App Startup APIs (Pre-Login / Public)

These endpoints are typically called when the Flutter app starts, before the user logs in. They are audited to ensure they **never** cause the app to stay stuck on a loading screen.

## Guarantees

1. **Valid JSON** – Every response is `Content-Type: application/json`. No HTML error pages.
2. **Consistent structure** – Success: `{ success: true, message: string, data: object }`. Error: `{ success: false, message: string, data: null, errors?: any }`.
3. **No null/undefined data** – `data` is always an object or array; optional fields use `null` or empty array/string instead of `undefined`.
4. **No hanging requests** – All async handlers are wrapped in `asyncHandler` or use try/catch and always call `res.json`/`successResponse`/`errorResponse`. Unhandled rejections go to the global error handler (JSON 500).
5. **Errors return JSON** – Validation, 400, 401, 404, 500 all return JSON, not HTML.

---

## Audited Endpoints

### Login / session (often called on app open)

| Method | Path | Response shape | Notes |
|--------|------|----------------|--------|
| POST | `/api/auth/refresh-token` | Success: `{ success, message, data: { accessToken, refreshToken } }`. **Missing token: 401** `{ success: false, message: "Refresh token not found", data: null }` — do not retry in a loop. | No auth. Header: `x-refresh-token` or `X-Refresh-Token`. |
| GET | `/api/user/profile` | `{ success, message, data: { user } }` | Requires `Authorization: Bearer <accessToken>`. Optional user fields are null. |

### Core startup

| Method | Path | Response shape | Notes |
|--------|------|----------------|--------|
| GET | `/health` | `{ success, message, data: { status, timestamp, uptime } }` | No DB; always &lt;1s. |
| GET | `/api/env/public` | `{ success, message, data: { VITE_GOOGLE_MAPS_API_KEY } }` | On DB error returns 200 with empty string key. |
| GET | `/api/zones/detect?lat=&lng=` | `{ success, message, data: { status, zoneId, zone, message } }` | zone/country/unit use null when missing. |
| GET | `/api/restaurant/list` | `{ success, message, data: { restaurants, total, filters } }` | Wrapped in asyncHandler; filters use null. |

### Configuration / settings (public)

| Method | Path | Response shape | Notes |
|--------|------|----------------|--------|
| GET | `/api/categories/public` | `{ success, message, data: { categories } }` | Array; asyncHandler. |
| GET | `/api/fee-settings/public` | `{ success, message, data: { feeSettings } }` | Defaults if none active. |
| GET | `/api/business-settings/public` | `{ success, message, data: { companyName, logo, favicon, maintenanceMode } }` | On error returns defaults. |
| GET | `/api/settings` | Same as `/api/business-settings/public` | Alias for login/startup (company name, logo, maintenance). |
| GET | `/api/about/public` | `{ success, message, data }` | About + app name/logo. |
| GET | `/api/terms/public` | `{ success, message, data }` | Terms content. |
| GET | `/api/privacy/public` | `{ success, message, data }` | Privacy content. |
| GET | `/api/refund/public` | `{ success, message, data }` | Refund policy. |
| GET | `/api/shipping/public` | `{ success, message, data }` | Shipping policy. |
| GET | `/api/cancellation/public` | `{ success, message, data }` | Cancellation policy. |
| GET | `/api/delivery-boy-agreement/public` | `{ success, message, data }` | Delivery agreement. |
| GET | `/api/delivery-boy-terms/public` | `{ success, message, data }` | Delivery terms. |

### Hero / landing (public)

| Method | Path | Response shape | Notes |
|--------|------|----------------|--------|
| GET | `/api/hero-banners/public` | `{ success, message, data: { banners } }` | asyncHandler. |
| GET | `/api/hero-banners/landing/public` | `{ success, message, data: { categories, exploreMore, settings } }` | Arrays default to []; exploreMoreHeading to ''. |
| GET | `/api/hero-banners/under-250/public` | `{ success, message, data: { banners } }` | asyncHandler. |
| GET | `/api/hero-banners/top-10/public` | `{ success, message, data }` | asyncHandler. |
| GET | `/api/hero-banners/gourmet/public` | `{ success, message, data }` | asyncHandler. |

### Other public (restaurant / offers)

| Method | Path | Response shape | Notes |
|--------|------|----------------|--------|
| GET | `/api/restaurant/under-250` | `{ success, message, data }` | asyncHandler. |
| GET | `/api/restaurant/offers/public` | `{ success, message, data }` | asyncHandler. |
| GET | `/api/restaurant/:id` | `{ success, message, data }` | asyncHandler. |
| GET | `/api/restaurant/:id/menu` | `{ success, message, data }` | asyncHandler. |
| GET | `/api/restaurant/:id/addons` | `{ success, message, data }` | asyncHandler. |

---

## Response time

- **Target:** All startup APIs respond in **under 1 second** under normal load.
- **/health** – No DB; effectively instant.
- **/api/env/public** – Single DB read (or getOrCreate); typically &lt;200ms.
- **/api/zones/detect** – One Zone.find; depends on zone count; usually &lt;500ms.
- **/api/restaurant/list** – Restaurant.find + in-memory filters; can be 200–800ms depending on data size and filters. If the app waits on this, ensure timeouts and error handling in Flutter (e.g. 10–15s timeout, show error if no response).

---

## Endpoints that could cause loading screen to hang (fixed)

| Issue | Endpoint(s) | Fix applied |
|-------|-------------|-------------|
| Health did not have `message`/`data` | `/health` | Response changed to `{ success, message, data: { status, timestamp, uptime } }`. |
| Async handler could throw without response | `/api/restaurant/list`, hero-banner publics, restaurant public routes | Wrapped in `asyncHandler` so unhandled rejections return JSON 500. |
| Undefined in response (Flutter parsing) | `/api/zones/detect` (zone.country, zone.unit), `/api/restaurant/list` (filters), landing config | Use `?? null`, `?? []`, `?? ''` so no `undefined` in JSON. |

---

## Flutter checklist for startup

1. Call **/health** first (or in parallel) to verify connectivity; expect `success: true` and `data.status === 'OK'`.
2. In parallel (or after health), load **/api/env/public**, **/api/zones/detect** (if you have location), **/api/restaurant/list**, and any config (categories, business-settings, hero-banners) your UI needs.
3. Parse every response as `{ success, message, data }`; handle `success === false` with `message` (and optional `errors`).
4. Set a **timeout** (e.g. 10–15s) per request; on timeout or non-JSON response, show an error and do not leave the loading state indefinitely.
5. Do not assume optional fields exist; use null-safe access (e.g. `data.zone?.zoneId`, `data.filters?.sortBy`).
