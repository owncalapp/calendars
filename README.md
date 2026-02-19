# Calendars Repository

This repository stores human-maintained calendar source data.

## Structure

- `schemas/`: JSON Schema definitions for metadata and event files
- `data/**/<calendar-id>.yaml`: flat calendar file (simple mode)
- `data/**/<calendar-id>/calendar.yaml`: calendar metadata (split mode)
- `data/**/<calendar-id>/*.yaml`: event files (split mode, excluding `calendar.yaml`)
- `docs/`: contribution and style guides
- `scripts/validate.js`: schema and consistency checks

## Quick Start

```bash
npm install
npm run validate
```

## Data Model

Default format is flat-calendar:

- flat mode (default): one `<calendar-id>.yaml` file with metadata and `events`
- split mode (exception): one `calendar.yaml` and one or more event files

Calendars may be grouped in subdirectories (for example `data/ai-industry/`).
Use split mode when splitting data across multiple files is clearer (for example `cn-holidays`).

Event IDs must be globally unique across all calendars.
