#!/usr/bin/env node
/**
 * Users First — blog build script.
 *
 * Reads Markdown files from blog/posts/, renders them into static HTML
 * pages, and regenerates the blog index and RSS feed.
 *
 * Drafts:
 *   A post is a draft when its frontmatter sets `status: draft` (or
 *   `published: false`, or the filename starts with an underscore).
 *   Drafts are skipped in normal builds so they live happily in the repo
 *   without ever appearing on the live site. To preview drafts locally,
 *   run with the DRAFTS=1 environment variable (`npm run build:drafts`).
 *
 * No network access required; all dependencies are local.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const POSTS_DIR = join(ROOT, 'blog', 'posts');
const BLOG_DIR = join(ROOT, 'blog');

const SITE = {
  title: 'Users First',
  tagline: 'Notes on building AI & games — from Columbus, Ohio.',
  url: 'https://www.usersfirst.com',
  blogUrl: 'https://www.usersfirst.com/blog',
  author: 'Users First',
};

const INCLUDE_DRAFTS = process.env.DRAFTS === '1' || process.argv.includes('--drafts');

/* ----------------------------- helpers ----------------------------- */

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isDraft(data, file) {
  if (basename(file).startsWith('_')) return true;
  if (data.status && String(data.status).toLowerCase() === 'draft') return true;
  if (data.published === false) return true;
  if (data.draft === true) return true;
  return false;
}

function formatDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return { display: '', iso: '', time: 0 };
  return {
    display: d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }),
    iso: d.toISOString().slice(0, 10),
    time: d.getTime(),
  };
}

function readingTime(markdown) {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/* ----------------------------- templates ----------------------------- */

function pageShell({ title, description, bodyClass, content, canonical, ogType = 'website' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="${ogType}">
  ${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
  <link rel="alternate" type="application/rss+xml" title="${esc(SITE.title)} Blog" href="/blog/feed.xml">
  <link rel="icon" type="image/png" href="/images/logos/usersfirst-logo_50x50.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/blog.css">
</head>
<body class="${bodyClass}">

  <header class="site-nav">
    <div class="container site-nav-inner">
      <a href="/" class="site-nav-logo">
        <img src="/images/logos/usersfirst-logo_646x220.png" alt="Users First">
      </a>
      <nav class="site-nav-links">
        <a href="/blog/">Blog</a>
        <a href="https://games.usersfirst.com">Games</a>
        <a href="https://ai.usersfirst.com">AI</a>
      </nav>
    </div>
  </header>

  <main class="landing">
${content}
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-inner">
        <div class="footer-logo">
          <img src="/images/logos/usersfirst-logo_646x220.png" alt="Users First">
        </div>
        <p class="footer-text">&copy; ${new Date().getFullYear()} Users First, LLC. All rights reserved.</p>
        <ul class="footer-links">
          <li><a href="/blog/">Blog</a></li>
          <li><a href="/blog/feed.xml">RSS</a></li>
          <li><a href="https://games.usersfirst.com">Games</a></li>
          <li><a href="https://ai.usersfirst.com">AI</a></li>
        </ul>
      </div>
      <p class="footer-colophon" title="Psalm 150 — Praise the LORD! Praise God in his sanctuary; praise him in his mighty heavens! Praise him for his mighty deeds; praise him according to his excellent greatness! Praise him with trumpet sound; praise him with lute and harp! Praise him with tambourine and dance; praise him with strings and pipe! Praise him with sounding cymbals; praise him with loud clashing cymbals! Let everything that has breath praise the LORD! Praise the LORD!">Ps. 150</p>
    </div>
  </footer>

  <script src="/js/main.js"></script>
</body>
</html>
`;
}

function postCard(post) {
  const draftBadge = post.draft ? `<span class="pillar-badge draft-badge">Draft</span>` : '';
  const tags = (post.tags || [])
    .map(t => `<span class="post-tag">${esc(t)}</span>`)
    .join('');
  return `        <a href="/blog/${esc(post.slug)}/" class="post-card fade-in">
          <div class="post-card-meta">
            <time datetime="${post.date.iso}">${post.date.display}</time>
            <span class="post-card-dot">&middot;</span>
            <span>${post.readingTime} min read</span>
            ${draftBadge}
          </div>
          <h2>${esc(post.title)}</h2>
          <p>${esc(post.summary)}</p>
          ${tags ? `<div class="post-tags">${tags}</div>` : ''}
          <span class="pillar-link">Read post &rarr;</span>
        </a>`;
}

function renderIndex(posts) {
  const cards = posts.length
    ? posts.map(postCard).join('\n\n')
    : `        <p class="blog-empty">No posts yet — check back soon.</p>`;

  const content = `    <section class="hero blog-hero">
      <div class="hero-content fade-in">
        <p class="blog-kicker">The Users First Blog</p>
        <h1 class="blog-title">${esc(SITE.title)} Journal</h1>
        <p class="hero-tagline">${esc(SITE.tagline)}</p>
        <a class="rss-link" href="/blog/feed.xml">
          <span class="rss-dot"></span> Subscribe via RSS
        </a>
      </div>
    </section>

    <section class="container">
      <div class="posts-grid">

${cards}

      </div>
    </section>`;

  return pageShell({
    title: `Blog — ${SITE.title}`,
    description: SITE.tagline,
    bodyClass: 'blog-page',
    canonical: SITE.blogUrl + '/',
    content,
  });
}

function renderPost(post) {
  const draftBanner = post.draft
    ? `      <div class="draft-banner">
        <strong>Draft preview</strong> — this post is not published and is hidden from the live site.
      </div>\n`
    : '';

  const tags = (post.tags || [])
    .map(t => `<span class="post-tag">${esc(t)}</span>`)
    .join('');

  const content = `    <article class="post container">
${draftBanner}      <a href="/blog/" class="post-back">&larr; All posts</a>
      <header class="post-header fade-in">
        <div class="post-card-meta">
          <time datetime="${post.date.iso}">${post.date.display}</time>
          <span class="post-card-dot">&middot;</span>
          <span>${post.readingTime} min read</span>
          <span class="post-card-dot">&middot;</span>
          <span>${esc(post.author)}</span>
        </div>
        <h1>${esc(post.title)}</h1>
        ${post.summary ? `<p class="post-lede">${esc(post.summary)}</p>` : ''}
        ${tags ? `<div class="post-tags">${tags}</div>` : ''}
      </header>

      <div class="post-body fade-in">
${post.html}
      </div>

      <footer class="post-footer fade-in">
        <a href="/blog/" class="pillar-link">&larr; Back to all posts</a>
      </footer>
    </article>`;

  return pageShell({
    title: `${post.title} — ${SITE.title}`,
    description: post.summary || SITE.tagline,
    bodyClass: 'blog-page post-page',
    canonical: `${SITE.blogUrl}/${post.slug}/`,
    ogType: 'article',
    content,
  });
}

function renderFeed(posts) {
  const items = posts
    .slice(0, 20)
    .map(p => {
      const link = `${SITE.blogUrl}/${p.slug}/`;
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(p.date.time).toUTCString()}</pubDate>
      <description>${esc(p.summary)}</description>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE.title)} Blog</title>
    <link>${SITE.blogUrl}/</link>
    <atom:link href="${SITE.blogUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${esc(SITE.tagline)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

/* ----------------------------- build ----------------------------- */

function loadPosts() {
  if (!existsSync(POSTS_DIR)) return [];
  const files = readdirSync(POSTS_DIR).filter(f => ['.md', '.markdown'].includes(extname(f).toLowerCase()));
  const posts = [];

  for (const file of files) {
    const raw = readFileSync(join(POSTS_DIR, file), 'utf8');
    const { data, content } = matter(raw);
    const draft = isDraft(data, file);

    if (draft && !INCLUDE_DRAFTS) continue;

    const slug = slugify(data.slug || data.title || basename(file, extname(file)));
    posts.push({
      slug,
      title: data.title || 'Untitled',
      summary: data.summary || data.description || '',
      author: data.author || SITE.author,
      tags: Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []),
      date: formatDate(data.date || statSync(join(POSTS_DIR, file)).mtime),
      readingTime: readingTime(content),
      draft,
      html: marked.parse(content),
    });
  }

  posts.sort((a, b) => b.date.time - a.date.time);
  return posts;
}

function clean() {
  // Remove previously generated post directories and feed, but never the
  // source posts/ directory or anything we don't own.
  if (!existsSync(BLOG_DIR)) return;
  for (const entry of readdirSync(BLOG_DIR)) {
    const full = join(BLOG_DIR, entry);
    if (entry === 'posts') continue;
    if (statSync(full).isDirectory()) {
      // Generated post dirs contain only an index.html we created.
      rmSync(full, { recursive: true, force: true });
    }
  }
}

function build() {
  mkdirSync(BLOG_DIR, { recursive: true });
  mkdirSync(POSTS_DIR, { recursive: true });
  clean();

  const posts = loadPosts();

  // Individual post pages.
  for (const post of posts) {
    const dir = join(BLOG_DIR, post.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), renderPost(post));
  }

  // Index + feed.
  writeFileSync(join(BLOG_DIR, 'index.html'), renderIndex(posts));
  writeFileSync(join(BLOG_DIR, 'feed.xml'), renderFeed(posts));

  const drafts = posts.filter(p => p.draft).length;
  console.log(
    `Built ${posts.length} post(s)` +
      (INCLUDE_DRAFTS ? ` (including ${drafts} draft(s))` : ` — drafts hidden`) +
      `.\n  → blog/index.html\n  → blog/feed.xml`
  );
}

build();
