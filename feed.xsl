<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom">
<xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
<xsl:template match="/">
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title><xsl:value-of select="/rss/channel/title"/> — RSS Feed</title>
  <link rel="stylesheet" href="/style.css"/>
  <script src="/script.js" defer="defer"></script>
</head>
<body>
<a href="/">← Home</a>
<article>
  <h1>Subscribe — <xsl:value-of select="/rss/channel/title"/></h1>
  <p class="tagline"><xsl:value-of select="/rss/channel/description"/></p>

  <p>This is a feed for RSS readers. Paste the URL below into your feed reader (Feedly, Inoreader, NetNewsWire, Reeder, etc.) to get new essays delivered as they're published.</p>

  <pre style="background:rgba(127,127,127,.1);padding:.75rem 1rem;border-radius:6px;overflow-x:auto;font-size:.95rem;">https://arunrafi.com/feed.xml</pre>

  <p><small>New to RSS? It's the oldest and simplest way to follow a writer without giving up your email. One app, all your favourite writers, no algorithm.</small></p>

  <hr/>

  <h2>Recent essays</h2>
  <ul>
    <xsl:for-each select="/rss/channel/item">
      <li>
        <a>
          <xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute>
          <xsl:value-of select="title"/>
        </a>
        <span style="color:var(--muted);font-size:.9rem;"> · <xsl:value-of select="substring(pubDate, 6, 11)"/></span>
      </li>
    </xsl:for-each>
  </ul>
</article>
<footer>
  <p><a href="/">Home</a> · <a href="/about.html">About</a> · <a href="/now.html">Now</a></p>
</footer>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
