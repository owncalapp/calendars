# Style Guide

## File Layout

- Default layout: flat mode `data/**/<calendar-id>.yaml`.
- Exception layout: split mode `data/**/<calendar-id>/calendar.yaml` + one or more event files.
- Choose split mode when splitting data across multiple files is clearer (example: `cn-holidays`).

## Event Writing

- Prefer `all_day: true` for date-only events.
- Use `start` and `end` only when exact times matter.
- Keep titles short and neutral.
- Keep `notes` factual and brief.
- Use tags for filtering and grouping.

## Time Rules

- All-day events use `date` only.
- Timed events use ISO8601 in `start` and `end`.
- Use the calendar-level timezone as the default interpretation.

## Correction Rules

- For factual corrections, set `status: corrected`.
- Explain the correction in `notes`.
