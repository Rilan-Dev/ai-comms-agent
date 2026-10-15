#!/usr/bin/env bash
set -euo pipefail

# Creates/configures the Gmail Pub/Sub topic and authenticated push subscription.
# Run only after authenticating gcloud to the Google Cloud project that owns
# the Gmail OAuth client. This script never prints or stores access tokens.

required=(
  GMAIL_PUBSUB_TOPIC
  GMAIL_PUBSUB_SUBSCRIPTION
  GMAIL_PUBSUB_PUSH_ENDPOINT
  GMAIL_PUBSUB_PUSH_AUDIENCE
  GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT
)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    printf 'Missing required environment variable: %s\n' "$name" >&2
    exit 2
  fi
done

if ! [[ "$GMAIL_PUBSUB_TOPIC" =~ ^projects/([^/]+)/topics/([^/]+)$ ]]; then
  echo "GMAIL_PUBSUB_TOPIC must be projects/<project-id>/topics/<topic-id>." >&2
  exit 2
fi
PROJECT_ID="${BASH_REMATCH[1]}"
TOPIC_ID="${BASH_REMATCH[2]}"

if ! [[ "$GMAIL_PUBSUB_SUBSCRIPTION" =~ ^[A-Za-z0-9._~+%-]+$ ]]; then
  echo "GMAIL_PUBSUB_SUBSCRIPTION must be a subscription ID, not a full resource path." >&2
  exit 2
fi
if [[ "$GMAIL_PUBSUB_PUSH_ENDPOINT" != https://* ]]; then
  echo "GMAIL_PUBSUB_PUSH_ENDPOINT must be a publicly reachable HTTPS URL." >&2
  exit 2
fi
if [[ "$GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT" != *@*.iam.gserviceaccount.com ]]; then
  echo "GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT must be a service-account email." >&2
  exit 2
fi

gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q .
gcloud config set project "$PROJECT_ID" >/dev/null
gcloud services enable gmail.googleapis.com pubsub.googleapis.com --project="$PROJECT_ID"

if ! gcloud pubsub topics describe "$TOPIC_ID" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud pubsub topics create "$TOPIC_ID" --project="$PROJECT_ID"
fi

# Gmail publishes change notifications using this Google-managed identity.
gcloud pubsub topics add-iam-policy-binding "$TOPIC_ID" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
PUBSUB_SERVICE_AGENT="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"

# Pub/Sub needs permission to mint the OIDC token used for authenticated push.
gcloud iam service-accounts add-iam-policy-binding "$GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${PUBSUB_SERVICE_AGENT}" \
  --role="roles/iam.serviceAccountTokenCreator"

if gcloud pubsub subscriptions describe "$GMAIL_PUBSUB_SUBSCRIPTION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud pubsub subscriptions update "$GMAIL_PUBSUB_SUBSCRIPTION" \
    --project="$PROJECT_ID" \
    --push-endpoint="$GMAIL_PUBSUB_PUSH_ENDPOINT" \
    --push-auth-service-account="$GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT" \
    --push-auth-token-audience="$GMAIL_PUBSUB_PUSH_AUDIENCE"
else
  gcloud pubsub subscriptions create "$GMAIL_PUBSUB_SUBSCRIPTION" \
    --project="$PROJECT_ID" \
    --topic="$TOPIC_ID" \
    --push-endpoint="$GMAIL_PUBSUB_PUSH_ENDPOINT" \
    --push-auth-service-account="$GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT" \
    --push-auth-token-audience="$GMAIL_PUBSUB_PUSH_AUDIENCE" \
    --ack-deadline=20 \
    --message-retention-duration=7d
fi

cat <<EOF
Gmail Pub/Sub resources configured in project: $PROJECT_ID
Topic: projects/$PROJECT_ID/topics/$TOPIC_ID
Subscription: $GMAIL_PUBSUB_SUBSCRIPTION
Push endpoint: $GMAIL_PUBSUB_PUSH_ENDPOINT
OIDC audience: $GMAIL_PUBSUB_PUSH_AUDIENCE
OIDC service account: $GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT

Set these same values in the server-side web and worker runtime:
  GMAIL_PUBSUB_TOPIC
  GMAIL_PUBSUB_PUSH_AUDIENCE
  GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT

Next: apply supabase/migrations/0049_email_sync_pending_push.sql to the database
shared by web and worker, then send a test email and inspect webhook/worker logs.
EOF
