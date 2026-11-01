#!/bin/bash
# Trigger a Jenkins job from the server terminal.
#   jenkins-build P7-ShopEase-CICD
#   jenkins-build P8-ShopEase-BlueGreen VERSION=v2 ACTION=deploy
set -euo pipefail
JOB="$1"; shift || true
J=http://localhost:8080
PASS=$(cat /home/ubuntu/jenkins-admin.pass)
CJ=$(mktemp)
CRUMB=$(curl -s -c "$CJ" -u "admin:$PASS" "$J/crumbIssuer/api/json" | jq -r '.crumbRequestField + ":" + .crumb')
if [ $# -gt 0 ]; then
  ARGS=(); for kv in "$@"; do ARGS+=(--data-urlencode "$kv"); done
  curl -sf -b "$CJ" -u "admin:$PASS" -H "$CRUMB" -X POST "$J/job/$JOB/buildWithParameters" "${ARGS[@]}"
else
  curl -sf -b "$CJ" -u "admin:$PASS" -H "$CRUMB" -X POST "$J/job/$JOB/build"
fi
rm -f "$CJ"
echo "Triggered $JOB $*"
