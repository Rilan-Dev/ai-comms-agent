# Authentication Runbook

## PostgreSQL-native authentication

The application does not require Supabase Auth. It requires a PostgreSQL database reachable through `DATABASE_URL`.

### First-account bootstrap

1. Set a strong random `AUTH_BOOTSTRAP_TOKEN` (at least 32 characters) and `APP_ORIGIN`.
2. Start the web application.
3. Send one `POST /api/auth/bootstrap` request with the bootstrap token, first-user email/name/password, and organization name/slug.
4. The endpoint creates the first application password credential and initial owner organization only when `aca.auth_credentials` is empty.
5. Remove/unset `AUTH_BOOTSTRAP_TOKEN` immediately after successful initialization. Subsequent calls return `409 already_initialized` even if the environment variable remains configured.

The password must be at least 12 characters and contain lowercase, uppercase, and numeric characters.

### Session security

- Browser session cookie: `aca-access-token`, HttpOnly, SameSite=Lax, Secure in production.
- Raw session tokens are never stored in PostgreSQL; only SHA-256 hashes are stored.
- Sessions expire after 12 hours and can be revoked server-side.
- Suspended/deleted users cannot resolve a valid session.
- Login failures are recorded; five failures in the rolling 15-minute window lock the credential for 15 minutes.
- Login returns a generic credential error so account existence is not disclosed.
- State-changing auth endpoints validate same-origin requests when an `Origin` header is present.
- Password changes revoke every other session and keep the current browser session active.

### No database project quota dependency

Supabase may be used as a PostgreSQL hosting option later, but no Supabase Auth project, publishable key, or hosted identity API is required by this authentication implementation.
