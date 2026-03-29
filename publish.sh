#!/bin/bash
# publish.sh — picks up .txt files from ~/Desktop/cowork/, wraps them in
# the site HTML template, commits to the repo, updates index.html, and pushes.
#
# Text file format:
#   Line 1: Post title
#   Line 2: (blank)
#   Line 3+: Body paragraphs (blank lines separate paragraphs)
#
# Filename becomes the URL slug, e.g. "the-next-thing.txt" → 2026-03-28-the-next-thing.html

set -euo pipefail

REPO_DIR="$HOME/Desktop/Projects/arunrafi.com"
QUEUE_DIR="$REPO_DIR/queue"
PUBLISHED_DIR="$REPO_DIR/published"
TODAY=$(date +%Y-%m-%d)
DAY_DISPLAY=$(date +"%d %b %Y" | sed 's/^0//')

mkdir -p "$PUBLISHED_DIR"

# Pick the oldest .txt file (one post per day)
filepath=$(ls -t "$QUEUE_DIR"/*.md 2>/dev/null | tail -1)

if [ -z "$filepath" ]; then
  echo "No posts found in $QUEUE_DIR"
  exit 0
fi

cd "$REPO_DIR"
git pull --rebase origin main 2>/dev/null || true

remaining=$(ls "$QUEUE_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "$remaining post(s) queued — publishing oldest one"

{
  filename=$(basename "$filepath" .md)
  slug=$(echo "$filename" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g')
  html_file="${TODAY}-${slug}.html"

  # Read title (line 1) and body (line 3+)
  title=$(head -1 "$filepath")
  body=$(tail -n +3 "$filepath")

  # Convert body paragraphs to <p> tags
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
  # Flush last paragraph
  if [ -n "$current" ]; then
    paragraphs="${paragraphs}  <p>${current}</p>\n"
  fi

  # Write the HTML post
  cat > "$REPO_DIR/$html_file" <<HTMLEOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title} — Arun Rafi</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
<a href="/">← Home</a>
<article>
  <h1>${title}</h1>
  <p><time datetime="${TODAY}">${DAY_DISPLAY}</time></p>

$(echo -e "$paragraphs")
</article>
</body>
</html>
HTMLEOF

  # Add link to index.html (after "<!-- newest on top -->" on the SECOND occurrence)
  # Insert as the first <li> after the inner <ul>
  NEW_LINK="      <li><a href=\"/${html_file}\">${title}<\/a><\/li>"
  sed -i '' "0,/<!-- newest on top -->/! {
    /<!-- newest on top -->/ a\\
${NEW_LINK}
  }" "$REPO_DIR/index.html"

  # Move source file to published
  mv "$filepath" "$PUBLISHED_DIR/"

  echo "Published: $html_file"
}

# Commit and push — only add the new post and updated index
git add "$html_file" index.html
git commit -m "Publish: $title" || { echo "Nothing to commit"; exit 0; }
git push origin main

echo "Done — site will update in ~1 minute."
