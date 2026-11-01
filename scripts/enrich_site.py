#!/usr/bin/env python3
"""Refresh shared page metadata, reading links and the public sitemap.

Run after rendering a post. No third-party packages required.
"""
from pathlib import Path
import html
import hashlib
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
BASE = 'https://arunrafi.com'
GROUPS = [
    ['the-shape-of-mastery', 'taste-is-technical', 'centipedes-dilemma', 'law-of-reversed-effort', 'learning-in-motion'],
    ['the-effort-moves', 'plain-text-is-the-test', 'think-slow-build-fast', 'the-compression-trap', 'the-cost-of-one-person'],
    ['the-daemon-returns', 'the-frankenstein-moment', 'past-words-present-voice', 'world-without-cameras'],
    ['the-last-promotion', 'knowledge-works-instagram-moment', 'knowledge-works-worst-case-by-2027', 'the-new-caste-system-is-a-subscription', 'the-head-start-is-gone'],
    ['burn-the-straight-line', 'what-iq-actually-measures-now', 'why-school-loses-to-a-patient-tutor', 'the-next-365-days', 'pareto-says', 'millennial-bug', 'vertical-writing', 'blender-spill', 'sweat-bass-sunburn-eye-contact'],
]
DESCRIPTIONS = {
    'mechanical-watch.html': 'Learn how a watch works without a battery. Explore a moving 3D model together, with simple explanations, things to try and questions to discuss.',
    'subscribe.html': 'Receive new essays by Arun Rafi through email or your preferred RSS reader.',
    'index.html': 'Short essays by Arun Rafi on learning, work, technology, and how we live.',
    'about.html': 'About Arun Rafi and the questions behind these essays on learning, work, technology, and life.',
    'now.html': 'What Arun Rafi is writing and thinking about now.',
    'tools.html': 'Interactive experiments by Arun Rafi: explore a mechanical watch, baby names, ELIZA, tokens, and long-context attention.',
    'baby-names.html': 'Explore how the popularity of baby names changes over time.',
    'eliza.html': 'Try a recreation of ELIZA, an early chatbot, and explore the history behind it.',
    'token-calculator.html': 'Explore how text is split into tokens and how conversation length affects token use.',
    'the-middle-fades.html': 'An interactive illustration of how information in the middle of a long context can get overlooked.',
}

def plain(value):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', value)).split())

def excerpt(value, limit=155):
    value = plain(value)
    return value if len(value) <= limit else value[:limit - 1].rsplit(' ', 1)[0] + '…'


def enrich():
    pages = sorted(ROOT.glob('*.html'))
    summaries = json.loads((ROOT / 'data/essay-summaries.json').read_text())
    posts = {}
    for path in pages:
        match = re.match(r'\d{4}-\d{2}-\d{2}-(.+)\.html$', path.name)
        if match:
            heading = re.search(r'<h1[^>]*>(.*?)</h1>', path.read_text(), re.S)
            if heading:
                posts[match[1]] = (path.name, plain(heading[1]))
    for path in pages:
        source = path.read_text()
        if path.name == 'index.html':
            def add_summary(match):
                filename, title = match.group(1), match.group(2)
                slug = re.sub(r'^\d{4}-\d{2}-\d{2}-|\.html$', '', filename)
                summary = summaries.get(slug)
                if summary is None:
                    article = (ROOT / filename).read_text()
                    paragraphs = re.findall(r'<p\b[^>]*>(.*?)</p>', article, re.S)
                    body = [p for p in paragraphs if '<time' not in p and 'read-time' not in p]
                    summary = excerpt(body[0]) if body else ''
                return f'<li><a href="/{filename}">{title}</a><p class="essay-summary">{html.escape(summary)}</p></li>'
            def update_latest(match):
                return re.sub(r'<li><a href="/([^"/]+\.html)">(.*?)</a>(?:<p[^>]*>.*?</p>)?</li>', add_summary, match.group(0), flags=re.S)
            source = re.sub(r'<section id="latest">.*?</section>', update_latest, source, flags=re.S)
        title = plain(re.search(r'<title>(.*?)</title>', source, re.S | re.I)[1])
        paragraphs = re.findall(r'<p\b[^>]*>(.*?)</p>', source, re.S | re.I)
        body = [p for p in paragraphs if '<time' not in p and 'read-time' not in p]
        description = DESCRIPTIONS.get(path.name, excerpt(body[0]) if body else title)
        url = BASE + ('/' if path.name == 'index.html' else '/' + path.name)
        # Replace only the managed metadata; repeated runs are idempotent.
        source = re.sub(r'\s*<meta\b(?=[^>]*(?:name=["\'](?:viewport|description|twitter:card|twitter:title|twitter:description)["\']|property=["\']og:[^"\']+["\']))[^>]*>', '', source, flags=re.I)
        source = re.sub(r'\s*<link\b(?=[^>]*rel=["\']canonical["\'])[^>]*>', '', source, flags=re.I)
        is_post = bool(re.match(r'\d{4}-\d{2}-\d{2}-', path.name))
        fields = [
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            f'<meta name="description" content="{html.escape(description, quote=True)}">',
            f'<link rel="canonical" href="{url}">',
            f'<meta property="og:title" content="{html.escape(title, quote=True)}">',
            f'<meta property="og:description" content="{html.escape(description, quote=True)}">',
            f'<meta property="og:url" content="{url}">',
            f'<meta property="og:type" content="{"article" if is_post else "website"}">',
            '<meta property="og:site_name" content="Arun Rafi">',
            '<meta name="twitter:card" content="summary">',
            f'<meta name="twitter:title" content="{html.escape(title, quote=True)}">',
            f'<meta name="twitter:description" content="{html.escape(description, quote=True)}">',
        ]
        source = re.sub(r'</head>', '  ' + '\n  '.join(fields) + '\n</head>', source, count=1, flags=re.I)
        source = re.sub(r'\s*<!-- related:start -->.*?<!-- related:end -->\s*', '\n', source, flags=re.S)
        if is_post:
            slug = re.sub(r'^\d{4}-\d{2}-\d{2}-|\.html$', '', path.name)
            group = next((g for g in GROUPS if slug in g), ['the-effort-moves', 'plain-text-is-the-test'])
            choices = [posts[key] for key in group if key != slug and key in posts][:2]
            links = '\n'.join(f'    <li><a href="/{filename}">{html.escape(heading)}</a></li>' for filename, heading in choices)
            related = f'''<!-- related:start -->
<section class="related-reading" aria-labelledby="related-title">
  <h2 id="related-title">Read next</h2>
  <ul>
{links}
  </ul>
</section>
<!-- related:end -->
'''
            source = source.replace('</article>', '</article>\n' + related, 1)
        source = re.sub(r'\s*<!-- follow:start -->.*?<!-- follow:end -->\s*', '\n', source, flags=re.S)
        if '/style.css' in source and path.name != 'subscribe.html':
            note = '''<!-- follow:start -->
<p class="follow-note">New essays, occasionally. <a href="/subscribe.html">Follow by email or RSS</a>.</p>
<!-- follow:end -->
'''
            source = source.replace('<footer>', note + '<footer>', 1)
        for asset in ['style.css', 'script.js', 'tools.css']:
            version = hashlib.sha256((ROOT / asset).read_bytes()).hexdigest()[:10]
            source = re.sub(r'(["\'])/' + re.escape(asset) + r'(?:\?[^"\']*)?\1',
                            '"/' + asset + '?v=' + version + '"', source)
        path.write_text(source)
    ET.register_namespace('', 'http://www.sitemaps.org/schemas/sitemap/0.9')
    tree = ET.Element('{http://www.sitemaps.org/schemas/sitemap/0.9}urlset')
    for path in pages:
        if path.name == '404.html':
            continue
        element = ET.SubElement(tree, 'url')
        ET.SubElement(element, 'loc').text = BASE + ('/' if path.name == 'index.html' else '/' + path.name)
    ET.indent(tree)
    ET.ElementTree(tree).write(ROOT / 'sitemap.xml', encoding='utf-8', xml_declaration=True)
    (ROOT / 'robots.txt').write_text('User-agent: *\nAllow: /\n\nSitemap: ' + BASE + '/sitemap.xml\n')
    print(f'Enriched {len(pages)} pages; linked {len(posts)} essays.')

if __name__ == '__main__':
    enrich()
