# Frontend Auth Architecture — PeoplePay360

## Overview

Authentication is **JWT-based and stateless**. The token lives in an **HttpOnly cookie** managed entirely by the browser — it is never accessible to JavaScript. The frontend never stores or reads the raw token; it only works with the decoded user profile returned by the server.

---

## The Three Auth Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/auth/login` | Validates credentials → sets `token` HttpOnly cookie → returns user profile |
| `GET` | `/api/auth/me` | Reads the cookie → returns current user profile (used on page refresh) |
| `POST` | `/api/auth/logout` | Clears the `token` cookie by setting it to epoch 0 |

---

## Layer-by-Layer Breakdown

### 1. `api/auth.js` — Raw Fetch Wrappers

Three focused functions, each using `credentials: 'include'` so the browser always sends/receives the HttpOnly cookie cross-origin:

```
loginRequest(email, password)  →  POST /api/auth/login
getMeRequest()                 →  GET  /api/auth/me
logoutRequest()                →  POST /api/auth/logout
```

`getMeRequest()` is special — it returns `null` (instead of throwing) on a `401`/`403`, so the app can silently treat "no session" as a logged-out state rather than an error.

---

### 2. `api/client.js` — Generic Fetcher

The base fetcher used by all React Query hooks also includes `credentials: 'include'`, so every API call (not just auth) automatically carries the cookie. No manual header wiring needed anywhere.

---

### 3. `context/AppContext.jsx` — The Global Auth State

This is the single source of truth for who is logged in. It exposes:

| Value | Type | Description |
|-------|------|-------------|
| `currentUser` | `object \| null` | The authenticated user profile, or `null` if not logged in |
| `authLoading` | `boolean` | `true` while the app is bootstrapping (checking for an existing session) |
| `authError` | `string \| null` | Holds login error messages |
| `login(email, password)` | `async fn` | Calls the API, sets `currentUser` on success, throws on failure |
| `logout()` | `async fn` | Calls the API, sets `currentUser` to `null` |

#### The `currentUser` object shape

```json
{
  "id": 1,
  "name": "Anish Goenka",
  "firstName": "Anish",
  "lastName": "Goenka",
  "email": "anish@peoplepay.dev",
  "role": "admin",
  "department": "Engineering",
  "isActive": true,
  "employmentStatus": "active",
  "initials": "AG"
}
```

> **Important:** The `role` field uses DB enum values (`admin`, `hr_manager`, `hr_payroll_user`, `hr_payroll_manager`, `employee`) — **not** PascalCase strings.

---

### 4. Session Bootstrap — The Page Refresh Problem

Without this, every page refresh would flash the Login screen even if the user has a valid JWT cookie.

```
AppContext mounts
      │
      ▼
useEffect fires once
      │
      ▼
getMeRequest()  ──►  GET /api/auth/me  ──►  Server reads HttpOnly cookie
      │
      ├─ 200 OK  →  setCurrentUser(data)  →  App shell renders
      │
      └─ 401/403 →  currentUser stays null  →  Login screen renders
      │
      ▼ (always)
setAuthLoading(false)
```

`authLoading` starts as `true` and is only set to `false` after this check completes — preventing any UI from rendering prematurely.

---

### 5. `App.jsx` — The Auth Gate

`AppShell` reads both `authLoading` and `currentUser` to decide what to render:

```
authLoading === true
      │
      ▼
  "PeoplePay360 — Loading…" full-page spinner
      │
      ▼ (after /me resolves)
authLoading === false
      │
      ├─ currentUser === null  →  <Login />
      │
      └─ currentUser !== null  →  <Topbar /> + <Routes />
```

This three-state guard eliminates the flash-of-login-screen problem entirely.

---

### 6. `components/Topbar.jsx` — Consuming Auth Context

The Topbar reads `currentUser` and `logout` from `useApp()`:

- Displays `currentUser.name` and a human-readable role label (mapped from the DB enum)
- Shows the **Users** nav item only when `currentUser.role === 'admin'`
- The logout button calls `await logout()` — waits for the server to clear the cookie before the UI reacts

---

## Data Flow Diagrams

### Login Flow

```
User submits form
      │
      ▼
Login.jsx calls login(email, password)   [AppContext]
      │
      ▼
loginRequest()   →   POST /api/auth/login
      │
      ├─ 4xx  →  throws Error(server message)
      │               │
      │               ▼
      │         Login.jsx catches → setError(msg) → shows alert
      │
      └─ 200  →  response.data = user profile
                      │
                      ▼
               setCurrentUser(user)
                      │
                      ▼
               AppShell re-renders → shows app shell
```

### Logout Flow

```
User clicks Logout button
      │
      ▼
Topbar.jsx calls await logout()   [AppContext]
      │
      ▼
logoutRequest()  →  POST /api/auth/logout
      │              (server sets cookie to epoch 0)
      ▼
setCurrentUser(null)
      │
      ▼
AppShell re-renders → shows <Login />
```

### Page Refresh Flow

```
Browser loads page → React mounts
      │
      ▼
AppContext useEffect → getMeRequest()
      │
      │  [cookie is automatically sent by browser]
      │
      ▼
GET /api/auth/me
      │
      ├─ 200  →  setCurrentUser(data) → setAuthLoading(false)
      │
      └─ 401  →  currentUser stays null → setAuthLoading(false)
```

---

## Convenience Hooks

Two hooks are exported from `AppContext.jsx`:

```js
// Full context — use in pages that also need HR data
const { currentUser, login, logout, employees, ... } = useApp();

// Auth-only — use in components that only care about the session
const { currentUser, authLoading, authError, login, logout } = useAuth();
```

---

## Role Reference

| DB enum value | Display label | Access level |
|---|---|---|
| `admin` | Admin | Full access to everything + user management |
| `hr_payroll_manager` | HR Payroll Manager | Full HR + full payroll CRUD (structures/rules) |
| `hr_payroll_user` | HR Payroll User | Full HR + read/create payruns & payslips |
| `hr_manager` | HR Manager | Full HR CRUD, no payroll |
| `employee` | Employee | Own records only, attendance & leave requests |

> RBAC page gating comes next — `currentUser.role` is already available globally for conditionally rendering nav items and protecting routes.

---

## Security Notes

| Concern | How it's handled |
|---|---|
| XSS token theft | Token is in an HttpOnly cookie — JS cannot read it |
| CSRF | Cookie is `SameSite=Strict` — cross-site requests won't include it |
| Timing attacks | `bcrypt.compare` always runs even for unknown emails (uses a dummy hash) |
| Inactive accounts | Server checks `is_active` and `employment_status` before issuing tokens |
| Token invalidation | Cookie cleared on logout; Redis blacklist hook exists in `auth.js` middleware (commented out, enable when Redis is available) |
