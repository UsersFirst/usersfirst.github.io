# Users First — Blog

The blog is generated from Markdown. You write posts as `.md` files in
`blog/posts/`, push to `main`, and a GitHub Actions workflow rebuilds the site
and deploys it. **No HTML to hand-edit.**

## Writing a new post

1. Create a file in `blog/posts/`, e.g. `2026-07-01-my-post.md`.
2. Start it with frontmatter (the block between `---` lines):

   ```markdown
   ---
   title: My Post Title
   date: 2026-07-01
   summary: One sentence that shows up in the index and previews.
   author: Users First
   status: published        # or: draft
   tags:
     - games
     - design
   ---

   Your post content in **Markdown** goes here.
   ```

3. Write the body in Markdown (headings, lists, links, code blocks, quotes — all supported).
4. Commit and push to `main`. The site rebuilds and the post goes live.

## Drafts vs. published

A post is treated as a **draft** (kept in the repo, hidden from the live site)
if **any** of these are true:

- the frontmatter has `status: draft`
- the frontmatter has `published: false`
- the filename starts with an underscore, e.g. `_my-draft.md`

To **publish** a draft: set `status: published` (and optionally rename the file
to drop the leading `_`). That's the only change needed.

## Frontmatter fields

| Field     | Required | Notes                                                        |
|-----------|----------|--------------------------------------------------------------|
| `title`   | yes      | Post title.                                                  |
| `date`    | yes      | `YYYY-MM-DD`. Controls ordering (newest first).              |
| `summary` | recommended | Shown on the index, post lede, and RSS feed.              |
| `status`  | recommended | `published` or `draft`. Defaults to published.            |
| `author`  | no       | Defaults to "Users First".                                   |
| `tags`    | no       | A list; rendered as pills.                                   |
| `slug`    | no       | Override the URL slug (defaults to a slug of the title).     |

## Previewing locally

```bash
npm install          # first time only
npm run build        # build published posts → blog/
npm run build:drafts # build including drafts (for previewing work-in-progress)
npm run serve        # serve at http://localhost:8080
```

`npm run build:drafts` renders drafts with a visible "Draft preview" banner so
you can see unfinished work without publishing it.

## How it deploys

`.github/workflows/deploy.yml` runs on every push to `main`: it installs
dependencies, runs `npm run build`, and deploys the site to GitHub Pages.

> **One-time setup:** In the repo's **Settings → Pages**, set **Source** to
> **GitHub Actions**. (Previously the site deployed straight from the branch;
> the build step requires the Actions source.)
