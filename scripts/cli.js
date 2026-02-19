#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const SCHEMA_DIR = path.join(ROOT, "schemas");

function die(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function readYaml(filePath) {
  return YAML.parse(fs.readFileSync(filePath, "utf8"));
}

function writeYaml(filePath, payload) {
  fs.writeFileSync(filePath, YAML.stringify(payload), "utf8");
}

function readPayload(filePath, label) {
  if (!filePath) die(`Missing --${label} <path>`);
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, "utf8");
  if (ext === ".json") return JSON.parse(raw);
  if (ext === ".yaml" || ext === ".yml") return YAML.parse(raw);
  die(`${label} file must be .json/.yaml/.yml`);
}

function walkYamlFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const out = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkYamlFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (/\.ya?ml$/.test(entry.name)) out.push(fullPath);
  }
  return out;
}

function isFlatCalendar(payload) {
  return (
    payload &&
    typeof payload === "object" &&
    typeof payload.calendar_id === "string" &&
    typeof payload.title === "string" &&
    Array.isArray(payload.events)
  );
}

function isSplitMeta(payload, filePath) {
  return (
    payload &&
    typeof payload === "object" &&
    path.basename(filePath) === "calendar.yaml" &&
    typeof payload.calendar_id === "string" &&
    typeof payload.title === "string"
  );
}

function isSplitEventFile(payload, filePath) {
  return (
    payload &&
    typeof payload === "object" &&
    path.basename(filePath) !== "calendar.yaml" &&
    typeof payload.calendar_id === "string" &&
    Array.isArray(payload.events) &&
    !("title" in payload)
  );
}

function buildIndex() {
  const files = walkYamlFiles(DATA_DIR);
  const index = new Map();

  for (const filePath of files) {
    const payload = readYaml(filePath);
    if (!payload || typeof payload !== "object") continue;

    if (isSplitMeta(payload, filePath)) {
      const id = payload.calendar_id;
      const entry = index.get(id) || {
        calendar_id: id,
        mode: "split",
        metaPath: null,
        dataPaths: [],
      };
      entry.mode = "split";
      entry.metaPath = filePath;
      index.set(id, entry);
      continue;
    }

    if (isFlatCalendar(payload)) {
      const id = payload.calendar_id;
      const entry = {
        calendar_id: id,
        mode: "flat",
        metaPath: filePath,
        dataPaths: [filePath],
      };
      index.set(id, entry);
      continue;
    }

    if (isSplitEventFile(payload, filePath)) {
      const id = payload.calendar_id;
      const entry = index.get(id) || {
        calendar_id: id,
        mode: "split",
        metaPath: null,
        dataPaths: [],
      };
      entry.mode = "split";
      entry.dataPaths.push(filePath);
      index.set(id, entry);
    }
  }

  for (const entry of index.values()) {
    entry.dataPaths.sort();
  }

  return index;
}

function loadSchemaValidators() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const calendarSchema = JSON.parse(
    fs.readFileSync(path.join(SCHEMA_DIR, "calendar.schema.json"), "utf8"),
  );
  const eventSchema = JSON.parse(
    fs.readFileSync(path.join(SCHEMA_DIR, "event.schema.json"), "utf8"),
  );

  ajv.addSchema(eventSchema);
  return {
    validateCalendar: ajv.compile(calendarSchema),
    validateEvent: ajv.compile(eventSchema),
    errorsText(errors) {
      return ajv.errorsText(errors, { separator: "; " });
    },
  };
}

function eventDateKey(event) {
  if (event.all_day) return event.date || "9999-12-31";
  return event.start || "9999-12-31T23:59:59Z";
}

function sortEvents(events) {
  return events.slice().sort((a, b) => {
    const ak = eventDateKey(a);
    const bk = eventDateKey(b);
    if (ak < bk) return -1;
    if (ak > bk) return 1;
    return (a.id || "").localeCompare(b.id || "");
  });
}

function loadAllEvents(index) {
  const out = [];
  for (const entry of index.values()) {
    if (entry.mode === "flat") {
      const payload = readYaml(entry.metaPath);
      for (const event of payload.events || []) {
        out.push({
          event,
          filePath: entry.metaPath,
          calendar_id: entry.calendar_id,
        });
      }
      continue;
    }

    for (const p of entry.dataPaths) {
      const payload = readYaml(p);
      for (const event of payload.events || []) {
        out.push({ event, filePath: p, calendar_id: entry.calendar_id });
      }
    }
  }
  return out;
}

function output(data, format) {
  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  console.log(YAML.stringify(data));
}

function ensureNoDuplicateEventId(index, eventId) {
  const all = loadAllEvents(index);
  const exists = all.find((x) => x.event && x.event.id === eventId);
  if (exists) {
    die(
      `Duplicate event id: ${eventId} in ${path.relative(ROOT, exists.filePath)}`,
    );
  }
}

function splitTargetPath(entry, event, yearOverride) {
  const source = yearOverride || (event.all_day ? event.date : event.start);
  if (!source || String(source).length < 4) {
    die(
      "Cannot infer split target year. Provide --year or valid event date/start.",
    );
  }
  const year = yearOverride || String(source).slice(0, 4);
  if (!/^\d{4}$/.test(year)) die("Invalid year for split calendar target file");
  const dir = entry.metaPath
    ? path.dirname(entry.metaPath)
    : path.join(DATA_DIR, entry.calendar_id);
  return path.join(dir, `${year}.yaml`);
}

function listCalendars(args) {
  const index = buildIndex();
  const format = args.format || "yaml";
  const rows = [];

  for (const [id, entry] of index.entries()) {
    const meta = entry.metaPath ? readYaml(entry.metaPath) : null;
    let eventCount = 0;
    if (entry.mode === "flat") {
      eventCount = meta && meta.events ? meta.events.length : 0;
    } else {
      for (const p of entry.dataPaths) {
        const payload = readYaml(p);
        eventCount += (payload.events || []).length;
      }
    }
    rows.push({
      calendar_id: id,
      title: meta && meta.title ? meta.title : "",
      mode: entry.mode,
      events: eventCount,
      path: entry.metaPath ? path.relative(ROOT, entry.metaPath) : "",
    });
  }

  rows.sort((a, b) => a.calendar_id.localeCompare(b.calendar_id));
  output(rows, format);
}

function listEvents(args) {
  const index = buildIndex();
  const format = args.format || "yaml";
  const calendarId = args.calendar;
  let rows = [];

  if (calendarId) {
    const entry = index.get(calendarId);
    if (!entry) die(`Calendar not found: ${calendarId}`);
    if (entry.mode === "flat") {
      rows = (readYaml(entry.metaPath).events || []).map((event) => ({
        ...event,
        calendar_id: calendarId,
      }));
    } else {
      for (const p of entry.dataPaths) {
        const payload = readYaml(p);
        rows.push(
          ...(payload.events || []).map((event) => ({
            ...event,
            calendar_id: calendarId,
          })),
        );
      }
    }
  } else {
    rows = loadAllEvents(index).map((x) => ({
      ...x.event,
      calendar_id: x.calendar_id,
    }));
  }

  rows = sortEvents(rows);
  output(rows, format);
}

function createCalendar(args) {
  const calendarId = args.calendar;
  if (!calendarId) die("Missing --calendar <id>");
  const mode = args.mode || "flat";

  const index = buildIndex();
  if (index.has(calendarId)) die(`Calendar already exists: ${calendarId}`);

  let payload;
  if (args.file) {
    payload = readPayload(args.file, "file");
  } else {
    const maintainers = args.maintainers
      ? String(args.maintainers)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const tags = args.tags
      ? String(args.tags)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    payload = {
      calendar_id: calendarId,
      title: args.title,
      description: args.description,
      locale: args.locale,
      timezone: args.timezone,
      maintainers,
      tags,
      update_frequency: args["update-frequency"] || args.update_frequency,
    };
    Object.keys(payload).forEach(
      (k) => payload[k] === undefined && delete payload[k],
    );
  }

  payload.calendar_id = calendarId;

  if (mode === "flat") {
    payload.events = payload.events || [];
  } else if (mode === "split") {
    delete payload.events;
  } else {
    die("Invalid --mode, use flat|split");
  }

  const { validateCalendar, errorsText } = loadSchemaValidators();
  if (!validateCalendar(payload)) {
    die(
      `Calendar schema validation failed: ${errorsText(validateCalendar.errors)}`,
    );
  }

  const baseDir = args.dir ? path.join(DATA_DIR, args.dir) : DATA_DIR;
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

  if (mode === "flat") {
    const targetPath = path.join(baseDir, `${calendarId}.yaml`);
    if (fs.existsSync(targetPath))
      die(`File exists: ${path.relative(ROOT, targetPath)}`);
    writeYaml(targetPath, payload);
    console.log(`Created calendar: ${path.relative(ROOT, targetPath)}`);
    return;
  }

  const dirPath = path.join(baseDir, calendarId);
  if (fs.existsSync(dirPath))
    die(`Directory exists: ${path.relative(ROOT, dirPath)}`);
  fs.mkdirSync(dirPath, { recursive: true });
  const targetPath = path.join(dirPath, "calendar.yaml");
  writeYaml(targetPath, payload);
  console.log(`Created calendar: ${path.relative(ROOT, targetPath)}`);
}

function updateCalendar(args) {
  const calendarId = args.calendar;
  if (!calendarId) die("Missing --calendar <id>");
  const patch = readPayload(args.patch, "patch");
  if (!patch || typeof patch !== "object" || Array.isArray(patch))
    die("Invalid patch payload");
  if ("calendar_id" in patch) die("Patch cannot change calendar_id");

  const index = buildIndex();
  const entry = index.get(calendarId);
  if (!entry || !entry.metaPath) die(`Calendar not found: ${calendarId}`);

  const current = readYaml(entry.metaPath);
  const next = { ...current, ...patch, calendar_id: calendarId };
  if (entry.mode === "flat") {
    next.events = current.events || [];
  } else {
    delete next.events;
  }

  const { validateCalendar, errorsText } = loadSchemaValidators();
  if (!validateCalendar(next)) {
    die(
      `Calendar schema validation failed: ${errorsText(validateCalendar.errors)}`,
    );
  }

  writeYaml(entry.metaPath, next);
  console.log(`Updated calendar: ${path.relative(ROOT, entry.metaPath)}`);
}

function deleteCalendar(args) {
  const calendarId = args.calendar;
  if (!calendarId) die("Missing --calendar <id>");
  if (!args.yes) die("Delete requires --yes");

  const index = buildIndex();
  const entry = index.get(calendarId);
  if (!entry || !entry.metaPath) die(`Calendar not found: ${calendarId}`);

  if (entry.mode === "flat") {
    fs.unlinkSync(entry.metaPath);
    console.log(`Deleted calendar: ${path.relative(ROOT, entry.metaPath)}`);
    return;
  }

  const dirPath = path.dirname(entry.metaPath);
  fs.rmSync(dirPath, { recursive: true, force: true });
  console.log(`Deleted calendar: ${path.relative(ROOT, dirPath)}`);
}

function createEvent(args) {
  const calendarId = args.calendar;
  if (!calendarId) die("Missing --calendar <id>");

  const index = buildIndex();
  const entry = index.get(calendarId);
  if (!entry) die(`Calendar not found: ${calendarId}`);

  const event = readPayload(args.event, "event");
  if (!event || typeof event !== "object" || Array.isArray(event))
    die("Invalid event payload");
  if (!event.id) die("Event must include id");
  event.updated_at = new Date().toISOString();

  ensureNoDuplicateEventId(index, event.id);
  const { validateEvent, errorsText } = loadSchemaValidators();
  if (!validateEvent(event)) {
    die(`Event schema validation failed: ${errorsText(validateEvent.errors)}`);
  }

  if (entry.mode === "flat") {
    const payload = readYaml(entry.metaPath);
    payload.events = payload.events || [];
    payload.events.push(event);
    payload.events = sortEvents(payload.events);
    writeYaml(entry.metaPath, payload);
    console.log(`Created event in ${path.relative(ROOT, entry.metaPath)}`);
    return;
  }

  const targetPath = splitTargetPath(entry, event, args.year);
  let payload;
  if (fs.existsSync(targetPath)) {
    payload = readYaml(targetPath);
  } else {
    payload = { calendar_id: calendarId, events: [] };
  }
  payload.events = payload.events || [];
  payload.events.push(event);
  payload.events = sortEvents(payload.events);
  writeYaml(targetPath, payload);
  console.log(`Created event in ${path.relative(ROOT, targetPath)}`);
}

function locateEventById(index, eventId) {
  const found = loadAllEvents(index).find(
    (x) => x.event && x.event.id === eventId,
  );
  return found || null;
}

function updateEvent(args) {
  const eventId = args.id;
  if (!eventId) die("Missing --id <event-id>");
  const patch = readPayload(args.patch, "patch");
  if (!patch || typeof patch !== "object" || Array.isArray(patch))
    die("Invalid patch payload");
  if ("id" in patch) die("Patch cannot change id");

  const index = buildIndex();
  const found = locateEventById(index, eventId);
  if (!found) die(`Event not found: ${eventId}`);

  const sourcePayload = readYaml(found.filePath);
  const sourceEvents = sourcePayload.events || [];
  const sourceIdx = sourceEvents.findIndex((e) => e.id === eventId);
  if (sourceIdx < 0)
    die(`Event not found in ${path.relative(ROOT, found.filePath)}`);

  const updated = { ...sourceEvents[sourceIdx], ...patch, id: eventId };
  updated.updated_at = new Date().toISOString();

  const { validateEvent, errorsText } = loadSchemaValidators();
  if (!validateEvent(updated)) {
    die(`Event schema validation failed: ${errorsText(validateEvent.errors)}`);
  }

  const entry = index.get(found.calendar_id);
  if (!entry) die(`Calendar not found for event: ${found.calendar_id}`);

  if (entry.mode === "flat") {
    sourceEvents[sourceIdx] = updated;
    sourcePayload.events = sortEvents(sourceEvents);
    writeYaml(found.filePath, sourcePayload);
    console.log(`Updated event in ${path.relative(ROOT, found.filePath)}`);
    return;
  }

  const targetPath = splitTargetPath(entry, updated, args.year);
  const sourcePathResolved = path.resolve(found.filePath);
  const targetPathResolved = path.resolve(targetPath);

  if (sourcePathResolved === targetPathResolved) {
    sourceEvents[sourceIdx] = updated;
    sourcePayload.events = sortEvents(sourceEvents);
    writeYaml(found.filePath, sourcePayload);
    console.log(`Updated event in ${path.relative(ROOT, found.filePath)}`);
    return;
  }

  sourcePayload.events = sourceEvents.filter((e) => e.id !== eventId);
  writeYaml(found.filePath, sourcePayload);

  let targetPayload;
  if (fs.existsSync(targetPath)) {
    targetPayload = readYaml(targetPath);
  } else {
    targetPayload = { calendar_id: found.calendar_id, events: [] };
  }
  targetPayload.events = targetPayload.events || [];
  targetPayload.events.push(updated);
  targetPayload.events = sortEvents(targetPayload.events);
  writeYaml(targetPath, targetPayload);

  console.log(`Updated event and moved to ${path.relative(ROOT, targetPath)}`);
}

function deleteEvent(args) {
  const eventId = args.id;
  if (!eventId) die("Missing --id <event-id>");
  if (!args.yes) die("Delete requires --yes");

  const index = buildIndex();
  const found = locateEventById(index, eventId);
  if (!found) die(`Event not found: ${eventId}`);

  const payload = readYaml(found.filePath);
  payload.events = (payload.events || []).filter((e) => e.id !== eventId);
  writeYaml(found.filePath, payload);
  console.log(`Deleted event from ${path.relative(ROOT, found.filePath)}`);
}

function sortEventFiles(paths) {
  const touched = [];
  for (const filePath of paths) {
    const payload = readYaml(filePath);
    if (
      !payload ||
      typeof payload !== "object" ||
      !Array.isArray(payload.events)
    ) {
      continue;
    }
    payload.events = sortEvents(payload.events);
    writeYaml(filePath, payload);
    touched.push({
      path: path.relative(ROOT, filePath),
      count: payload.events.length,
    });
  }
  return touched;
}

function sortEventsCommand(args) {
  const index = buildIndex();
  const calendarId = args.calendar;
  let targets = [];

  if (calendarId) {
    const entry = index.get(calendarId);
    if (!entry) die(`Calendar not found: ${calendarId}`);
    if (entry.mode === "flat") {
      targets = [entry.metaPath];
    } else {
      targets = entry.dataPaths.slice();
    }
  } else {
    for (const entry of index.values()) {
      if (entry.mode === "flat") {
        targets.push(entry.metaPath);
      } else {
        targets.push(...entry.dataPaths);
      }
    }
  }

  const touched = sortEventFiles(targets);
  console.log(
    YAML.stringify({
      sorted_files: touched.length,
      files: touched,
    }),
  );
}

function runValidate() {
  require("./validate.js");
}

function printHelp() {
  console.log(
    [
      "Usage:",
      "  npm run cli -- calendar list [--format json|yaml]",
      "  npm run cli -- calendar create --calendar <id> [--mode flat|split] [--file <path>] [--dir <subdir>]",
      "  npm run cli -- calendar update --calendar <id> --patch <path>",
      "  npm run cli -- calendar delete --calendar <id> --yes",
      "  npm run cli -- event list [--calendar <id>] [--format json|yaml]",
      "  npm run cli -- event create --calendar <id> --event <path> [--year <yyyy>]",
      "  npm run cli -- event update --id <event-id> --patch <path> [--year <yyyy>]",
      "  npm run cli -- event delete --id <event-id> --yes",
      "  npm run cli -- event sort [--calendar <id>]",
      "  npm run cli -- validate",
    ].join("\n"),
  );
}

function main() {
  const args = parseArgs(process.argv);
  const type = args._[0];
  const action = args._[1];

  if (!type || type === "help" || args.help) {
    printHelp();
    return;
  }

  if (type === "validate") {
    runValidate();
    return;
  }

  if (type === "calendar") {
    if (action === "list") return listCalendars(args);
    if (action === "create") return createCalendar(args);
    if (action === "update") return updateCalendar(args);
    if (action === "delete") return deleteCalendar(args);
    die(`Unknown calendar action: ${action || "(missing)"}`);
  }

  if (type === "event") {
    if (action === "list") return listEvents(args);
    if (action === "create") return createEvent(args);
    if (action === "update") return updateEvent(args);
    if (action === "delete") return deleteEvent(args);
    if (action === "sort") return sortEventsCommand(args);
    die(`Unknown event action: ${action || "(missing)"}`);
  }

  if (type === "list") return listEvents(args);
  if (type === "create") return createEvent(args);

  die(`Unknown command: ${type}`);
}

main();
