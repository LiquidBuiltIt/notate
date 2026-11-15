<!--
CHANGELOG PARSER CONTRACT — read before editing. Parsed by
scripts/release/changelog.mjs. It is regex-driven: deviate and an entry is
dropped without an error.

1. Section headers start with exactly "## " at column 0.
   - Unreleased: exactly `## Unreleased` (any case), nothing else on the line.
     It never ships: the build leaves it out of changelog.json.
   - Released: `## X.Y.Z — YYYY-MM-DD`. Only the three integers are read.
   - Any other "## " header is dropped, with every bullet under it.
2. Use an em dash "—" (not a hyphen) before the date.
3. No "### " subsections. One flat bullet list per section.
4. Entries are top-level bullets: "- " at column 0. Indented bullets are ignored.
5. Lead each bullet with a **bold** phrase. `code` spans are allowed. Any other
   markup shows as plain text, and HTML is always escaped.
6. A version section may have one blurb line directly under its heading, before
   the bullets, wrapped in single asterisks: *a short summary*.
7. `npm run version.bump` moves Unreleased into the new version section and
   leaves a fresh empty Unreleased. `npm run publish` refuses to ship a version
   that has no section with bullets here.
-->

# Changelog

All notable changes to Notate are documented in this file.

## Unreleased

- **New look.** The new tab page, the in-page menu, the note editor, Settings and every pop-up now share one printed-paper style.
- **Search bar with commands.** A bar at the bottom of the new tab rises when you hover it or press `/`. Type to find notes, or start with `/note` or `/notebook` to create one.
- **Search engine picker.** Choose a search engine in the bar and press Enter to search with it.
- **Board layout (preview).** Turn it on in Settings to put notes on a free board. Drag to move, drag the paper to pan, and Ctrl + wheel to zoom. It is off by default.
- **What's new button.** A new button next to Settings shows what changed in each version. A red dot tells you when an update has news.
- **Movable Notate button.** Drag the button on web pages to any corner. Notate remembers the corner.
- **Hidden sites.** Sites you hide with "For This Site" are saved. Settings shows them and lets you turn the menu back on.
- **Safer settings.** Saving Settings or hiding a site no longer undoes other changes you made at the same time.
- **Clearer notebook delete.** Deleting a notebook shows one warning that says its notes are kept.
- **Wide screens.** On a wide screen the page stays still and the notes scroll in their own box.

## 1.2.1 — 2026-11-09

*Security fixes for the note editor and note previews.*

- **Safer note editor.** The editor removes unsafe markup that a web page tries to add while you write.
- **Safer note previews.** Note cards show your text as plain text and never run it.
- **Safer links.** Web addresses in notes turn into links without running any code.
- **Exact site matching.** Related notes now come only from the same site, not from a different site with a similar address.
- **Protected menu.** Web pages can no longer click the Notate menu or its Save button for you.

## 1.2.0 — 2026-11-08

*Dependency updates and a first-install fix.*

- **Updated dependencies.** Libraries that Notate uses were updated to remove known security problems.
- **First-install fix.** The database no longer fails with an error the first time Notate starts.
