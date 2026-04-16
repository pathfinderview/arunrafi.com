# Arun Rafi Blog — arunrafi.com

Personal blog hosted at arunrafi.com. Git repo deployed via **GitHub Pages** from `main` branch at `github.com/pathfinderview/arunrafi.com`. Custom domain set in `CNAME`.

## Strategic role
Everything this vault does flows into the **100 cr mission** (Rs 100 Cr revenue by Dec 2027). The blog is honest public thinking that builds audience and credibility, which feeds YouTube, the book, and every other surface. Essays that resonate here get repurposed elsewhere. If it doesn't serve 100 cr — directly or indirectly — don't write it.

## Folder structure
```
arunrafi.com/
├── drafts/            # WIP posts — Claude saves here first
├── queue/             # Finished posts waiting to publish
├── published/         # Source .md of posts that are live
├── *.html             # Live published pages (auto-generated)
├── index.html         # Homepage with post list (auto-updated)
├── style.css          # Site styles
├── publish.sh         # The publishing script
├── CNAME              # Custom domain config
└── .publish.log       # Cron run log
```

## Post format
- Line 1: Title (plain text, or `# Title`)
- Line 2: Blank
- Line 3+: Body paragraphs, separated by blank lines
- Filename = URL slug (lowercase-kebab-case): `burn-the-straight-line.md` → `2026-04-12-burn-the-straight-line.html`
- **Length: 200–500 words.** Short and sharp. If it's running long, cut or split.
- **No images.** Template is text-only. Don't include `![]()` syntax.

## Drafting workflow
When the user asks Claude to help with a post:
1. **Outline first** — confirm angle, key turn, ending before writing
2. **Read 2–3 recent posts in `published/`** to match voice
3. **Save draft to `drafts/`** as `kebab-case-title.md` — never straight to `queue/`
4. **Ask for approval** before moving draft to `queue/`
5. Only when user says "publish" / "ship it" / equivalent: `mv drafts/my-post.md queue/my-post.md`

The user writes straight to `queue/` only when a post is already finished and reviewed.

## Publishing pipeline
- **LaunchAgent:** `com.arunrafi.publish` fires 3x/day at **09:07, 14:07, 21:07**
- **Per run:** picks the **oldest** `.md` in `queue/`, wraps it in HTML, updates `index.html`, commits, and pushes to `origin main`
- **One post per run.** Queue of 10 = 10 posts over ~3.3 days. Plan accordingly.
- Source file moves from `queue/` → `published/` on success
- GitHub Pages rebuilds and serves within ~1 minute
- Log: `.publish.log`

## Voice
- Thoughtful, concise essays on technology, knowledge, AI, career
- Short paragraphs. Declarative sentences. No fluff, no hedging
- Not promotional — this is the thinking space, not the selling space
- Match tone by reading a few posts in `published/` before drafting

## Constraints
- No current-employer specifics
- No named clients or private conversations
- No political takes
- No AI-slop phrases ("delve", "it's worth noting that", "in today's fast-paced world")
- No images, no code blocks longer than ~5 lines (template doesn't handle them well)

## Troubleshooting
- **Cron not firing?** `launchctl list | grep arunrafi` — exit status should be 0. If 127, the script path in the plist is broken.
- **Reload LaunchAgent:** `launchctl unload ~/Library/LaunchAgents/com.arunrafi.publish.plist && launchctl load ~/Library/LaunchAgents/com.arunrafi.publish.plist`
- **Force-run publish:** `cd /Users/lab/Desktop/Arun/Blog/arunrafi.com && bash publish.sh`
- **Last run output:** `tail -30 .publish.log`
- **Push fails (conflict):** Someone edited remote. `git pull --rebase origin main`, then re-run publish.
- **Site not updating:** GitHub Pages deploy status at `github.com/pathfinderview/arunrafi.com/actions`
- **LaunchAgent plist:** `~/Library/LaunchAgents/com.arunrafi.publish.plist`

## Where this sits
Inside the `Arun` Obsidian vault at `/Users/lab/Desktop/Arun/`. Siblings:
- `../100 cr/` — the Rs 10 Cr mission tracker
- `../Youtube/Arun YT/`, `../Youtube/Aria/`, `../Youtube/The Cars Professor/` — YouTube channels

OpenClaw (background Mac assistant at `~/.openclaw/`) does not currently touch this repo. Blog publishing is standalone via the LaunchAgent.
