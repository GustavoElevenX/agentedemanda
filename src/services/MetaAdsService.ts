import { Campaign, MetaConnection, PerformanceSnapshot } from "../types";
import { now, uid } from "../lib/utils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787";

export class MetaAdsService {
  connectMeta(companyId: string): MetaConnection {
    return {
      id: uid("meta"),
      companyId,
      userId: "user_demo",
      metaUserId: "mock_meta_user",
      adAccountId: "act_mock_" + Math.floor(Math.random() * 100000),
      businessId: "business_mock",
      accessTokenEncrypted: "mock_encrypted_token_replace_with_oauth",
      tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(),
      status: "active",
      createdAt: now(),
      updatedAt: now(),
    };
  }

  listAdAccounts(connection?: MetaConnection) {
    return [
      { id: connection?.adAccountId || "act_mock_001", name: "Conta Meta Ads principal", status: "ACTIVE" },
      { id: "act_mock_002", name: "Conta de testes", status: "ACTIVE" },
    ];
  }

  listCampaigns() {
    return [
      { id: "mock_campaign_001", name: "Campanha antiga | Leads", status: "PAUSED" },
      { id: "mock_campaign_002", name: "Remarketing | Prova", status: "ACTIVE" },
    ];
  }

  async listAdAccountsReal() {
    const response = await fetch(`${API_BASE_URL}/api/meta/ad-accounts`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha ao listar contas reais do Meta Ads.");
    return data.data || [];
  }

  async listCampaignsReal(adAccountId?: string) {
    const suffix = adAccountId ? `?adAccountId=${encodeURIComponent(adAccountId)}` : "";
    const response = await fetch(`${API_BASE_URL}/api/meta/campaigns${suffix}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha ao listar campanhas reais do Meta Ads.");
    return data.data || [];
  }

  getInsights(campaign: Campaign): PerformanceSnapshot {
    const clicks = 180 + Math.floor(Math.random() * 120);
    const leads = 8 + Math.floor(Math.random() * 22);
    const spend = Math.round(campaign.budgetTotal * 0.42);
    return {
      id: uid("snapshot"),
      companyId: campaign.companyId,
      campaignId: campaign.id,
      metaCampaignId: campaign.metaCampaignId || "mock_meta_campaign",
      dateStart: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10),
      dateEnd: new Date().toISOString().slice(0, 10),
      spend,
      impressions: 12000 + Math.floor(Math.random() * 9000),
      reach: 9000 + Math.floor(Math.random() * 7000),
      frequency: 1.3,
      cpm: 34,
      cpc: Number((spend / clicks).toFixed(2)),
      ctr: 1.2,
      clicks,
      leads,
      costPerLead: Number((spend / leads).toFixed(2)),
      results: leads,
      costPerResult: Number((spend / leads).toFixed(2)),
      rawPayload: { source: "mock_meta_ads_service" },
      createdAt: now(),
    };
  }

  uploadAdImage() {
    return { hash: "mock_image_hash", status: "READY" };
  }

  createPausedCampaign(campaign: Campaign) {
    return { metaCampaignId: `meta_campaign_${campaign.id.slice(-8)}`, status: "PAUSED" };
  }

  async createPausedCampaignReal(campaign: Campaign, adAccountId?: string) {
    const response = await fetch(`${API_BASE_URL}/api/meta/campaigns/paused`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adAccountId,
        name: campaign.name,
        objective: "OUTCOME_LEADS",
        specialAdCategories: [],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha ao criar campanha pausada real.");
    return { metaCampaignId: data.id || data.metaCampaignId, status: data.status || "PAUSED", raw: data };
  }

  createPausedAdSet() {
    return { metaAdSetId: uid("meta_adset"), status: "PAUSED" };
  }

  createPausedAd() {
    return { metaAdId: uid("meta_ad"), status: "PAUSED" };
  }
}
