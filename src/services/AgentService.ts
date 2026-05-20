import { AiService } from "./AiService";
import { ApprovalService } from "./ApprovalService";
import { CampaignService } from "./CampaignService";
import { CreativeService } from "./CreativeService";
import { FunnelService } from "./FunnelService";
import { Company, CompanyDna, Database, DemandSession, Offer, Product, SessionType } from "../types";
import { now, uid } from "../lib/utils";

export class AgentService {
  private ai = new AiService();
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

  async sendMessage(db: Database, sessionId: string, content: string) {
    const session = db.demandSessions.find((item) => item.id === sessionId);
    if (!session) return;
    session.messages.push({ id: uid("message"), sessionId, role: "user", content, createdAt: now() });
    const lower = content.toLowerCase();
    if (lower.includes("hipótese") || lower.includes("primeira versão") || this.validateContext(db, session).isValid) {
      await this.generateStrategy(db, session.id, content);
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

  async generateStrategy(db: Database, sessionId: string, userInput = "") {
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

    session.status = "generating_strategy";
    const aiText = await this.tryGenerateAiText(db, company, dna, product, offer, session, userInput);

    if (session.sessionType !== "Campanha completa") {
      this.generateIsolatedMode(db, company, dna, product, offer, session, aiText);
      return;
    }

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
      content:
        aiText ||
        `Minha decisão: ${asset.format} e funil ${funnel.funnelType}. ${funnel.reason} Estruturei copy, roteiro, prompt de imagem, landing page, formulário e campanha Meta pausada para revisão.`,
      createdAt: now(),
    });
    session.nextAction = "Revisar aprovação pendente.";
    session.updatedAt = now();
  }

  private generateIsolatedMode(
    db: Database,
    company: Company,
    dna: CompanyDna,
    product: Product,
    offer: Offer,
    session: DemandSession,
    aiText: string,
  ) {
    const mode = session.sessionType;
    let itemType = "asset_review";
    let itemId = "";
    let decision = "";

    if (mode === "Funil") {
      const funnel = this.funnel.chooseFunnel(company, product, offer, session);
      db.funnelDecisions.unshift(funnel);
      itemType = "funnel_review";
      itemId = funnel.id;
      decision = `Funil recomendado: ${funnel.funnelType}.`;
    }

    if (mode === "Copy") {
      const copy = this.creative.generateCopy(company, product, offer, session);
      db.copyVariations.unshift(copy);
      itemType = "copy_review";
      itemId = copy.id;
      decision = `Copy criada para ${copy.channel}, com ângulo ${copy.angle}.`;
    }

    if (mode === "Roteiro de vídeo") {
      const asset = this.creative.saveCreativeAsset(company, session, product, offer, dna, "roteiro de vídeo");
      asset.copyText = undefined;
      asset.imagePrompt = undefined;
      db.creativeAssets.unshift(asset);
      session.generatedAssets.unshift(asset.id);
      itemType = "video_script_review";
      itemId = asset.id;
      decision = "Roteiro de vídeo gerado sem criar campanha.";
    }

    if (mode === "Criativo de imagem") {
      const asset = this.creative.saveCreativeAsset(company, session, product, offer, dna, "criativo de imagem");
      asset.scriptText = undefined;
      asset.copyText = undefined;
      db.creativeAssets.unshift(asset);
      session.generatedAssets.unshift(asset.id);
      itemType = "image_creative_review";
      itemId = asset.id;
      decision = "Prompt de imagem criado; a arte pode ser gerada em variações por formato.";
    }

    if (mode === "Carrossel") {
      const asset = this.creative.saveCreativeAsset(company, session, product, offer, dna, "carrossel");
      asset.scriptText = this.creative.generateCarousel(product, offer);
      asset.copyText = undefined;
      db.creativeAssets.unshift(asset);
      session.generatedAssets.unshift(asset.id);
      itemType = "carousel_review";
      itemId = asset.id;
      decision = "Sequência de carrossel gerada sem criar campanha.";
    }

    if (mode === "Landing page") {
      const page = this.funnel.generateLandingPage(company, product, offer, dna, session);
      db.landingPages.unshift(page);
      itemType = "landing_page_review";
      itemId = page.id;
      decision = "Landing page criada em estrutura JSON e HTML exportável.";
    }

    if (mode === "Formulário") {
      const form = this.funnel.generateForm(company, product, offer);
      db.forms.unshift(form);
      itemType = "form_review";
      itemId = form.id;
      decision = "Formulário de triagem criado sem campanha.";
    }

    if (mode === "Análise de campanha" || mode === "Otimização") {
      decision = "Sessão preparada para análise: conecte métricas reais ou puxe dados do Meta Ads antes de recomendar escala.";
    }

    if (!decision) decision = "Ideia de demanda estruturada com base no contexto disponível.";

    const approval = this.approvals.requestApproval(company.id, itemType, itemId || undefined, session.id);
    db.approvals.unshift(approval);
    session.approvals.unshift(approval.id);
    session.status = "waiting_user_review";
    session.agentDecisions.unshift({
      id: uid("decision"),
      title: mode,
      decision,
      reason: "Modo isolado não cria campanha, orçamento ou estrutura Meta Ads automaticamente.",
      risk: "Transformar demanda isolada em campanha sem revisar contexto pode gerar execução fraca.",
      nextStep: "Aprovar, pedir alteração ou transformar em campanha completa depois.",
    });
    session.messages.push({
      id: uid("message"),
      sessionId: session.id,
      role: "agent",
      content: aiText || `${decision} Mantive a entrega isolada para não criar campanha completa sem necessidade.`,
      createdAt: now(),
    });
    session.nextAction = "Revisar entrega isolada.";
    session.updatedAt = now();
  }

  private async tryGenerateAiText(
    db: Database,
    company: Company,
    dna: CompanyDna,
    product: Product,
    offer: Offer,
    session: DemandSession,
    userInput: string,
  ) {
    try {
      const result = await this.ai.generateAgentResponse({
        company,
        dna,
        product,
        offer,
        session,
        mode: session.sessionType,
        userInput,
      });
      db.aiUsage.unshift(result.usage);
      return result.text;
    } catch (error) {
      db.aiUsage.unshift({
        id: uid("ai_usage"),
        companyId: company.id,
        userId: session.userId,
        sessionId: session.id,
        generationType: "text",
        model: "fallback",
        promptTokens: 0,
        completionTokens: 0,
        imageCount: 0,
        estimatedCost: 0,
        status: error instanceof Error ? `fallback: ${error.message}` : "fallback",
        createdAt: now(),
      });
      return "";
    }
  }
}
