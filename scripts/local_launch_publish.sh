#!/bin/bash

set -euo pipefail
shopt -s nullglob

export TZ=Asia/Kolkata

SOURCE_REPO="$HOME/Desktop/Arun/Blog/arunrafi.com"
SOURCE_QUEUE_DIR="$SOURCE_REPO/queue"
SOURCE_PUBLISHED_DIR="$SOURCE_REPO/published"
LOG_FILE="$SOURCE_REPO/.publish.local.log"

AUTOMATION_ROOT="$HOME/.local/share/arunrafi-publisher"
AUTOMATION_REPO="$AUTOMATION_ROOT/repo"
LOCK_DIR="$AUTOMATION_ROOT/.lock"

timestamp() {
  date '+%Y-%m-%d %H:%M:%S %Z'
}

log_line() {
  echo "$(timestamp) $*" >> "$LOG_FILE"
}

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

mkdir -p "$SOURCE_PUBLISHED_DIR" "$AUTOMATION_ROOT"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  log_line "Another local publish run is already in progress."
  exit 0
fi

trap cleanup EXIT

hour="$(date +%H)"
case "$hour" in
  06)
    slot_name="morning"
    slot_start="$(date '+%Y-%m-%d 06:00:00')"
    ;;
  18)
    slot_name="evening"
    slot_start="$(date '+%Y-%m-%d 18:00:00')"
    ;;
  *)
    log_line "Not a publish slot; exiting."
    exit 0
    ;;
esac

origin_url="$(git -C "$SOURCE_REPO" remote get-url origin)"

ensure_automation_repo() {
  if [ ! -d "$AUTOMATION_REPO/.git" ]; then
    log_line "Creating clean automation clone."
    git clone "$origin_url" "$AUTOMATION_REPO" >> "$LOG_FILE" 2>&1
  fi

  git -C "$AUTOMATION_REPO" fetch origin main >> "$LOG_FILE" 2>&1
  git -C "$AUTOMATION_REPO" checkout -B main origin/main >> "$LOG_FILE" 2>&1
  git -C "$AUTOMATION_REPO" reset --hard origin/main >> "$LOG_FILE" 2>&1
  git -C "$AUTOMATION_REPO" clean -fd >> "$LOG_FILE" 2>&1
  mkdir -p "$AUTOMATION_REPO/queue" "$AUTOMATION_REPO/published"
}

reconcile_already_published_queue() {
  local source_file base

  for source_file in "$SOURCE_QUEUE_DIR"/*.md; do
    [ -e "$source_file" ] || continue
    base="$(basename "$source_file")"

    if git -C "$AUTOMATION_REPO" cat-file -e "origin/main:published/$base" 2>/dev/null; then
      if [ -f "$SOURCE_PUBLISHED_DIR/$base" ]; then
        rm -f "$source_file"
        log_line "Removed duplicate queued file already published remotely: $base"
      else
        mv "$source_file" "$SOURCE_PUBLISHED_DIR/$base"
        log_line "Reconciled queue to published for already-remote post: $base"
      fi
    fi
  done
}

oldest_queue_file() {
  find "$SOURCE_QUEUE_DIR" -maxdepth 1 -type f -name '*.md' -print0 \
    | while IFS= read -r -d '' candidate; do
        if stat -f '%m' "$candidate" >/dev/null 2>&1; then
          printf '%s\t%s\n' "$(stat -f '%m' "$candidate")" "$candidate"
        else
          printf '%s\t%s\n' "$(stat -c '%Y' "$candidate")" "$candidate"
        fi
      done \
    | sort -n \
    | head -n 1 \
    | cut -f 2-
}

sync_queue_to_automation_repo() {
  mkdir -p "$AUTOMATION_REPO/queue"
  find "$AUTOMATION_REPO/queue" -maxdepth 1 -type f -name '*.md' -delete

  local source_file
  for source_file in "$SOURCE_QUEUE_DIR"/*.md; do
    [ -e "$source_file" ] || continue
    cp "$source_file" "$AUTOMATION_REPO/queue/"
  done
}

ensure_automation_repo
reconcile_already_published_queue

if git -C "$AUTOMATION_REPO" log --since="$slot_start" --grep='^Publish:' --format='%H' | grep -q .; then
  log_line "A ${slot_name} publish already landed after $slot_start; skipping retry."
  exit 0
fi

next_file="$(oldest_queue_file)"
if [ -z "${next_file:-}" ]; then
  log_line "Queue is empty; nothing to publish for ${slot_name} slot."
  exit 0
fi

next_base="$(basename "$next_file")"

sync_queue_to_automation_repo

log_line "Starting ${slot_name} publish for $next_base."
(
  cd "$AUTOMATION_REPO"
  bash ./publish.sh
) >> "$LOG_FILE" 2>&1

if [ -f "$AUTOMATION_REPO/published/$next_base" ]; then
  if [ -f "$SOURCE_QUEUE_DIR/$next_base" ]; then
    mv "$SOURCE_QUEUE_DIR/$next_base" "$SOURCE_PUBLISHED_DIR/$next_base"
    log_line "Moved local source file from queue to published: $next_base"
  elif [ ! -f "$SOURCE_PUBLISHED_DIR/$next_base" ]; then
    cp "$AUTOMATION_REPO/published/$next_base" "$SOURCE_PUBLISHED_DIR/$next_base"
    log_line "Copied published source file back locally: $next_base"
  fi
fi
