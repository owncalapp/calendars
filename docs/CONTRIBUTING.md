# Contributing

## Rules

- Keep source data human-maintained.
- Add or edit events in `data/**/<calendar-id>.yaml` by default (flat mode).
- Use split-mode event files in `data/**/<calendar-id>/` only for split-mode calendars (for example `cn-holidays`).
- Every event must include a valid `source` URL.
- Event IDs must stay stable after merge.
- Do not rewrite old files for style-only changes.

## Pull Request Checklist

- Added or updated `source` links.
- Ran `npm run validate`.
- Kept `id` stable for existing events.

## ID Convention

Use lowercase kebab-case:

`<org-or-domain>-<event-key>-<yyyy-mm-dd>`

Example:

`openai-gpt-4o-2024-05-13`
