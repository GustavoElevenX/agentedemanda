import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  Building2,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FlaskConical,
  FormInput,
  Gauge,
  Image,
  Layers,
  Megaphone,
  MessageSquareText,
  Pencil,
  PlugZap,
  Plus,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Video,
  X,
} from "lucide-react";
import { store } from "./data/store";
import { AgentService } from "./services/AgentService";
import { ApprovalService } from "./services/ApprovalService";
import { CampaignService } from "./services/CampaignService";
import { LearningService } from "./services/LearningService";
import { MetaAdsService } from "./services/MetaAdsService";
import { ImageGenerationService } from "./services/ImageGenerationService";
import { Database, Offer, Product, SessionType } from "./types";
import { compactText, money, now } from "./lib/utils";
import "./styles.css";

const agentService = new AgentService();
const approvalService = new ApprovalService();
const campaignService = new CampaignService();
const metaAdsService = new MetaAdsService();
const learningService = new LearningService();
const imageGenerationService = new ImageGenerationService();

const nav = [
  ["Dashboard", Gauge],
  ["Empresas", Building2],
  ["DNA", Sparkles],
  ["Produtos", Layers],
  ["Ofertas", Target],
  ["Sessões", MessageSquareText],
  ["Campanhas", Megaphone],
  ["Aprovações", ClipboardCheck],
  ["Criativos", Image],
  ["Funis", ChevronRight],
  ["Landing Pages", FileText],
  ["Leads", FormInput],
  ["Meta Ads", PlugZap],
  ["Aprendizados", BookOpenCheck],
  ["Configurações", ShieldCheck],
] as const;

const sessionTypes: SessionType[] = [
  "Campanha completa",
  "Funil",
  "Copy",
  "Criativo de imagem",
  "Roteiro de vídeo",
  "Carrossel",
  "Landing page",
  "Formulário",
  "Análise de campanha",
  "Otimização",
  "Calendário de demanda",
  "Ideias de demanda",
];

function App() {
  const [db, setDb] = useState<Database>(() => store.load());
  const [active, setActive] = useState<(typeof nav)[number][0]>("Dashboard");
  const [selectedCompanyId, setSelectedCompanyId] = useState(db.companies[0]?.id || "");
  const [selectedSessionId, setSelectedSessionId] = useState(db.demandSessions[0]?.id || "");
  const [sessionDraft, setSessionDraft] = useState({
    type: "Campanha completa" as SessionType,
    objective: "Gerar demanda qualificada com aprovação humana.",
    productId: db.products[0]?.id || "",
    offerId: db.offers[0]?.id || "",
    message: "Verba disponível: R$ 1.500. Região: cidade da empresa. Meta desejada: leads qualificados.",
  });

  const currentCompany = db.companies.find((company) => company.id === selectedCompanyId) || db.companies[0];
  const currentSession = db.demandSessions.find((session) => session.id === selectedSessionId) || db.demandSessions[0];

  function commit(next: Database, action?: string, entityType?: string, entityId?: string) {
    if (action) store.audit(next, action, entityType, entityId, currentCompany?.id);
    store.save(next);
    setDb(structuredClone(next));
  }

  function updateCompany(field: string, value: string) {
    const next = structuredClone(db);
    const company = next.companies.find((item) => item.id === selectedCompanyId);
    if (!company) return;
    (company as unknown as Record<string, string>)[field] = value;
    company.updatedAt = now();
    commit(next, "Atualização de empresa", "company", company.id);
  }

  function updateDna(field: string, value: string) {
    const next = structuredClone(db);
    const dna = next.companyDna.find((item) => item.companyId === selectedCompanyId);
    if (!dna) return;
    (dna as unknown as Record<string, string>)[field] = value;
    dna.updatedAt = now();
    commit(next, "Atualização de DNA", "company_dna", dna.id);
  }

  async function createSession() {
    const next = structuredClone(db);
    const session = agentService.createSession(
      selectedCompanyId,
      sessionDraft.productId,
      sessionDraft.offerId,
      sessionDraft.type,
      sessionDraft.objective,
    );
    session.messages = session.messages.map((message) => ({ ...message, sessionId: session.id }));
    session.collectedContext = { verba: "1500", regiao: currentCompany?.city || "", raio: "10 km" };
    next.demandSessions.unshift(session);
    await agentService.sendMessage(next, session.id, sessionDraft.message);
    commit(next, "Criação de sessão", "demand_session", session.id);
    setSelectedSessionId(session.id);
    setActive("Sessões");
  }

  async function sendSessionMessage(content: string) {
    const next = structuredClone(db);
    await agentService.sendMessage(next, currentSession.id, content);
    commit(next, "Mensagem em sessão", "demand_session", currentSession.id);
  }

  async function generateImagesForAsset(assetId: string) {
    const next = structuredClone(db);
    const asset = next.creativeAssets.find((item) => item.id === assetId);
    const company = asset ? next.companies.find((item) => item.id === asset.companyId) : undefined;
    if (!asset || !company) return;
    try {
      const result = await imageGenerationService.generateImages(company, asset);
      asset.generatedImages = [...(asset.generatedImages || []), ...result.generated];
      asset.assetUrl = result.generated[0]?.url || asset.assetUrl;
      asset.generationCostCredits = (asset.generationCostCredits || 0) + result.generated.length;
      asset.status = "generated";
      asset.updatedAt = now();
      next.aiUsage.unshift(result.usage);
      commit(next, "Geração real de imagem", "creative_asset", asset.id);
    } catch (error) {
      next.aiUsage.unshift({
        id: crypto.randomUUID(),
        companyId: company.id,
        userId: "user_demo",
        sessionId: asset.sessionId,
        generationType: "image",
        model: "fallback",
        promptTokens: 0,
        completionTokens: 0,
        imageCount: 0,
        estimatedCost: 0,
        status: error instanceof Error ? `error: ${error.message}` : "error",
        createdAt: now(),
      });
      commit(next, "Erro na geração de imagem", "creative_asset", asset.id);
    }
  }

  function handleApproval(id: string, mode: "approve" | "reject" | "changes") {
    const next = structuredClone(db);
    const approvalIndex = next.approvals.findIndex((approval) => approval.id === id);
    if (approvalIndex < 0) return;
    const approval = next.approvals[approvalIndex];
    next.approvals[approvalIndex] =
      mode === "approve"
        ? approvalService.approveItem(approval)
        : mode === "reject"
          ? approvalService.rejectItem(approval)
          : approvalService.requestChanges(approval);
    const campaign = next.campaigns.find((item) => item.id === approval.campaignId);
    if (campaign) {
      campaign.internalStatus = mode === "approve" ? "approved" : mode === "reject" ? "rejected" : "waiting_review";
      campaign.updatedAt = now();
    }
    commit(next, mode === "approve" ? "Aprovação" : "Revisão de aprovação", "approval", id);
  }

  async function createPausedMetaCampaign(campaignId: string) {
    const next = structuredClone(db);
    const campaign = next.campaigns.find((item) => item.id === campaignId);
    const approval = next.approvals.find((item) => item.campaignId === campaignId && item.status === "approved");
    if (!campaign || !approval) return;
    let result = metaAdsService.createPausedCampaign(campaign);
    try {
      result = await metaAdsService.createPausedCampaignReal(campaign);
    } catch {
      result = metaAdsService.createPausedCampaign(campaign);
    }
    const updated = campaignService.attachMetaIds(campaign, result.metaCampaignId);
    Object.assign(campaign, updated);
    commit(next, "Criação de campanha Meta pausada", "campaign", campaign.id);
  }

  function connectMeta() {
    const next = structuredClone(db);
    next.metaConnections.unshift(metaAdsService.connectMeta(selectedCompanyId));
    commit(next, "Conexão Meta", "meta_connection", next.metaConnections[0].id);
  }

  function collectLearning(campaignId: string) {
    const next = structuredClone(db);
    const campaign = next.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    const snapshot = metaAdsService.getInsights(campaign);
    const evaluation = learningService.evaluateCampaign(campaign, snapshot);
    const pattern = learningService.createLearnedPattern(campaign, evaluation, snapshot);
    next.performanceSnapshots.unshift(snapshot);
    next.aiEvaluations.unshift(evaluation);
    next.learnedPatterns.unshift(pattern);
    commit(next, "Análise de performance", "campaign", campaign.id);
  }

  function captureLead(formId: string) {
    const next = structuredClone(db);
    const form = next.forms.find((item) => item.id === formId);
    if (!form) return;
    next.leads.unshift({
      id: crypto.randomUUID(),
      companyId: form.companyId,
      campaignId: form.campaignId,
      formId: form.id,
      name: "Lead de preview",
      email: "lead.preview@example.com",
      whatsapp: "+55 11 99999-9999",
      city: currentCompany?.city || "São Paulo",
      source: "landing_page_preview",
      payload: { interest: "Teste de captura funcional", fields: form.fields.map((field) => field.name) },
      status: "new",
      createdAt: now(),
    });
    commit(next, "Captura de lead", "lead", next.leads[0].id);
  }

  function resetData() {
    store.reset();
    const fresh = store.load();
    setDb(fresh);
    setSelectedCompanyId(fresh.companies[0]?.id || "");
    setSelectedSessionId(fresh.demandSessions[0]?.id || "");
  }

  const metrics = useMemo(
    () => ({
      waitingApprovals: db.approvals.filter((approval) => approval.status === "pending").length,
      createdCampaigns: db.campaigns.length,
      publishedCampaigns: db.campaigns.filter((campaign) => campaign.internalStatus === "active").length,
      sessions: db.demandSessions.length,
    }),
    [db],
  );

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">V</div>
          <div>
            <strong>Vértice</strong>
            <span>Agente de Demanda</span>
          </div>
        </div>
        <nav>
          {nav.map(([label, Icon]) => (
            <button key={label} className={active === label ? "active" : ""} onClick={() => setActive(label)}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Sistema operacional de geração de demanda</p>
            <h1>{active}</h1>
          </div>
          <div className="topActions">
            <select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)}>
              {db.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <button className="ghost" onClick={resetData}>
              <RefreshCcw size={16} /> Reset demo
            </button>
            <button onClick={createSession}>
              <Plus size={16} /> Criar nova sessão de demanda
            </button>
          </div>
        </header>

        {active === "Dashboard" && (
          <Dashboard
            db={db}
            metrics={metrics}
            createSession={createSession}
            setActive={setActive}
            collectLearning={collectLearning}
          />
        )}
        {active === "Empresas" && currentCompany && <CompanyScreen company={currentCompany} update={updateCompany} />}
        {active === "DNA" && <DnaScreen db={db} companyId={selectedCompanyId} update={updateDna} />}
        {active === "Produtos" && <ProductsCrudScreen db={db} companyId={selectedCompanyId} commit={commit} />}
        {active === "Ofertas" && <OffersCrudScreen db={db} companyId={selectedCompanyId} commit={commit} />}
        {active === "Sessões" && (
          <SessionsScreen
            db={db}
            sessionDraft={sessionDraft}
            setSessionDraft={setSessionDraft}
            selectedSessionId={selectedSessionId}
            setSelectedSessionId={setSelectedSessionId}
            createSession={createSession}
            sendSessionMessage={sendSessionMessage}
          />
        )}
        {active === "Campanhas" && <CampaignsScreen db={db} createPausedMetaCampaign={createPausedMetaCampaign} collectLearning={collectLearning} handleApproval={handleApproval} />}
        {active === "Aprovações" && <ApprovalRail db={db} handleApproval={handleApproval} />}
        {active === "Criativos" && <CreativesScreen db={db} generateImagesForAsset={generateImagesForAsset} />}
        {active === "Funis" && <FunnelsScreen db={db} />}
        {active === "Landing Pages" && <LandingPagesScreen db={db} captureLead={captureLead} />}
        {active === "Leads" && <LeadsScreen db={db} />}
        {active === "Meta Ads" && <MetaScreen db={db} connectMeta={connectMeta} />}
        {active === "Aprendizados" && <LearningScreen db={db} />}
        {active === "Configurações" && <SettingsScreen db={db} />}
        {active === "Dashboard" || active === "Aprovações" ? null : active !== "Campanhas" && <ApprovalRail db={db} handleApproval={handleApproval} />}
      </main>
    </div>
  );
}

function Dashboard({
  db,
  metrics,
  createSession,
  setActive,
  collectLearning,
}: {
  db: Database;
  metrics: Record<string, number>;
  createSession: () => void;
  setActive: (value: (typeof nav)[number][0]) => void;
  collectLearning: (id: string) => void;
}) {
  return (
    <div className="gridPage">
      <section className="metricGrid">
        <Metric icon={Building2} label="Empresas cadastradas" value={db.companies.length} />
        <Metric icon={MessageSquareText} label="Últimas sessões" value={metrics.sessions} />
        <Metric icon={Megaphone} label="Campanhas criadas" value={metrics.createdCampaigns} />
        <Metric icon={ClipboardCheck} label="Aguardando aprovação" value={metrics.waitingApprovals} />
      </section>
      <section className="actionBand">
        <button onClick={createSession}>
          <Plus size={18} /> Criar nova sessão de demanda
        </button>
        {["Criar campanha", "Criar funil", "Criar copy", "Criar criativo", "Criar landing page", "Analisar campanha", "Conectar Meta Ads"].map(
          (label) => (
            <button key={label} className="secondary" onClick={() => setActive(label.includes("Meta") ? "Meta Ads" : "Sessões")}>
              {label}
            </button>
          ),
        )}
      </section>
      <section className="split">
        <Panel title="Próximas ações recomendadas" icon={Target}>
          {db.approvals.slice(0, 3).map((approval) => (
            <div className="rowItem" key={approval.id}>
              <div>
                <strong>{approval.itemType}</strong>
                <span>{approval.notes}</span>
              </div>
              <Status value={approval.status} />
            </div>
          ))}
        </Panel>
        <Panel title="Alertas de performance" icon={Activity}>
          {db.campaigns.slice(0, 3).map((campaign) => (
            <div className="rowItem" key={campaign.id}>
              <div>
                <strong>{campaign.name}</strong>
                <span>Revisar métricas e consolidar aprendizado.</span>
              </div>
              <button className="tiny" onClick={() => collectLearning(campaign.id)}>
                Analisar
              </button>
            </div>
          ))}
        </Panel>
      </section>
      <Panel title="Aprendizados recentes" icon={BookOpenCheck}>
        <div className="cardGrid">
          {db.learnedPatterns.map((pattern) => (
            <article className="miniCard" key={pattern.id}>
              <strong>{pattern.title}</strong>
              <p>{pattern.description}</p>
              <span>Confiança {Math.round(pattern.confidence * 100)}%</span>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function CompanyScreen({ company, update }: { company: Database["companies"][number]; update: (field: string, value: string) => void }) {
  const fields = [
    ["name", "Nome da empresa"],
    ["segment", "Segmento"],
    ["city", "Cidade"],
    ["state", "Estado"],
    ["country", "País"],
    ["site", "Site"],
    ["instagram", "Instagram"],
    ["whatsapp", "WhatsApp"],
    ["description", "Descrição"],
    ["serviceCapacity", "Capacidade de atendimento"],
    ["positioning", "Posicionamento"],
    ["differentiators", "Diferenciais"],
    ["toneOfVoice", "Tom de voz"],
    ["communicationRestrictions", "Restrições de comunicação"],
    ["forbiddenWords", "Palavras proibidas"],
    ["forbiddenPromises", "Promessas proibidas"],
    ["strategicNotes", "Observações estratégicas"],
  ];
  return <FormPanel title="Cadastro da empresa" fields={fields} source={company} update={update} />;
}

function DnaScreen({ db, companyId, update }: { db: Database; companyId: string; update: (field: string, value: string) => void }) {
  const dna = db.companyDna.find((item) => item.companyId === companyId);
  if (!dna) return <Empty title="Cadastre uma empresa para criar DNA." />;
  const fields = [
    ["positioning", "Posicionamento"],
    ["valueProposition", "Proposta de valor"],
    ["toneOfVoice", "Tom de voz"],
    ["mainAudience", "Público principal"],
    ["audiencePains", "Dores do público"],
    ["audienceDesires", "Desejos do público"],
    ["commonObjections", "Objeções comuns"],
    ["availableProofs", "Provas disponíveis"],
    ["differentiators", "Diferenciais"],
    ["recurringOffers", "Ofertas recorrentes"],
    ["commercialLimits", "Limites comerciais"],
    ["legalEthicRestrictions", "Restrições legais ou éticas"],
    ["visualStyle", "Estilo visual"],
    ["brandColors", "Cores da marca"],
    ["communicationReferences", "Referências de comunicação"],
    ["goodCampaignExamples", "Exemplos de boas campanhas"],
    ["badCampaignExamples", "Exemplos de campanhas ruins"],
    ["verticeNotes", "Observações da Vértice"],
  ];
  return <FormPanel title="DNA consultado antes de qualquer ativo" fields={fields} source={dna} update={update} />;
}

function ProductsScreen({ db, companyId, commit }: { db: Database; companyId: string; commit: (db: Database, action?: string, entityType?: string, entityId?: string) => void }) {
  const products = db.products.filter((item) => item.companyId === companyId);
  return (
    <Panel title="Produtos e serviços" icon={Layers}>
      <div className="cardGrid">
        {products.map((product) => (
          <article className="detailCard" key={product.id}>
            <strong>{product.name}</strong>
            <p>{product.fullDescription}</p>
            <dl>
              <dt>Ticket</dt>
              <dd>{money(product.averageTicket)}</dd>
              <dt>Dor</dt>
              <dd>{product.mainPain}</dd>
              <dt>Objeções</dt>
              <dd>{product.objections}</dd>
            </dl>
          </article>
        ))}
      </div>
      <button
        className="secondary"
        onClick={() => {
          const next = structuredClone(db);
          next.products.unshift({
            ...products[0],
            id: crypto.randomUUID(),
            name: "Novo produto de demanda",
            status: "ativo",
          });
          commit(next, "Criação de produto", "product", next.products[0].id);
        }}
      >
        <Plus size={16} /> Novo produto
      </button>
    </Panel>
  );
}

function OffersScreen({ db, companyId, commit }: { db: Database; companyId: string; commit: (db: Database, action?: string, entityType?: string, entityId?: string) => void }) {
  const offers = db.offers.filter((item) => item.companyId === companyId);
  return (
    <Panel title="Ofertas" icon={Target}>
      <div className="cardGrid">
        {offers.map((offer) => (
          <article className="detailCard" key={offer.id}>
            <strong>{offer.name}</strong>
            <p>{offer.promise}</p>
            <dl>
              <dt>CTA</dt>
              <dd>{offer.cta}</dd>
              <dt>Preço</dt>
              <dd>{money(offer.price)}</dd>
              <dt>Limites</dt>
              <dd>{offer.limits}</dd>
            </dl>
          </article>
        ))}
      </div>
      <button
        className="secondary"
        onClick={() => {
          const next = structuredClone(db);
          next.offers.unshift({ ...offers[0], id: crypto.randomUUID(), name: "Nova oferta estratégica", status: "ativa" });
          commit(next, "Criação de oferta", "offer", next.offers[0].id);
        }}
      >
        <Plus size={16} /> Nova oferta
      </button>
    </Panel>
  );
}

function ProductsCrudScreen({ db, companyId, commit }: { db: Database; companyId: string; commit: (db: Database, action?: string, entityType?: string, entityId?: string) => void }) {
  const products = db.products.filter((item) => item.companyId === companyId);
  const [selectedId, setSelectedId] = useState(products[0]?.id || "");
  const selected = products.find((item) => item.id === selectedId) || products[0];
  const fields: [keyof Product, string, "text" | "number"][] = [
    ["name", "Nome", "text"],
    ["type", "Tipo", "text"],
    ["shortDescription", "Descrição curta", "text"],
    ["fullDescription", "Descrição completa", "text"],
    ["averageTicket", "Ticket médio", "number"],
    ["estimatedMargin", "Margem estimada", "number"],
    ["targetAudience", "Público alvo", "text"],
    ["mainPain", "Dor principal", "text"],
    ["mainDesire", "Desejo principal", "text"],
    ["objections", "Objeções", "text"],
    ["proofs", "Provas", "text"],
    ["differentiators", "Diferenciais", "text"],
    ["benefits", "Benefícios", "text"],
    ["deliveryMethod", "Como é entregue", "text"],
    ["deliveryTime", "Tempo de entrega", "text"],
    ["seasonality", "Sazonalidade", "text"],
    ["currentOffer", "Oferta atual", "text"],
    ["preferredCta", "CTA preferencial", "text"],
    ["currentConversionDestination", "Destino de conversão", "text"],
    ["status", "Status", "text"],
  ];

  function updateProduct(field: keyof Product, value: string) {
    if (!selected) return;
    const next = structuredClone(db);
    const product = next.products.find((item) => item.id === selected.id);
    if (!product) return;
    (product as unknown as Record<string, string | number>)[field] = field === "averageTicket" || field === "estimatedMargin" ? Number(value) : value;
    commit(next, "Atualização de produto", "product", product.id);
  }

  function createProduct() {
    const next = structuredClone(db);
    const product: Product = {
      id: crypto.randomUUID(),
      companyId,
      name: "Novo produto de demanda",
      type: "serviço",
      shortDescription: "",
      fullDescription: "",
      averageTicket: 0,
      estimatedMargin: 0,
      targetAudience: "",
      mainPain: "",
      mainDesire: "",
      objections: "",
      proofs: "",
      differentiators: "",
      benefits: "",
      deliveryMethod: "",
      deliveryTime: "",
      seasonality: "",
      currentOffer: "",
      preferredCta: "",
      currentConversionDestination: "",
      status: "ativo",
    };
    next.products.unshift(product);
    commit(next, "Criação de produto", "product", product.id);
    setSelectedId(product.id);
  }

  function archiveOrDelete(id: string, deleteItem = false) {
    const next = structuredClone(db);
    if (deleteItem) next.products = next.products.filter((item) => item.id !== id);
    else {
      const product = next.products.find((item) => item.id === id);
      if (product) product.status = "arquivado";
    }
    commit(next, deleteItem ? "Exclusão de produto" : "Arquivamento de produto", "product", id);
  }

  return (
    <Panel title="Produtos e serviços" icon={Layers}>
      <div className="crudLayout">
        <div className="listRail">
          <button className="secondary" onClick={createProduct}>
            <Plus size={16} /> Novo produto
          </button>
          {products.map((product) => (
            <button key={product.id} className={product.id === selected?.id ? "selected" : ""} onClick={() => setSelectedId(product.id)}>
              {product.name}
            </button>
          ))}
        </div>
        {selected ? (
          <div className="formGrid">
            {fields.map(([field, label, kind]) => (
              <label key={String(field)}>
                {label}
                <textarea value={String(selected[field] || "")} inputMode={kind === "number" ? "numeric" : "text"} onChange={(event) => updateProduct(field, event.target.value)} />
              </label>
            ))}
            <div className="buttonRow">
              <button className="secondary" onClick={() => archiveOrDelete(selected.id)}>
                Arquivar
              </button>
              <button className="danger" onClick={() => archiveOrDelete(selected.id, true)}>
                Excluir
              </button>
            </div>
          </div>
        ) : (
          <Empty title="Cadastre o primeiro produto para alimentar o agente." />
        )}
      </div>
    </Panel>
  );
}

function OffersCrudScreen({ db, companyId, commit }: { db: Database; companyId: string; commit: (db: Database, action?: string, entityType?: string, entityId?: string) => void }) {
  const offers = db.offers.filter((item) => item.companyId === companyId);
  const products = db.products.filter((item) => item.companyId === companyId);
  const [selectedId, setSelectedId] = useState(offers[0]?.id || "");
  const selected = offers.find((item) => item.id === selectedId) || offers[0];
  const fields: [keyof Offer, string, "text" | "number"][] = [
    ["name", "Nome da oferta", "text"],
    ["promise", "Promessa", "text"],
    ["condition", "Condição", "text"],
    ["bonus", "Bônus", "text"],
    ["guarantee", "Garantia", "text"],
    ["urgency", "Urgência", "text"],
    ["scarcity", "Escassez", "text"],
    ["price", "Preço", "number"],
    ["discount", "Desconto", "text"],
    ["cta", "CTA", "text"],
    ["rules", "Regras", "text"],
    ["limits", "Limites", "text"],
    ["notes", "Observações", "text"],
    ["status", "Status", "text"],
  ];

  function updateOffer(field: keyof Offer, value: string) {
    if (!selected) return;
    const next = structuredClone(db);
    const offer = next.offers.find((item) => item.id === selected.id);
    if (!offer) return;
    (offer as unknown as Record<string, string | number>)[field] = field === "price" ? Number(value) : value;
    commit(next, "Atualização de oferta", "offer", offer.id);
  }

  function createOffer() {
    const next = structuredClone(db);
    const offer: Offer = {
      id: crypto.randomUUID(),
      companyId,
      productId: products[0]?.id || "",
      name: "Nova oferta estratégica",
      promise: "",
      condition: "",
      bonus: "",
      guarantee: "",
      urgency: "",
      scarcity: "",
      price: 0,
      discount: "",
      cta: "",
      rules: "",
      limits: "",
      notes: "",
      status: "ativa",
    };
    next.offers.unshift(offer);
    commit(next, "Criação de oferta", "offer", offer.id);
    setSelectedId(offer.id);
  }

  function archiveOrDelete(id: string, deleteItem = false) {
    const next = structuredClone(db);
    if (deleteItem) next.offers = next.offers.filter((item) => item.id !== id);
    else {
      const offer = next.offers.find((item) => item.id === id);
      if (offer) offer.status = "arquivada";
    }
    commit(next, deleteItem ? "Exclusão de oferta" : "Arquivamento de oferta", "offer", id);
  }

  return (
    <Panel title="Ofertas" icon={Target}>
      <div className="crudLayout">
        <div className="listRail">
          <button className="secondary" onClick={createOffer}>
            <Plus size={16} /> Nova oferta
          </button>
          {offers.map((offer) => (
            <button key={offer.id} className={offer.id === selected?.id ? "selected" : ""} onClick={() => setSelectedId(offer.id)}>
              {offer.name}
            </button>
          ))}
        </div>
        {selected ? (
          <div className="formGrid">
            <label>
              Produto relacionado
              <select value={selected.productId} onChange={(event) => updateOffer("productId", event.target.value)}>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            {fields.map(([field, label, kind]) => (
              <label key={String(field)}>
                {label}
                <textarea value={String(selected[field] || "")} inputMode={kind === "number" ? "numeric" : "text"} onChange={(event) => updateOffer(field, event.target.value)} />
              </label>
            ))}
            <div className="buttonRow">
              <button className="secondary" onClick={() => archiveOrDelete(selected.id)}>
                Arquivar
              </button>
              <button className="danger" onClick={() => archiveOrDelete(selected.id, true)}>
                Excluir
              </button>
            </div>
          </div>
        ) : (
          <Empty title="Cadastre a primeira oferta para o agente decidir melhor." />
        )}
      </div>
    </Panel>
  );
}

function SessionsScreen({
  db,
  sessionDraft,
  setSessionDraft,
  selectedSessionId,
  setSelectedSessionId,
  createSession,
  sendSessionMessage,
}: {
  db: Database;
  sessionDraft: { type: SessionType; objective: string; productId: string; offerId: string; message: string };
  setSessionDraft: React.Dispatch<React.SetStateAction<{ type: SessionType; objective: string; productId: string; offerId: string; message: string }>>;
  selectedSessionId: string;
  setSelectedSessionId: (id: string) => void;
  createSession: () => void;
  sendSessionMessage: (content: string) => void;
}) {
  const session = db.demandSessions.find((item) => item.id === selectedSessionId) || db.demandSessions[0];
  const [message, setMessage] = useState("");
  return (
    <div className="sessionLayout">
      <Panel title="Nova sessão guiada" icon={Plus}>
        <div className="stack">
          <label>
            Tipo
            <select value={sessionDraft.type} onChange={(event) => setSessionDraft((state) => ({ ...state, type: event.target.value as SessionType }))}>
              {sessionTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Produto
            <select value={sessionDraft.productId} onChange={(event) => setSessionDraft((state) => ({ ...state, productId: event.target.value }))}>
              {db.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Oferta
            <select value={sessionDraft.offerId} onChange={(event) => setSessionDraft((state) => ({ ...state, offerId: event.target.value }))}>
              {db.offers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Objetivo
            <textarea value={sessionDraft.objective} onChange={(event) => setSessionDraft((state) => ({ ...state, objective: event.target.value }))} />
          </label>
          <label>
            Briefing inicial
            <textarea value={sessionDraft.message} onChange={(event) => setSessionDraft((state) => ({ ...state, message: event.target.value }))} />
          </label>
          <button onClick={createSession}>
            <Sparkles size={16} /> Gerar estratégia e ativos
          </button>
        </div>
      </Panel>
      <Panel title="Sessão do agente" icon={MessageSquareText}>
        <div className="sessionPicker">
          {db.demandSessions.map((item) => (
            <button key={item.id} className={item.id === selectedSessionId ? "selected" : ""} onClick={() => setSelectedSessionId(item.id)}>
              {item.sessionType}
            </button>
          ))}
        </div>
        {session ? (
          <>
            <div className="sessionHeader">
              <div>
                <strong>{session.objective}</strong>
                <span>{session.nextAction}</span>
              </div>
              <Status value={session.status} />
            </div>
            <div className="chatBox">
              {session.messages.map((item) => (
                <div className={`message ${item.role}`} key={item.id}>
                  <span>{item.role}</span>
                  <p>{item.content}</p>
                </div>
              ))}
            </div>
            <div className="chatInput">
              <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Enviar contexto, ajuste ou pedir primeira versão com hipóteses" />
              <button
                onClick={() => {
                  if (!message.trim()) return;
                  sendSessionMessage(message);
                  setMessage("");
                }}
              >
                <Send size={16} />
              </button>
            </div>
            <div className="decisionGrid">
              {session.agentDecisions.map((decision) => (
                <article className="miniCard" key={decision.id}>
                  <strong>{decision.title}</strong>
                  <p>{decision.decision}</p>
                  <span>{decision.reason}</span>
                </article>
              ))}
            </div>
          </>
        ) : (
          <Empty title="Crie uma sessão para começar." />
        )}
      </Panel>
    </div>
  );
}

function CampaignsScreen({
  db,
  createPausedMetaCampaign,
  collectLearning,
  handleApproval,
}: {
  db: Database;
  createPausedMetaCampaign: (id: string) => void;
  collectLearning: (id: string) => void;
  handleApproval: (id: string, mode: "approve" | "reject" | "changes") => void;
}) {
  return (
    <Panel title="Campanhas internas e estrutura Meta Ads" icon={Megaphone}>
      <div className="campaignList">
        {db.campaigns.map((campaign) => {
          const approved = db.approvals.some((approval) => approval.campaignId === campaign.id && approval.status === "approved");
          return (
            <article className="campaignCard" key={campaign.id}>
              <div>
                <strong>{campaign.name}</strong>
                <p>{campaign.objective}</p>
                <div className="pillRow">
                  <Status value={campaign.internalStatus} />
                  <span>{campaign.channel}</span>
                  <span>{campaign.funnelType}</span>
                  <span>{money(campaign.budgetTotal)}</span>
                </div>
              </div>
              <div className="metaBox">
                <h4>Estrutura pausada</h4>
                <pre>{JSON.stringify(campaignService.buildMetaStructure(campaign), null, 2)}</pre>
              </div>
              <div className="buttonRow">
                <button disabled={!approved || campaign.internalStatus === "created_paused"} onClick={() => createPausedMetaCampaign(campaign.id)}>
                  <PlugZap size={16} /> Criar campanha pausada
                </button>
                <button className="secondary" onClick={() => collectLearning(campaign.id)}>
                  <BarChart3 size={16} /> Puxar métricas e aprender
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <ApprovalRail db={db} handleApproval={handleApproval} />
    </Panel>
  );
}

function CreativesScreen({ db, generateImagesForAsset }: { db: Database; generateImagesForAsset: (assetId: string) => void }) {
  return (
    <Panel title="Criativos, copies, roteiros e prompts" icon={Image}>
      <div className="cardGrid">
        {db.creativeAssets.map((asset) => (
          <article className="detailCard" key={asset.id}>
            <div className="iconTitle">{asset.type.includes("vídeo") ? <Video size={18} /> : <Image size={18} />} {asset.format}</div>
            <strong>{asset.angle}</strong>
            <p>{asset.hypothesis}</p>
            <dl>
              <dt>Copy</dt>
              <dd>{asset.copyText}</dd>
              <dt>Roteiro</dt>
              <dd>{asset.scriptText}</dd>
              <dt>Prompt de imagem</dt>
              <dd>{asset.imagePrompt}</dd>
              <dt>Créditos</dt>
              <dd>{asset.generationCostCredits || 0} geração(ões)</dd>
            </dl>
            {asset.imagePrompt && (
              <button className="secondary" onClick={() => generateImagesForAsset(asset.id)}>
                <Image size={16} /> Gerar arte real
              </button>
            )}
            {!!asset.generatedImages?.length && (
              <div className="imageGrid">
                {asset.generatedImages.map((image) => (
                  <figure key={image.id}>
                    <img src={image.url} alt={image.format} />
                    <figcaption>{image.format}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </Panel>
  );
}

function FunnelsScreen({ db }: { db: Database }) {
  return (
    <Panel title="Decisões de funil" icon={ChevronRight}>
      <div className="cardGrid">
        {db.funnelDecisions.map((funnel) => (
          <article className="detailCard" key={funnel.id}>
            <strong>{funnel.funnelType}</strong>
            <p>{funnel.reason}</p>
            <ol>
              {funnel.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function LandingPagesScreen({ db, captureLead }: { db: Database; captureLead: (formId: string) => void }) {
  return (
    <Panel title="Landing pages e formulários" icon={FileText}>
      <div className="split">
        <div className="cardGrid">
          {db.landingPages.map((page) => (
            <article className="detailCard" key={page.id}>
              <strong>{page.title}</strong>
              <span>/{page.slug}</span>
              <div className="landingPreview">
                <h3>{page.pageJson.sections[0]?.title || page.title}</h3>
                <p>{page.pageJson.sections[0]?.copy}</p>
                <button className="tiny">CTA</button>
              </div>
              {page.pageJson.sections.map((section) => (
                <p key={section.title}>
                  <b>{section.title}:</b> {section.copy}
                </p>
              ))}
            </article>
          ))}
        </div>
        <div className="cardGrid">
          {db.forms.map((form) => (
            <article className="detailCard" key={form.id}>
              <strong>{form.title}</strong>
              <p>{form.description}</p>
              {form.fields.map((field) => (
                <span className="fieldPill" key={field.name}>
                  {field.name}
                </span>
              ))}
              <button className="secondary" onClick={() => captureLead(form.id)}>
                <FormInput size={16} /> Testar captura de lead
              </button>
            </article>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function LeadsScreen({ db }: { db: Database }) {
  return (
    <Panel title="Leads e triagem" icon={FormInput}>
      {!db.leads.length && <Empty title="Os formulários já capturam leads no MVP local. Use o preview de landing page para gerar um lead de teste." />}
      <div className="cardGrid">
        {db.leads.map((lead) => (
          <article className="miniCard" key={lead.id}>
            <strong>{lead.name}</strong>
            <p>{lead.whatsapp} | {lead.city}</p>
            <span>{lead.source} | {lead.status}</span>
          </article>
        ))}
        {db.forms.map((form) => (
          <article className="miniCard" key={form.id}>
            <strong>{form.title}</strong>
            <p>{form.fields.length} campos de qualificação.</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function MetaScreen({ db, connectMeta }: { db: Database; connectMeta: () => void }) {
  const accounts = metaAdsService.listAdAccounts(db.metaConnections[0]);
  return (
    <Panel title="Meta Ads seguro" icon={PlugZap}>
      <div className="notice">
        <ShieldCheck size={18} />
        Marketing API direta prevista para produção. No MVP local, a conexão é simulada e nenhuma campanha é ativada sem aprovação.
      </div>
      <button onClick={connectMeta}>
        <PlugZap size={16} /> Conectar Meta Ads
      </button>
      <div className="cardGrid">
        {db.metaConnections.map((connection) => (
          <article className="miniCard" key={connection.id}>
            <strong>{connection.adAccountId}</strong>
            <p>Status {connection.status}. Token armazenado de forma simulada.</p>
          </article>
        ))}
        {accounts.map((account) => (
          <article className="miniCard" key={account.id}>
            <strong>{account.name}</strong>
            <p>{account.id} | {account.status}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function LearningScreen({ db }: { db: Database }) {
  return (
    <Panel title="Aprendizado contínuo" icon={BookOpenCheck}>
      <div className="split">
        <div className="cardGrid">
          {db.aiEvaluations.map((evaluation) => (
            <article className="detailCard" key={evaluation.id}>
              <strong>{evaluation.diagnosis}</strong>
              <p>{evaluation.possibleCauses}</p>
              <span>{evaluation.recommendation}</span>
            </article>
          ))}
        </div>
        <div className="cardGrid">
          {db.learnedPatterns.map((pattern) => (
            <article className="detailCard" key={pattern.id}>
              <strong>{pattern.title}</strong>
              <p>{pattern.description}</p>
              <span>Confiança {Math.round(pattern.confidence * 100)}%</span>
            </article>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function SettingsScreen({ db }: { db: Database }) {
  return (
    <Panel title="Configurações, segurança e logs" icon={ShieldCheck}>
      <div className="notice">
        <BadgeCheck size={18} />
        Regras ativas: Vértice como marca, briefing fraco exige pergunta, Meta Ads sempre pausado no MVP e execução bloqueada sem aprovação.
      </div>
      <div className="cardGrid">
        <article className="miniCard">
          <strong>Uso de IA</strong>
          <p>{db.aiUsage.length} geração(ões) registradas em ai_usage.</p>
        </article>
        <article className="miniCard">
          <strong>API local</strong>
          <p>Configure OPENAI_API_KEY e META_ACCESS_TOKEN no ambiente do servidor local.</p>
        </article>
      </div>
      <div className="logList">
        {db.auditLogs.slice(0, 20).map((log) => (
          <div className="rowItem" key={log.id}>
            <div>
              <strong>{log.action}</strong>
              <span>{log.entityType} | {new Date(log.createdAt).toLocaleString("pt-BR")}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ApprovalRail({ db, handleApproval }: { db: Database; handleApproval: (id: string, mode: "approve" | "reject" | "changes") => void }) {
  const approvals = db.approvals.filter((approval) => approval.status === "pending");
  if (!approvals.length) return null;
  return (
    <Panel title="Aprovação humana obrigatória" icon={ClipboardCheck}>
      <div className="approvalGrid">
        {approvals.map((approval) => {
          const campaign = db.campaigns.find((item) => item.id === approval.campaignId);
          return (
            <article className="approvalCard" key={approval.id}>
              <strong>{campaign?.name || approval.itemType}</strong>
              <p>{approval.notes}</p>
              <div className="reviewChecklist">
                {["Estratégia", "Copy", "Criativo", "Funil", "Landing page", "Meta Ads", "Orçamento", "Riscos", "Checklist de política"].map((item) => (
                  <span key={item}>
                    <Check size={13} /> {item}
                  </span>
                ))}
              </div>
              <div className="buttonRow">
                <button onClick={() => handleApproval(approval.id, "approve")}>
                  <Check size={16} /> Aprovar
                </button>
                <button className="secondary" onClick={() => handleApproval(approval.id, "changes")}>
                  <Pencil size={16} /> Solicitar alteração
                </button>
                <button className="danger" onClick={() => handleApproval(approval.id, "reject")}>
                  <X size={16} /> Rejeitar
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

function FormPanel({
  title,
  fields,
  source,
  update,
}: {
  title: string;
  fields: string[][];
  source: object;
  update: (field: string, value: string) => void;
}) {
  return (
    <Panel title={title} icon={Building2}>
      <div className="formGrid">
        {fields.map(([field, label]) => (
          <label key={field}>
            {label}
            <textarea value={String((source as Record<string, unknown>)[field] || "")} onChange={(event) => update(field, event.target.value)} />
          </label>
        ))}
      </div>
    </Panel>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: number }) {
  return (
    <article className="metric">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Gauge; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <Icon size={18} />
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Status({ value }: { value: string }) {
  return <span className={`status ${value}`}>{value.replaceAll("_", " ")}</span>;
}

function Empty({ title }: { title: string }) {
  return <div className="empty">{title}</div>;
}

createRoot(document.getElementById("root")!).render(<App />);
