#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const SCHEMA_DIR = path.join(ROOT, "schemas");

function readYaml(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return YAML.parse(text);
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function listCalendarDirs() {
  if (!fs.existsSync(DATA_DIR)) return [];
  const result = [];

  function walk(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const hasCalendarYaml = entries.some(
      (entry) => entry.isFile() && entry.name === "calendar.yaml",
    );
    if (hasCalendarYaml) {
      result.push(dirPath);
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      walk(path.join(dirPath, entry.name));
    }
  }

  walk(DATA_DIR);
  return result.sort();
}

function listFlatCalendarFiles() {
  if (!fs.existsSync(DATA_DIR)) return [];
  const result = [];

  function walk(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/\.ya?ml$/.test(entry.name)) continue;
      if (entry.name === "calendar.yaml") continue;
      if (entry.name === "taxonomy.yaml") continue;
      if (/^\d{4}\.ya?ml$/.test(entry.name)) continue;
      result.push(fullPath);
    }
  }

  walk(DATA_DIR);
  return result.sort();
}

function main() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const calendarSchema = JSON.parse(
    fs.readFileSync(path.join(SCHEMA_DIR, "calendar.schema.json"), "utf8"),
  );
  const eventSchema = JSON.parse(
    fs.readFileSync(path.join(SCHEMA_DIR, "event.schema.json"), "utf8"),
  );

  ajv.addSchema(eventSchema);

  const validateCalendar = ajv.compile(calendarSchema);
  const validateEvent = ajv.compile(eventSchema);
  const seenEventIds = new Map();
  const seenCalendarIds = new Map();

  const calendarDirs = listCalendarDirs();
  const flatCalendarFiles = listFlatCalendarFiles();
  if (calendarDirs.length === 0 && flatCalendarFiles.length === 0) {
    fail("No calendars found under data/.");
    return;
  }

  for (const dirPath of calendarDirs) {
    const dirName = path.basename(dirPath);
    const files = fs.readdirSync(dirPath).sort();
    const metaPath = path.join(dirPath, "calendar.yaml");

    if (!fs.existsSync(metaPath)) {
      fail(`Missing metadata file: ${path.relative(ROOT, metaPath)}`);
      continue;
    }

    const meta = readYaml(metaPath);
    if (!validateCalendar(meta)) {
      fail(
        `${path.relative(ROOT, metaPath)} failed schema validation:\n` +
          ajv.errorsText(validateCalendar.errors, { separator: "\n" }),
      );
      continue;
    }
    if (Array.isArray(meta.events)) {
      fail(
        `${path.relative(ROOT, metaPath)} must not include events in split mode.`,
      );
      continue;
    }

    if (meta.calendar_id !== dirName) {
      fail(
        `${path.relative(
          ROOT,
          metaPath,
        )} calendar_id must match directory name "${dirName}".`,
      );
    }
    if (seenCalendarIds.has(meta.calendar_id)) {
      fail(
        `Duplicate calendar_id "${meta.calendar_id}" found in ${path.relative(
          ROOT,
          metaPath,
        )} and ${seenCalendarIds.get(meta.calendar_id)}.`,
      );
    } else {
      seenCalendarIds.set(meta.calendar_id, path.relative(ROOT, metaPath));
    }

    for (const file of files) {
      if (file === "calendar.yaml" || file === "calendar.yml") continue;
      if (!/\.ya?ml$/.test(file)) continue;

      const dataPath = path.join(dirPath, file);
      const payload = readYaml(dataPath);

      if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload) ||
        typeof payload.calendar_id !== "string" ||
        !Array.isArray(payload.events)
      ) {
        fail(
          `${path.relative(
            ROOT,
            dataPath,
          )} must be an object with calendar_id and events array.`,
        );
        continue;
      }

      if (payload.calendar_id !== meta.calendar_id) {
        fail(
          `${path.relative(
            ROOT,
            dataPath,
          )} calendar_id does not match ${path.relative(ROOT, metaPath)}.`,
        );
      }

      for (const event of payload.events) {
        if (!validateEvent(event)) {
          fail(
            `${path.relative(ROOT, dataPath)} has invalid event:\n` +
              ajv.errorsText(validateEvent.errors, { separator: "\n" }),
          );
          continue;
        }
        if (seenEventIds.has(event.id)) {
          fail(
            `Duplicate event id "${event.id}" found in ${path.relative(
              ROOT,
              dataPath,
            )} and ${seenEventIds.get(event.id)}.`,
          );
        } else {
          seenEventIds.set(event.id, path.relative(ROOT, dataPath));
        }
      }
    }
  }

  for (const flatPath of flatCalendarFiles) {
    const payload = readYaml(flatPath);
    if (!validateCalendar(payload)) {
      fail(
        `${path.relative(ROOT, flatPath)} failed schema validation:\n` +
          ajv.errorsText(validateCalendar.errors, { separator: "\n" }),
      );
      continue;
    }
    if (!Array.isArray(payload.events)) {
      fail(
        `${path.relative(ROOT, flatPath)} must include events array in flat mode.`,
      );
      continue;
    }

    const expectedId = path.basename(flatPath).replace(/\.ya?ml$/, "");
    if (payload.calendar_id !== expectedId) {
      fail(
        `${path.relative(
          ROOT,
          flatPath,
        )} calendar_id must match filename "${expectedId}".`,
      );
    }

    if (seenCalendarIds.has(payload.calendar_id)) {
      fail(
        `Duplicate calendar_id "${payload.calendar_id}" found in ${path.relative(
          ROOT,
          flatPath,
        )} and ${seenCalendarIds.get(payload.calendar_id)}.`,
      );
      continue;
    } else {
      seenCalendarIds.set(payload.calendar_id, path.relative(ROOT, flatPath));
    }

    for (const event of payload.events) {
      if (!validateEvent(event)) {
        fail(
          `${path.relative(ROOT, flatPath)} has invalid event:\n` +
            ajv.errorsText(validateEvent.errors, { separator: "\n" }),
        );
        continue;
      }
      if (seenEventIds.has(event.id)) {
        fail(
          `Duplicate event id "${event.id}" found in ${path.relative(
            ROOT,
            flatPath,
          )} and ${seenEventIds.get(event.id)}.`,
        );
      } else {
        seenEventIds.set(event.id, path.relative(ROOT, flatPath));
      }
    }
  }

  if (process.exitCode === 1) return;
  console.log("Validation passed.");
}

main();
