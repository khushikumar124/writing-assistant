# Nook — status

## Vision
A quiet space for writers to capture messy thoughts, collect them, and slowly
shape raw thinking into writing worth publishing. Not a blank page tool. Not an
AI tool. A replacement for notebooks and notes apps.

## Built

### Capture layer
- [x] ⌘K capture from every page, no friction
- [x] Loose tags, or none
- [x] Raw Thoughts separate from polished Ideas
- [x] Unlimited user-defined categories
- [x] Users can add their own prompts to Discover
- [x] PWA: installable, offline app shell, OS share-target
- [x] Offline captures queue locally and sync on reconnect

### Shape layer
- [x] Distraction-free editor with autosave
- [x] Merge several raw thoughts into one Idea
- [x] Thought rail in the editor — linked thoughts beside the draft, insertable
- [x] Attach/detach thoughts mid-draft

### Habit layer
- [x] "Last wrote X days ago"
- [x] Streak counter, based on words actually added
- [x] Message that varies with the writing pattern

### Ship layer
- [x] Mark shipped with link, outlet, and date
- [x] Shipped shelf with counts and words published
- [x] Public shelf at `/@handle`, opt-in, published work only
- [x] Markdown export

### Account & safety
- [x] Per-visitor sandbox accounts, self-expiring — no shared demo login
- [x] Rate limiting on sign-in, signup, resets, sandbox creation
- [x] Password reset by email, single-use tokens, hashed at rest
- [x] Soft delete + undo toast + 30-day bin
- [x] Search across thoughts, ideas, and drafts
- [x] Settings: profile, handle, bio, dark mode, password

### Cleanup
- [x] Discover collapsed from 4 modes into one filterable library
- [x] All AI framing removed; prompts are human-written and static
- [x] Mobile bottom nav

## Not built
- [ ] Publish directly to Substack / Medium.
      Medium's write API is retired and Substack has no public write API, so
      "export to Substack" can't mean an API call. The honest options are
      Markdown export (done) or a clipboard-formatted paste.
- [ ] Full-text search via SQLite FTS5 — `LIKE` is fine until someone has a
      few thousand pieces
- [ ] Editor: markdown preview
- [ ] Client bundle is 573 kB; worth code-splitting before launch
