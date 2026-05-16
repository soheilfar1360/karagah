import { NextResponse } from "next/server";
import type { GeneratedCharacter } from "@/types/character";

const DEFAULT_PROFILE_MODEL = "gpt-4.1-mini";
const DEFAULT_IMAGE_MODEL = "gpt-image-1";
const IMAGE_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

const characterSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "displayName",
    "role",
    "archetype",
    "ageRange",
    "appearance",
    "outfit",
    "personality",
    "backstory",
    "secret",
    "speakingStyle",
    "avatarPrompt",
  ],
  properties: {
    displayName: { type: "string" },
    role: { type: "string" },
    archetype: { type: "string" },
    ageRange: { type: "string" },
    appearance: { type: "string" },
    outfit: { type: "string" },
    personality: { type: "string" },
    backstory: { type: "string" },
    secret: { type: "string" },
    speakingStyle: { type: "string" },
    avatarPrompt: { type: "string" },
  },
} as const;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "کلید OpenAI روی سرور تنظیم نشده است." }, { status: 500 });
    }

    const body = await request.json().catch(() => null);
    const playerId = typeof body?.playerId === "string" ? body.playerId.trim() : "";
    const playerName = typeof body?.playerName === "string" ? body.playerName.trim() : "";
    const preferredRole = typeof body?.preferredRole === "string" ? body.preferredRole.trim() : "";
    const avatarDataUrl = typeof body?.avatarDataUrl === "string" ? body.avatarDataUrl.trim() : "";

    if (!playerId) {
      return NextResponse.json({ error: "شناسه بازیکن الزامی است." }, { status: 400 });
    }

    if (!avatarDataUrl) {
      return NextResponse.json({ error: "تصویر آواتار الزامی است." }, { status: 400 });
    }

    if (!IMAGE_DATA_URL_PATTERN.test(avatarDataUrl)) {
      return NextResponse.json({ error: "فرمت تصویر آواتار معتبر نیست." }, { status: 400 });
    }

    const character = await createCharacterProfile({
      apiKey,
      avatarDataUrl,
      playerName,
      preferredRole,
    });

    const portraitDataUrl = await createCharacterPortrait({
      apiKey,
      avatarDataUrl,
      character,
    });

    return NextResponse.json({
      ok: true,
      character: {
        ...character,
        portraitDataUrl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            : "ساخت کاراکتر از روی عکس ناموفق بود.",
      },
      { status: 500 }
    );
  }
}

async function createCharacterProfile({
  apiKey,
  avatarDataUrl,
  playerName,
  preferredRole,
}: {
  apiKey: string;
  avatarDataUrl: string;
  playerName: string;
  preferredRole: string;
}) {
  const profileResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_PROFILE_MODEL,
      instructions:
        "Create a fictional Persian detective-game character inspired by the uploaded image. Preserve broad identity cues and vibe, but do not claim the character is the real person. Return only JSON. No markdown.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Analyze the uploaded player photo for general vibe, expression, styling, and visible identity cues.",
                "Invent a fictional in-game character for a dark detective mystery game.",
                "All visible prose must be Persian.",
                "The world is cinematic noir, mystery, slightly Victorian, dark detective atmosphere, premium game portrait.",
                `Player name hint: ${playerName || "نامشخص"}`,
                `Preferred role hint: ${preferredRole || "آزاد"}`,
                "avatarPrompt must be an English image prompt for generating the final portrait.",
              ].join("\n"),
            },
            {
              type: "input_image",
              image_url: avatarDataUrl,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "karagah_generated_character",
          schema: characterSchema,
          strict: true,
        },
      },
    }),
  });

  const profileJson = await profileResponse.json().catch(() => null);

  if (!profileResponse.ok) {
    throw new Error(readOpenAiError(profileJson, "OpenAI نتوانست پروفایل کاراکتر را بسازد."));
  }

  return extractCharacter(profileJson);
}

async function createCharacterPortrait({
  apiKey,
  avatarDataUrl,
  character,
}: {
  apiKey: string;
  avatarDataUrl: string;
  character: GeneratedCharacter;
}) {
  const portraitPrompt = [
    character.avatarPrompt,
    "Transform the provided person into a fictional cinematic detective game character portrait.",
    "Preserve broad facial identity cues, expression vibe, and recognizable personal styling cues without making a photoreal copy.",
    "Dark detective world, cinematic noir, mystery, slightly Victorian atmosphere, premium game portrait, dramatic soft side light, textured dark background.",
    "Bust portrait, centered composition, detailed costume, no text, no logo, no watermark.",
  ].join(" ");

  const imageResponse = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
      images: [{ image_url: avatarDataUrl }],
      prompt: portraitPrompt,
      size: "1024x1024",
      quality: "low",
      output_format: "webp",
      output_compression: 60,
      n: 1,
    }),
  });

  const imageJson = await imageResponse.json().catch(() => null);

  if (!imageResponse.ok) {
    throw new Error(readOpenAiError(imageJson, "OpenAI نتوانست تصویر کاراکتر را بسازد."));
  }

  const base64 = readImageBase64(imageJson);
  return `data:image/webp;base64,${base64}`;
}

function extractCharacter(responseJson: unknown): GeneratedCharacter {
  const text = extractOutputText(responseJson);
  const parsed = JSON.parse(text) as GeneratedCharacter;

  return {
    displayName: String(parsed.displayName || ""),
    role: String(parsed.role || ""),
    archetype: String(parsed.archetype || ""),
    ageRange: String(parsed.ageRange || ""),
    appearance: String(parsed.appearance || ""),
    outfit: String(parsed.outfit || ""),
    personality: String(parsed.personality || ""),
    backstory: String(parsed.backstory || ""),
    secret: String(parsed.secret || ""),
    speakingStyle: String(parsed.speakingStyle || ""),
    avatarPrompt: String(parsed.avatarPrompt || ""),
  };
}

function extractOutputText(responseJson: unknown) {
  if (!isRecord(responseJson)) {
    throw new Error("پاسخ OpenAI معتبر نیست.");
  }

  if (typeof responseJson.output_text === "string") {
    return responseJson.output_text;
  }

  if (Array.isArray(responseJson.output)) {
    for (const outputItem of responseJson.output) {
      if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) continue;

      for (const content of outputItem.content) {
        if (isRecord(content) && content.type === "output_text" && typeof content.text === "string") {
          return content.text;
        }
      }
    }
  }

  throw new Error("متن پروفایل کاراکتر در پاسخ OpenAI پیدا نشد.");
}

function readImageBase64(responseJson: unknown) {
  if (!isRecord(responseJson) || !Array.isArray(responseJson.data)) {
    throw new Error("تصویر تولیدشده در پاسخ OpenAI پیدا نشد.");
  }

  const firstImage = responseJson.data[0];
  if (!isRecord(firstImage) || typeof firstImage.b64_json !== "string") {
    throw new Error("تصویر تولیدشده در پاسخ OpenAI پیدا نشد.");
  }

  return firstImage.b64_json;
}

function readOpenAiError(responseJson: unknown, fallback: string) {
  if (isRecord(responseJson) && isRecord(responseJson.error) && typeof responseJson.error.message === "string") {
    return responseJson.error.message;
  }

  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
