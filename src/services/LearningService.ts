import { AiEvaluation, Campaign, LearnedPattern, PerformanceSnapshot } from "../types";
import { now, uid } from "../lib/utils";

export class LearningService {
  evaluateCampaign(campaign: Campaign, snapshot: PerformanceSnapshot): AiEvaluation {
    const goodCpl = snapshot.costPerLead <= Math.max(40, campaign.budgetDaily * 0.35);
    return {
      id: uid("evaluation"),
      companyId: campaign.companyId,
      campaignId: campaign.id,
      evaluationType: "performance",
      diagnosis: goodCpl
        ? "A campanha tem sinal positivo de custo por lead. O próximo gargalo provável é qualidade e velocidade de atendimento."
        : "O custo por lead está acima do esperado para teste inicial. O problema tende a estar no ângulo, oferta ou fricção do funil.",
      possibleCauses: goodCpl
        ? "Criativo consultivo gerou intenção, mas o formulário precisa medir prontidão de compra."
        : "Gancho pouco específico, promessa fraca, prova insuficiente ou destino com muita fricção.",
      recommendation: goodCpl
        ? "Manter criativo principal, testar variação de gancho e adicionar pergunta de qualificação."
        : "Reescrever gancho com objeção principal, reforçar prova e revisar oferta antes de subir verba.",
      confidence: goodCpl ? 0.78 : 0.69,
      createdAt: now(),
    };
  }

  createLearnedPattern(campaign: Campaign, evaluation: AiEvaluation, snapshot: PerformanceSnapshot): LearnedPattern {
    return {
      id: uid("pattern"),
      companyId: campaign.companyId,
      productId: campaign.productId,
      offerId: campaign.offerId,
      patternType: "performance_learning",
      title: snapshot.costPerLead <= 45 ? "Ângulo consultivo com bom sinal" : "Oferta precisa de prova antes de escala",
      description: evaluation.recommendation,
      evidence: {
        cpl: snapshot.costPerLead,
        ctr: snapshot.ctr,
        leads: snapshot.leads,
        spend: snapshot.spend,
      },
      confidence: evaluation.confidence,
      status: "active",
      createdAt: now(),
      updatedAt: now(),
    };
  }

  generateNextRecommendation(evaluations: AiEvaluation[]) {
    const last = evaluations[0];
    return last?.recommendation || "Criar teste com vídeo principal, prova forte e funil de qualificação.";
  }
}
