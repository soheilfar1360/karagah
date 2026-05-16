export type EvidenceType =
  | "report"
  | "photo"
  | "document"
  | "interview"
  | "physical"
  | "forensic"
  | "archive";

export type EvidenceStatus = "locked" | "new" | "viewed" | "flagged" | "critical";

export type SuspicionLevel = "low" | "medium" | "high" | "critical";

export type InvestigationToolCategory =
  | "interrogation"
  | "forensic"
  | "archive"
  | "field"
  | "technology"
  | "surveillance";

export type InvestigationTool = {
  id: string;
  title: string;
  description: string;
  available: boolean;
  category: InvestigationToolCategory;
};

export type EvidenceItem = {
  id: string;
  title: string;
  type: EvidenceType;
  phase: number;
  summary: string;
  content: string;
  status: EvidenceStatus;
  image?: string;
  relatedSuspects?: string[];
  isCritical?: boolean;
};

export type Suspect = {
  id: string;
  name: string;
  age: number;
  relation: string;
  motive: string;
  alibi: string;
  suspicionLevel: SuspicionLevel;
  notes?: string;
};

export type TimelineEvent = {
  id: string;
  time: string;
  title: string;
  description: string;
  phase: number;
};

export type InvestigationAction = {
  id: string;
  title: string;
  description: string;
  unlockEvidenceIds: string[];
  targetPhase?: number;
};

export type CaseData = {
  id: string;
  title: string;
  subtitle: string;
  era: string;
  location: string;
  duration: string;
  briefing: string;
  mission: string;
  availableTools: InvestigationTool[];
  victim: {
    name: string;
    age: number;
    occupation: string;
    summary: string;
  };
  phases: string[];
  suspects: Suspect[];
  evidence: EvidenceItem[];
  timeline: TimelineEvent[];
  actions: InvestigationAction[];
};

export type FinalAccusation = {
  killerId: string;
  motive: string;
  method: string;
  timeWindow: string;
  selectedEvidenceIds: string[];
  suspectExplanations: Record<string, string>;
};

export type JudgeResult = {
  total: number;
  breakdown: {
    killer: number;
    motive: number;
    method: number;
    timeWindow: number;
    evidence: number;
    explanations: number;
  };
  feedback: string;
  correctEvidence: string[];
  missedEvidence: string[];
};
