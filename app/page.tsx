"use client";

import { useEffect, useMemo, useState } from "react";
import { caseData } from "@/data/caseData";
import type { GeneratedCharacter } from "@/types/character";
import type { EvidenceItem, FinalAccusation, JudgeResult, Suspect } from "@/types/game";

type Screen =
  | "entrance"
  | "landing"
  | "room"
  | "setup"
  | "roles"
  | "briefing"
  | "game"
  | "final"
  | "result"
  | "documentary";

const methodOptions = [
  { label: "مسمومیت با چای", value: "poisoned_tea" },
  { label: "سکته طبیعی", value: "natural_heart_attack" },
  { label: "قتل فیزیکی", value: "physical_murder" },
  { label: "داروی اشتباه", value: "wrong_medicine" },
  { label: "نامشخص", value: "unknown" },
];

const timeOptions = [
  { label: "قبل از ۷:۳۰", value: "before_19:30" },
  { label: "بین ۷:۴۰ تا ۸:۱۵", value: "19:40-20:15" },
  { label: "بین ۹:۱۰ تا ۹:۳۰", value: "21:10-21:30" },
  { label: "بعد از ۱۰:۰۰", value: "after_22:00" },
];

const documentaryText = `پرونده «آخرین چای» از چند الگوی واقعی در پرونده‌های جنایی قرن بیستم الهام گرفته شده است: قتل‌هایی که در آن‌ها مرگ قربانی ابتدا طبیعی یا ناشی از بیماری به نظر می‌رسید، اما بررسی دقیق‌تر نوشیدنی، دارو یا غذای مصرف‌شده مسیر تحقیق را تغییر داد. در بسیاری از این پرونده‌ها، قاتل کسی بود که به قربانی دسترسی عاطفی یا خانوادگی داشت و می‌توانست بدون ایجاد درگیری وارد فضای شخصی او شود.

در نسخه بازی، نام‌ها، مکان‌ها، روابط، جزئیات شغلی و ترتیب اتفاقات کاملاً داستانی شده‌اند. هدف این اپیزود بازسازی مستقیم یک پرونده واقعی نیست، بلکه تبدیل الگوی تحقیقاتی چنین پرونده‌هایی به یک تجربه تعاملی است.

این پرونده نشان می‌دهد که در تحقیقات جنایی، همیشه پرصداترین مظنون قاتل نیست. گاهی یک تناقض کوچک، یک فنجان نیمه‌خورده و یک جمله اشتباه در بازجویی، بیشتر از تهدیدهای آشکار حقیقت را نشان می‌دهد.`;

const CUSTOM_CASE_STORAGE_KEY = "karagah_custom_case";
const PLAYERS_STORAGE_KEY = "karagah_players";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const AVATAR_FILE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type Player = {
  id: string;
  name: string;
  avatar?: string;
  characterProfile?: GeneratedCharacter;
  isGeneratingCharacter?: boolean;
};

function createPlayers(countValue: string, firstPlayerName: string, existingPlayers: Player[] = []) {
  const count = Math.max(1, Math.min(4, Number(countValue) || 1));

  return Array.from({ length: count }, (_, index) => {
    const existingPlayer = existingPlayers[index];
    const fallbackName = index === 0 ? firstPlayerName : `بازیکن ${index + 1}`;

    return {
      id: existingPlayer?.id ?? `player_${index + 1}`,
      name: existingPlayer?.name || fallbackName,
      avatar: existingPlayer?.avatar,
      characterProfile: existingPlayer?.characterProfile,
      isGeneratingCharacter: false,
    };
  });
}

function readStoredPlayers(value: string | null): Player[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((player) => player && typeof player === "object")
      .map((player, index) => {
        const candidate = player as Partial<Player>;

        return {
          id: typeof candidate.id === "string" ? candidate.id : `player_${index + 1}`,
          name: typeof candidate.name === "string" && candidate.name.trim()
            ? candidate.name
            : `بازیکن ${index + 1}`,
          avatar: typeof candidate.avatar === "string" ? candidate.avatar : undefined,
          characterProfile: readGeneratedCharacter(candidate.characterProfile),
          isGeneratingCharacter: false,
        };
      });
  } catch {
    return [];
  }
}

function playerInitial(name: string) {
  return name.trim().charAt(0) || "؟";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readGeneratedCharacter(value: unknown): GeneratedCharacter | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const candidate = value as Partial<GeneratedCharacter>;
  if (typeof candidate.displayName !== "string" || !candidate.displayName.trim()) {
    return undefined;
  }

  return {
    displayName: candidate.displayName,
    role: typeof candidate.role === "string" ? candidate.role : "",
    archetype: typeof candidate.archetype === "string" ? candidate.archetype : "",
    ageRange: typeof candidate.ageRange === "string" ? candidate.ageRange : "",
    appearance: typeof candidate.appearance === "string" ? candidate.appearance : "",
    outfit: typeof candidate.outfit === "string" ? candidate.outfit : "",
    personality: typeof candidate.personality === "string" ? candidate.personality : "",
    backstory: typeof candidate.backstory === "string" ? candidate.backstory : "",
    secret: typeof candidate.secret === "string" ? candidate.secret : "",
    speakingStyle: typeof candidate.speakingStyle === "string" ? candidate.speakingStyle : "",
    avatarPrompt: typeof candidate.avatarPrompt === "string" ? candidate.avatarPrompt : "",
    portraitDataUrl: typeof candidate.portraitDataUrl === "string" ? candidate.portraitDataUrl : undefined,
  };
}

function persistPlayers(playersToPersist: Player[]) {
  const playersForStorage = playersToPersist.map(({ isGeneratingCharacter, ...player }) => ({
    ...player,
    isGeneratingCharacter: undefined,
  }));

  try {
    window.localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(playersForStorage));
  } catch (error) {
    console.warn("Failed to persist players with portraits:", error);

    const lighterPlayers = playersForStorage.map((player) => ({
      ...player,
      characterProfile: player.characterProfile
        ? { ...player.characterProfile, portraitDataUrl: undefined }
        : undefined,
    }));

    try {
      window.localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(lighterPlayers));
    } catch (fallbackError) {
      console.warn("Failed to persist compact players:", fallbackError);
    }
  }
}

function createSuspectExplanations(suspects: Suspect[]) {
  return suspects.reduce<Record<string, string>>((acc, suspect) => {
    acc[suspect.id] = "";
    return acc;
  }, {});
}

function createInitialAccusation(suspects: Suspect[]): FinalAccusation {
  return {
    killerId: "",
    motive: "",
    method: "",
    timeWindow: "",
    selectedEvidenceIds: [],
    suspectExplanations: createSuspectExplanations(suspects),
  };
}

function normalizeCaseData(candidate: unknown): typeof caseData {
  if (!candidate || typeof candidate !== "object") {
    return caseData;
  }

  const raw = candidate as Record<string, any>;

  const suspects = Array.isArray(raw.suspects) && raw.suspects.length > 0
    ? raw.suspects.map((suspect: any, index: number) => ({
        ...caseData.suspects[index % caseData.suspects.length],
        ...suspect,
        id: String(suspect?.id || `suspect_${index + 1}`),
        name: String(suspect?.name || `مظنون ${index + 1}`),
        relation: String(suspect?.relation || suspect?.role || "نامشخص"),
        alibi: String(suspect?.alibi || "نامشخص"),
        suspicionLevel: Number(suspect?.suspicionLevel ?? 50),
      }))
    : caseData.suspects;

  const evidence = Array.isArray(raw.evidence) && raw.evidence.length > 0
    ? raw.evidence.map((item: any, index: number) => ({
        ...caseData.evidence[index % caseData.evidence.length],
        ...item,
        id: String(item?.id || `evidence_${String(index + 1).padStart(3, "0")}`),
        title: String(item?.title || `مدرک ${index + 1}`),
        summary: String(item?.summary || item?.description || ""),
        content: String(item?.content || item?.summary || item?.description || ""),
        type: String(item?.type || "مدرک"),
        phase: Number(item?.phase ?? 1),
      }))
    : caseData.evidence;

  const victim = {
    ...caseData.victim,
    ...(raw.victim && typeof raw.victim === "object" ? raw.victim : {}),
    name: String(raw.victim?.name || caseData.victim.name),
    age: Number(raw.victim?.age ?? caseData.victim.age),
    summary: String(raw.victim?.summary || raw.victim?.description || caseData.victim.summary),
  };

  return {
    ...caseData,
    ...raw,
    id: String(raw.id || caseData.id),
    title: String(raw.title || caseData.title),
    subtitle: String(raw.subtitle || caseData.subtitle),
    era: String(raw.era || caseData.era),
    location: String(raw.location || caseData.location),
    duration: String(raw.duration || caseData.duration),
    briefing: String(raw.briefing || raw.intro || raw.opening || caseData.briefing),
    mission: String(raw.mission || raw.objective || caseData.mission),
    victim,
    suspects,
    evidence,
    phases: Array.isArray(raw.phases) && raw.phases.length > 0 ? raw.phases : caseData.phases,
    timeline: Array.isArray(raw.timeline)
      ? raw.timeline.map((item: any, index: number) => ({
          ...item,
          id: String(item?.id || `timeline_${index + 1}`),
          time: String(item?.time || ""),
          title: String(item?.title || `رویداد ${index + 1}`),
          description: String(item?.description || item?.summary || ""),
          phase: Number(item?.phase ?? 1),
        }))
      : caseData.timeline,
    actions: Array.isArray(raw.actions) ? raw.actions : caseData.actions,
    availableTools: Array.isArray(raw.availableTools) ? raw.availableTools : caseData.availableTools,
  } as typeof caseData;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("entrance");
  const [activeCase, setActiveCase] = useState(() => normalizeCaseData(caseData));
  const [isCustomCaseActive, setIsCustomCaseActive] = useState(false);
  const [playerName, setPlayerName] = useState("کارآگاه");
  const [playerCount, setPlayerCount] = useState("1");
  const [players, setPlayers] = useState<Player[]>(() => createPlayers("1", "کارآگاه"));
  const [mode, setMode] = useState<"solo" | "team">("solo");
  const [selectedRole, setSelectedRole] = useState("lead");
  const [currentPhase, setCurrentPhase] = useState(1);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("evidence_001");
  const [flaggedEvidenceIds, setFlaggedEvidenceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [isJudging, setIsJudging] = useState(false);
  const [judgeError, setJudgeError] = useState("");

  const [accusation, setAccusation] = useState<FinalAccusation>(() =>
    createInitialAccusation(caseData.suspects)
  );

  useEffect(() => {
    const storedPlayers = readStoredPlayers(window.localStorage.getItem(PLAYERS_STORAGE_KEY));
    if (storedPlayers.length === 0) return;

    const storedCount = String(Math.max(1, Math.min(4, storedPlayers.length)));
    const storedFirstPlayerName = storedPlayers[0]?.name || playerName;

    setPlayerCount(storedCount);
    setMode(storedCount === "1" ? "solo" : "team");
    setPlayerName(storedFirstPlayerName);
    setPlayers(createPlayers(storedCount, storedFirstPlayerName, storedPlayers));
  }, []);

  useEffect(() => {
    persistPlayers(players);
  }, [players]);

  useEffect(() => {
    const storedCase = window.localStorage.getItem(CUSTOM_CASE_STORAGE_KEY);

    if (!storedCase) {
      const normalizedDefaultCase = normalizeCaseData(caseData);
      setActiveCase(normalizedDefaultCase);
      setIsCustomCaseActive(false);
      setSelectedEvidenceId(normalizedDefaultCase.evidence[0]?.id ?? "");
      setCurrentPhase(1);
      setFlaggedEvidenceIds([]);
      setNotes([]);
      setResult(null);
      setJudgeError("");
      setAccusation(createInitialAccusation(normalizedDefaultCase.suspects));
      return;
    }

    try {
      const parsedCase = JSON.parse(storedCase);
      const normalizedCustomCase = normalizeCaseData(parsedCase);

      setActiveCase(normalizedCustomCase);
      setIsCustomCaseActive(true);
      setSelectedEvidenceId(normalizedCustomCase.evidence[0]?.id ?? "");
      setCurrentPhase(1);
      setFlaggedEvidenceIds([]);
      setNotes([]);
      setResult(null);
      setJudgeError("");
      setAccusation(createInitialAccusation(normalizedCustomCase.suspects));
    } catch (error) {
      console.error("Failed to load custom case:", error);

      const normalizedDefaultCase = normalizeCaseData(caseData);
      setActiveCase(normalizedDefaultCase);
      setIsCustomCaseActive(false);
      setSelectedEvidenceId(normalizedDefaultCase.evidence[0]?.id ?? "");
      setCurrentPhase(1);
      setAccusation(createInitialAccusation(normalizedDefaultCase.suspects));
    }
  }, []);

  const availableEvidence = useMemo(() => {
    return activeCase.evidence.filter((item) => item.phase <= currentPhase);
  }, [currentPhase]);

  const selectedEvidence =
    activeCase.evidence.find((item) => item.id === selectedEvidenceId) ?? availableEvidence[0];

  const progressPercent = Math.round((currentPhase / activeCase.phases.length) * 100);

  const isAccusationValid =
    accusation.killerId &&
    accusation.method &&
    accusation.timeWindow &&
    accusation.selectedEvidenceIds.length >= 3;

  function handlePlayerCountChange(value: string) {
    setPlayerCount(value);
    setMode(value === "1" ? "solo" : "team");
    setPlayers((prev) => createPlayers(value, playerName, prev));
  }

  function handlePlayerNameChange(value: string) {
    setPlayerName(value);
    setPlayers((prev) =>
      prev.map((player, index) => (index === 0 ? { ...player, name: value || "کارآگاه" } : player))
    );
  }

  function handlePlayerCardNameChange(playerId: string, value: string) {
    if (players[0]?.id === playerId) {
      setPlayerName(value);
    }

    setPlayers((prev) =>
      prev.map((player) => {
        if (player.id !== playerId) return player;

        return {
          ...player,
          name: value,
        };
      })
    );
  }

  async function handleAvatarUpload(playerId: string, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!AVATAR_FILE_TYPES.has(file.type)) {
      alert("فرمت تصویر باید PNG، JPG/JPEG یا WebP باشد.");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      alert("حجم تصویر آواتار باید حداکثر ۲ مگابایت باشد.");
      return;
    }

    try {
      const avatar = await fileToDataUrl(file);
      setPlayers((prev) =>
        prev.map((player) =>
          player.id === playerId ? { ...player, avatar, characterProfile: undefined } : player
        )
      );
    } catch {
      alert("خواندن تصویر آواتار ناموفق بود. لطفاً فایل دیگری انتخاب کنید.");
    }
  }

  async function handleGenerateCharacter(playerId: string) {
    const player = players.find((item) => item.id === playerId);
    if (!player?.avatar || player.isGeneratingCharacter) return;

    setPlayers((prev) =>
      prev.map((item) =>
        item.id === playerId ? { ...item, isGeneratingCharacter: true } : item
      )
    );

    try {
      const response = await fetch("/api/generate-character-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId: player.id,
          playerName: player.name,
          preferredRole: selectedRole,
          avatarDataUrl: player.avatar,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "ساخت کاراکتر ناموفق بود.");
      }

      setPlayers((prev) =>
        prev.map((item) =>
          item.id === playerId
            ? {
                ...item,
                characterProfile: data.character as GeneratedCharacter,
                isGeneratingCharacter: false,
              }
            : item
        )
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "ساخت کاراکتر ناموفق بود.");
      setPlayers((prev) =>
        prev.map((item) =>
          item.id === playerId ? { ...item, isGeneratingCharacter: false } : item
        )
      );
    }
  }

  function goToGame() {
    setCurrentPhase(1);
    setSelectedEvidenceId(activeCase.evidence[0]?.id ?? "");
    setScreen("game");
  }

  function unlockAction(ids: string[], targetPhase?: number) {
    const highestEvidencePhase = activeCase.evidence
      .filter((item) => ids.includes(item.id))
      .reduce((max, item) => Math.max(max, item.phase), currentPhase);

    const nextPhase = Math.max(currentPhase, targetPhase ?? highestEvidencePhase);
    setCurrentPhase(Math.min(nextPhase, activeCase.phases.length));

    const firstUnlocked = activeCase.evidence.find((item) => ids.includes(item.id));
    if (firstUnlocked) {
      setSelectedEvidenceId(firstUnlocked.id);
    }

    const actionNote = `اقدام انجام شد. مدارک جدید آزاد شدند: ${ids
      .map((id) => activeCase.evidence.find((item) => item.id === id)?.title)
      .filter(Boolean)
      .join("، ")}`;

    setNotes((prev) => [actionNote, ...prev]);
  }

  function toggleFlag(id: string) {
    setFlaggedEvidenceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function addNote() {
    const clean = noteDraft.trim();
    if (!clean) return;

    setNotes((prev) => [clean, ...prev]);
    setNoteDraft("");
  }

  function toggleEvidenceForAccusation(id: string) {
    setAccusation((prev) => ({
      ...prev,
      selectedEvidenceIds: prev.selectedEvidenceIds.includes(id)
        ? prev.selectedEvidenceIds.filter((item) => item !== id)
        : [...prev.selectedEvidenceIds, id],
    }));
  }

  async function submitAccusation() {
    if (!isAccusationValid || isJudging) return;

    setIsJudging(true);
    setJudgeError("");
    setResult(null);
    setScreen("result");

    try {
      const response = await fetch("/api/judge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accusation,
          availableEvidence,
          truth: (activeCase as any).truth,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.details || data?.error || "خطای نامشخص در داوری");
      }

      setResult(data as JudgeResult);
    } catch (error) {
      setJudgeError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsJudging(false);
    }
  }

  if (screen === "entrance") {
    return (
      <main
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          margin: 0,
          padding: 0,
          overflow: "hidden",
          backgroundColor: "#050608",
          zIndex: 9999,
        }}
      >
        <section
          aria-label="The Detective entrance poster"
          style={{
            position: "relative",
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            backgroundColor: "#050608",
            display: "grid",
            placeItems: "center",
          }}
        >
          <img
            src="/entrance-detective.png"
            alt="The Detective"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center center",
              backgroundColor: "#050608",
              zIndex: 1,
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              pointerEvents: "none",
              background:
                "radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.12) 70%, rgba(0,0,0,0.5) 100%)",
            }}
          />

          <button
            onClick={() => setScreen("landing")}
            style={{
              position: "absolute",
              left: "50%",
              top: "85%",
              transform: "translateX(-50%)",
              zIndex: 3,
              minWidth: 190,
              padding: "14px 34px",
              borderRadius: 18,
              border: "2px solid #e05a66",
              background: "rgba(143, 29, 44, 0.96)",
              color: "#ffffff",
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: "0.14em",
              boxShadow:
                "0 16px 38px rgba(0,0,0,0.42), 0 0 0 5px rgba(199,58,69,0.16)",
              cursor: "pointer",
            }}
          >
            ENTER
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={`page screen-${screen}`}>
      <div className="shell">
        {screen === "landing" && (
          <section className="hero">
            <div>
              <div className="status-badges">
                <span className="badge">پرونده فعال</span>
                {isCustomCaseActive && <span className="badge accent">پرونده سفارشی فعال</span>}
                <span className="badge quiet">AI Judge</span>
              </div>
              <h1 className="title">کارآگاه</h1>
              <p className="subtitle">پرونده را نخوان. حلش کن.</p>
              <p className="text">
                در یک بازی تحقیقاتی ۱ تا ۴ نفره، با تیم خود وارد پرونده‌های قتل
                الهام‌گرفته از واقعیت شوید، مدارک را بررسی کنید، مظنون‌ها را بازجویی
                کنید و در پایان، اتهام خود را با دلیل ثابت کنید.
              </p>

              <div className="actions">
                <button className="btn" onClick={() => setScreen("room")}>
                  شروع پرونده
                </button>

                <button className="btn secondary" onClick={() => setScreen("briefing")}>
                  مشاهده Briefing
                </button>
              </div>
            </div>

            <div className="card case-preview">
              <div className="status-badges">
                <span className="badge">{activeCase.era}</span>
                <span className="badge quiet">{activeCase.duration}</span>
              </div>
              <h2>{activeCase.title}</h2>
              <p className="text">{activeCase.briefing}</p>

              <div className="actions">
                <button className="btn ghost" onClick={() => setScreen("room")}>
                  ورود به پرونده
                </button>
              </div>
            </div>
          </section>
        )}

        {screen === "room" && (
          <SimplePage title="ساخت یا ورود به اتاق" back={() => setScreen("landing")}>
            <div className="form-grid">
              <div className="card stack">
                <h2>ساخت اتاق</h2>

                <div className="field">
                  <label>نام بازیکن</label>
                  <input
                    className="input"
                    value={playerName}
                    onChange={(event) => handlePlayerNameChange(event.target.value)}
                  />
                </div>

                <div className="field">
                  <label>تعداد بازیکنان هدف</label>
                  <select
                    className="select"
                    value={playerCount}
                    onChange={(event) => handlePlayerCountChange(event.target.value)}
                  >
                    <option value="1">۱ نفر</option>
                    <option value="2">۲ نفر</option>
                    <option value="3">۳ نفر</option>
                    <option value="4">۴ نفر</option>
                  </select>
                </div>

                <div className="field">
                  <label>زبان</label>
                  <select className="select" defaultValue="fa">
                    <option value="fa">فارسی</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <button className="btn" onClick={() => setScreen("setup")}>
                  ساخت اتاق
                </button>
              </div>

              <div className="card stack">
                <h2>ورود به اتاق</h2>

                <div className="field">
                  <label>نام بازیکن</label>
                  <input
                    className="input"
                    value={playerName}
                    onChange={(event) => handlePlayerNameChange(event.target.value)}
                  />
                </div>

                <div className="field">
                  <label>کد اتاق</label>
                  <input className="input" placeholder="مثلاً KRG-001" />
                </div>

                <button className="btn secondary" onClick={() => setScreen("setup")}>
                  ورود نمایشی
                </button>

                <p className="small">
                  در MVP هنوز مولتی‌پلیر واقعی نداریم. فعلاً اتاق را شبیه‌سازی می‌کنیم.
                  چون ظاهراً بهتر است اول بازی داشته باشیم، بعد شبکه را به جانش بیندازیم.
                </p>
              </div>
            </div>
          </SimplePage>
        )}

        {screen === "setup" && (
          <SimplePage title="تنظیم بازیکن" back={() => setScreen("room")}>
            <div className="card stack">
              <div className="form-grid">
                <div className="field">
                  <label>نام بازیکن</label>
                  <input
                    className="input"
                    value={playerName}
                    onChange={(event) => handlePlayerNameChange(event.target.value)}
                  />
                </div>

                <div className="field">
                  <label>حالت بازی</label>
                  <div className="input">
                    {mode === "solo" ? "تک‌نفره" : `تیمی • ${playerCount} نفره`}
                  </div>
                  <p className="small">
                    حالت بازی بر اساس تعداد بازیکنان انتخاب‌شده تعیین می‌شود.
                  </p>
                </div>
              </div>

              <div className="grid-4">
                {players.map((player) => (
                  <div key={player.id} className="player-card">
                    <div className="avatar-frame">
                      {player.avatar ? (
                        <img src={player.avatar} alt={player.name} className="avatar-image" />
                      ) : (
                        <span className="avatar-placeholder">{playerInitial(player.name)}</span>
                      )}
                    </div>

                    <div className="field">
                      <label>نام بازیکن</label>
                      <input
                        className="input"
                        value={player.name}
                        onChange={(event) =>
                          handlePlayerCardNameChange(player.id, event.target.value)
                        }
                      />
                    </div>

                    <label className="avatar-upload-btn">
                      انتخاب تصویر
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => handleAvatarUpload(player.id, event)}
                      />
                    </label>

                    <button
                      className="btn secondary avatar-generate-btn"
                      disabled={!player.avatar || player.isGeneratingCharacter}
                      onClick={() => handleGenerateCharacter(player.id)}
                    >
                      {player.isGeneratingCharacter
                        ? "در حال ساخت کاراکتر..."
                        : "ساخت کاراکتر از روی عکس"}
                    </button>

                    {player.isGeneratingCharacter && (
                      <div className="character-loading">در حال تحلیل عکس و ساخت پرتره...</div>
                    )}

                    {player.characterProfile && (
                      <CharacterProfilePanel character={player.characterProfile} />
                    )}
                  </div>
                ))}
              </div>

              <div className="panel warning">
                به‌زودی: تبدیل عکس شما به کاراکتر پلیسی دهه ۵۰. فعلاً نه، چون پروژه
                هنوز نوزاد است و لازم نیست از روز اول جراحی زیبایی‌اش کنیم.
              </div>

              <button className="btn" onClick={() => setScreen("roles")}>
                ادامه
              </button>
            </div>
          </SimplePage>
        )}

        {screen === "roles" && (
          <SimplePage title="انتخاب نقش" back={() => setScreen("setup")}>
            <div className="panel" style={{ marginBottom: 14 }}>
              {mode === "solo"
                ? "در حالت تک‌نفره، به همه نقش‌ها دسترسی دارید."
                : `حالت تیمی ${playerCount} نفره فعال است. فعلاً در MVP نقش‌ها شبیه‌سازی می‌شوند و مولتی‌پلیر واقعی بعداً اضافه می‌شود.`}
            </div>

            <div className="grid-4">
              {[
                {
                  id: "lead",
                  title: "کارآگاه اصلی",
                  text: "مسیر تحقیق را مدیریت می‌کند و اتهام نهایی را ثبت می‌کند.",
                },
                {
                  id: "interrogator",
                  title: "بازجو",
                  text: "اظهارات شاهدان و مظنون‌ها را بررسی می‌کند.",
                },
                {
                  id: "forensic",
                  title: "افسر پزشکی قانونی",
                  text: "گزارش جسد، زمان مرگ و آثار فیزیکی را تحلیل می‌کند.",
                },
                {
                  id: "analyst",
                  title: "تحلیل‌گر پرونده",
                  text: "تایم‌لاین، سوابق و اسناد آرشیوی را بررسی می‌کند.",
                },
              ].map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={`role-card ${selectedRole === role.id ? "active" : ""}`}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <h3>{role.title}</h3>
                  <p className="small">{role.text}</p>
                </button>
              ))}
            </div>

            <div className="actions">
              <button className="btn" onClick={() => setScreen("briefing")}>
                ورود به Briefing
              </button>
            </div>
          </SimplePage>
        )}

        {screen === "briefing" && (
          <SimplePage title="Briefing پرونده" back={() => setScreen("roles")}>
            <div className="card stack">
              <span className="badge">
                {activeCase.location} • {activeCase.era} • {activeCase.duration}
              </span>

              <h1>{activeCase.title}</h1>

              <div
                className="panel stack briefing-panel"
                style={{
                  padding: 18,
                  borderRadius: 24,
                  background:
                    "radial-gradient(circle at top left, rgba(216, 194, 143, 0.12), transparent 34%), rgba(10, 18, 30, 0.72)",
                  border: "1px solid rgba(216, 194, 143, 0.18)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <span className="badge quiet">Case Briefing</span>
                    <h3 style={{ margin: "10px 0 0" }}>بریفینگ تصویری پرونده</h3>
                  </div>

                  <span className="small">حدود ۱ دقیقه</span>
                </div>

                <video
                  className="briefing-video"
                  controls
                  preload="metadata"
                  playsInline
                  style={{
                    width: "100%",
                    display: "block",
                    overflow: "hidden",
                    borderRadius: 22,
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    background: "#05070b",
                    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.45)",
                  }}
                >
                  <source src="/videos/briefing-whitechapel.mp4" type="video/mp4" />
                  مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
                </video>

                <p className="text">
                  ابتدا بریفینگ تصویری را ببینید، سپس وارد اتاق پرونده شوید و مدارک را
                  بررسی کنید.
                </p>
              </div>

              <p className="text">{activeCase.briefing}</p>

              <div className="panel warning">
                هشدار محتوایی: این پرونده شامل قتل، مسمومیت، فساد مالی و روابط عاطفی
                آسیب‌زا است.
              </div>

              <div className="panel">
                <h3>مأموریت تیم</h3>
                <p className="text">{activeCase.mission}</p>
              </div>

              <button className="btn" onClick={goToGame}>
                ورود به اتاق پرونده
              </button>
            </div>
          </SimplePage>
        )}

        {screen === "game" && (
          <section>
            <div className="header">
              <div>
                <strong>{activeCase.title}</strong>
                <div className="small">
                  فاز فعلی: {activeCase.phases[currentPhase - 1]} • پیشرفت {progressPercent}٪
                </div>
                <div className="status-badges compact">
                  <span className="badge">پرونده فعال</span>
                  {isCustomCaseActive && <span className="badge accent">پرونده سفارشی فعال</span>}
                  <span className="badge quiet">AI Judge</span>
                </div>
              </div>

              <div className="actions" style={{ marginTop: 0 }}>
                <button
                  className="btn secondary"
                  onClick={() =>
                    setCurrentPhase((phase) => Math.min(phase + 1, activeCase.phases.length))
                  }
                >
                  پیشروی دستی فاز
                </button>

                <button className="btn" onClick={() => setScreen("final")}>
                  اتهام نهایی
                </button>
              </div>
            </div>

            <div className="game-layout">
              <aside className="stack">
                <div className="panel">
                  <h3>پرونده</h3>
                  <p className="small">
                    قربانی: {activeCase.victim.name}، {activeCase.victim.age} ساله
                  </p>
                  <p className="small">{activeCase.victim.summary}</p>
                </div>

                <div className="panel">
                  <h3>فازها</h3>
                  <div className="phase-list">
                    {activeCase.phases.map((phase, index) => (
                      <div
                        key={phase}
                        className={`phase-item ${index + 1 === currentPhase ? "active" : ""}`}
                      >
                        {index + 1}. {phase}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel">
                  <h3>امکانات این دوره</h3>
                  <p className="small">دوره پرونده: {activeCase.era}</p>

                  <div className="stack">
                    {activeCase.availableTools.map((tool) => (
                      <div
                        key={tool.id}
                        className={`era-tool ${tool.available ? "available" : "unavailable"}`}
                      >
                        <div>
                          <strong>{tool.title}</strong>
                          <p className="small">{tool.description}</p>
                        </div>

                        <span className="type-pill">
                          {tool.available ? "فعال" : "غیرفعال"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel">
                  <h3>مظنون‌ها</h3>
                  <div className="stack">
                    {activeCase.suspects.map((suspect) => (
                      <SuspectMini key={suspect.id} suspect={suspect} />
                    ))}
                  </div>
                </div>
              </aside>

              <section className="stack">
                <div className="panel">
                  <h2>مدارک آزادشده</h2>
                  <div className="evidence-grid">
                    {activeCase.evidence.map((item) => {
                      const locked = item.phase > currentPhase;
                      const active = selectedEvidenceId === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={locked}
                          className={`evidence-card ${locked ? "locked" : ""} ${
                            active ? "active" : ""
                          }`}
                          onClick={() => setSelectedEvidenceId(item.id)}
                        >
                          <EvidenceCardImage item={item} />
                          <span className="type-pill">{item.type}</span>
                          <h3>{item.title}</h3>
                          <p className="small">{locked ? "قفل‌شده" : item.summary}</p>
                          {flaggedEvidenceIds.includes(item.id) && (
                            <span className="badge">علامت‌گذاری‌شده</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <EvidenceViewer
                  evidence={selectedEvidence}
                  locked={selectedEvidence ? selectedEvidence.phase > currentPhase : false}
                  flagged={selectedEvidence ? flaggedEvidenceIds.includes(selectedEvidence.id) : false}
                  onFlag={() => selectedEvidence && toggleFlag(selectedEvidence.id)}
                  onAddNote={() =>
                    selectedEvidence &&
                    setNotes((prev) => [
                      `مدرک مهم: ${selectedEvidence.title} - ${selectedEvidence.summary}`,
                      ...prev,
                    ])
                  }
                />

                <div className="panel">
                  <h2>تایم‌لاین</h2>
                  <div className="stack">
                    {activeCase.timeline
                      .filter((item) => item.phase <= currentPhase)
                      .map((item) => (
                        <div key={item.id} className="note-item">
                          <strong>
                            {item.time} — {item.title}
                          </strong>
                          <div className="small">{item.description}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </section>

              <aside className="stack">
                <div className="panel">
                  <h3>اقدام‌های تحقیقاتی</h3>
                  <div className="stack">
                    {activeCase.actions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className="btn secondary"
                        onClick={() => unlockAction(action.unlockEvidenceIds, action.targetPhase)}
                      >
                        {action.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="panel">
                  <h3>یادداشت تیمی</h3>
                  <textarea
                    className="textarea"
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="فرضیه یا تناقض را بنویس..."
                  />

                  <div className="actions">
                    <button className="btn secondary" onClick={addNote}>
                      افزودن یادداشت
                    </button>
                  </div>

                  <div className="stack">
                    {notes.map((note, index) => (
                      <div key={`${note}-${index}`} className="note-item">
                        {note}
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}

        {screen === "final" && (
          <SimplePage title="اتهام نهایی" back={() => setScreen("game")}>
            <div className="card stack">
              <div className="form-grid">
                <div className="field">
                  <label>قاتل کیست؟</label>
                  <select
                    className="select"
                    value={accusation.killerId}
                    onChange={(event) =>
                      setAccusation((prev) => ({ ...prev, killerId: event.target.value }))
                    }
                  >
                    <option value="">انتخاب کنید</option>
                    {activeCase.suspects.map((suspect) => (
                      <option key={suspect.id} value={suspect.id}>
                        {suspect.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>روش قتل</label>
                  <select
                    className="select"
                    value={accusation.method}
                    onChange={(event) =>
                      setAccusation((prev) => ({ ...prev, method: event.target.value }))
                    }
                  >
                    <option value="">انتخاب کنید</option>
                    {methodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>زمان احتمالی</label>
                  <select
                    className="select"
                    value={accusation.timeWindow}
                    onChange={(event) =>
                      setAccusation((prev) => ({ ...prev, timeWindow: event.target.value }))
                    }
                  >
                    <option value="">انتخاب کنید</option>
                    {timeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>انگیزه</label>
                <textarea
                  className="textarea"
                  value={accusation.motive}
                  onChange={(event) =>
                    setAccusation((prev) => ({ ...prev, motive: event.target.value }))
                  }
                  placeholder="مثلاً: جلوگیری از افشاگری درباره فساد شرکت دارویی و اسناد..."
                />
              </div>

              <div className="panel">
                <h3>مدارک اصلی</h3>
                <p className="small">حداقل سه مدرک انتخاب کن.</p>
                <div className="evidence-grid">
                  {availableEvidence.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`evidence-card ${
                        accusation.selectedEvidenceIds.includes(item.id) ? "active" : ""
                      }`}
                      onClick={() => toggleEvidenceForAccusation(item.id)}
                    >
                      <EvidenceCardImage item={item} />
                      <h3>{item.title}</h3>
                      <p className="small">{item.summary}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-grid">
                {activeCase.suspects.map((suspect) => (
                  <ExplanationField
                    key={suspect.id}
                    label={`چرا ${suspect.name} قاتل نیست؟`}
                    value={accusation.suspectExplanations?.[suspect.id] ?? ""}
                    onChange={(value) =>
                      setAccusation((prev) => ({
                        ...prev,
                        suspectExplanations: {
                          ...prev.suspectExplanations,
                          [suspect.id]: value,
                        },
                      }))
                    }
                  />
                ))}
              </div>

              {!isAccusationValid && (
                <div className="panel warning">
                  برای ارسال پرونده، باید قاتل، روش قتل، زمان و حداقل سه مدرک را انتخاب
                  کنید.
                </div>
              )}

              <button className="btn" disabled={!isAccusationValid || isJudging} onClick={submitAccusation}>
                {isJudging ? "در حال داوری..." : "ارسال به قاضی پرونده"}
              </button>
            </div>
          </SimplePage>
        )}

        {screen === "result" && (
          <SimplePage title="نتیجه داوری" back={() => setScreen("final")}>
            {isJudging && (
              <div className="card stack judging-card">
                <div className="judging-orb" />
                <p className="score">در حال داوری...</p>
                <p className="text">قاضی پرونده دارد اتهام را بررسی می‌کند.</p>
              </div>
            )}

            {!isJudging && judgeError && (
              <div className="card stack">
                <p className="score">خطا در داوری</p>
                <p className="text">{judgeError}</p>
                <button className="btn secondary" onClick={() => setScreen("final")}>
                  بازگشت به اتهام نهایی
                </button>
              </div>
            )}

            {!isJudging && !judgeError && result && (
              <div className="card stack verdict-card">
                <div className="verdict-head">
                  <div className="score-ring">
                    <span>{result.total}</span>
                    <small>/100</small>
                  </div>
                  <div>
                    <span className="badge accent">
                      {String(result.judgedBy ?? "").toLowerCase() === "openai"
                        ? "OpenAI داوری کرده"
                        : "داوری داخلی"}
                    </span>
                    <h2>رأی نهایی پرونده</h2>
                  </div>
                </div>

                <div className="panel verdict-feedback">
                  <p className="text">{result.feedback}</p>
                </div>

                <div className="panel score-breakdown">
                  <ScoreRow label="قاتل" value={result.breakdown.killer} max={20} />
                  <ScoreRow label="انگیزه" value={result.breakdown.motive} max={15} />
                  <ScoreRow label="روش قتل" value={result.breakdown.method} max={15} />
                  <ScoreRow label="زمان‌بندی" value={(result.breakdown as any).timeline ?? (result.breakdown as any).timeWindow ?? 0} max={20} />
                  <ScoreRow label="مدارک" value={result.breakdown.evidence} max={20} />
                  <ScoreRow label="رد مظنون‌ها" value={(result.breakdown as any).elimination ?? (result.breakdown as any).explanations ?? 0} max={10} />
                </div>

                <div className="actions">
                  <button className="btn" onClick={() => setScreen("documentary")}>
                    مشاهده پرونده واقعی پشت داستان
                  </button>
                  <button className="btn secondary" onClick={() => setScreen("game")}>
                    بازگشت به اتاق پرونده
                  </button>
                </div>
              </div>
            )}
          </SimplePage>
        )}

        {screen === "documentary" && (
          <SimplePage title="پرونده واقعی پشت داستان" back={() => setScreen("result")}>
            <article className="card documentary">
              {documentaryText.split("\n\n").map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}

              <div className="actions">
                <button className="btn" onClick={() => setScreen("landing")}>
                  بازگشت به صفحه اصلی
                </button>
              </div>
            </article>
          </SimplePage>
        )}
      </div>
    </main>
  );
}

function SimplePage({
  title,
  children,
  back,
}: {
  title: string;
  children: React.ReactNode;
  back: () => void;
}) {
  return (
    <section className="stack">
      <div className="header">
        <div>
          <strong>{title}</strong>
          <div className="small">کارآگاه • نمونه اولیه</div>
          <div className="status-badges compact">
            <span className="badge">پرونده فعال</span>
            <span className="badge quiet">AI Judge</span>
          </div>
        </div>

        <button className="btn secondary" onClick={back}>
          بازگشت
        </button>
      </div>

      {children}
    </section>
  );
}

function CharacterProfilePanel({ character }: { character: GeneratedCharacter }) {
  return (
    <div className="character-result-panel">
      {character.portraitDataUrl && (
        <div className="generated-portrait-frame">
          <img
            src={character.portraitDataUrl}
            alt={character.displayName}
            className="generated-portrait-image"
          />
        </div>
      )}

      <div className="character-meta-section">
        <strong>{character.displayName}</strong>
        <span className="type-pill">{character.role}</span>
        <span className="small">{character.archetype}</span>
      </div>

      <div className="character-detail-list">
        <p>
          <strong>شخصیت: </strong>
          {character.personality}
        </p>
        <p>
          <strong>پیشینه: </strong>
          {character.backstory}
        </p>
        <p>
          <strong>راز: </strong>
          {character.secret}
        </p>
      </div>

      <details className="character-prompt-block">
        <summary>پرامپت تصویر</summary>
        <p>{character.avatarPrompt}</p>
      </details>
    </div>
  );
}

function SuspectMini({ suspect }: { suspect: Suspect }) {
  return (
    <div className="suspect-card">
      <strong>{suspect.name}</strong>
      <p className="small">{suspect.relation}</p>
      <p className="small">آلیبی: {suspect.alibi}</p>
      <span className="type-pill">سطح شک: {suspect.suspicionLevel}</span>
    </div>
  );
}


function getEvidenceImage(item: EvidenceItem) {
  const explicitImage = (item as EvidenceItem & { image?: string }).image;
  if (explicitImage) return explicitImage;

  const haystack = [
    item.id,
    item.title,
    item.type,
    item.summary,
    item.content,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const rules: Array<[string[], string]> = [
    [["newspaper", "روزنامه", "خبر", "رسانه", "journalist"], "/evidence/newspaper-clipping.webp"],
    [["pocket-watch", "watch", "ساعت", "زمان", "timeline", "time"], "/evidence/pocket-watch.webp"],
    [["boot", "footprint", "print", "رد کفش", "کفش", "گل"], "/evidence/boot-print.webp"],
    [["medical", "doctor", "پزشک", "طبی", "کیف پزشکی"], "/evidence/medical-bag.webp"],
    [["knife", "surgical", "چاقو", "جراحی", "weapon", "method"], "/evidence/surgical-knife.webp"],
    [["butcher", "قصاب", "پیش بند", "apron"], "/evidence/butcher-apron.webp"],
    [["ink-glove", "دستکش جوهری"], "/evidence/ink-gloves.webp"],
    [["ink", "جوهر", "چاپ", "printing"], "/evidence/ink-bottle.webp"],
    [["wax", "seal", "مهر", "مومی"], "/evidence/wax-seal.webp"],
    [["key", "کلید", "access", "دسترسی"], "/evidence/skeleton-key.webp"],
    [["map", "نقشه", "location", "محل", "مسیر"], "/evidence/map-fragment.webp"],
    [["police", "badge", "نشان", "پلیس"], "/evidence/police-badge.webp"],
    [["witness", "statement", "شاهد", "شهادت", "اظهارات"], "/evidence/witness-statement.webp"],
    [["lace", "glove", "دستکش", "قربانی"], "/evidence/lace-glove.webp"],
    [["ring", "انگشتر", "black gem"], "/evidence/black-ring.webp"],
    [["match", "کبریت"], "/evidence/matchbox.webp"],
    [["train", "ticket", "قطار", "بلیت", "بلیط", "alibi"], "/evidence/train-ticket.webp"],
    [["diary", "دفترچه", "یادداشت"], "/evidence/pocket-diary.webp"],
    [["lantern", "فانوس", "چراغ"], "/evidence/gas-lantern.webp"],
    [["letter", "نامه", "کاغذ", "paper", "document"], "/evidence/bloodstained-letter.webp"],
  ];

  return rules.find(([keywords]) => keywords.some((keyword) => haystack.includes(keyword)))?.[1];
}

function EvidenceCardImage({ item, large = false }: { item: EvidenceItem; large?: boolean }) {
  const image = getEvidenceImage(item);
  if (!image) return null;

  return (
    <div className={`evidence-image-wrap ${large ? "large" : ""}`}>
      <img
        src={image}
        alt={item.title}
        loading="lazy"
        className="evidence-image"
      />
    </div>
  );
}

function EvidenceViewer({
  evidence,
  locked,
  flagged,
  onFlag,
  onAddNote,
}: {
  evidence?: EvidenceItem;
  locked: boolean;
  flagged: boolean;
  onFlag: () => void;
  onAddNote: () => void;
}) {
  if (!evidence) {
    return (
      <div className="panel viewer">
        <h2>مدرکی انتخاب نشده</h2>
      </div>
    );
  }

  return (
    <div className="panel viewer stack">
      <div>
        <span className="type-pill">{evidence.type}</span>
        <h2>{evidence.title}</h2>
      </div>

      {!locked && <EvidenceCardImage item={evidence} large />}

      {locked ? (
        <p className="text">
          این مدرک هنوز در دسترس نیست. با پیشروی در تحقیق یا انتخاب اقدام مناسب آزاد
          می‌شود.
        </p>
      ) : (
        <>
          <p className="text">{evidence.content}</p>

          <div className="actions">
            <button className="btn secondary" onClick={onFlag}>
              {flagged ? "حذف علامت" : "علامت‌گذاری مهم"}
            </button>

            <button className="btn ghost" onClick={onAddNote}>
              افزودن به یادداشت‌ها
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ExplanationField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea
        className="textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="score-row">
      <span>{label}</span>
      <strong>
        {value}/{max}
      </strong>
    </div>
  );
}
