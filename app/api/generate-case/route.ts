import { NextResponse } from "next/server";
import { validateCaseData } from "@/lib/caseValidation";

const DEFAULT_MODEL = "gpt-4.1-mini";

const caseDataSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "title",
    "subtitle",
    "era",
    "location",
    "duration",
    "briefing",
    "opening",
    "mission",
    "availableTools",
    "victim",
    "phases",
    "suspects",
    "evidence",
    "timeline",
    "actions",
    "truth",
  ],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    subtitle: { type: "string" },
    era: { type: "string" },
    location: { type: "string" },
    duration: { type: "string" },
    briefing: { type: "string" },
    opening: { type: "string" },
    mission: { type: "string" },
    availableTools: {
      type: "array",
      minItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "description", "available", "category"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          available: { type: "boolean" },
          category: {
            type: "string",
            enum: ["interrogation", "forensic", "archive", "field", "technology", "surveillance"],
          },
        },
      },
    },
    victim: {
      type: "object",
      additionalProperties: false,
      required: ["name", "age", "occupation", "summary"],
      properties: {
        name: { type: "string" },
        age: { type: "number" },
        occupation: { type: "string" },
        summary: { type: "string" },
      },
    },
    phases: {
      type: "array",
      minItems: 5,
      items: { type: "string" },
    },
    suspects: {
      type: "array",
      minItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "age", "relation", "motive", "alibi", "suspicionLevel", "notes"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          age: { type: "number" },
          relation: { type: "string" },
          motive: { type: "string" },
          alibi: { type: "string" },
          suspicionLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
          notes: { type: "string" },
        },
      },
    },
    evidence: {
      type: "array",
      minItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "title",
          "type",
          "phase",
          "summary",
          "content",
          "status",
          "relatedSuspects",
          "isCritical",
        ],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          type: {
            type: "string",
            enum: ["report", "photo", "document", "interview", "physical", "forensic", "archive"],
          },
          phase: { type: "number" },
          summary: { type: "string" },
          content: { type: "string" },
          status: { type: "string", enum: ["locked", "new", "viewed", "flagged", "critical"] },
          relatedSuspects: {
            type: "array",
            items: { type: "string" },
          },
          isCritical: { type: "boolean" },
        },
      },
    },
    timeline: {
      type: "array",
      minItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "time", "title", "description", "phase"],
        properties: {
          id: { type: "string" },
          time: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          phase: { type: "number" },
        },
      },
    },
    actions: {
      type: "array",
      minItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "description", "unlockEvidenceIds", "targetPhase"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          unlockEvidenceIds: {
            type: "array",
            items: { type: "string" },
          },
          targetPhase: { type: "number" },
        },
      },
    },
    truth: {
      type: "object",
      additionalProperties: false,
      required: ["killerId", "method", "timeline", "motive", "criticalEvidenceIds"],
      properties: {
        killerId: { type: "string" },
        method: { type: "string" },
        timeline: { type: "string" },
        motive: { type: "string" },
        criticalEvidenceIds: {
          type: "array",
          minItems: 3,
          items: { type: "string" },
        },
      },
    },
  },
} as const;

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/generate-case",
    method: "POST",
    body: { synopsis: "خلاصه پرونده کارآگاهی به فارسی..." },
  });
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

    if (!apiKey) {
      return safeError("کلید OpenAI روی سرور تنظیم نشده است.");
    }

    const body = await request.json().catch(() => null);
    const synopsis = typeof body?.synopsis === "string" ? body.synopsis.trim() : "";

    if (synopsis.length < 20) {
      return NextResponse.json(
        { error: "سیناپس باید حداقل چند جمله روشن درباره پرونده داشته باشد." },
        { status: 400 }
      );
    }

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions:
          "You generate playable Persian RTL detective game case data. Return only JSON that matches the schema. Do not use markdown. Keep all player-facing prose in Persian. Use stable ASCII ids. Make the case fair: evidence should reveal contradictions over phases, not expose the killer immediately.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Generate a complete CaseData object for the Karagah detective game from this synopsis.",
                  "The object must be playable with the existing UI fields: phases, suspects, evidence, timeline, actions, availableTools, victim, briefing, mission.",
                  "Use 5-6 phases, at least 4 suspects, and at least 12 evidence items.",
                  "Evidence phases must be valid phase numbers. First phase must include at least 3 unlocked/new evidence items.",
                  "Actions must unlock existing evidence ids and should advance the investigation.",
                  "Include a truth object with killerId, method, timeline, motive, criticalEvidenceIds.",
                  "All visible prose must be Persian. JSON strings must not contain markdown.",
                  `Synopsis: ${synopsis}`,
                ].join("\n"),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "karagah_generated_case",
            schema: caseDataSchema,
            strict: true,
          },
        },
      }),
    });

    const responseJson = await openAiResponse.json().catch(() => null);

    if (!openAiResponse.ok) {
      return safeError(readOpenAiError(responseJson));
    }

    const caseData = extractCaseData(responseJson);
    const validation = validateCaseData(caseData);

    if (!validation.ok) {
      return safeError("پرونده تولیدشده ساختار قابل استفاده ندارد.");
    }

    return NextResponse.json({
      caseData,
      generatedBy: "openai",
    });
  } catch {
    return safeError("سرویس تولید پرونده در دسترس نیست.");
  }
}

function extractCaseData(responseJson: unknown) {
  if (!isRecord(responseJson)) {
    throw new Error("Invalid OpenAI response");
  }

  if (typeof responseJson.output_text === "string") {
    return JSON.parse(responseJson.output_text);
  }

  const output = responseJson.output;
  if (!Array.isArray(output)) {
    throw new Error("Missing OpenAI output");
  }

  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;

    for (const content of item.content) {
      if (isRecord(content) && content.type === "output_text" && typeof content.text === "string") {
        return JSON.parse(content.text);
      }
    }
  }

  throw new Error("Missing OpenAI output text");
}

function readOpenAiError(responseJson: unknown) {
  if (isRecord(responseJson) && isRecord(responseJson.error) && typeof responseJson.error.message === "string") {
    return responseJson.error.message;
  }

  return "OpenAI نتوانست پرونده را تولید کند.";
}

function safeError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
