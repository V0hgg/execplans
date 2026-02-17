#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

log() {
  printf '[smoke] %s\n' "$1"
}

wait_for() {
  local name="$1"
  local url="$2"
  local attempts=0
  until curl -fsS "$url" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [[ "$attempts" -ge 60 ]]; then
      log "$name: FAIL (timeout waiting for $url)"
      return 1
    fi
    sleep 1
  done
  return 0
}

wait_for "logs" "http://127.0.0.1:9428/health"
wait_for "metrics" "http://127.0.0.1:8428/health"
wait_for "traces" "http://127.0.0.1:10428/health"

# 1) Logs check
printf '{"stream":"smoke","date":"0","log":{"message":"smoke-log-line"}}\n' | \
  curl -fsS -X POST -H 'Content-Type: application/stream+json' --data-binary @- \
  'http://127.0.0.1:9428/insert/jsonline?_stream_fields=stream&_time_field=date&_msg_field=log.message' >/dev/null

if curl -fsS 'http://127.0.0.1:9428/select/logsql/query' -d 'query=smoke-log-line' -d 'limit=1' | grep -q 'smoke-log-line'; then
  log 'logs query: PASS'
else
  log 'logs query: FAIL'
  exit 1
fi

# 2) Metrics check (self-scraped metric from VictoriaMetrics)
if curl -fsS 'http://127.0.0.1:8428/prometheus/api/v1/query' -d 'query=process_cpu_cores_available' | grep -q '"status":"success"'; then
  log 'metrics query: PASS'
else
  log 'metrics query: FAIL'
  exit 1
fi

# 3) Traces check (ingest one OTLP span then query via VictoriaTraces)
NOW_NANOS="$(python3 - <<'PY'
import time
print(int(time.time() * 1_000_000_000))
PY
)"

cat > "$BASE_DIR/.trace-payload.json" <<JSON
{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"smoke-service"}}]},"scopeSpans":[{"scope":{"name":"smoke"},"spans":[{"traceId":"1af5dd013a30efe7f2970032ab81958b","spanId":"229d083a6c480511","name":"smoke-span","kind":1,"startTimeUnixNano":"$NOW_NANOS","endTimeUnixNano":"$NOW_NANOS"}]}]}]}
JSON

curl -fsS -X POST -H 'Content-Type: application/json' --data-binary @"$BASE_DIR/.trace-payload.json" \
  'http://127.0.0.1:10428/insert/opentelemetry/v1/traces' >/dev/null

rm -f "$BASE_DIR/.trace-payload.json"

if curl -fsS 'http://127.0.0.1:10428/select/jaeger/api/services' | grep -q 'smoke-service'; then
  log 'traces query: PASS'
else
  # Fallback: query via LogsQL-compatible endpoint.
  if curl -fsS 'http://127.0.0.1:10428/select/logsql/query' -d 'query=smoke-service' -d 'limit=1' | grep -q 'smoke-service'; then
    log 'traces query: PASS'
  else
    log 'traces query: FAIL'
    exit 1
  fi
fi
