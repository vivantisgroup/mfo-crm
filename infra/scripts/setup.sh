#!/usr/bin/env bash
set -euo pipefail
PROJECT_ID="$1"; REGION="${2:-us-central1}"

if [[ -z "$PROJECT_ID" ]]; then echo "Usage: setup.sh <PROJECT_ID> [REGION]"; exit 1; fi

gcloud config set project "$PROJECT_ID"
gcloud config set run/region "$REGION"
gcloud config set functions/region "$REGION"

gcloud services enable \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  pubsub.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  bigquery.googleapis.com \
  bigquerydatatransfer.googleapis.com \
  logging.googleapis.com \
  storage.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com

# Firestore Native (in REGION)
gcloud firestore databases create --location=$REGION --type=firestore-native || true

# Default bucket regional
gsutil mb -l $REGION gs://$PROJECT_ID-$REGION || true

# Pub/Sub topics
for t in ocr-parse reconcile; do gcloud pubsub topics create $t || true; done

# Scheduler jobs (call functions/HTTP endpoints as needed)
# Example nightly performance  Cloud Functions
SVC_URL="https://$REGION-$PROJECT_ID.cloudfunctions.net/nightlyPerf"
gcloud scheduler jobs create http nightly-perf \
  --schedule="0 5 * * *" --uri="$SVC_URL" --http-method=GET || true

# BigQuery dataset for audits
bq --location=$REGION mk -d --description "Vivantis audit logs" audit || true
bq mk --table audit.firestore_changes time:TIMESTAMP,path:STRING,op:STRING,tenantId:STRING,before:JSON,after:JSON || true

# Hosting sites (web, admin, portal)
firebase hosting:sites:create web || true
firebase hosting:sites:create admin || true
firebase hosting:sites:create portal || true

echo "Setup complete in $REGION for $PROJECT_ID"
