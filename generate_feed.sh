#!/bin/bash
# generate_feed.sh — regenerates /feed.xml from published posts.
# Pairs each YYYY-MM-DD-<slug>.html in the repo root with its source .md
# in published/ to emit an RSS 2.0 feed with full content.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

SITE_URL="https://arunrafi.com"
SITE_TITLE="Arun Rafi"
SITE_DESC="Notes on knowledge work, AI, and what humans do next."
MAX_ITEMS=30

BUILD_DATE=$(date -u "+%a, %d %b %Y %H:%M:%S GMT")

feed_file="$REPO_DIR/feed.xml"

{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>'
  echo '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">'
  echo '<channel>'
  echo "  <title>${SITE_TITLE}</title>"
  echo "  <link>${SITE_URL}/</link>"
  echo "  <description>${SITE_DESC}</description>"
  echo '  <language>en</language>'
  echo "  <atom:link href=\"${SITE_URL}/feed.xml\" rel=\"self\" type=\"application/rss+xml\"/>"
  echo "  <lastBuildDate>${BUILD_DATE}</lastBuildDate>"

  # Find dated HTML files (YYYY-MM-DD-*.html), reverse-sort so newest first
  ls -1 [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-*.html 2>/dev/null | sort -r | head -n "$MAX_ITEMS" | while read -r html; do
    date_part=$(echo "$html" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
    slug=$(echo "$html" | sed -E "s/^${date_part}-//; s/\.html$//")

    # Find matching source .md for body; look in published/ first, then queue/
    md=""
    if [ -f "published/${slug}.md" ]; then md="published/${slug}.md"
    elif [ -f "queue/${slug}.md" ]; then md="queue/${slug}.md"
    fi

    if [ -n "$md" ]; then
      title=$(head -1 "$md" | sed 's/^#* *//')
      body=$(tail -n +3 "$md")
    else
      # Fallback: parse title from HTML <h1>
      title=$(grep -oE '<h1>[^<]+</h1>' "$html" | head -1 | sed 's/<[^>]*>//g')
      body=""
    fi

    # RFC 822 pub date — macOS date flavor
    pub_date=$(date -j -f "%Y-%m-%d" "$date_part" "+%a, %d %b %Y 09:00:00 +0530" 2>/dev/null || echo "$date_part")

    # Build paragraph HTML from body for <content:encoded>-style description
    paragraphs=""
    current=""
    while IFS= read -r line || [ -n "$line" ]; do
      if [ -z "$line" ]; then
        if [ -n "$current" ]; then
          paragraphs="${paragraphs}<p>${current}</p>"
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
    [ -n "$current" ] && paragraphs="${paragraphs}<p>${current}</p>"

    # XML-escape title
    safe_title=$(echo "$title" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')

    echo '  <item>'
    echo "    <title>${safe_title}</title>"
    echo "    <link>${SITE_URL}/${html}</link>"
    echo "    <guid isPermaLink=\"true\">${SITE_URL}/${html}</guid>"
    echo "    <pubDate>${pub_date}</pubDate>"
    echo "    <description><![CDATA[${paragraphs}]]></description>"
    echo '  </item>'
  done

  echo '</channel>'
  echo '</rss>'
} > "$feed_file"

echo "Feed written: $feed_file"
