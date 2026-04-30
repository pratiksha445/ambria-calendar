# Ambria Calendar

Booking calendar for Ambria venues.

## Auth

Authentication uses a phone + PIN flow backed by a server-side Postgres RPC:

1. User enters phone number and 4-digit PIN on the login screen.
2. Client calls `public.login(p_phone, p_pin)` via `supabase.rpc()`.
3. The RPC validates credentials server-side and returns `{ access_token, expires_at, user }`.
4. The JWT (`access_token`), expiry timestamp, and user object are stored in `localStorage` under the key `ambria_session`.
5. `supabase.auth.setSession()` is called with the JWT so all subsequent Supabase REST and realtime requests include it as `Authorization: Bearer <jwt>`.

### Token lifetime

- Tokens are valid for **12 hours**.
- There is **no refresh token** flow. On expiry the user is forced to re-login.
- A proactive timer fires 60 seconds before expiry to log the user out with a toast message.
- A fetch interceptor detects 401 responses and triggers the same forced-logout flow.

### Logout

Logout clears `ambria_session` from localStorage and calls `supabase.auth.signOut()`.

### Admin PIN management

Admin PIN reset/set and user creation currently write to the `users` table directly.
These operations are wrapped in try/catch and will surface a clear error message once
RLS is enabled. Server-side admin RPCs (`admin_reset_pin`, `signup_user`) are planned
for the next deploy.

## Development

```bash
npm install
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.
