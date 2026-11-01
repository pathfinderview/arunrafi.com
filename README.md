# arunrafi.com

Static personal website deployed from `main` through GitHub Pages.

## Writing workspace

The parent README describes the ideas → drafts → pushed → published workflow. Keep private working drafts outside this checkout. Only place approved posts in `queue/`.

## Publish

Run `bash publish.sh --dry-run` to check the selected queued post. Run `bash publish.sh` for an approved publication. A post is plain title, blank line, then paragraphs. The script renders the oldest queued source, refreshes shared page additions and RSS, commits, and pushes to main. Use a clean checkout: publishing stages all changes.

Python 3 and Git are required, alongside Bash. GitHub Actions provides them. Author identity must be configured locally or by the workflow.

## Maintain shared page additions

Run `python3 scripts/enrich_site.py` after changing page content. It updates mobile viewport metadata, descriptions, canonical URLs, sharing metadata, related essays, follow links, robots.txt, and sitemap.xml. It leaves essay bodies untouched. Add a new essay's slug to a relevant `GROUPS` list for hand-picked related reading; unlisted posts receive two starting recommendations.

Homepage selections and descriptions live in index.html. Shared reading styles live in style.css. The theme switch works on pages using script.js. Standalone interactive tools retain their own designs.

## Following

subscribe.html offers RSS and explains email delivery through the independent Blogtrottr service. Readers enter their email there; this site stores no subscriber addresses. The free service is ad-supported. No publisher account or paid plan was created. Reference: https://blogtrottr.com/about

## Current pages

Now was refreshed on 1 November 2026 using the writing resumed in this workspace. Keep its date and claims current. About explains the AI-assisted drafting process. Existing essay text and URLs are preserved.
