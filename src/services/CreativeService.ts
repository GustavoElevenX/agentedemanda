import { Company, CompanyDna, CopyVariation, CreativeAsset, DemandSession, Offer, Product } from "../types";
import { compactText, now, uid } from "../lib/utils";

export class CreativeService {
  generateCopy(company: Company, product: Product, offer: Offer, session: DemandSession): CopyVariation {
    const angle = this.chooseAngle(product, offer);
    return {
      id: uid("copy"),
      companyId: company.id,
      creativeAssetId: undefined,
      channel: session.sessionType === "Copy" ? "Meta Ads e social" : "Meta Ads",
      primaryText: `Antes de tomar uma decisão, entenda se ${product.name} realmente resolve o que você precisa. A ${company.name} trabalha com ${compactText(company.positioning).toLowerCase()} e recomenda começar por uma avaliação clara: ${offer.promise}`,
      headline: offer.promise || `${product.name} com orientação estratégica`,
      description: `${compactText(product.mainPain)} não precisa virar tentativa no escuro.`,
      caption: `${compactText(offer.cta || product.preferredCta, "Solicitar análise")}.`,
      cta: offer.cta || product.preferredCta || "Solicitar análise",
      angle,
      status: "draft",
      createdAt: now(),
    };
  }

  generateVideoScript(product: Product, offer: Offer, dna: CompanyDna): string {
    return [
      `Objetivo do vídeo: gerar confiança e explicar por que ${product.name} exige contexto antes da decisão.`,
      `Gancho principal: "O erro não é querer resolver ${product.mainPain.toLowerCase()}; o erro é escolher o caminho sem diagnóstico."`,
      "5 variações de gancho:",
      "1. Antes de comprar, veja se isso serve para você.",
      "2. Nem todo caso pede a mesma solução.",
      "3. O que ninguém te pergunta antes de vender.",
      "4. Se você já tentou e não funcionou, comece por aqui.",
      "5. O tratamento certo começa com a pergunta certa.",
      "Roteiro completo:",
      `Cena 1: especialista em ambiente real. Fala: "Na ${dna.positioning}, a gente não começa empurrando solução."`,
      `Cena 2: explicar a dor. Fala: "Quem sofre com ${product.mainPain.toLowerCase()} precisa entender causa, expectativa e limite."`,
      `Cena 3: prova. Fala: "Usamos ${compactText(product.proofs, "provas e processo consultivo")} para orientar a decisão."`,
      `Cena 4: oferta. Fala: "${offer.promise}"`,
      `Cena 5: CTA. Fala: "${offer.cta || product.preferredCta}"`,
      "Texto na tela: Diagnóstico antes da decisão | Plano individual | Atendimento com critério",
      "Dicas de gravação: luz natural, enquadramento próximo, tom calmo e autoridade sem exagero.",
      "Dicas de edição: cortes secos, legendas grandes, prova visual discreta e CTA final claro.",
      "Variações A/B: gancho de objeção vs. gancho de diagnóstico.",
    ].join("\n");
  }

  generateImagePrompt(company: Company, product: Product, offer: Offer, dna: CompanyDna) {
    return `Imagem publicitária realista para a ${company.name}, segmento ${company.segment}. Cena com estética ${dna.visualStyle}. Comunicar "${offer.promise || product.mainDesire}" sem promessa exagerada. Usar cores ${dna.brandColors}. Incluir texto curto: "${offer.cta || product.preferredCta}". Visual confiável, humano, direto, alta qualidade, formato 4:5 para Meta Ads.`;
  }

  generateCarousel(product: Product, offer: Offer) {
    return [
      `Slide 1: ${product.mainPain} não se resolve com escolha no escuro.`,
      `Slide 2: O que avaliar antes: contexto, objetivo, histórico e expectativa.`,
      `Slide 3: Por que essa oferta existe: ${offer.promise}`,
      `Slide 4: O que muda quando você começa por diagnóstico: menos tentativa, mais clareza.`,
      `Slide 5: Próximo passo: ${offer.cta || product.preferredCta}`,
    ].join("\n");
  }

  saveCreativeAsset(
    company: Company,
    session: DemandSession,
    product: Product,
    offer: Offer,
    dna: CompanyDna,
    type = "pacote criativo",
  ): CreativeAsset {
    return {
      id: uid("asset"),
      companyId: company.id,
      sessionId: session.id,
      type,
      format: this.recommendFormat(product),
      angle: this.chooseAngle(product, offer),
      pain: product.mainPain,
      desire: product.mainDesire,
      objection: product.objections,
      promise: offer.promise,
      proof: product.proofs || dna.availableProofs,
      cta: offer.cta || product.preferredCta,
      hypothesis: "Criativo com diagnóstico e prova deve qualificar melhor que promessa direta.",
      copyText: this.generateCopy(company, product, offer, session).primaryText,
      scriptText: this.generateVideoScript(product, offer, dna),
      imagePrompt: this.generateImagePrompt(company, product, offer, dna),
      status: "generated",
      createdAt: now(),
      updatedAt: now(),
    };
  }

  private chooseAngle(product: Product, offer: Offer) {
    if (product.averageTicket >= 1000 || product.type.includes("serviço")) return "Diagnóstico, confiança e quebra de objeção";
    if (offer.discount) return "Oferta direta com urgência controlada";
    return "Valor prático e próximo passo simples";
  }

  private recommendFormat(product: Product) {
    if (product.averageTicket >= 900 || product.type.includes("serviço")) return "Vídeo 30s + variação imagem para remarketing";
    if (product.type.includes("e-commerce")) return "Imagem 4:5 + coleção";
    return "Vídeo curto + carrossel educativo";
  }
}
