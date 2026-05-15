type Env = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

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
  culpritId?: string;
  selectedSuspect?: string;
  selectedKiller?: string;
  motive?: string;
  method?: string;
  murderMethod?: string;
  timeWindow?: string;
  timeline?: string;
  selectedEvidenceIds?: string[];
  evidenceIds?: string[];
  suspectExplanations?: Record<string, string>;
  explanation?: string;
  reasoning?: string;
};

type JudgeRequestBody = {
  accusation?: FinalAccusation;
  availableEvidence?: EvidenceItem[];
};

type JudgeBreakdown = {
  suspect: number;
  killer: number;
  motive: number;
  method: number;
  timeline: number;
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

const SCORE_LIMITS = {
  suspect: 20,
  motive: 15,
  method: 15,
  timeline: 20,
  evidence: 20,
  explanations: 10,
};

const TRUTH = {
  killerId: "suspect_mehtab",
  method: "poisoned_tea",
  timeWindow: "21:10-21:30",
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
    const body = (await request.json()) as JudgeRequestBody;

    if (!body.accusation) {
      return jsonResponse(
        {
          error: "Invalid request body.",
          details: "accusation is required.",
        },
        400
      );
    }

    const availableEvidence = Array.isArray(body.availableEvidence)
      ? body.availableEvidence
      : [];

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    if (!apiKey) {
      const fallback = judgeLocally(body.accusation, availableEvidence);
      return jsonResponse({
        ...fallback,
        feedback:
          "OPENAI_API_KEY تنظیم نشده، بنابراین داوری فعلاً با منطق داخلی انجام شد. برای داوری هوش مصنوعی، کلید را در .env.local بگذار.",
      });
    }

    const prompt = buildJudgePrompt({
      accusation: body.accusation,
      availableEvidence,
    });

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You are a strict JSON-only judge for a Persian detective game. Return only valid JSON matching the schema.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
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
                    suspect: { type: "number" },
                    motive: { type: "number" },
                    method: { type: "number" },
                    timeline: { type: "number" },
                    evidence: { type: "number" },
                    explanations: { type: "number" },
                  },
                  required: [
                    "suspect",
                    "motive",
                    "method",
                    "timeline",
                    "evidence",
                    "explanations"
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
                "missedEvidence"
              ],
            },
          },
        },
      }),
    });

    if (!openAiResponse.ok) {
      const details = await openAiResponse.text();
      console.error("OpenAI request failed:", details);

      const fallback = judgeLocally(body.accusation, availableEvidence);
      return jsonResponse({
        ...fallback,
        feedback:
          "درخواست OpenAI خطا داد، بنابراین داوری داخلی جایگزین شد. جزئیات خطا در ترمینال ثبت شده.",
      });
    }

    const data = await openAiResponse.json();
    const outputText = extractOutputText(data);

    if (!outputText) {
      const fallback = judgeLocally(body.accusation, availableEvidence);
      return jsonResponse({
        ...fallback,
        feedback:
          "OpenAI خروجی قابل خواندن برنگرداند، بنابراین داوری داخلی جایگزین شد.",
      });
    }

    const aiResult = JSON.parse(outputText) as Partial<JudgeResult>;
    return jsonResponse(normalizeJudgeResult(aiResult, body.accusation, availableEvidence));
  } catch (error) {
    console.error("Judge route failed:", error);

    return jsonResponse(
      {
        error: "Judge API failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}

function buildJudgePrompt(body: {
  accusation: FinalAccusation;
  availableEvidence: EvidenceItem[];
}) {
  const { accusation, availableEvidence } = body;

  return `
تو قاضی نهایی پرونده در بازی «کارآگاه» هستی.

پرونده: آخرین چای
دوره: دهه ۱۳۵۰

حقیقت پرونده:
- قاتل واقعی: ${TRUTH.killerId}
- روش واقعی قتل: ${TRUTH.method}
- زمان واقعی قتل: ${TRUTH.timeWindow}
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

قواعد نمره‌دهی دقیق:
- قاتل درست: حداکثر 20
- انگیزه: حداکثر 15
- روش قتل: حداکثر 15
- زمان‌بندی: حداکثر 20
- انتخاب مدارک کلیدی: حداکثر 20
- رد منطقی سایر مظنون‌ها: حداکثر 10
- مجموع باید از 100 باشد.
- هیچ فیلدی نباید بیشتر از سقف خودش امتیاز بگیرد.
- اگر بازیکن فقط روش قتل یا فقط زمان را درست گفته، همان بخش را امتیاز بده و بقیه را صفر یا کم بده.
- feedback فارسی، جدی، تحلیلی و مناسب فضای پلیسی باشد.
- correctEvidence فقط id مدارک کلیدی درست انتخاب‌شده باشد.
- missedEvidence فقط id مدارک کلیدی از دست‌رفته باشد.

خروجی فقط JSON معتبر باشد.
`;
}

function normalizeJudgeResult(
  result: Partial<JudgeResult>,
  accusation: FinalAccusation,
  availableEvidence: EvidenceItem[]
): JudgeResult {
  const rawBreakdown = result.breakdown ?? ({} as Partial<JudgeBreakdown>);

  const suspect = clampNumber(rawBreakdown.suspect ?? rawBreakdown.killer, SCORE_LIMITS.suspect);
  const motive = clampNumber(rawBreakdown.motive, SCORE_LIMITS.motive);
  const method = clampNumber(rawBreakdown.method, SCORE_LIMITS.method);
  const timeline = clampNumber(rawBreakdown.timeline ?? rawBreakdown.timeWindow, SCORE_LIMITS.timeline);
  const evidence = clampNumber(rawBreakdown.evidence, SCORE_LIMITS.evidence);
  const explanations = clampNumber(rawBreakdown.explanations, SCORE_LIMITS.explanations);

  const correctEvidence = Array.isArray(result.correctEvidence)
    ? result.correctEvidence.filter((id) => TRUTH.criticalEvidenceIds.includes(id))
    : getCorrectEvidenceIds(accusation);

  const missedEvidence = TRUTH.criticalEvidenceIds.filter(
    (id) => !correctEvidence.includes(id)
  );

  const total = suspect + motive + method + timeline + evidence + explanations;

  return {
    total,
    breakdown: {
      suspect,
      killer: suspect,
      motive,
      method,
      timeline,
      timeWindow: timeline,
      evidence,
      explanations,
    },
    feedback:
      typeof result.feedback === "string" && result.feedback.trim()
        ? result.feedback
        : buildLocalFeedback(total, correctEvidence, missedEvidence, availableEvidence),
    correctEvidence,
    missedEvidence,
  };
}

function judgeLocally(
  accusation: FinalAccusation,
  availableEvidence: EvidenceItem[]
): JudgeResult {
  const selectedEvidenceIds = getSelectedEvidenceIds(accusation);

  const allText = [
    accusation.killerId,
    accusation.suspectId,
    accusation.culpritId,
    accusation.selectedSuspect,
    accusation.selectedKiller,
    accusation.motive,
    accusation.method,
    accusation.murderMethod,
    accusation.timeWindow,
    accusation.timeline,
    accusation.explanation,
    accusation.reasoning,
    accusation.suspectExplanations
      ? Object.values(accusation.suspectExplanations).join(" ")
      : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const suspect = includesAny(allText, ["suspect_mehtab", "مهتاب", "mehtab"]) ? 20 : 0;
  const motive = includesAny(allText, ["ارث", "وصیت", "وصیت‌نامه", "مالی", "inheritance", "will"]) ? 15 : 0;
  const method = includesAny(allText, ["poisoned_tea", "چای", "سم", "مسموم", "tea", "poison"]) ? 15 : 0;
  const timeline = includesAny(allText, ["21:10", "21:30", "21", "۹:۱۰", "۹:۳۰", "نه و ده", "نه و نیم"]) ? 20 : 0;

  const correctEvidence = selectedEvidenceIds.filter((id) =>
    TRUTH.criticalEvidenceIds.includes(id)
  );

  const missedEvidence = TRUTH.criticalEvidenceIds.filter(
    (id) => !correctEvidence.includes(id)
  );

  const evidence = Math.min(
    SCORE_LIMITS.evidence,
    Math.round((correctEvidence.length / TRUTH.criticalEvidenceIds.length) * SCORE_LIMITS.evidence)
  );

  const explanations = accusation.suspectExplanations &&
    Object.values(accusation.suspectExplanations).some((text) => text.trim().length > 8)
      ? 10
      : 0;

  const total = suspect + motive + method + timeline + evidence + explanations;

  return {
    total,
    breakdown: {
      suspect,
      killer: suspect,
      motive,
      method,
      timeline,
      timeWindow: timeline,
      evidence,
      explanations,
    },
    feedback: buildLocalFeedback(total, correctEvidence, missedEvidence, availableEvidence),
    correctEvidence,
    missedEvidence,
  };
}

function extractOutputText(data: any): string | null {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const firstText = data.output?.[0]?.content?.find(
    (item: any) => item.type === "output_text"
  )?.text;

  return typeof firstText === "string" ? firstText : null;
}

function getSelectedEvidenceIds(accusation: FinalAccusation) {
  return accusation.selectedEvidenceIds ?? accusation.evidenceIds ?? [];
}

function getCorrectEvidenceIds(accusation: FinalAccusation) {
  return getSelectedEvidenceIds(accusation).filter((id) =>
    TRUTH.criticalEvidenceIds.includes(id)
  );
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function clampNumber(value: unknown, max: number) {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(max, Math.round(numberValue)));
}

function buildLocalFeedback(
  total: number,
  correctEvidence: string[],
  missedEvidence: string[],
  availableEvidence: EvidenceItem[]
) {
  const missedTitles = missedEvidence
    .map((id) => availableEvidence.find((item) => item.id === id)?.title ?? id)
    .join("، ");

  if (total >= 85) {
    return "تحلیل شما بسیار نزدیک به حقیقت پرونده است. قاتل، روش قتل، زمان‌بندی و مدارک کلیدی با دقت خوبی تشخیص داده شده‌اند.";
  }

  if (total >= 60) {
    return `تحلیل شما بخش مهمی از حقیقت را پیدا کرده، اما هنوز کامل نیست. تعداد مدارک کلیدی درست: ${correctEvidence.length}. مدارک جاافتاده: ${missedTitles || "نامشخص"}.`;
  }

  return `اتهام نهایی هنوز با حقیقت پرونده فاصله دارد. بهتر است دوباره روی انگیزه، روش قتل، زمان‌بندی و مدارک کلیدی تمرکز کنید. مدارک جاافتاده: ${missedTitles || "نامشخص"}.`;
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
