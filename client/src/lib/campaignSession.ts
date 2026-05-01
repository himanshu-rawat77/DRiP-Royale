import type { CampaignDifficulty } from "./soloCampaignClient";

const CAMPAIGN_SESSION_KEY = "drip-campaign-session";

export interface CampaignSession {
  campaignId: string;
  difficulty: CampaignDifficulty;
  runId?: string;
}

export function readCampaignSession(): CampaignSession | null {
  try {
    const raw = sessionStorage.getItem(CAMPAIGN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CampaignSession;
    if (!parsed?.campaignId || !parsed?.difficulty) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCampaignSession(next: CampaignSession): void {
  sessionStorage.setItem(CAMPAIGN_SESSION_KEY, JSON.stringify(next));
}

export function clearCampaignSession(): void {
  sessionStorage.removeItem(CAMPAIGN_SESSION_KEY);
}
