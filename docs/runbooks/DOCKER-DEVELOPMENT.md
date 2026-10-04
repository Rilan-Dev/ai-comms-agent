# Docker Development Environment Runbook

## 1. Purpose
This runbook describes the supported local Docker development and verification environment for ai-comms-agent.

Two modes are supported:
1. Infrastructure-only: PostgreSQL, Redis, RabbitMQ and Qdrant.
2. Full manual stack: PostgreSQL, Redis, RabbitMQ, Qdrant, automatic migrations, Next.js web and worker.

This is development/verification only, not production deployment.

## 2. Prerequisites
- Docker Engine 24+ or Docker Desktop with Compose v2
- Git
- Node.js 24.x
- pnpm 12.x
- 8 GB RAM minimum; 12–16 GB recommended for the full stack
- Ports available: 3000, 5432, 6379, 5672, 6333, 6334, 15672

Verify:
~~~bash
docker --version
docker compose version
git --version
node --version
pnpm --version
~~~

## 3. Clone and install
~~~bash
git clone git@github.com:Rilan-Dev/ai-comms-agent.git
cd ai-comms-agent
git checkout main
pnpm install --frozen-lockfile
~~~

Existing checkout:
~~~bash
git pull --ff-only origin main
pnpm install --frozen-lockfile
~~~

## 4. Environment configuration

### 4.1 Full Docker stack
~~~bash
cp .env.docker.example .env.docker
~~~
Set random values for CREDENTIALS_MASTER_KEY and SESSION_SIGNING_KEY. Generate them with:
~~~bash
openssl rand -base64 32
openssl rand -base64 32
~~~
The manual Compose stack supplies internal container URLs for web and worker. Do not use Docker service names from a host-side .env.local.

### 4.2 Direct host development
~~~bash
cp .env.example .env.local
~~~
Use localhost endpoints when the application runs directly on the host:
~~~dotenv
NODE_ENV=development
DATABASE_URL=postgresql://aca:aca_local_dev@127.0.0.1:5432/aca
DIRECT_URL=postgresql://aca:aca_local_dev@127.0.0.1:5432/aca
DATABASE_SSL=false
DATABASE_SSL_REJECT_UNAUTHORIZED=false
REDIS_URL=redis://127.0.0.1:6379
RABBITMQ_URL=amqp://aca:aca_local_dev@127.0.0.1:5672
QDRANT_URL=http://127.0.0.1:6333
NEXT_PUBLIC_APP_URL=http://localhost:3000
CREDENTIALS_MASTER_KEY=<generated-secret>
SESSION_SIGNING_KEY=<generated-secret>
~~~
Do not use production provider credentials locally.

## 5. Mode A — infrastructure only
Start the local infrastructure:
~~~bash
docker compose -f infra/docker-compose.yml --profile local-infra up -d
~~~
Check status:
~~~bash
docker compose -f infra/docker-compose.yml --profile local-infra ps
~~~

| Service | Host endpoint |
|---|---|
| PostgreSQL | 127.0.0.1:5432 |
| Redis | 127.0.0.1:6379 |
| RabbitMQ AMQP | 127.0.0.1:5672 |
| RabbitMQ UI | http://localhost:15672 |
| Qdrant HTTP | http://localhost:6333 |
| Qdrant gRPC | 127.0.0.1:6334 |

Credentials are defined in infra/docker-compose.yml: PostgreSQL aca / aca_local_dev / aca; RabbitMQ aca / aca_local_dev.

Stop:
~~~bash
docker compose -f infra/docker-compose.yml --profile local-infra down
~~~
Destroy local volumes too:
~~~bash
docker compose -f infra/docker-compose.yml --profile local-infra down -v
~~~

## 6. Mode B — full manual Docker application stack
This is the preferred one-command local integration environment.

Start:
~~~bash
cp .env.docker.example .env.docker
# Edit .env.docker and set random application secrets.
bash scripts/manual-up.sh
~~~

The stack contains postgres-db, redis, rabbitmq, qdrant, migrate, web and worker. The migrate service waits for PostgreSQL, applies forward migrations with scripts/migrate.sh, and must complete before web and worker start.

Check:
~~~bash
docker compose -f infra/docker-compose.manual.yml ps
~~~
Logs:
~~~bash
docker compose -f infra/docker-compose.manual.yml logs -f web
docker compose -f infra/docker-compose.manual.yml logs -f worker
docker compose -f infra/docker-compose.manual.yml logs -f
~~~

Endpoints:
- Web: http://localhost:3000
- RabbitMQ management: http://localhost:15672
- Qdrant: http://localhost:6333
- PostgreSQL: localhost:5432
- Redis: localhost:6379

Health check:
~~~bash
curl -i http://localhost:3000/api/health
~~~

Stop:
~~~bash
bash scripts/manual-down.sh
~~~
Destroy data too:
~~~bash
docker compose -f infra/docker-compose.manual.yml down -v
~~~

## 7. Migration operations
Migrations are forward-only SQL files under supabase/migrations.

Apply/check migrations:
~~~bash
DATABASE_URL=postgresql://aca:aca_local_dev@127.0.0.1:5432/aca bash scripts/migrate.sh
~~~
The runner creates _aca_schema_migrations and stores SHA-256 checksums. If an applied migration changes, the runner fails closed.

## 8. Phase 3 database verification
Run disposable PostgreSQL verification:
~~~bash
bash scripts/verify-docker.sh
~~~
This starts PostgreSQL 17, applies migrations, verifies ownership transfer semantics, verifies exactly one active owner, verifies ownerless organization rejection, and cleans up.

Full local gate:
~~~bash
bash scripts/verify.sh
~~~
This also runs workspace typechecking, web tests/build and worker build.

## 9. Useful commands
~~~bash
docker compose -f infra/docker-compose.manual.yml ps -a
docker compose -f infra/docker-compose.manual.yml logs --tail=200 worker
docker compose -f infra/docker-compose.manual.yml build web worker
docker compose -f infra/docker-compose.manual.yml up -d --no-deps web worker
docker exec -it <postgres-container> psql -U aca -d aca
docker exec -it <redis-container> redis-cli ping
docker exec -it <rabbitmq-container> rabbitmq-diagnostics -q ping
curl -fsS http://localhost:6333/health
~~~

## 10. Clean reset
~~~bash
docker compose -f infra/docker-compose.manual.yml down -v --remove-orphans
docker compose -f infra/docker-compose.yml --profile local-infra down -v --remove-orphans
~~~

Then restart with bash scripts/manual-up.sh.

## 11. Common failures
### Docker daemon unavailable
~~~bash
docker info
~~~
Start Docker Desktop or the Docker daemon.

### Port already in use
Linux/macOS:
~~~bash
ss -ltnp | grep -E ':3000|:5432|:6379|:5672|:6333|:6334|:15672'
~~~
Windows PowerShell:
~~~powershell
Get-NetTCPConnection -State Listen | Where-Object {$_.LocalPort -in 3000,5432,6379,5672,6333,6334,15672}
~~~

### Migration failure
~~~bash
docker compose -f infra/docker-compose.manual.yml logs migrate
~~~
Do not rewrite an already-applied migration. Create a new forward migration after review.

### Container cannot reach a dependency
Inside Compose use postgres-db, redis, rabbitmq and qdrant. From the host use 127.0.0.1 and published ports.

Inspect web environment:
~~~bash
docker compose -f infra/docker-compose.manual.yml exec web env | grep -E 'DATABASE_URL|REDIS_URL|RABBITMQ_URL|QDRANT_URL'
~~~

## 12. Security rules
- Never commit .env, .env.local, .env.docker or provider credentials.
- Never use production database credentials for local development.
- Never expose PostgreSQL, Redis, RabbitMQ or Qdrant to the public Internet.
- Rotate a secret if it appears in logs, screenshots, issues, chat or Git history.
- Local health checks do not prove AI, email or WhatsApp provider integration.
- Production provisioning remains phase-gated.

## 13. Daily development workflow
~~~bash
git pull --ff-only origin main
pnpm install --frozen-lockfile
bash scripts/verify-docker.sh
bash scripts/manual-up.sh
~~~
Before pushing:
~~~bash
bash scripts/verify.sh
git status
git diff --check
git push origin <branch>
~~~

## 14. Production boundary
Do not use this document as a production deployment procedure. Production requires separately approved PostgreSQL/Supabase, Redis, RabbitMQ, Qdrant, worker hosting, secrets, backups, monitoring, provider credentials, migrations and runtime verification.