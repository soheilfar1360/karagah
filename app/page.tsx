"use client";

import { useMemo, useState } from "react";
import { caseData } from "@/data/caseData";
import { judgeAccusation } from "@/lib/judge";
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

export default function Home() {
  const [screen, setScreen] = useState<Screen>("entrance");
  const [playerName, setPlayerName] = useState("کارآگاه");
  const [playerCount, setPlayerCount] = useState("1");
  const [mode, setMode] = useState<"solo" | "team">("solo");
  const [selectedRole, setSelectedRole] = useState("lead");
  const [currentPhase, setCurrentPhase] = useState(1);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("evidence_001");
  const [flaggedEvidenceIds, setFlaggedEvidenceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [result, setResult] = useState<JudgeResult | null>(null);

  const [accusation, setAccusation] = useState<FinalAccusation>({
    killerId: "",
    motive: "",
    method: "",
    timeWindow: "",
    selectedEvidenceIds: [],
    suspectExplanations: {
      suspect_naser: "",
      suspect_leyla: "",
      suspect_kamran: "",
    },
  });

  const availableEvidence = useMemo(() => {
    return caseData.evidence.filter((item) => item.phase <= currentPhase);
  }, [currentPhase]);

  const selectedEvidence =
    caseData.evidence.find((item) => item.id === selectedEvidenceId) ?? availableEvidence[0];

  const progressPercent = Math.round((currentPhase / caseData.phases.length) * 100);

  const isAccusationValid =
    accusation.killerId &&
    accusation.method &&
    accusation.timeWindow &&
    accusation.selectedEvidenceIds.length >= 3;

  function handlePlayerCountChange(value: string) {
    setPlayerCount(value);
    setMode(value === "1" ? "solo" : "team");
  }

  function goToGame() {
    setCurrentPhase(1);
    setSelectedEvidenceId("evidence_001");
    setScreen("game");
  }

  function unlockAction(ids: string[], targetPhase?: number) {
    const highestEvidencePhase = caseData.evidence
      .filter((item) => ids.includes(item.id))
      .reduce((max, item) => Math.max(max, item.phase), currentPhase);

    const nextPhase = Math.max(currentPhase, targetPhase ?? highestEvidencePhase);
    setCurrentPhase(Math.min(nextPhase, caseData.phases.length));

    const firstUnlocked = caseData.evidence.find((item) => ids.includes(item.id));
    if (firstUnlocked) {
      setSelectedEvidenceId(firstUnlocked.id);
    }

    const actionNote = `اقدام انجام شد. مدارک جدید آزاد شدند: ${ids
      .map((id) => caseData.evidence.find((item) => item.id === id)?.title)
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

  function submitAccusation() {
    const judged = judgeAccusation(accusation, availableEvidence);
    setResult(judged);
    setScreen("result");
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
    <main className="page">
      <div className="shell">
        {screen === "landing" && (
          <section className="hero">
            <div>
              <span className="badge">پرونده ۰۰۱ • MVP Prototype</span>
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
              <span className="badge">{caseData.era}</span>
              <h2>{caseData.title}</h2>
              <p className="text">{caseData.briefing}</p>

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
                    onChange={(event) => setPlayerName(event.target.value)}
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
                    onChange={(event) => setPlayerName(event.target.value)}
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
                    onChange={(event) => setPlayerName(event.target.value)}
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
                {["کارآگاه", "بازجو", "پزشکی قانونی", "تحلیل‌گر"].map((avatar) => (
                  <button key={avatar} className="role-card" type="button">
                    <h3>{avatar}</h3>
                    <p className="small">آواتار نمایشی برای نسخه MVP</p>
                  </button>
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
                {caseData.location} • {caseData.era} • {caseData.duration}
              </span>

              <h1>{caseData.title}</h1>
              <p className="text">{caseData.briefing}</p>

              <div className="panel warning">
                هشدار محتوایی: این پرونده شامل قتل، مسمومیت، فساد مالی و روابط عاطفی
                آسیب‌زا است.
              </div>

              <div className="panel">
                <h3>مأموریت تیم</h3>
                <p className="text">{caseData.mission}</p>
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
                <strong>{caseData.title}</strong>
                <div className="small">
                  فاز فعلی: {caseData.phases[currentPhase - 1]} • پیشرفت {progressPercent}٪
                </div>
              </div>

              <div className="actions" style={{ marginTop: 0 }}>
                <button
                  className="btn secondary"
                  onClick={() =>
                    setCurrentPhase((phase) => Math.min(phase + 1, caseData.phases.length))
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
                    قربانی: {caseData.victim.name}، {caseData.victim.age} ساله
                  </p>
                  <p className="small">{caseData.victim.summary}</p>
                </div>

                <div className="panel">
                  <h3>فازها</h3>
                  <div className="phase-list">
                    {caseData.phases.map((phase, index) => (
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
                  <p className="small">دوره پرونده: {caseData.era}</p>

                  <div className="stack">
                    {caseData.availableTools.map((tool) => (
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
                    {caseData.suspects.map((suspect) => (
                      <SuspectMini key={suspect.id} suspect={suspect} />
                    ))}
                  </div>
                </div>
              </aside>

              <section className="stack">
                <div className="panel">
                  <h2>مدارک آزادشده</h2>
                  <div className="evidence-grid">
                    {caseData.evidence.map((item) => {
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
                  locked={selectedEvidence.phase > currentPhase}
                  flagged={flaggedEvidenceIds.includes(selectedEvidence.id)}
                  onFlag={() => toggleFlag(selectedEvidence.id)}
                  onAddNote={() =>
                    setNotes((prev) => [
                      `مدرک مهم: ${selectedEvidence.title} - ${selectedEvidence.summary}`,
                      ...prev,
                    ])
                  }
                />

                <div className="panel">
                  <h2>تایم‌لاین</h2>
                  <div className="stack">
                    {caseData.timeline
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
                    {caseData.actions.map((action) => (
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
                    {caseData.suspects.map((suspect) => (
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
                      <h3>{item.title}</h3>
                      <p className="small">{item.summary}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-grid">
                <ExplanationField
                  label="چرا ناصر قاتل نیست؟"
                  value={accusation.suspectExplanations.suspect_naser}
                  onChange={(value) =>
                    setAccusation((prev) => ({
                      ...prev,
                      suspectExplanations: {
                        ...prev.suspectExplanations,
                        suspect_naser: value,
                      },
                    }))
                  }
                />

                <ExplanationField
                  label="چرا لیلا قاتل نیست؟"
                  value={accusation.suspectExplanations.suspect_leyla}
                  onChange={(value) =>
                    setAccusation((prev) => ({
                      ...prev,
                      suspectExplanations: {
                        ...prev.suspectExplanations,
                        suspect_leyla: value,
                      },
                    }))
                  }
                />

                <ExplanationField
                  label="چرا کامران قاتل نیست؟"
                  value={accusation.suspectExplanations.suspect_kamran}
                  onChange={(value) =>
                    setAccusation((prev) => ({
                      ...prev,
                      suspectExplanations: {
                        ...prev.suspectExplanations,
                        suspect_kamran: value,
                      },
                    }))
                  }
                />
              </div>

              {!isAccusationValid && (
                <div className="panel warning">
                  برای ارسال پرونده، باید قاتل، روش قتل، زمان و حداقل سه مدرک را انتخاب
                  کنید.
                </div>
              )}

              <button className="btn" disabled={!isAccusationValid} onClick={submitAccusation}>
                ارسال به قاضی پرونده
              </button>
            </div>
          </SimplePage>
        )}

        {screen === "result" && result && (
          <SimplePage title="نتیجه داوری" back={() => setScreen("final")}>
            <div className="card stack">
              <p className="score">{result.total}/100</p>
              <p className="text">{result.feedback}</p>

              <div className="panel">
                <ScoreRow label="قاتل" value={result.breakdown.killer} max={20} />
                <ScoreRow label="انگیزه" value={result.breakdown.motive} max={15} />
                <ScoreRow label="روش قتل" value={result.breakdown.method} max={15} />
                <ScoreRow label="زمان‌بندی" value={result.breakdown.timeWindow} max={20} />
                <ScoreRow label="مدارک" value={result.breakdown.evidence} max={20} />
                <ScoreRow label="رد مظنون‌ها" value={result.breakdown.explanations} max={10} />
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
        </div>

        <button className="btn secondary" onClick={back}>
          بازگشت
        </button>
      </div>

      {children}
    </section>
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