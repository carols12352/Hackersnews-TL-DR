import { HNStory, TopStoryLite } from "./types";
export const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";


export async function hnFetch<T>(path: string): Promise<T> {
    const modpath = path.startsWith("/") ? path : `/${path}`;

    const res = await fetch(`${HN_API_BASE}${modpath}`);
    if (!res.ok) {
        throw new Error(`HN API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data as T;
}

export async function getTopStoryIds(limit:number = 5): Promise<number[]> {
    const data = await hnFetch<number[]>("topstories.json");
    return data.slice(0, limit);
}

export async function getStoryById(id: number): Promise<HNStory |null> {
    try {
        const story = await hnFetch<HNStory>(`item/${id}.json`);
        if( story === null) {
            return null;
        }else if (story.type !== "story" || story.dead || story.deleted) {
            return null;
        } else {
            return story;
        }
    } catch (e) {
        return null;
    }
}

export async function getTopStoriesLite(limit: number = 5): Promise<TopStoryLite[]> {
  const ids = await getTopStoryIds(limit);
  const stories = await Promise.all(ids.map(getStoryById));

  return stories
    .filter((s): s is HNStory => s !== null)
    .map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url ?? `https://news.ycombinator.com/item?id=${s.id}`,
      score: s.score ?? 0,
      kids: s.kids ?? [],
    }));
}
