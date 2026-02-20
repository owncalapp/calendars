# Calendars Repository

This repository stores human-maintained calendar source data.

## Structure

- `schemas/`: JSON Schema definitions for metadata and event files
- `data/**/<calendar-id>.yaml`: flat calendar file (simple mode)
- `data/**/<calendar-id>/calendar.yaml`: calendar metadata (split mode)
- `data/**/<calendar-id>/*.yaml`: event files (split mode, excluding `calendar.yaml`)
- `docs/`: contribution and style guides
- `scripts/cli.js`: calendar/event CLI and validation entry

## Quick Start

```bash
npm install
npm run cli -- validate
```

## Calendar CLI

Basic usage:

```bash
# validate all calendars/events
npm run cli -- validate

# list calendars
npm run cli -- calendar list
npm run cli -- calendar list --format json

# create/update/delete a calendar
npm run cli -- calendar create --calendar demo-cal --mode flat --title "Demo" --locale en-US --timezone UTC --maintainers data-team --tags demo
npm run cli -- calendar update --calendar demo-cal --patch /path/to/calendar-patch.yaml
npm run cli -- calendar delete --calendar demo-cal --yes

# list events (global or by calendar)
npm run cli -- event list
npm run cli -- event list --calendar openai-model-releases --format json

# create/update/delete an event
npm run cli -- event create --calendar openai-model-releases --event /path/to/event.yaml
npm run cli -- event update --id openai-gpt-4o-2024-05-13 --patch /path/to/event-patch.yaml
npm run cli -- event delete --id openai-gpt-4o-2024-05-13 --yes

# sort events in files (all calendars or one calendar)
npm run cli -- event sort
npm run cli -- event sort --calendar cn-holidays
```

Commands:

- `calendar list`: `--format json|yaml` (optional, default `yaml`)
- `calendar create`: `--calendar <id>` (required), `--mode flat|split` (optional, default `flat`), `--file <path>` (optional), `--dir <subdir>` (optional), or use inline flags `--title --description --locale --timezone --maintainers --tags --update-frequency`
- `calendar update`: `--calendar <id> --patch <path>` (required)
- `calendar delete`: `--calendar <id> --yes` (required)
- `event list`: `--calendar <id>` (optional), `--format json|yaml` (optional, default `yaml`)
- `event create`: `--calendar <id> --event <path>` (required), `--year <yyyy>` (optional for split mode)
- `event update`: `--id <event-id> --patch <path>` (required), `--year <yyyy>` (optional for split mode)
- `event delete`: `--id <event-id> --yes` (required)
- `event sort`: `--calendar <id>` (optional, omitted means sort all calendars)
- `validate`: no options

Notes:

- Calendar and event writes are schema validated.
- Event IDs are checked globally for uniqueness on create.
- Event `create/update` auto-sets `updated_at` to current UTC.
- Split-mode event files are written to `data/**/<calendar-id>/<year>.yaml` based on `date`/`start` (or `--year`).

## Data Model

Default format is flat-calendar:

- flat mode (default): one `<calendar-id>.yaml` file with metadata and `events`
- split mode (exception): one `calendar.yaml` and one or more event files

Calendars may be grouped in subdirectories (for example `data/ai-industry/`).
Use split mode when splitting data across multiple files is clearer (for example `cn-holidays`).

Event IDs must be globally unique across all calendars.
