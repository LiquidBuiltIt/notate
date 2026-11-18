<!--
CHANGELOG PARSER CONTRACT — read before editing. Parsed by
scripts/release/changelog.mjs (`npm run changelog` reads it from the terminal).
It is regex-driven: deviate and an entry is dropped without an error.

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

- **Notes from this site.** The bar at the top of web pages is gone, so it no longer covers site menus. When a site has notes, the Notate menu shows "Notes From This Site" with a count. Click it to pick a note and open it.
- **Export a note.** The note window has an Export note button. It saves the note as a Markdown file you can share. Pictures are kept inside the file. The button is off until the note is saved.
- **Export a notebook.** The notebook window has an Export notebook button. It saves the notebook and all its notes as one Markdown file.
- **Export all notes.** Settings has an Export all notes button. It saves a backup file named `.notate` with a folder for each notebook, one Markdown file for each note, and all your data for a future restore. Export is only on the new tab page, never on a web page.
- **Smaller pictures.** A picture you drop, paste or pick is shrunk to fit 1600 pixels. It is saved as WebP when that makes it smaller, and kept as it is otherwise. The editor has a new button to insert a picture, and you can paste a copied picture. Files over 25 MB and files that are not pictures are refused.
- **Formats on note cards.** Cards show lists, checkboxes, headings and quotes as plain lines such as `• item` and `☐ task`.
- **Lists, headings and quotes.** The editor has new buttons for bullet lists, numbered lists, checklists, two heading sizes and quotes. You can also type `- `, `1. `, `[ ] `, `# `, `## ` or `> ` at the start of a line. Click a box to tick it, or press Ctrl + Enter.
- **Safer web pages.** A web page can no longer read your notes from other sites, or change, delete or export them. The Notate menu on a site now gets only that site's notes. Fake clicks and keys made by a page are ignored, and the page cannot see what you type in the note window.

## 2.0.0 — 2026-11-16

*A new printed-paper look, a search bar with commands, and a board layout to try.*

- **New look.** The new tab page, the in-page menu, the note editor, Settings and every pop-up now share one printed-paper style.
- **Search bar with commands.** A bar at the bottom of the new tab rises when you hover it or press `/`. Type to find notes, or start with `/note` or `/notebook` to create one.
- **Search engine picker.** Choose a search engine in the bar and press Enter to search with it.
- **Board layout (preview).** Turn it on in Settings to put notes on a free board. Drag to move, drag the paper to pan, and Ctrl + wheel to zoom. Drop a note on a notebook frame to file it. After you save a new note, click where it should go, or press Esc to drop it in a free spot. It is off by default.
- **The Notate logo is back.** The hand-drawn logo returns on the in-page button and the new tab.
- **What's new button.** A new button next to Settings shows what changed in each version. A red dot tells you when an update has news.
- **Movable Notate button.** Drag the button on web pages to any corner, or focus it and press the arrow keys. Notate remembers the corner. The hidden button no longer blocks clicks on the page under it.
- **New wallpapers.** Cork, wood, marble and ruled paper are real textures again, light enough that your notes stay easy to read.
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
