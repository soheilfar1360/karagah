type EvidenceItem = {
  id: string;
  title?: string;
  summary?: string;
  content?: string;
  isCritical?: boolean;
};

type FinalAccusation = {
  killerId?: string;
  suspectId?: string;
  suspect?: string;
  killer?: string;
  motive?: string;
  method?: string;
  timeWindow?: string;
  timeline?: string;
  selectedEvidenceIds?: string[];
  evidenceIds?: string[];
  suspectExplanations?: Record<string, string>;
  explanation?: string;
};

type JudgeRequestBody = {
  accusation?: FinalAccusation;
  availableEvidence?: EvidenceItem[];
};

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

type JudgeResponse = JudgeResult & {
  judgedBy: "openai" | "local" | "error";
};

const MIN_JUDGE_DELAY_MS = 5000;

const TRUTH = {
  killerId: "suspect_mehtab",

  killerKeywords: ["suspect_mehtab", "mehtab", "مهتاب"],

  methodKeywords: [
    "poisoned_tea",
    "چای",
    "سم",
    "مسموم",
    "مسمومیت",
    "tea",
    "poison",
    "poisoned",
  ],

  timelineKeywords: [
    "21:10-21:30",
    "21:10",
    "21:30",
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
  const startedAt = Date.now();

  try {
    const body = (await request.json()) as JudgeRequestBody;

    const accusation = body.accusation ?? {};
    const availableEvidence = Array.isArray(body.availableEvidence)
      ? body.availableEvidence
      : [];

    const localResult = judgeLocally(accusation, availableEvidence);

    const aiResult = await judgeWithOpenAI({
      accusation,
      availableEvidence,
      localResult,
    });

    await ensureMinimumDelay(startedAt);

    return jsonResponse({
      ...(aiResult ?? localResult),
      judgedBy: aiResult ? "openai" : "local",
    } satisfies JudgeResponse);
  } catch (error) {
    console.error("Judge API error:", error);

    await ensureMinimumDelay(startedAt);

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
        judgedBy: "error",
      } satisfies JudgeResponse,
      500
    );
  }
}

function judgeLocally(
  accusation: FinalAccusation,
  availableEvidence: EvidenceItem[]
): JudgeResult {
  const killerText = [
    accusation.killerId,
    accusation.suspectId,
    accusation.suspect,
    accusation.killer,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const methodText = String(accusation.method ?? "").toLowerCase();

  const timelineText = [
    accusation.timeWindow,
    accusation.timeline,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const motiveText = String(accusation.motive ?? "").toLowerCase();

  const suspectExplanationsText = accusation.suspectExplanations
    ? Object.values(accusation.suspectExplanations).join(" ").toLowerCase()
    : "";

  const explanationText = String(accusation.explanation ?? "").toLowerCase();

  const allText = [
    killerText,
    methodText,
    timelineText,
    motiveText,
    suspectExplanationsText,
    explanationText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const killerScore = containsAny(allText, TRUTH.killerKeywords) ? 20 : 0;

  const motiveScore = containsAny(allText, TRUTH.motiveKeywords) ? 15 : 0;

  const methodScore = containsAny(allText, TRUTH.methodKeywords) ? 15 : 0;

  const timelineScore = containsAny(allText, TRUTH.timelineKeywords) ? 20 : 0;

  const selectedEvidenceIds =
    accusation.selectedEvidenceIds ?? accusation.evidenceIds ?? [];

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
    : Math.min(10, countNonEmptySuspectExplanations(accusation) * 3);

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
  accusation: FinalAccusation;
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

  const prompt = buildJudgePrompt({
    accusation,
    availableEvidence: evidenceForPrompt,
    localResult,
  });

  try {
    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
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
            type: "json_schema",
            name: "detective_judge_result",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                total: { type: "number" },
                breakdown: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    killer: { type: "number" },
                    suspect: { type: "number" },
                    motive: { type: "number" },
                    method: { type: "number" },
                    timeline: { type: "number" },
                    evidence: { type: "number" },
                    elimination: { type: "number" },
                  },
                  required: [
                    "killer",
                    "suspect",
                    "motive",
                    "method",
                    "timeline",
                    "evidence",
                    "elimination",
                  ],
                },
                feedback: { type: "string" },
                correctEvidence: {
                  type: "array",
                  items: { type: "string" },
                },
                missedEvidence: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: [
                "total",
                "breakdown",
                "feedback",
                "correctEvidence",
                "missedEvidence",
              ],
            },
          },
        },
      }),
    });

    if (!openAiResponse.ok) {
      const details = await openAiResponse.text();
      console.error("OpenAI request failed:", openAiResponse.status, details);
      return null;
    }

    const data = await openAiResponse.json();
    const outputText = extractOutputText(data);

    if (!outputText) {
      console.error("No structured output returned from OpenAI:", data);
      return null;
    }

    const parsed = safeParseJson(outputText);

    if (!parsed) {
      console.error("OpenAI returned invalid JSON:", outputText);
      return null;
    }

    return normalizeJudgeResult(parsed, localResult);
  } catch (error) {
    console.error("OpenAI judge failed:", error);
    return null;
  }
}

function buildJudgePrompt({
  accusation,
  availableEvidence,
  localResult,
}: {
  accusation: FinalAccusation;
  availableEvidence: Array<{
    id: string;
    title: string;
    summary: string;
    content: string;
    isCritical: boolean;
  }>;
  localResult: JudgeResult;
}) {
  return `
تو داور نهایی پرونده در بازی فارسی «کارآگاه» هستی.

پرونده: آخرین چای
دوره: دهه ۱۳۵۰

حقیقت پرونده:
- قاتل واقعی: suspect_mehtab / مهتاب
- روش واقعی قتل: poisoned_tea / مسمومیت با چای
- زمان واقعی قتل: 21:10-21:30
- انگیزه اصلی: ارث، وصیت‌نامه، منفعت مالی، حذف قربانی یا انتقام
- مدارک کلیدی:
  - evidence_003: فنجان چای
  - evidence_016: قوطی چای آشپزخانه
  - evidence_011: شهادت خانم ملک‌زاده
  - evidence_015: رسید عطاری
  - evidence_017: کلید یدکی
  - evidence_020: تناقض بارانی

قواعد نمره‌دهی:
- killer: از 20
- suspect: برابر با killer
- motive: از 15
- method: از 15
- timeline: از 20
- evidence: از 20
- elimination: از 10
- total: مجموع killer + motive + method + timeline + evidence + elimination
- suspect فقط alias است و نباید جداگانه به total اضافه شود.
- اگر بازیکن قاتل را درست گفته اما استدلالش ناقص است، killer می‌تواند کامل باشد ولی motive/method/evidence کم شود.
- feedback فارسی، جدی، تحلیلی و مناسب فضای پلیسی باشد.
- فقط JSON معتبر برگردان. هیچ متن اضافه‌ای ننویس.

اتهام بازیکن:
${JSON.stringify(accusation, null, 2)}

مدارک در دسترس بازیکن:
${JSON.stringify(availableEvidence, null, 2)}

نتیجه داوری داخلی برای راهنما، نه الزام:
${JSON.stringify(localResult, null, 2)}
`;
}

function normalizeJudgeResult(
  value: unknown,
  fallback: JudgeResult
): JudgeResult {
  if (typeof value !== "object" || value === null) {
    return fallback;
  }

  const objectValue = value as Record<string, unknown>;

  const rawBreakdown =
    typeof objectValue.breakdown === "object" && objectValue.breakdown !== null
      ? (objectValue.breakdown as Record<string, unknown>)
      : {};

  const killer = clampScore(readNumber(rawBreakdown.killer), 0, 20);
  const suspect = clampScore(readNumber(rawBreakdown.suspect), 0, 20) || killer;
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

  const correctEvidence = readStringList(objectValue.correctEvidence);
  const missedEvidence = readStringList(objectValue.missedEvidence);

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
  if (eliminationScore === 0) weakParts.push("رد منطقی سایر مظنون‌ها");

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

function countNonEmptySuspectExplanations(accusation: FinalAccusation) {
  if (!accusation.suspectExplanations) {
    return 0;
  }

  return Object.values(accusation.suspectExplanations).filter(
    (value) => value.trim().length > 0
  ).length;
}

function extractOutputText(data: unknown): string | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const objectData = data as {
    output_text?: unknown;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  if (typeof objectData.output_text === "string") {
    return objectData.output_text;
  }

  const text = objectData.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim();

  return text || null;
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

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item : ""))
    .filter(Boolean);
}

function clampScore(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

async function ensureMinimumDelay(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, MIN_JUDGE_DELAY_MS - elapsed);

  if (remaining > 0) {
    await wait(remaining);
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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