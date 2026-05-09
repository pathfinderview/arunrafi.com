#!/bin/bash
# publish.sh — publishes the oldest queued markdown post, updates the index and
# RSS feed, commits the result, and pushes it to origin/main.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
QUEUE_DIR="$REPO_DIR/queue"
PUBLISHED_DIR="$REPO_DIR/published"
LOCK_DIR="$REPO_DIR/.publish.lock"
DRY_RUN=0
SKIP_REMOTE_SYNC="${SKIP_REMOTE_SYNC:-0}"
export TZ="${TZ:-Asia/Kolkata}"

if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

TODAY=$(date +%Y-%m-%d)
DAY_DISPLAY=$(date +"%d %b %Y" | sed 's/^0//')
PROCESSING_PATH=""
SUCCESS=0

cleanup() {
  if [ "$SUCCESS" -ne 1 ] && [ -n "$PROCESSING_PATH" ] && [ -f "$PROCESSING_PATH" ]; then
    original_name="$(basename "$PROCESSING_PATH")"
    original_name="${original_name#.processing-}"
    mv "$PROCESSING_PATH" "$QUEUE_DIR/$original_name"
  fi

  rmdir "$LOCK_DIR" 2>/dev/null || true
}

file_mtime() {
  if stat -f '%m' "$1" >/dev/null 2>&1; then
    stat -f '%m' "$1"
  else
    stat -c '%Y' "$1"
  fi
}

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another publish run is already in progress."
  exit 0
fi

trap cleanup EXIT

mkdir -p "$PUBLISHED_DIR"
cd "$REPO_DIR"

if [ "$SKIP_REMOTE_SYNC" != "1" ]; then
  if ! git fetch origin main; then
    echo "git fetch origin main failed; leaving queue untouched."
    exit 1
  fi

  if git merge-base --is-ancestor HEAD origin/main && [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    echo "origin/main is ahead of the local checkout; sync the repo before publishing."
    exit 1
  fi

  if ! git merge-base --is-ancestor origin/main HEAD; then
    echo "Local branch has diverged from origin/main; resolve that before publishing."
    exit 1
  fi
fi

filepath=""
while IFS=$'\t' read -r _mtime candidate; do
  filepath="$candidate"
  break
done < <(
  find "$QUEUE_DIR" -maxdepth 1 -type f -name '*.md' -print0 \
    | while IFS= read -r -d '' candidate; do
        printf '%s\t%s\n' "$(file_mtime "$candidate")" "$candidate"
      done \
    | sort -n
)

if [ -z "$filepath" ]; then
  echo "No posts found in $QUEUE_DIR"
  SUCCESS=1
  exit 0
fi

remaining=$(find "$QUEUE_DIR" -maxdepth 1 -type f -name '*.md' | wc -l | tr -d ' ')
echo "$remaining post(s) queued — publishing oldest one"

filename=$(basename "$filepath" .md)
slug=$(echo "$filename" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g')
html_file="${TODAY}-${slug}.html"

if [ -e "$REPO_DIR/$html_file" ]; then
  echo "Refusing to publish because $html_file already exists."
  exit 1
fi

if [ -n "$(git status --porcelain -- index.html feed.xml "$html_file")" ]; then
  echo "index.html, feed.xml, or $html_file already has local changes; aborting."
  exit 1
fi

title=$(head -1 "$filepath" | sed 's/^#* *//')
body=$(tail -n +3 "$filepath")

word_count=$(echo "$body" | wc -w | tr -d ' ')
read_min=$(( (word_count + 219) / 220 ))
[ "$read_min" -lt 1 ] && read_min=1

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run: would publish $filepath as $html_file"
  SUCCESS=1
  exit 0
fi

PROCESSING_PATH="$QUEUE_DIR/.processing-$(basename "$filepath")"
mv "$filepath" "$PROCESSING_PATH"
filepath="$PROCESSING_PATH"

paragraphs=""
current=""
while IFS= read -r line || [ -n "$line" ]; do
  if [ -z "$line" ]; then
    if [ -n "$current" ]; then
      paragraphs="${paragraphs}  <p>${current}</p>\n\n"
      current=""
    fi
  else
    if [ -n "$current" ]; then
      current="${current} ${line}"
    else
      current="$line"
    fi
  fi
done <<< "$body"

if [ -n "$current" ]; then
  paragraphs="${paragraphs}  <p>${current}</p>\n"
fi

cat > "$REPO_DIR/$html_file" <<HTMLEOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title} — Arun Rafi</title>
  <link rel="stylesheet" href="/style.css">
  <link rel="alternate" type="application/rss+xml" title="Arun Rafi" href="/feed.xml">
  <script src="/script.js" defer></script>
</head>
<body>
<a href="/">← Home</a>
<article>
  <h1>${title}</h1>
  <p><time datetime="${TODAY}">${DAY_DISPLAY}</time> <span class="read-time">· ${read_min} min read</span></p>

$(echo -e "$paragraphs")
</article>
<footer>
  <p><a href="/">Home</a> · <a href="/feed.xml">RSS</a> · <a href="/about.html">About</a></p>
</footer>
</body>
</html>
HTMLEOF

NEW_LINK="      <li><a href=\"/${html_file}\">${title}</a></li>"
awk -v new_link="$NEW_LINK" '
  { print }
  index($0, "<!-- newest on top -->") { print new_link }
' "$REPO_DIR/index.html" > "$REPO_DIR/index.html.tmp"
mv "$REPO_DIR/index.html.tmp" "$REPO_DIR/index.html"

echo "Published: $html_file"

bash "$REPO_DIR/generate_feed.sh" 2>/dev/null || true

published_name="$(basename "$filepath")"
published_name="${published_name#.processing-}"
original_queue_rel="queue/$published_name"
published_rel="published/$published_name"
published_path="$PUBLISHED_DIR/$published_name"
mv "$filepath" "$published_path"
PROCESSING_PATH="$published_path"

git add "$html_file" index.html feed.xml
git add -A -f "$published_rel" "$original_queue_rel"
git commit -m "Publish: $title" || { echo "Nothing to commit"; exit 0; }

if ! git push origin main; then
  echo "git push failed; restoring queued post for a later retry."
  exit 1
fi

PROCESSING_PATH=""
SUCCESS=1

echo "Done — site will update in ~1 minute."
