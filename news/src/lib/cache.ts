import { Redis } from "@upstash/redis";
import { StorySummary } from "./types";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if(!url || !token) {
    throw new Error("Either redis url or token is missing");
}

export const redis = new Redis({
  url,
  token,
});

const SUMMARY_CACHE_VERSION = "v3";
const SUMMARY_MODEL_TAG = (process.env.OPENAI_MODEL ?? "unknown-model")
  .replace(/[^a-zA-Z0-9_-]/g, "_");

export function storySummaryKey(storyId: number): string {
    return `hn:story:${storyId}:summary:${SUMMARY_CACHE_VERSION}:${SUMMARY_MODEL_TAG}`;
}

export async function getStorySummary(storyId: number): Promise<StorySummary | null> {
    const key = storySummaryKey(storyId);
    const data = await redis.get<StorySummary>(key);
    if (data) {
        return data;
    }
    return null;
}

export async function setStorySummary(storyId: number, summary: StorySummary, TTL: number = 2700): Promise<void> {
    await redis.set(storySummaryKey(storyId), summary, { ex: TTL });
}
