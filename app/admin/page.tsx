"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CUSTOM_CASE_STORAGE_KEY, validateCaseData } from "@/lib/caseValidation";
import type { CaseData } from "@/types/game";

type UploadState = {
  status: "idle" | "valid" | "invalid" | "saved";
  message: string;
  errors: string[];
};

const initialState: UploadState = {
  status: "idle",
  message: "یک فایل JSON پرونده انتخاب کنید.",
  errors: [],
};

export default function AdminPage() {
  const [uploadState, setUploadState] = useState<UploadState>(initialState);
  const [draftCase, setDraftCase] = useState<CaseData | null>(null);
  const [storedCase, setStoredCase] = useState<CaseData | null>(null);
  const [fileName, setFileName] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [generatedJson, setGeneratedJson] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationMessage, setGenerationMessage] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem(CUSTOM_CASE_STORAGE_KEY);
    if (!stored) return;

    try {
      const validation = validateCaseData(JSON.parse(stored));
      if (validation.ok) {
        queueMicrotask(() => setStoredCase(validation.caseData));
      }
    } catch {
      window.localStorage.removeItem(CUSTOM_CASE_STORAGE_KEY);
    }
  }, []);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setDraftCase(null);
    setFileName(file?.name ?? "");

    if (!file) {
      setUploadState(initialState);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".json")) {
      setUploadState({
        status: "invalid",
        message: "فرمت فایل باید JSON باشد.",
        errors: ["فایل انتخاب‌شده پسوند .json ندارد."],
      });
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validation = validateCaseData(parsed);

      if (!validation.ok) {
        setUploadState({
          status: "invalid",
          message: "ساختار پرونده معتبر نیست.",
          errors: validation.errors,
        });
        return;
      }

      setDraftCase(validation.caseData);
      setUploadState({
        status: "valid",
        message: "پرونده معتبر است و آماده ذخیره است.",
        errors: [],
      });
    } catch (error) {
      setUploadState({
        status: "invalid",
        message: "فایل JSON قابل خواندن نیست.",
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  function saveDraftCase() {
    if (!draftCase) return;

    window.localStorage.setItem(CUSTOM_CASE_STORAGE_KEY, JSON.stringify(draftCase));
    setStoredCase(draftCase);
    setUploadState({
      status: "saved",
      message: "پرونده سفارشی ذخیره شد. صفحه اصلی از همین پرونده استفاده می‌کند.",
      errors: [],
    });
  }

  function clearStoredCase() {
    window.localStorage.removeItem(CUSTOM_CASE_STORAGE_KEY);
    setStoredCase(null);
    setDraftCase(null);
    setFileName("");
    setUploadState({
      status: "idle",
      message: "پرونده سفارشی حذف شد. بازی دوباره از پرونده پیش‌فرض استفاده می‌کند.",
      errors: [],
    });
  }

  async function generateCaseFromSynopsis() {
    const cleanSynopsis = synopsis.trim();
    setGenerationError("");
    setGenerationMessage("");

    if (cleanSynopsis.length < 20) {
      setGenerationError("برای تولید پرونده، سیناپس باید کمی کامل‌تر باشد.");
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate-case", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ synopsis: cleanSynopsis }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "تولید پرونده ناموفق بود.");
      }

      setGeneratedJson(JSON.stringify(data.caseData, null, 2));
      setGenerationMessage("پرونده تولید شد. می‌توانید JSON را قبل از ذخیره ویرایش کنید.");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsGenerating(false);
    }
  }

  function saveGeneratedCase() {
    setGenerationError("");
    setGenerationMessage("");

    try {
      const parsed = JSON.parse(generatedJson);

      if (!hasBasicCaseShape(parsed)) {
        setGenerationError("JSON باید حداقل عنوان، آرایه مظنون‌ها و آرایه مدارک داشته باشد.");
        return;
      }

      const validation = validateCaseData(parsed);
      if (!validation.ok) {
        setGenerationError(`ساختار کامل پرونده معتبر نیست: ${validation.errors[0]}`);
        return;
      }

      window.localStorage.setItem(CUSTOM_CASE_STORAGE_KEY, JSON.stringify(parsed));
      setStoredCase(validation.caseData);
      setDraftCase(null);
      setGenerationMessage("پرونده تولیدشده به عنوان پرونده فعال ذخیره شد.");
    } catch {
      setGenerationError("JSON تولیدشده قابل خواندن نیست. لطفاً ویرایش‌ها را بررسی کنید.");
    }
  }

  const previewCase = draftCase ?? storedCase;

  return (
    <main className="page">
      <div className="shell stack">
        <header className="header">
          <div>
            <strong>مدیریت پرونده</strong>
            <div className="small">بارگذاری پرونده سفارشی برای کارآگاه</div>
          </div>

          <Link className="btn secondary" href="/">
            بازگشت به بازی
          </Link>
        </header>

        <section className="form-grid">
          <div className="card stack">
            <div>
              <span className="badge">JSON Case File</span>
              <h1 className="subtitle" style={{ marginTop: 16 }}>
                آپلود پرونده جدید
              </h1>
              <p className="text">
                فایل باید ساختار اصلی پرونده را داشته باشد: مشخصات پرونده، قربانی، فازها،
                مظنون‌ها، مدارک، تایم‌لاین، ابزارها و اقدام‌های تحقیقاتی.
              </p>
            </div>

            <div className="field">
              <label>فایل JSON</label>
              <input className="input" type="file" accept="application/json,.json" onChange={handleFileChange} />
              {fileName && <p className="small">فایل انتخاب‌شده: {fileName}</p>}
            </div>

            <div className={`panel ${uploadState.status === "invalid" ? "warning" : ""}`}>
              <strong>{uploadState.message}</strong>
              {uploadState.errors.length > 0 && (
                <div className="stack" style={{ marginTop: 12 }}>
                  {uploadState.errors.map((error) => (
                    <div className="note-item" key={error}>
                      {error}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="actions">
              <button className="btn" disabled={!draftCase} onClick={saveDraftCase}>
                ذخیره در مرورگر
              </button>
              <button className="btn secondary" disabled={!storedCase && !draftCase} onClick={clearStoredCase}>
                حذف پرونده سفارشی
              </button>
            </div>
          </div>

          <aside className="card stack case-preview">
            <span className="badge">{storedCase ? "پرونده سفارشی فعال" : "پیش‌نمایش"}</span>

            {previewCase ? (
              <>
                <h2>{previewCase.title}</h2>
                <p className="text">{previewCase.briefing}</p>
                <div className="panel">
                  <p className="small">شناسه: {previewCase.id}</p>
                  <p className="small">
                    {previewCase.location} • {previewCase.era} • {previewCase.duration}
                  </p>
                  <p className="small">
                    {previewCase.suspects.length} مظنون • {previewCase.evidence.length} مدرک •{" "}
                    {previewCase.phases.length} فاز
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2>هنوز پرونده‌ای انتخاب نشده</h2>
                <p className="text">پس از انتخاب فایل معتبر، خلاصه پرونده اینجا نمایش داده می‌شود.</p>
              </>
            )}
          </aside>
        </section>

        <section className="card stack">
          <div>
            <span className="badge">AI Case Generator</span>
            <h2 className="subtitle" style={{ marginTop: 16 }}>
              تولید پرونده از سیناپس
            </h2>
            <p className="text">
              خلاصه داستان، فضای زمانی، قربانی، مظنون‌های احتمالی یا پیچ اصلی پرونده را بنویسید تا AI
              یک JSON قابل ویرایش برای بازی بسازد.
            </p>
          </div>

          <div className="field">
            <label>سیناپس پرونده</label>
            <textarea
              className="textarea"
              value={synopsis}
              onChange={(event) => setSynopsis(event.target.value)}
              placeholder="مثلاً: در یک مهمانخانه قدیمی شمال، صاحب مهمانخانه صبح بعد از یک مهمانی خصوصی مرده پیدا می‌شود..."
              style={{ minHeight: 140 }}
            />
          </div>

          <div className="actions">
            <button className="btn" disabled={isGenerating} onClick={generateCaseFromSynopsis}>
              تولید JSON با AI
            </button>
          </div>

          {isGenerating && <div className="panel">AI در حال ساخت پرونده است...</div>}

          {generationError && <div className="panel warning">{generationError}</div>}
          {generationMessage && <div className="panel">{generationMessage}</div>}

          <div className="field">
            <label>JSON تولیدشده</label>
            <textarea
              className="textarea"
              value={generatedJson}
              onChange={(event) => setGeneratedJson(event.target.value)}
              placeholder="پس از تولید، JSON پرونده اینجا نمایش داده می‌شود."
              spellCheck={false}
              style={{ minHeight: 360, direction: "ltr", textAlign: "left" }}
            />
          </div>

          <div className="actions">
            <button className="btn secondary" disabled={!generatedJson.trim()} onClick={saveGeneratedCase}>
              ذخیره به عنوان پرونده فعال
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function hasBasicCaseShape(value: unknown): value is { title: string; suspects: unknown[]; evidence: unknown[] } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    candidate.title.trim().length > 0 &&
    Array.isArray(candidate.suspects) &&
    Array.isArray(candidate.evidence)
  );
}
