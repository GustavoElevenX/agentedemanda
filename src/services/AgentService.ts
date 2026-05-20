import { CampaignService } from "./CampaignService";
import { CreativeService } from "./CreativeService";
import { FunnelService } from "./FunnelService";
import { ApprovalService } from "./ApprovalService";
import { Company, CompanyDna, Database, DemandSession, Offer, Product, SessionType } from "../types";
import { now, uid } from "../lib/utils";

export class AgentService {
  private creative = new CreativeService();
  private funnel = new FunnelService();
  private campaign = new CampaignService();
  private approvals = new ApprovalService();

  createSession(companyId: string, productId: string, offerId: string, sessionType: SessionType, objective: string): DemandSession {
    return {
      id: uid("session"),
      companyId,
      userId: "user_demo",
      sessionType,
      objective,
      productId,
      offerId,
      status: "collecting_context",
      collectedContext: {},
      messages: [
        {
          id: uid("message"),
          sessionId: "",
          role: "system",
          content: "Sessão criada. O agente carregará DNA, produto e oferta antes de gerar qualquer ativo.",
          createdAt: now(),
        },
      ],
      agentDecisions: [],
      generatedAssets: [],
      approvals: [],
      nextAction: "Enviar briefing mínimo.",
      createdAt: now(),
      updatedAt: now(),
    };
  }

  sendMessage(db: Database, sessionId: string, content: string) {
    const session = db.demandSessions.find((item) => item.id === sessionId);
    if (!session) return;
    session.messages.push({ id: uid("message"), sessionId, role: "user", content, createdAt: now() });
    const lower = content.toLowerCase();
    if (lower.includes("hipótese") || lower.includes("primeira versão") || this.validateContext(db, session).isValid) {
      this.generateStrategy(db, session.id);
      return;
    }
    session.messages.push({
      id: uid("message"),
      sessionId,
      role: "agent",
      content: `Ainda falta contexto mínimo para uma decisão boa: ${this.validateContext(db, session).missing.join(", ")}. Posso gerar uma primeira versão com hipóteses se você pedir explicitamente.`,
      createdAt: now(),
    });
    session.status = "collecting_context";
    session.updatedAt = now();
  }

  loadCompanyContext(db: Database, session: DemandSession) {
    return {
      company: db.companies.find((item) => item.id === session.companyId),
      dna: db.companyDna.find((item) => item.companyId === session.companyId),
      product: db.products.find((item) => item.id === session.productId),
      offer: db.offers.find((item) => item.id === session.offerId),
    };
  }

  validateContext(db: Database, session: DemandSession) {
    const { company, product, offer } = this.loadCompanyContext(db, session);
    const checks = [
      ["nome do produto", product?.name],
      ["descrição", product?.fullDescription || product?.shortDescription],
      ["para quem é", product?.targetAudience],
      ["problema que resolve", product?.mainPain],
      ["desejo que atende", product?.mainDesire],
      ["principal promessa", offer?.promise],
      ["ticket médio", product?.averageTicket || company?.averageTicket],
      ["região de atuação", company?.city],
      ["tipo de venda", product?.type],
      ["canal de venda", product?.currentConversionDestination],
      ["provas existentes", product?.proofs],
      ["objeções comuns", product?.objections],
      ["oferta atual", offer?.name || product?.currentOffer],
      ["limites de promessa", offer?.limits || company?.forbiddenPromises],
      ["verba disponível", session.collectedContext.verba],
      ["meta desejada", session.objective],
    ];
    const missing = checks.filter(([, value]) => !String(value || "").trim()).map(([label]) => label);
    return { isValid: missing.length === 0, missing };
  }

  generateStrategy(db: Database, sessionId: string) {
    const session = db.demandSessions.find((item) => item.id === sessionId);
    if (!session) return;
    const context = this.loadCompanyContext(db, session) as {
      company: Company;
      dna: CompanyDna;
      product: Product;
      offer: Offer;
    };
    const { company, dna, product, offer } = context;
    if (!company || !dna || !product || !offer) return;

    const funnel = this.funnel.chooseFunnel(company, product, offer, session);
    const landingPage = this.funnel.generateLandingPage(company, product, offer, dna, session);
    const form = this.funnel.generateForm(company, product, offer);
    funnel.landingPageId = landingPage.id;
    funnel.formId = form.id;
    const asset = this.creative.saveCreativeAsset(company, session, product, offer, dna);
    const copy = this.creative.generateCopy(company, product, offer, session);
    copy.creativeAssetId = asset.id;
    const campaign = this.campaign.createInternalCampaign(company, product, offer, session, funnel);
    asset.campaignId = campaign.id;
    copy.campaignId = campaign.id;
    funnel.campaignId = campaign.id;
    landingPage.campaignId = campaign.id;
    form.campaignId = campaign.id;
    const approval = this.approvals.requestApproval(company.id, "campaign_review", campaign.id, session.id, campaign.id);

    db.funnelDecisions.unshift(funnel);
    db.landingPages.unshift(landingPage);
    db.forms.unshift(form);
    db.creativeAssets.unshift(asset);
    db.copyVariations.unshift(copy);
    db.campaigns.unshift(campaign);
    db.approvals.unshift(approval);

    session.status = "waiting_user_review";
    session.generatedAssets.unshift(asset.id);
    session.approvals.unshift(approval.id);
    session.agentDecisions.unshift({
      id: uid("decision"),
      title: "Estratégia recomendada",
      decision: `${asset.format} com funil ${funnel.funnelType}.`,
      reason: `${funnel.reason} A campanha deve nascer pausada e só pode ser executada após aprovação.`,
      risk: "Briefing fraco, promessa exagerada ou destino direto demais podem gerar lead barato e ruim.",
      nextStep: "Revisar estratégia, ativos, orçamento, localização e aprovar ou pedir ajuste.",
    });
    session.messages.push({
      id: uid("message"),
      sessionId,
      role: "agent",
      content: `Minha decisão: ${asset.format} e funil ${funnel.funnelType}. ${funnel.reason} Estruturei copy, roteiro, prompt de imagem, landing page, formulário e campanha Meta pausada para revisão.`,
      createdAt: now(),
    });
    session.nextAction = "Revisar aprovação pendente.";
    session.updatedAt = now();
  }
}
