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


export function storySummaryKey(storyId: number): string {
    return `hn:story:${storyId}:summary:v1`;
}

export async function getStorySummary(storyId: number): Promise<StorySummary | null> {
    const key = storySummaryKey(storyId);
    const data = await redis.get(key);
    if (data) {
        return data as StorySummary;
    }
    return null;
}

export async function setStorySummary(storyId: number, summary: StorySummary, TTL: number = 2700): Promise<void> {
    redis.set(storySummaryKey(storyId), summary, { ex: TTL })
}