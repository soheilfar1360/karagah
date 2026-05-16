type EvidenceItem = {
  id: string;
  title?: string;
  summary?: string;
  content?: string;
  isCritical?: boolean;
};

type RawAccusation = Record<string, unknown>;

type JudgeBreakdown = {
  killer: number;
  suspect: number;
  motive: number;
  method: number;
  timeline: number;
  evidence: number;
  elimination: number;
};

type JudgeResult = {
  total: number;
  breakdown: JudgeBreakdown;
  feedback: string;
  correctEvidence: string[];
  missedEvidence: string[];
};

const TRUTH = {
  killerId: "suspect_mehtab",

  suspectKeywords: ["مهتاب", "mehtab", "suspect_mehtab"],

  methodKeywords: [
    "چای",
    "سم",
    "مسموم",
    "مسمومیت",
    "tea",
    "poison",
    "poisoned",
  ],

  timelineKeywords: [
    "21:10",
    "21:30",
    "21",
    "۹:۱۰",
    "۹:۳۰",
    "نه و ده",
    "نه و نیم",
    "بین ۹:۱۰ تا ۹:۳۰",
    "بین 21:10 تا 21:30",
  ],

  motiveKeywords: [
    "ارث",
    "وصیت",
    "وصیت‌نامه",
    "مالی",
    "انتقام",
    "حذف",
    "inheritance",
    "will",
    "revenge",
    "money",
  ],

  eliminationKeywords: [
    "رد",
    "حذف",
    "بی‌گناه",
    "بی گناه",
    "نمی‌توانسته",
    "نمی توانسته",
    "alibi",
    "innocent",
    "ruled out",
    "excluded",
  ],

  criticalEvidenceIds: [
    "evidence_003",
    "evidence_016",
    "evidence_011",
    "evidence_015",
    "evidence_017",
    "evidence_020",
  ],
};

export async function GET() {
  return jsonResponse({
    ok: true,
    message: "Detective judge API is running.",
    ai: Boolean(process.env.OPENAI_API_KEY),
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const accusation =
      typeof body.accusation === "object" && body.accusation !== null
        ? (body.accusation as RawAccusation)
        : (body as RawAccusation);

    const availableEvidence = Array.isArray(body.availableEvidence)
      ? (body.availableEvidence as EvidenceItem[])
      : [];

    const localResult = judgeLocally(accusation, availableEvidence);

    const aiResult = await judgeWithOpenAI({
      accusation,
      availableEvidence,
      localResult,
    });

   return jsonResponse({
  ...(aiResult ?? localResult),
  judgedBy: aiResult ? "openai" : "local",
});
  } catch (error) {
    console.error("Judge API error:", error);

    return jsonResponse(
      {
        total: 0,
        breakdown: {
          killer: 0,
          suspect: 0,
          motive: 0,
          method: 0,
          timeline: 0,
          evidence: 0,
          elimination: 0,
        },
        feedback:
          "داوری با خطای داخلی مواجه شد. داده‌های اتهام یا مدارک درست ارسال نشده‌اند.",
        correctEvidence: [],
        missedEvidence: TRUTH.criticalEvidenceIds,
      },
      500
    );
  }
}

function judgeLocally(
  accusation: RawAccusation,
  availableEvidence: EvidenceItem[]
): JudgeResult {
  const suspectText = readText(accusation, [
    "suspectId",
    "suspect",
    "killerId",
    "killer",
    "culpritId",
    "culprit",
    "selectedSuspect",
    "selectedKiller",
    "selectedCulprit",
    "accusedSuspect",
  ]);

  const methodText = readText(accusation, [
    "method",
    "murderMethod",
    "selectedMethod",
    "causeOfDeath",
    "weapon",
  ]);

  const motiveText = readText(accusation, [
    "motive",
    "selectedMotive",
    "reason",
  ]);

  const timelineText = readText(accusation, [
    "timeline",
    "time",
    "murderTime",
    "selectedTimeline",
    "timeWindow",
  ]);

  const explanationText = readText(accusation, [
    "explanation",
    "reasoning",
    "analysis",
    "notes",
    "finalExplanation",
  ]);

  const eliminatedSuspectsText = readText(accusation, [
    "eliminatedSuspects",
    "elimination",
    "excludedSuspects",
    "ruledOut",
  ]);

  const selectedEvidenceIds = readStringArray(accusation, [
    "evidenceIds",
    "selectedEvidenceIds",
    "evidence",
    "selectedEvidence",
    "proofIds",
  ]);

  const allText = [
    suspectText,
    methodText,
    motiveText,
    timelineText,
    explanationText,
    eliminatedSuspectsText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const killerScore = containsAny(
    `${suspectText} ${allText}`.toLowerCase(),
    TRUTH.suspectKeywords
  )
    ? 20
    : 0;

  const motiveScore = containsAny(
    `${motiveText} ${allText}`.toLowerCase(),
    TRUTH.motiveKeywords
  )
    ? 15
    : 0;

  const methodScore = containsAny(
    `${methodText} ${allText}`.toLowerCase(),
    TRUTH.methodKeywords
  )
    ? 15
    : 0;

  const timelineScore = containsAny(
    `${timelineText} ${allText}`.toLowerCase(),
    TRUTH.timelineKeywords
  )
    ? 20
    : 0;

  const correctEvidence = selectedEvidenceIds.filter((id) =>
    TRUTH.criticalEvidenceIds.includes(id)
  );

  const missedEvidence = TRUTH.criticalEvidenceIds.filter(
    (id) => !selectedEvidenceIds.includes(id)
  );

  const evidenceScore = Math.min(
    20,
    Math.round((correctEvidence.length / TRUTH.criticalEvidenceIds.length) * 20)
  );

  const eliminationScore = containsAny(allText, TRUTH.eliminationKeywords)
    ? 10
    : 0;

  const total =
    killerScore +
    motiveScore +
    methodScore +
    timelineScore +
    evidenceScore +
    eliminationScore;

  return {
    total,
    breakdown: {
      killer: killerScore,
      suspect: killerScore,
      motive: motiveScore,
      method: methodScore,
      timeline: timelineScore,
      evidence: evidenceScore,
      elimination: eliminationScore,
    },
    feedback: buildFeedback({
      total,
      killerScore,
      motiveScore,
      methodScore,
      timelineScore,
      evidenceScore,
      eliminationScore,
      correctEvidence,
      missedEvidence,
      availableEvidence,
    }),
    correctEvidence,
    missedEvidence,
  };
}

async function judgeWithOpenAI({
  accusation,
  availableEvidence,
  localResult,
}: {
  accusation: RawAccusation;
  availableEvidence: EvidenceItem[];
  localResult: JudgeResult;
}): Promise<JudgeResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const evidenceForPrompt = availableEvidence.map((item) => ({
    id: item.id,
    title: item.title ?? "",
    summary: item.summary ?? "",
    content: item.content ?? "",
    isCritical: Boolean(item.isCritical),
  }));

  const prompt = `
تو داور یک بازی کارآگاهی فارسی هستی.

باید فقط JSON معتبر برگردانی. هیچ متن اضافه‌ای ننویس.

حقیقت پرونده:
- قاتل: مهتاب
- شناسه قاتل: suspect_mehtab
- روش قتل: چای مسموم
- بازه زمانی قتل: 21:10 تا 21:30
- انگیزه اصلی: ارث، وصیت‌نامه، حذف قربانی، منفعت مالی یا انتقام
- مدارک کلیدی: ${TRUTH.criticalEvidenceIds.join(", ")}

قواعد امتیازدهی:
- killer: از 20
- suspect: برابر با killer
- motive: از 15
- method: از 15
- timeline: از 20
- evidence: از 20
- elimination: از 10
- total: مجموع دقیق از 100
- total نباید از جمع این موارد جدا باشد.
- suspect نباید جداگانه به total اضافه شود. فقط alias برای killer است.

ساختار خروجی دقیقاً:
{
  "total": number,
  "breakdown": {
    "killer": number,
    "suspect": number,
    "motive": number,
    "method": number,
    "timeline": number,
    "evidence": number,
    "elimination": number
  },
  "feedback": "string فارسی",
  "correctEvidence": ["evidence_id"],
  "missedEvidence": ["evidence_id"]
}

اتهام کاربر:
${JSON.stringify(accusation, null, 2)}

مدارک موجود:
${JSON.stringify(evidenceForPrompt, null, 2)}

نتیجه داوری داخلی برای راهنما:
${JSON.stringify(localResult, null, 2)}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        temperature: 0.2,
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI judge failed:", response.status, errorText);
      return null;
    }

    const data = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{
          text?: string;
          type?: string;
        }>;
      }>;
    };

    const text = extractOpenAIText(data);

    if (!text) {
      console.error("OpenAI judge returned empty text:", data);
      return null;
    }

    const parsed = safeParseJson(text);

    if (!parsed) {
      console.error("OpenAI judge returned non-JSON:", text);
      return null;
    }

    return normalizeJudgeResult(parsed, localResult);
  } catch (error) {
    console.error("OpenAI judge error:", error);
    return null;
  }
}

function extractOpenAIText(data: {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
}) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const textFromOutput = data.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim();

  return textFromOutput || "";
}

function normalizeJudgeResult(value: unknown, fallback: JudgeResult): JudgeResult {
  if (typeof value !== "object" || value === null) {
    return fallback;
  }

  const objectValue = value as Record<string, unknown>;

  const rawBreakdown =
    typeof objectValue.breakdown === "object" && objectValue.breakdown !== null
      ? (objectValue.breakdown as Record<string, unknown>)
      : {};

  const killer = clampScore(readNumber(rawBreakdown.killer), 0, 20);
  const suspectRaw = clampScore(readNumber(rawBreakdown.suspect), 0, 20);
  const suspect = suspectRaw || killer;

  const motive = clampScore(readNumber(rawBreakdown.motive), 0, 15);
  const method = clampScore(readNumber(rawBreakdown.method), 0, 15);
  const timeline = clampScore(readNumber(rawBreakdown.timeline), 0, 20);
  const evidence = clampScore(readNumber(rawBreakdown.evidence), 0, 20);
  const elimination = clampScore(readNumber(rawBreakdown.elimination), 0, 10);

  const total = clampScore(
    killer + motive + method + timeline + evidence + elimination,
    0,
    100
  );

  const feedback =
    typeof objectValue.feedback === "string" && objectValue.feedback.trim()
      ? objectValue.feedback.trim()
      : fallback.feedback;

  const correctEvidence = readArrayOfStrings(objectValue.correctEvidence);
  const missedEvidence = readArrayOfStrings(objectValue.missedEvidence);

  return {
    total,
    breakdown: {
      killer,
      suspect,
      motive,
      method,
      timeline,
      evidence,
      elimination,
    },
    feedback,
    correctEvidence:
      correctEvidence.length > 0 ? correctEvidence : fallback.correctEvidence,
    missedEvidence:
      missedEvidence.length > 0 ? missedEvidence : fallback.missedEvidence,
  };
}

function readText(source: RawAccusation, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number") {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === "string") return item;

          if (typeof item === "object" && item !== null) {
            const objectItem = item as Record<string, unknown>;

            return String(
              objectItem.id ??
                objectItem.value ??
                objectItem.title ??
                objectItem.name ??
                objectItem.label ??
                ""
            );
          }

          return "";
        })
        .filter(Boolean)
        .join(" ");
    }

    if (typeof value === "object" && value !== null) {
      const objectValue = value as Record<string, unknown>;

      const possibleText =
        objectValue.id ??
        objectValue.value ??
        objectValue.title ??
        objectValue.name ??
        objectValue.label;

      if (typeof possibleText === "string") {
        return possibleText;
      }
    }
  }

  return "";
}

function readStringArray(source: RawAccusation, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === "string") return item;

          if (typeof item === "object" && item !== null) {
            const objectItem = item as Record<string, unknown>;
            const id = objectItem.id ?? objectItem.value;

            return typeof id === "string" ? id : "";
          }

          return "";
        })
        .filter(Boolean);
    }
  }

  return [];
}

function readArrayOfStrings(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item : ""))
    .filter(Boolean);
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function clampScore(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function safeParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function buildFeedback({
  total,
  killerScore,
  motiveScore,
  methodScore,
  timelineScore,
  evidenceScore,
  eliminationScore,
  correctEvidence,
  missedEvidence,
  availableEvidence,
}: {
  total: number;
  killerScore: number;
  motiveScore: number;
  methodScore: number;
  timelineScore: number;
  evidenceScore: number;
  eliminationScore: number;
  correctEvidence: string[];
  missedEvidence: string[];
  availableEvidence: EvidenceItem[];
}) {
  const missedTitles = missedEvidence
    .map((id) => availableEvidence.find((item) => item.id === id)?.title ?? id)
    .join("، ");

  const weakParts: string[] = [];

  if (killerScore === 0) weakParts.push("قاتل");
  if (motiveScore === 0) weakParts.push("انگیزه");
  if (methodScore === 0) weakParts.push("روش قتل");
  if (timelineScore === 0) weakParts.push("زمان‌بندی");
  if (evidenceScore < 15) weakParts.push("مدارک کلیدی");
  if (eliminationScore === 0) weakParts.push("رد مظنون‌های دیگر");

  if (total >= 85) {
    return "تحلیل شما بسیار نزدیک به حقیقت پرونده است. مظنون اصلی، روش قتل، زمان‌بندی و بخش مهمی از مدارک کلیدی درست تشخیص داده شده‌اند.";
  }

  if (total >= 60) {
    return `تحلیل شما بخشی از حقیقت را پیدا کرده، اما هنوز کامل نیست. بخش‌هایی که نیاز به دقت بیشتر دارند: ${
      weakParts.join("، ") || "جزئیات تکمیلی"
    }. مدارک جاافتاده: ${missedTitles || "نامشخص"}.`;
  }

  return `اتهام نهایی هنوز با حقیقت پرونده فاصله دارد. بهتر است دوباره روی ${
    weakParts.join("، ") || "انگیزه، روش قتل، زمان‌بندی و مدارک کلیدی"
  } تمرکز کنید. مدارک جاافتاده: ${missedTitles || "نامشخص"}.`;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: corsHeaders(),
  });
}