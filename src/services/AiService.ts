import { AiUsage, Company, CompanyDna, DemandSession, Offer, Product } from "../types";
import { now, uid } from "../lib/utils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";

export const VERTICE_SYSTEM_PROMPT = `Você é o Agente de Demanda da Vértice.

Sua função é transformar contexto real de empresa, produto, oferta e objetivo em decisões e ativos de geração de demanda.

Você não é um gerador genérico de anúncios.
Você atua como estrategista de demanda, copywriter, diretor criativo, consultor de funil, analista de performance e operador assistido de Meta Ads.

Você deve ser assertivo.
Você deve ter opinião.
Você deve pedir contexto quando faltar informação.
Você deve justificar decisões.
Você deve evitar respostas genéricas.
Você deve priorizar geração de demanda real.

Regra obrigatória:
Nada deve ser publicado, pausado, alterado ou otimizado em conta de anúncio sem aprovação humana.

Sua lógica:
1. Entenda o contexto.
2. Diagnostique a intenção.
3. Decida o melhor caminho.
4. Crie os ativos.
5. Apresente para aprovação.
6. Aprenda com os resultados.

Evite linguagem fraca. Quando houver incerteza, declare a hipótese e proponha teste.`;

export interface AiContext {
  company: Company;
  dna: CompanyDna;
  product: Product;
  offer: Offer;
  session: DemandSession;
  mode: string;
  userInput?: string;
}

export class AiService {
  async generateAgentResponse(context: AiContext) {
    const input = this.buildInput(context);
    const response = await fetch(`${API_BASE_URL}/api/ai/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: VERTICE_SYSTEM_PROMPT,
        input,
        mode: context.mode,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha ao gerar resposta com OpenAI.");
    return {
      text: String(data.text || "").trim(),
      usage: this.usageFromResponse(context, data, "text"),
    };
  }

  usageFromResponse(context: AiContext, data: Record<string, unknown>, generationType: string): AiUsage {
    const usage = (data.usage || {}) as Record<string, number>;
    return {
      id: uid("ai_usage"),
      companyId: context.company.id,
      userId: context.session.userId,
      sessionId: context.session.id,
      generationType,
      model: String(data.model || "openai"),
      promptTokens: Number(usage.input_tokens || usage.prompt_tokens || 0),
      completionTokens: Number(usage.output_tokens || usage.completion_tokens || 0),
      imageCount: 0,
      estimatedCost: 0,
      status: "completed",
      createdAt: now(),
    };
  }

  private buildInput({ company, dna, product, offer, session, mode, userInput }: AiContext) {
    return [
      `Modo da sessão: ${mode}`,
      `Objetivo: ${session.objective}`,
      `Mensagem do usuário: ${userInput || "Gerar entrega do modo com base no contexto."}`,
      "",
      "Empresa:",
      JSON.stringify(company, null, 2),
      "",
      "DNA:",
      JSON.stringify(dna, null, 2),
      "",
      "Produto:",
      JSON.stringify(product, null, 2),
      "",
      "Oferta:",
      JSON.stringify(offer, null, 2),
      "",
      "Entregue em português do Brasil, com decisão, justificativa, ativo, risco e próximo passo.",
    ].join("\n");
  }
}
