export type Id = string;

export type SessionStatus =
  | "draft"
  | "collecting_context"
  | "generating_strategy"
  | "waiting_user_review"
  | "approved"
  | "rejected"
  | "ready_to_execute"
  | "executed"
  | "learning"
  | "archived";

export type CampaignStatus =
  | "draft"
  | "waiting_review"
  | "approved"
  | "creating_on_meta"
  | "created_paused"
  | "active"
  | "rejected"
  | "archived"
  | "error";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "changes_requested";

export type SessionType =
  | "Campanha completa"
  | "Funil"
  | "Copy"
  | "Criativo de imagem"
  | "Roteiro de vídeo"
  | "Carrossel"
  | "Landing page"
  | "Formulário"
  | "Análise de campanha"
  | "Otimização"
  | "Calendário de demanda"
  | "Ideias de demanda";

export interface Company {
  id: Id;
  name: string;
  segment: string;
  city: string;
  state: string;
  country: string;
  site: string;
  instagram: string;
  whatsapp: string;
  description: string;
  averageTicket: number;
  serviceCapacity: string;
  positioning: string;
  differentiators: string;
  toneOfVoice: string;
  communicationRestrictions: string;
  forbiddenWords: string;
  forbiddenPromises: string;
  strategicNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDna {
  id: Id;
  companyId: Id;
  positioning: string;
  valueProposition: string;
  toneOfVoice: string;
  mainAudience: string;
  audiencePains: string;
  audienceDesires: string;
  commonObjections: string;
  availableProofs: string;
  differentiators: string;
  recurringOffers: string;
  commercialLimits: string;
  legalEthicRestrictions: string;
  visualStyle: string;
  brandColors: string;
  communicationReferences: string;
  goodCampaignExamples: string;
  badCampaignExamples: string;
  verticeNotes: string;
  updatedAt: string;
}

export interface Product {
  id: Id;
  companyId: Id;
  name: string;
  type: string;
  shortDescription: string;
  fullDescription: string;
  averageTicket: number;
  estimatedMargin: number;
  targetAudience: string;
  mainPain: string;
  mainDesire: string;
  objections: string;
  proofs: string;
  differentiators: string;
  benefits: string;
  deliveryMethod: string;
  deliveryTime: string;
  seasonality: string;
  currentOffer: string;
  preferredCta: string;
  currentConversionDestination: string;
  status: string;
}

export interface Offer {
  id: Id;
  companyId: Id;
  productId: Id;
  name: string;
  promise: string;
  condition: string;
  bonus: string;
  guarantee: string;
  urgency: string;
  scarcity: string;
  price: number;
  discount: string;
  cta: string;
  rules: string;
  limits: string;
  notes: string;
  status: string;
}

export interface SessionMessage {
  id: Id;
  sessionId: Id;
  role: "user" | "agent" | "system";
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AgentDecision {
  id: Id;
  title: string;
  decision: string;
  reason: string;
  risk: string;
  nextStep: string;
}

export interface DemandSession {
  id: Id;
  companyId: Id;
  userId: Id;
  sessionType: SessionType;
  objective: string;
  productId: Id;
  offerId: Id;
  status: SessionStatus;
  collectedContext: Record<string, string>;
  messages: SessionMessage[];
  agentDecisions: AgentDecision[];
  generatedAssets: Id[];
  approvals: Id[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: Id;
  companyId: Id;
  sessionId: Id;
  productId: Id;
  offerId: Id;
  name: string;
  objective: string;
  channel: string;
  funnelType: string;
  destinationType: string;
  budgetDaily: number;
  budgetTotal: number;
  location: {
    country: string;
    state: string;
    city: string;
    radius: string;
    excluded?: string;
  };
  ageMin: number;
  ageMax: number;
  metaCampaignId?: string;
  metaStatus?: string;
  internalStatus: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreativeAsset {
  id: Id;
  companyId: Id;
  campaignId?: Id;
  sessionId: Id;
  type: string;
  format: string;
  angle: string;
  pain: string;
  desire: string;
  objection: string;
  promise: string;
  proof: string;
  cta: string;
  hypothesis: string;
  copyText?: string;
  scriptText?: string;
  imagePrompt?: string;
  assetUrl?: string;
  metaCreativeId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CopyVariation {
  id: Id;
  companyId: Id;
  campaignId?: Id;
  creativeAssetId?: Id;
  channel: string;
  primaryText: string;
  headline: string;
  description: string;
  caption: string;
  cta: string;
  angle: string;
  status: string;
  createdAt: string;
}

export interface FunnelDecision {
  id: Id;
  companyId: Id;
  campaignId?: Id;
  sessionId: Id;
  funnelType: string;
  reason: string;
  steps: string[];
  destinationUrl: string;
  whatsappMessage: string;
  formId?: Id;
  landingPageId?: Id;
  createdAt: string;
}

export interface LandingPage {
  id: Id;
  companyId: Id;
  campaignId?: Id;
  sessionId: Id;
  title: string;
  slug: string;
  pageJson: {
    sections: { title: string; copy: string }[];
    seo: string;
    events: string[];
  };
  htmlExport: string;
  status: string;
  publishedUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadForm {
  id: Id;
  companyId: Id;
  campaignId?: Id;
  title: string;
  description: string;
  fields: { name: string; type: string; required: boolean }[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: Id;
  companyId: Id;
  sessionId?: Id;
  campaignId?: Id;
  itemType: string;
  itemId?: Id;
  status: ApprovalStatus;
  requestedBy: Id;
  approvedBy?: Id;
  notes: string;
  createdAt: string;
  approvedAt?: string;
}

export interface MetaConnection {
  id: Id;
  companyId: Id;
  userId: Id;
  metaUserId: string;
  adAccountId: string;
  businessId: string;
  accessTokenEncrypted: string;
  tokenExpiresAt: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceSnapshot {
  id: Id;
  companyId: Id;
  campaignId: Id;
  creativeAssetId?: Id;
  metaCampaignId?: string;
  metaAdsetId?: string;
  metaAdId?: string;
  dateStart: string;
  dateEnd: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  cpm: number;
  cpc: number;
  ctr: number;
  clicks: number;
  leads: number;
  costPerLead: number;
  results: number;
  costPerResult: number;
  rawPayload: Record<string, unknown>;
  createdAt: string;
}

export interface AiEvaluation {
  id: Id;
  companyId: Id;
  campaignId?: Id;
  creativeAssetId?: Id;
  evaluationType: string;
  diagnosis: string;
  possibleCauses: string;
  recommendation: string;
  confidence: number;
  createdAt: string;
}

export interface LearnedPattern {
  id: Id;
  companyId: Id;
  productId?: Id;
  offerId?: Id;
  patternType: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  confidence: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: Id;
  companyId?: Id;
  userId?: Id;
  action: string;
  entityType?: string;
  entityId?: Id;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Database {
  companies: Company[];
  companyDna: CompanyDna[];
  products: Product[];
  offers: Offer[];
  demandSessions: DemandSession[];
  campaigns: Campaign[];
  creativeAssets: CreativeAsset[];
  copyVariations: CopyVariation[];
  funnelDecisions: FunnelDecision[];
  landingPages: LandingPage[];
  forms: LeadForm[];
  approvals: Approval[];
  metaConnections: MetaConnection[];
  performanceSnapshots: PerformanceSnapshot[];
  aiEvaluations: AiEvaluation[];
  learnedPatterns: LearnedPattern[];
  auditLogs: AuditLog[];
}
