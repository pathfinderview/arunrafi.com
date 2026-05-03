#!/bin/zsh

set -euo pipefail

export TZ=Asia/Kolkata

REPO_DIR="$HOME/Desktop/Arun/Blog/arunrafi.com"
LOG_FILE="$REPO_DIR/.publish.local.log"
QUEUE_DIR="$REPO_DIR/queue"

mkdir -p "$(dirname "$LOG_FILE")"

timestamp() {
  date '+%Y-%m-%d %H:%M:%S %Z'
}

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
    echo "$(timestamp) Not a publish slot; exiting." >> "$LOG_FILE"
    exit 0
    ;;
esac

if ! find "$QUEUE_DIR" -maxdepth 1 -type f -name '*.md' | grep -q .; then
  echo "$(timestamp) Queue is empty; nothing to publish for ${slot_name} slot." >> "$LOG_FILE"
  exit 0
fi

terminal_command=$(cat <<EOF
export TZ=Asia/Kolkata
cd "$REPO_DIR"
if git log --since="$slot_start" --grep='^Publish:' --format='%H' | grep -q .; then
  echo "$(timestamp) ${slot_name} slot already published after $slot_start." >> "$LOG_FILE"
else
  echo "$(timestamp) Starting ${slot_name} publish." >> "$LOG_FILE"
  bash ./publish.sh >> "$LOG_FILE" 2>&1
fi
exit
EOF
)

/usr/bin/osascript - "$terminal_command" <<'EOF'
on run argv
  tell application "Terminal"
    activate
    do script (item 1 of argv)
  end tell
end run
EOF
