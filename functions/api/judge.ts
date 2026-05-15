type Env = {
  OPENAI_API_KEY: string;
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

type JudgeRequestBody = {
  accusation: FinalAccusation;
  availableEvidence: EvidenceItem[];
};

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}) {
  try {
    const { request, env } = context;

    if (!env.OPENAI_API_KEY) {
      return jsonResponse(
        {
          error: "OPENAI_API_KEY is missing.",
        },
        500
      );
    }

    const body = (await request.json()) as JudgeRequestBody;

    if (!body.accusation || !Array.isArray(body.availableEvidence)) {
      return jsonResponse(
        {
          error: "Invalid request body.",
        },
        400
      );
    }

    const prompt = buildJudgePrompt(body);

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.2-mini",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "detective_judge_result",
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
                    explanations: { type: "number" }
                  },
                  required: [
                    "killer",
                    "motive",
                    "method",
                    "timeWindow",
                    "evidence",
                    "explanations"
                  ]
                },
                feedback: { type: "string" },
                correctEvidence: {
                  type: "array",
                  items: { type: "string" }
                },
                missedEvidence: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: [
                "total",
                "breakdown",
                "feedback",
                "correctEvidence",
                "missedEvidence"
              ]
            }
          }
        }
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();

      return jsonResponse(
        {
          error: "OpenAI request failed.",
          details: errorText,
        },
        500
      );
    }

    const data = await openAiResponse.json();
    const outputText = extractOutputText(data);

    if (!outputText) {
      return jsonResponse(
        {
          error: "No structured output returned from OpenAI.",
          raw: data,
        },
        500
      );
    }

    const result = JSON.parse(outputText);

    return jsonResponse(result);
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

export async function onRequestGet() {
  return jsonResponse({
    ok: true,
    message: "Detective judge API is running.",
  });
}

function buildJudgePrompt(body: JudgeRequestBody) {
  const { accusation, availableEvidence } = body;

  return `
تو قاضی نهایی پرونده در بازی کارآگاه هستی.

پرونده: آخرین چای
دوره: دهه ۱۳۵۰
حقیقت پرونده:
- قاتل واقعی: suspect_mehtab
- روش واقعی قتل: poisoned_tea
- زمان واقعی: 21:10-21:30
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

مهم:
- فقط JSON معتبر خروجی بده.
- feedback فارسی باشد.
- لحن feedback جدی، پلیسی و تحلیلی باشد.
- correctEvidence فقط id مدارک کلیدی درست انتخاب‌شده باشد.
- missedEvidence فقط id مدارک کلیدی از دست‌رفته باشد.
`;
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

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}