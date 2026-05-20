import { Company, CompanyDna, DemandSession, FunnelDecision, LandingPage, LeadForm, Offer, Product } from "../types";
import { now, slugify, uid } from "../lib/utils";

export class FunnelService {
  chooseFunnel(company: Company, product: Product, offer: Offer, session: DemandSession): FunnelDecision {
    const highTicket = product.averageTicket >= 1000;
    const needsTrust = Boolean(product.objections || product.proofs || product.type.includes("serviço"));
    const funnelType = highTicket && needsTrust ? "página + formulário" : product.type.includes("e-commerce") ? "página de produto" : "WhatsApp direto";
    const reason =
      funnelType === "página + formulário"
        ? "A oferta precisa explicar valor, construir confiança e qualificar antes do contato comercial."
        : funnelType === "página de produto"
          ? "O produto pode ir para compra direta porque a decisão é mais objetiva e a página já concentra detalhes."
          : "A decisão é rápida e o atendimento humano pode converter melhor que uma página longa.";

    return {
      id: uid("funnel"),
      companyId: company.id,
      sessionId: session.id,
      funnelType,
      reason,
      steps:
        funnelType === "página + formulário"
          ? ["Criativo com diagnóstico", "Landing page de prova e processo", "Formulário de triagem", "WhatsApp com contexto"]
          : funnelType === "página de produto"
            ? ["Criativo direto", "Página de produto", "Checkout", "Remarketing"]
            : ["Criativo direto", "Clique para WhatsApp", "Mensagem pré-preenchida", "Atendimento humano"],
      destinationUrl: funnelType === "WhatsApp direto" ? company.whatsapp : `/landing/${slugify(offer.name || product.name)}`,
      whatsappMessage: `Olá, quero saber mais sobre ${offer.name || product.name}.`,
      createdAt: now(),
    };
  }

  generateLandingPage(company: Company, product: Product, offer: Offer, dna: CompanyDna, session: DemandSession): LandingPage {
    const title = offer.name || product.name;
    const sections = [
      { title: offer.promise || product.mainDesire, copy: `A ${company.name} recomenda começar por uma decisão orientada por contexto, não por impulso.` },
      { title: "Para quem é", copy: product.targetAudience },
      { title: "O problema que resolve", copy: product.mainPain },
      { title: "Por que confiar", copy: product.proofs || dna.availableProofs },
      { title: "Como funciona", copy: product.deliveryMethod || "Diagnóstico, recomendação e próximo passo." },
      { title: "Próximo passo", copy: offer.cta || product.preferredCta },
    ];
    return {
      id: uid("page"),
      companyId: company.id,
      sessionId: session.id,
      title,
      slug: slugify(title),
      pageJson: {
        sections,
        seo: `${title} | ${company.name}`,
        events: ["ViewContent", "Lead", "CompleteRegistration"],
      },
      htmlExport: `<main>${sections.map((section) => `<section><h2>${section.title}</h2><p>${section.copy}</p></section>`).join("")}</main>`,
      status: "draft",
      createdAt: now(),
      updatedAt: now(),
    };
  }

  generateForm(company: Company, product: Product, offer: Offer): LeadForm {
    return {
      id: uid("form"),
      companyId: company.id,
      title: `Triagem | ${offer.name || product.name}`,
      description: "Formulário simples para qualificar intenção antes do atendimento.",
      fields: [
        { name: "Nome", type: "text", required: true },
        { name: "WhatsApp", type: "tel", required: true },
        { name: "Cidade", type: "text", required: true },
        { name: "Principal objetivo", type: "textarea", required: true },
        { name: "Prazo para começar", type: "select", required: true },
      ],
      status: "draft",
      createdAt: now(),
      updatedAt: now(),
    };
  }
}
