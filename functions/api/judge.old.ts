type Env = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

type EvidenceItem = {
  id: string;
  title: string;
  summary: string;
  content?: string;
  isCritical?: boolean;
};

type FinalAccusation = {
  killerId: string;
  motive: string;
  method: string;
  timeWindow: string;
  selectedEvidenceIds: string[];
  suspectExplanations: Record<string, string>;
};

type JudgeBreakdown = {
  killer: number;
  motive: number;
  method: number;
  timeWindow: number;
  evidence: number;
  explanations: number;
};

type JudgeResult = {
  total: number;
  breakdown: JudgeBreakdown;
  feedback: string;
  correctEvidence: string[];
  missedEvidence: string[];
};

type JudgeRequestBody = {
  accusation: FinalAccusation;
  availableEvidence: EvidenceItem[];
};

const CASE_TRUTH = {
  killerId: "suspect_mehtab",
  methodKeywords: ["poisoned_tea", "poison", "سم", "مسموم", "چای", "فنجان", "قوطی"],
  motiveKeywords: ["ارث", "میراث", "وصیت", "انتقام", "حسادت", "پول", "مالی", "سود"],
  timeKeywords: ["21:10", "21:30", "۲۱:۱۰", "۲۱:۳۰", "نه و ده", "نه و نیم", "9:10", "9:30"],
  criticalEvidenceIds: [
    "evidence_003",
    "evidence_016",
    "evidence_011",
    "evidence_015",
    "evidence_017",
    "evidence_020",
  ],
};

export async function onRequestOptions() {
  return jsonResponse({ ok: true });
}

export async function onRequestGet() {
  return jsonResponse({
    ok: true,
    message: "Detective judge API is running.",
  });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const { request, env } = context;
    const body = (await request.json()) as JudgeRequestBody;

    if (!isValidJudgeRequest(body)) {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    /*
      داوری بازی نباید فقط به OpenAI وابسته باشد.
      اگر کلید API نباشد، مدل خطا بدهد، JSON خراب برگردد، یا پروژه لوکال اجرا شود،
      همین داوری deterministic نتیجه را برمی‌گرداند تا صفحه روی «در حال داوری...» گیر نکند.
    */
    const fallbackResult = judgeLocally(body);

    if (!env.OPENAI_API_KEY) {
      return jsonResponse(fallbackResult);
    }

    try {
      const prompt = buildJudgePrompt(body);
      const model = env.OPENAI_MODEL || "gpt-4.1-mini";

      const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: prompt,
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
                      motive: { type: "number" },
                      method: { type: "number" },
                      timeWindow: { type: "number" },
                      evidence: { type: "number" },
                      explanations: { type: "number" },
                    },
                    required: [
                      "killer",
                      "motive",
                      "method",
                      "timeWindow",
                      "evidence",
                      "explanations",
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
        console.error("OpenAI judge failed:", details);
        return jsonResponse(fallbackResult);
      }

      const data = await openAiResponse.json();
      const outputText = extractOutputText(data);

      if (!outputText) {
        console.error("No OpenAI structured output:", data);
        return jsonResponse(fallbackResult);
      }

      const parsed = JSON.parse(outputText);
      const normalized = normalizeJudgeResult(parsed, fallbackResult);

      return jsonResponse(normalized);
    } catch (openAiError) {
      console.error("OpenAI judge exception:", openAiError);
      return jsonResponse(fallbackResult);
    }
  } catch (error) {
    return jsonResponse(
      {
        error: "Judge function failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

function isValidJudgeRequest(body: unknown): body is JudgeRequestBody {
  if (!body || typeof body !== "object") return false;

  const candidate = body as JudgeRequestBody;

  return (
    !!candidate.accusation &&
    typeof candidate.accusation === "object" &&
    typeof candidate.accusation.killerId === "string" &&
    Array.isArray(candidate.accusation.selectedEvidenceIds) &&
    Array.isArray(candidate.availableEvidence)
  );
}

function judgeLocally(body: JudgeRequestBody): JudgeResult {
  const { accusation } = body;

  const selectedEvidenceIds = Array.isArray(accusation.selectedEvidenceIds)
    ? accusation.selectedEvidenceIds
    : [];

  const correctEvidence = selectedEvidenceIds.filter((id) =>
    CASE_TRUTH.criticalEvidenceIds.includes(id)
  );

  const missedEvidence = CASE_TRUTH.criticalEvidenceIds.filter(
    (id) => !selectedEvidenceIds.includes(id)
  );

  const killer = accusation.killerId === CASE_TRUTH.killerId ? 20 : 0;

  const motiveText = accusation.motive || "";
  const methodText = accusation.method || "";
  const timeText = accusation.timeWindow || "";

  const motive = scoreByKeywords(motiveText, CASE_TRUTH.motiveKeywords, 15);
  const method = scoreByKeywords(methodText, CASE_TRUTH.methodKeywords, 15);
  const timeWindow = scoreByKeywords(timeText, CASE_TRUTH.timeKeywords, 20);

  const evidence = Math.round(
    (correctEvidence.length / CASE_TRUTH.criticalEvidenceIds.length) * 20
  );

  const explanations = scoreSuspectExplanations(accusation.suspectExplanations);

  const breakdown = {
    killer,
    motive,
    method,
    timeWindow,
    evidence,
    explanations,
  };

  const total = clampScore(
    breakdown.killer +
      breakdown.motive +
      breakdown.method +
      breakdown.timeWindow +
      breakdown.evidence +
      breakdown.explanations,
    0,
    100
  );

  return {
    total,
    breakdown,
    feedback: buildLocalFeedback(total, breakdown, correctEvidence, missedEvidence),
    correctEvidence,
    missedEvidence,
  };
}

function scoreByKeywords(text: string, keywords: string[], maxScore: number) {
  const normalized = normalizeText(text);

  if (!normalized) return 0;

  const hits = keywords.filter((keyword) =>
    normalized.includes(normalizeText(keyword))
  ).length;

  if (hits <= 0) return 0;
  if (hits === 1) return Math.round(maxScore * 0.55);
  if (hits === 2) return Math.round(maxScore * 0.8);

  return maxScore;
}

function scoreSuspectExplanations(
  suspectExplanations: Record<string, string> | undefined
) {
  if (!suspectExplanations || typeof suspectExplanations !== "object") {
    return 0;
  }

  const usefulExplanations = Object.values(suspectExplanations).filter(
    (value) => normalizeText(value).length >= 15
  );

  if (usefulExplanations.length <= 0) return 0;
  if (usefulExplanations.length === 1) return 4;
  if (usefulExplanations.length === 2) return 7;

  return 10;
}

function buildLocalFeedback(
  total: number,
  breakdown: JudgeBreakdown,
  correctEvidence: string[],
  missedEvidence: string[]
) {
  const level =
    total >= 85
      ? "تحلیل شما بسیار دقیق است."
      : total >= 65
        ? "تحلیل شما قابل قبول است، اما هنوز چند حلقه‌ی مهم کم دارد."
        : total >= 40
          ? "تحلیل شما بخشی از مسیر را درست رفته، اما برای اثبات پرونده کافی نیست."
          : "اتهام مطرح‌شده هنوز با حقیقت پرونده فاصله‌ی زیادی دارد.";

  const killerNote =
    breakdown.killer === 20
      ? "قاتل اصلی را درست شناسایی کرده‌اید."
      : "قاتل اصلی درست شناسایی نشده است.";

  const evidenceNote =
    missedEvidence.length === 0
      ? "همه‌ی مدارک کلیدی را انتخاب کرده‌اید."
      : `از ${CASE_TRUTH.criticalEvidenceIds.length} مدرک کلیدی، ${correctEvidence.length} مورد را انتخاب کرده‌اید و ${missedEvidence.length} مورد از قلم افتاده است.`;

  return `${level} ${killerNote} ${evidenceNote} برای امتیاز بالاتر باید روش قتل، بازه‌ی زمانی و ارتباط مدارک با انگیزه‌ی قاتل روشن‌تر و مستندتر بیان شود.`;
}

function buildJudgePrompt(body: JudgeRequestBody) {
  const { accusation, availableEvidence } = body;

  return `
تو قاضی نهایی پرونده در بازی «کارآگاه» هستی.

پرونده: آخرین چای
دوره: دهه ۱۳۵۰

حقیقت پرونده:
- قاتل واقعی: suspect_mehtab
- روش واقعی قتل: poisoned_tea
- زمان واقعی قتل: 21:10-21:30
- مدارک کلیدی:
  - evidence_003: فنجان چای
  - evidence_016: قوطی چای آشپزخانه
  - evidence_011: شهادت خانم ملک‌زاده
  - evidence_015: رسید عطاری
  - evidence_017: کلید یدکی
  - evidence_020: تناقض بارانی

اتهام بازیکن:
${JSON.stringify(accusation, null, 2)}

مدارک در دسترس بازیکن:
${JSON.stringify(
  availableEvidence.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    isCritical: item.isCritical ?? false,
  })),
  null,
  2
)}

قواعد نمره‌دهی:
- قاتل درست: حداکثر 20
- انگیزه: حداکثر 15
- روش قتل: حداکثر 15
- زمان‌بندی: حداکثر 20
- انتخاب مدارک کلیدی: حداکثر 20
- رد منطقی سایر مظنون‌ها: حداکثر 10
- مجموع باید از 100 باشد.

خروجی فقط JSON معتبر باشد.
feedback فارسی، جدی، تحلیلی و مناسب فضای پلیسی باشد.
correctEvidence فقط id مدارک کلیدی درست انتخاب‌شده باشد.
missedEvidence فقط id مدارک کلیدی از دست‌رفته باشد.
`;
}

function extractOutputText(data: any): string | null {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  for (const outputItem of data.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (
        contentItem?.type === "output_text" &&
        typeof contentItem.text === "string"
      ) {
        return contentItem.text;
      }
    }
  }

  return null;
}

function normalizeJudgeResult(parsed: any, fallback: JudgeResult): JudgeResult {
  const breakdown = {
    killer: toNumber(parsed?.breakdown?.killer, fallback.breakdown.killer),
    motive: toNumber(parsed?.breakdown?.motive, fallback.breakdown.motive),
    method: toNumber(parsed?.breakdown?.method, fallback.breakdown.method),
    timeWindow: toNumber(
      parsed?.breakdown?.timeWindow,
      fallback.breakdown.timeWindow
    ),
    evidence: toNumber(parsed?.breakdown?.evidence, fallback.breakdown.evidence),
    explanations: toNumber(
      parsed?.breakdown?.explanations,
      fallback.breakdown.explanations
    ),
  };

  const total = clampScore(
    toNumber(
      parsed?.total,
      breakdown.killer +
        breakdown.motive +
        breakdown.method +
        breakdown.timeWindow +
        breakdown.evidence +
        breakdown.explanations
    ),
    0,
    100
  );

  return {
    total,
    breakdown,
    feedback:
      typeof parsed?.feedback === "string" && parsed.feedback.trim()
        ? parsed.feedback
        : fallback.feedback,
    correctEvidence: Array.isArray(parsed?.correctEvidence)
      ? parsed.correctEvidence.filter((item: unknown) => typeof item === "string")
      : fallback.correctEvidence,
    missedEvidence: Array.isArray(parsed?.missedEvidence)
      ? parsed.missedEvidence.filter((item: unknown) => typeof item === "string")
      : fallback.missedEvidence,
  };
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampScore(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeText(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit).toString());
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
