# shop-38

## Git branches

Never create a branch — local (`git checkout -b`, `git switch -c`, `git branch <name>`) or remote (pushing to a branch name that doesn't exist on `origin` yet) — unless the user explicitly asks for one. Commit on the current branch, and push only to that branch's existing remote counterpart. If a task seems to need a new branch, ask first.

## apps/admin localization

All user-facing UI text in `apps/admin` (nav labels, headings, buttons, breadcrumbs, empty states, etc.) must be written in **Mongolian (Cyrillic script)**, not English.

- Keep untranslated: brand/product names ("Shop 38"), email addresses, and other technical identifiers that aren't language-dependent.
- `index.html` must have `lang="mn"`.
- Any font used for text that can contain Mongolian Cyrillic (headings, body, labels) must actually ship a Cyrillic subset — check the font package's files (e.g. `find node_modules/@fontsource-variable/<name>/files -name '*cyrillic*'`) before wiring it into `index.css`. Don't assume a Latin-first Google Font (e.g. Public Sans) covers Cyrillic; many don't. If you swap or add a heading/body font, verify with `document.fonts.load(...)` + `document.fonts.check(...)` in the browser rather than trusting it visually, since a missing subset silently falls back to the system font instead of erroring.
- Prefer fonts from the same family/foundry already in use when possible (e.g. this project pairs `Noto Serif Variable` for body text with `Noto Sans Variable` for headings — both Noto, both have full Cyrillic coverage) to keep the type system visually consistent.
