import { Campaign, Company, DemandSession, FunnelDecision, Offer, Product } from "../types";
import { now, uid } from "../lib/utils";

export class CampaignService {
  createInternalCampaign(company: Company, product: Product, offer: Offer, session: DemandSession, funnel: FunnelDecision): Campaign {
    const budget = Number(session.collectedContext.verba?.replace(/\D/g, "")) || Math.max(900, product.averageTicket);
    return {
      id: uid("campaign"),
      companyId: company.id,
      sessionId: session.id,
      productId: product.id,
      offerId: offer.id,
      name: `${offer.name || product.name} | ${company.name}`,
      objective: session.objective || "Gerar demanda qualificada",
      channel: "Meta Ads",
      funnelType: funnel.funnelType,
      destinationType: funnel.funnelType.includes("formulário") ? "landing_page_form" : funnel.funnelType,
      budgetDaily: Math.round(budget / 10),
      budgetTotal: budget,
      location: {
        country: company.country || "Brasil",
        state: company.state,
        city: company.city,
        radius: session.collectedContext.raio || "10 km",
      },
      ageMin: 24,
      ageMax: 60,
      metaStatus: "PAUSED",
      internalStatus: "waiting_review",
      createdAt: now(),
      updatedAt: now(),
    };
  }

  buildMetaStructure(campaign: Campaign) {
    return {
      campaign: {
        name: campaign.name,
        objective: "OUTCOME_LEADS",
        status: "PAUSED",
      },
      adSet: {
        name: `${campaign.name} | Conjunto 1`,
        daily_budget: campaign.budgetDaily * 100,
        billing_event: "IMPRESSIONS",
        optimization_goal: "LEAD_GENERATION",
        status: "PAUSED",
        targeting: {
          geo_locations: campaign.location,
          age_min: campaign.ageMin,
          age_max: campaign.ageMax,
        },
      },
      ad: {
        name: `${campaign.name} | Anúncio 1`,
        status: "PAUSED",
      },
      thesis:
        "A segmentação real acontece pelo criativo, pela oferta, pelo ângulo e pelo funil. Interesses devem ser usados apenas quando houver justificativa clara.",
    };
  }

  updateCampaignStatus(campaign: Campaign, internalStatus: Campaign["internalStatus"]) {
    return { ...campaign, internalStatus, updatedAt: now() };
  }

  attachMetaIds(campaign: Campaign, metaCampaignId: string) {
    return { ...campaign, metaCampaignId, metaStatus: "PAUSED", internalStatus: "created_paused" as const, updatedAt: now() };
  }
}
