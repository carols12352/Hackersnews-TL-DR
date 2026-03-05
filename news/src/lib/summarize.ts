import { StorySummary, TopStoryLite, HNComment } from "./types";

function generateAt(): Promise<string> {
  const now = new Date();
  return Promise.resolve(now.toISOString());
}

async function tldrBulletPoints(story: TopStoryLite, comments: HNComment[]): Promise<string[]> {
    //Placeholder
    return [`This is a placeholder TLDR for story ${story.id}.`];
}

async function commentSummary(comments: HNComment[]): Promise<string[]> {
    //Placeholder
    return [`This is a placeholder comment summary based on ${comments.length} comments.`];
}


export async function summarizeStory(story:TopStoryLite, comments:HNComment[], topRank:number): Promise<StorySummary>  {
    const storyId = story.id;
    const title = story.title;
    const url = story.url;
    const generatedAt = await generateAt();
    const tldrBullets = await tldrBulletPoints(story, comments);
    const commentSummaryPoints = await commentSummary(comments);
    const consensusView = commentSummaryPoints[0] ?? "Placeholder consensus view.";
    const counterView = commentSummaryPoints[1] ?? "Placeholder counter view.";
    const sourceMeta = {
        storyScore: story.score,
        commentsUsed: comments.length,
        topRank,
    };

    return {
        storyId,
        title,
        url,
        generatedAt,
        tldrBullets,
        commentSummary: commentSummaryPoints,
        consensusView,
        counterView,
        sourceMeta,
    };
}