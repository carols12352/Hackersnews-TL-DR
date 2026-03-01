import { HNComment } from "@/lib/types";
import { hnFetch } from "@/lib/hn";
import he from "he";
import striptags from "striptags";


export async function getCommentById(id: number): Promise<HNComment | null> {
    try {
        const comment = await hnFetch<HNComment | null>(`item/${id}.json`)
        if (comment === null || comment.dead || comment.deleted || comment.type !== "comment") {
            return null;
        }
        return comment;
    } catch { return null; }
}

export async function getCommentsByIds(ids: number[]): Promise<HNComment[]> {
    const comments = await Promise.all(ids.map(getCommentById));
    const validComments : HNComment[] = [];
    for (const c of comments) {
        if(c !== null) {
            validComments.push(c);
        }
    }
    for (const c of validComments) {
        const noTags = striptags(c.text ?? "");
        const decoded = he.decode(noTags);
        const cleaned = decoded.replace(/\s+/g, " ").trim();
        c.text = cleaned;
    }
    return validComments.filter((c) => (c.text ?? "").length > 0).slice(0, 50);
}

export async function getCommentsByStoryId(storyId: number): Promise<HNComment[]> {
  try {
    const data = await hnFetch<{ kids?: number[] }>(`item/${storyId}.json`);
    const kids = data.kids?.slice(0, 80) ?? [];
    if (kids.length === 0) return [];
    return await getCommentsByIds(kids);
  } catch {
    return [];
  }
}

