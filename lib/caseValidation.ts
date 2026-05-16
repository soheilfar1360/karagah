import type { CaseData } from "@/types/game";

export const CUSTOM_CASE_STORAGE_KEY = "karagah_custom_case";

type ValidationResult =
  | { ok: true; caseData: CaseData; errors: [] }
  | { ok: false; errors: string[] };

const evidenceTypes = new Set(["report", "photo", "document", "interview", "physical", "forensic", "archive"]);
const evidenceStatuses = new Set(["locked", "new", "viewed", "flagged", "critical"]);
const suspicionLevels = new Set(["low", "medium", "high", "critical"]);
const toolCategories = new Set([
  "interrogation",
  "forensic",
  "archive",
  "field",
  "technology",
  "surveillance",
]);

export function validateCaseData(value: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["فایل باید یک آبجکت JSON پرونده باشد."] };
  }

  requireString(value, "id", errors);
  requireString(value, "title", errors);
  requireString(value, "subtitle", errors);
  requireString(value, "era", errors);
  requireString(value, "location", errors);
  requireString(value, "duration", errors);
  requireString(value, "briefing", errors);
  requireString(value, "mission", errors);

  validateVictim(value.victim, errors);
  validateStringArray(value.phases, "phases", errors, 1);
  validateTools(value.availableTools, errors);
  validateSuspects(value.suspects, errors);
  validateEvidence(value.evidence, value.phases, errors);
  validateTimeline(value.timeline, errors);
  validateActions(value.actions, value.evidence, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, caseData: value as CaseData, errors: [] };
}

function validateVictim(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("victim باید یک آبجکت باشد.");
    return;
  }

  requireString(value, "victim.name", errors, "name");
  requireNumber(value, "victim.age", errors, "age");
  requireString(value, "victim.occupation", errors, "occupation");
  requireString(value, "victim.summary", errors, "summary");
}

function validateTools(value: unknown, errors: string[]) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("availableTools باید یک آرایه غیرخالی باشد.");
    return;
  }

  value.forEach((tool, index) => {
    if (!isRecord(tool)) {
      errors.push(`availableTools[${index}] باید آبجکت باشد.`);
      return;
    }

    requireString(tool, `availableTools[${index}].id`, errors, "id");
    requireString(tool, `availableTools[${index}].title`, errors, "title");
    requireString(tool, `availableTools[${index}].description`, errors, "description");

    if (typeof tool.available !== "boolean") {
      errors.push(`availableTools[${index}].available باید boolean باشد.`);
    }

    if (typeof tool.category !== "string" || !toolCategories.has(tool.category)) {
      errors.push(`availableTools[${index}].category معتبر نیست.`);
    }
  });
}

function validateSuspects(value: unknown, errors: string[]) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("suspects باید یک آرایه غیرخالی باشد.");
    return;
  }

  const ids = new Set<string>();
  value.forEach((suspect, index) => {
    if (!isRecord(suspect)) {
      errors.push(`suspects[${index}] باید آبجکت باشد.`);
      return;
    }

    const id = readString(suspect.id);
    if (!id) {
      errors.push(`suspects[${index}].id الزامی است.`);
    } else if (ids.has(id)) {
      errors.push(`شناسه مظنون تکراری است: ${id}`);
    } else {
      ids.add(id);
    }

    requireString(suspect, `suspects[${index}].name`, errors, "name");
    requireNumber(suspect, `suspects[${index}].age`, errors, "age");
    requireString(suspect, `suspects[${index}].relation`, errors, "relation");
    requireString(suspect, `suspects[${index}].motive`, errors, "motive");
    requireString(suspect, `suspects[${index}].alibi`, errors, "alibi");

    if (typeof suspect.suspicionLevel !== "string" || !suspicionLevels.has(suspect.suspicionLevel)) {
      errors.push(`suspects[${index}].suspicionLevel معتبر نیست.`);
    }
  });
}

function validateEvidence(value: unknown, phases: unknown, errors: string[]) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("evidence باید یک آرایه غیرخالی باشد.");
    return;
  }

  const phaseCount = Array.isArray(phases) ? phases.length : 0;
  const ids = new Set<string>();

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`evidence[${index}] باید آبجکت باشد.`);
      return;
    }

    const id = readString(item.id);
    if (!id) {
      errors.push(`evidence[${index}].id الزامی است.`);
    } else if (ids.has(id)) {
      errors.push(`شناسه مدرک تکراری است: ${id}`);
    } else {
      ids.add(id);
    }

    requireString(item, `evidence[${index}].title`, errors, "title");
    requireString(item, `evidence[${index}].summary`, errors, "summary");
    requireString(item, `evidence[${index}].content`, errors, "content");

    if (typeof item.type !== "string" || !evidenceTypes.has(item.type)) {
      errors.push(`evidence[${index}].type معتبر نیست.`);
    }

    if (typeof item.status !== "string" || !evidenceStatuses.has(item.status)) {
      errors.push(`evidence[${index}].status معتبر نیست.`);
    }

    const phase = item.phase;
    if (typeof phase !== "number" || !Number.isInteger(phase) || phase < 1 || phase > phaseCount) {
      errors.push(`evidence[${index}].phase باید بین 1 و تعداد فازها باشد.`);
    }
  });
}

function validateTimeline(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("timeline باید آرایه باشد.");
    return;
  }

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`timeline[${index}] باید آبجکت باشد.`);
      return;
    }

    requireString(item, `timeline[${index}].id`, errors, "id");
    requireString(item, `timeline[${index}].time`, errors, "time");
    requireString(item, `timeline[${index}].title`, errors, "title");
    requireString(item, `timeline[${index}].description`, errors, "description");
    requireNumber(item, `timeline[${index}].phase`, errors, "phase");
  });
}

function validateActions(value: unknown, evidence: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("actions باید آرایه باشد.");
    return;
  }

  const evidenceIds = new Set(
    Array.isArray(evidence)
      ? evidence.map((item) => (isRecord(item) ? readString(item.id) : "")).filter(Boolean)
      : []
  );

  value.forEach((action, index) => {
    if (!isRecord(action)) {
      errors.push(`actions[${index}] باید آبجکت باشد.`);
      return;
    }

    requireString(action, `actions[${index}].id`, errors, "id");
    requireString(action, `actions[${index}].title`, errors, "title");
    requireString(action, `actions[${index}].description`, errors, "description");

    if (!Array.isArray(action.unlockEvidenceIds)) {
      errors.push(`actions[${index}].unlockEvidenceIds باید آرایه باشد.`);
    } else {
      action.unlockEvidenceIds.forEach((id, idIndex) => {
        if (typeof id !== "string" || !evidenceIds.has(id)) {
          errors.push(`actions[${index}].unlockEvidenceIds[${idIndex}] به مدرک معتبر اشاره نمی‌کند.`);
        }
      });
    }
  });
}

function validateStringArray(value: unknown, label: string, errors: string[], minLength = 0) {
  if (!Array.isArray(value) || value.length < minLength || value.some((item) => typeof item !== "string")) {
    errors.push(`${label} باید آرایه‌ای از متن${minLength > 0 ? " و غیرخالی" : ""} باشد.`);
  }
}

function requireString(
  record: Record<string, unknown>,
  label: string,
  errors: string[],
  key = label
) {
  if (!readString(record[key])) {
    errors.push(`${label} الزامی است و باید متن باشد.`);
  }
}

function requireNumber(
  record: Record<string, unknown>,
  label: string,
  errors: string[],
  key = label
) {
  if (typeof record[key] !== "number" || !Number.isFinite(record[key])) {
    errors.push(`${label} باید عدد باشد.`);
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
