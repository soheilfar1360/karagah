import type { EvidenceItem, FinalAccusation, JudgeResult } from "@/types/game";

export const truthKey = {
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

const motiveKeywords = ["فساد", "افشاگری", "شرکت", "دارو", "اسناد", "مهتاب"];

export function judgeAccusation(
  accusation: FinalAccusation,
  availableEvidence: EvidenceItem[]
): JudgeResult {
  const breakdown = {
    killer: 0,
    motive: 0,
    method: 0,
    timeWindow: 0,
    evidence: 0,
    explanations: 0,
  };

  if (accusation.killerId === truthKey.killerId) {
    breakdown.killer = 20;
  }

  if (accusation.method === truthKey.method) {
    breakdown.method = 15;
  }

  if (accusation.timeWindow === truthKey.timeWindow) {
    breakdown.timeWindow = 20;
  }

  const motiveText = accusation.motive.trim();
  const matchedMotiveKeywords = motiveKeywords.filter((keyword) =>
    motiveText.includes(keyword)
  );
  breakdown.motive = Math.min(15, matchedMotiveKeywords.length * 3);

  const selectedCriticalEvidence = truthKey.criticalEvidenceIds.filter((id) =>
    accusation.selectedEvidenceIds.includes(id)
  );

  breakdown.evidence = Math.min(20, selectedCriticalEvidence.length * 4);

  const explanationTexts = Object.values(accusation.suspectExplanations).filter(
    (text) => text.trim().length >= 12
  );

  breakdown.explanations = Math.min(10, explanationTexts.length * 3 + 1);

  const total =
    breakdown.killer +
    breakdown.motive +
    breakdown.method +
    breakdown.timeWindow +
    breakdown.evidence +
    breakdown.explanations;

  const availableCriticalEvidence = availableEvidence
    .filter((item) => truthKey.criticalEvidenceIds.includes(item.id))
    .map((item) => item.id);

  const missedEvidence = availableCriticalEvidence.filter(
    (id) => !accusation.selectedEvidenceIds.includes(id)
  );

  const feedback = createFeedback(total, accusation.killerId);

  return {
    total,
    breakdown,
    feedback,
    correctEvidence: selectedCriticalEvidence,
    missedEvidence,
  };
}

function createFeedback(total: number, killerId: string): string {
  if (killerId === truthKey.killerId && total >= 80) {
    return "تیم شما قاتل را درست شناسایی کرد و توانست روش قتل را با مدارک کلیدی پشتیبانی کند. تحلیل شما درباره فنجان چای، ورود دوم مهتاب و تناقض آلیبی او دقیق بود. پرونده تمیز بسته شد، چه اتفاق نادری در تاریخ تصمیم‌گیری انسانی.";
  }

  if (killerId === truthKey.killerId) {
    return "قاتل را درست شناسایی کردید، اما پرونده هنوز از نظر استدلالی کامل بسته نشده است. چند مدرک کلیدی یا توضیح تایم‌لاین جا افتاده و همین می‌تواند در دادگاه مشکل‌ساز شود.";
  }

  if (killerId === "suspect_naser") {
    return "ناصر انگیزه و قدرت کافی دارد، اما بین انگیزه و اجرای مستقیم قتل فاصله وجود دارد. شواهد فیزیکی صحنه، مخصوصاً فنجان چای و قوطی چای، بیشتر به فردی نزدیک‌تر به قربانی اشاره می‌کند.";
  }

  if (killerId === "suspect_leyla") {
    return "لیلا اختلاف خانوادگی و مالی دارد، اما زمان‌بندی حضور او با زمان مسمومیت هماهنگ نیست. هیچ مدرک مستقیمی او را به چای، سم یا ورود دوم وصل نمی‌کند.";
  }

  if (killerId === "suspect_kamran") {
    return "کامران دروغ گفته و همین او را مشکوک می‌کند، اما دروغ او بیشتر برای پنهان کردن حضورش نزدیک ساختمان است. تماس ناتمام فرهاد با دفتر روزنامه نشان می‌دهد کامران احتمالاً مقصد کمک بوده، نه قاتل.";
  }

  return "اتهام نهایی شما با مدارک اصلی پرونده هم‌خوانی کافی ندارد. بهتر است دوباره فنجان چای، آلیبی مهتاب، تماس ناتمام و مدارک عطاری را بررسی کنید.";
}
