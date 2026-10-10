# Redis connection configuration

The worker's Redis lease client supports these `REDIS_URL` forms:

- Passwordless Redis: `redis://HOST:6379` (no `AUTH` command is sent).
- Legacy password-only Redis: `redis://:PASSWORD@HOST:6379`.
- Redis ACL username and password: `redis://USERNAME:PASSWORD@HOST:6379`.
- TLS is supported by using `rediss://` instead of `redis://`.
- A database number can be supplied as a path, for example `redis://HOST:6379/2`.

Credentials containing URL-reserved characters must be URL-encoded.

## Shared Redis ACL namespaces

When Redis ACLs restrict users to a key pattern such as `~project-c:*`, set `REDIS_KEY_PREFIX=project-c` along with the matching ACL username (in this example, `project_c`). The worker will prefix both lease acquisition and release keys consistently.

Choose only the namespace assigned to this application. Do not use the example namespace blindly. Leave `REDIS_KEY_PREFIX` unset for standalone Redis or a user with appropriate unrestricted key access.

Example:

```dotenv
REDIS_URL=redis://project_c:URL_ENCODED_PASSWORD@host.docker.internal:6379
REDIS_KEY_PREFIX=project-c
```

For a passwordless standalone Redis:

```dotenv
REDIS_URL=redis://host.docker.internal:6379
# REDIS_KEY_PREFIX is optional
```

## Safety

Redis authentication failure remains fail-closed for mailbox polling: the worker skips the batch rather than bypassing the distributed lease. Do not disable this protection to work around connection errors.