import { AiUsage, Company, CreativeAsset, GeneratedImage } from "../types";
import { now, uid } from "../lib/utils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";

export class ImageGenerationService {
  async generateImages(company: Company, asset: CreativeAsset, formats = ["Feed 4:5", "Story 9:16", "Quadrado 1:1"]) {
    const generated: GeneratedImage[] = [];
    let model = "gpt-image-1";

    for (const format of formats) {
      const response = await fetch(`${API_BASE_URL}/api/images/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: asset.imagePrompt,
          format,
          count: 1,
          quality: "medium",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao gerar imagem com OpenAI.");
      model = String(data.model || model);
      for (const image of data.images || []) {
        generated.push({
          id: uid("image"),
          url: image.url,
          prompt: asset.imagePrompt || "",
          format,
          size: image.size,
          model,
          createdAt: now(),
        });
      }
    }

    const usage: AiUsage = {
      id: uid("ai_usage"),
      companyId: company.id,
      userId: "user_demo",
      sessionId: asset.sessionId,
      generationType: "image",
      model,
      promptTokens: 0,
      completionTokens: 0,
      imageCount: generated.length,
      estimatedCost: generated.length,
      status: "completed",
      createdAt: now(),
    };

    return { generated, usage };
  }
}
