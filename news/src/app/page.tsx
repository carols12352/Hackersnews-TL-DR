import {getTopStoriesLite} from "@/lib/hn"
import {TopStoryLite, StorySummary} from "@/lib/types";
import { getCommentsByStoryId } from "@/lib/comments";
import { isPlaceholderSummary, summarizeStory } from "@/lib/summarize";
import { getStorySummary, setStorySummary } from "@/lib/cache";

export default async function Home() {
  let topStories : TopStoryLite[] = await getTopStoriesLite();
  let topStoriesWithComments: Array<TopStoryLite & { comments: Awaited<ReturnType<typeof getCommentsByStoryId>> }> = [];
  let summaries: StorySummary[] = [];
  try {
    topStoriesWithComments = await Promise.all(topStories.map(async (story) => {
      const comments = await getCommentsByStoryId(story.id); 
      return { ...story, comments };
    }));

    summaries = await Promise.all(
    topStoriesWithComments.map(async (item, index) => {
      const cached = await getStorySummary(item.id);
      if (cached) {
        console.log("Redis hit", item.id);
        return cached;
      }

      const generated = await summarizeStory(item, item.comments, index + 1);
      if (isPlaceholderSummary(generated)) {
        console.log("LLM fallback detected; skip cache write", item.id);
      } else {
        await setStorySummary(item.id, generated);
        console.log("Redis miss", item.id);
      }
      return generated;
    })
    );
  } catch (e) {
    console.error("Error fetching top stories:", e);

    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
          <p className="text-2xl font-bold">Failed to fetch top stories.</p>
        </main>
      </div>
    )
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center py-16 px-16 bg-white dark:bg-black sm:items-start">
        {summaries.length > 0 ? (
          <div className="w-full space-y-6">
            {summaries.map((summary) => (
              <div key={summary.storyId} className="p-4 border rounded shadow">
                <h2 className="text-xl font-bold mb-2">{summary.title}</h2>
                <p className="text-sm text-gray-500 mb-2">
                  Generated at: {new Date(summary.generatedAt).toLocaleString()}
                </p>

                <ul className="list-disc list-inside mb-2">
                  {summary.tldrBullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>

                <p className="text-sm font-semibold">Comment Summary:</p>
                <ul className="list-disc list-inside mb-2">
                  {summary.commentSummary.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>

                <p className="text-sm"><strong>Consensus View:</strong> {summary.consensusView}</p>
                <p className="text-sm"><strong>Counter View:</strong> {summary.counterView}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-2xl font-bold">No summary available for the top story.</p>
        )}
        {topStoriesWithComments.length === 0 ? (
          <p className="text-2xl font-bold">There are no top stories at this time.</p>
        ) : (
          <ul className="w-full">
            {topStoriesWithComments.map((item) => (
              <li key={item.id} className="mb-4">
                <a href={item.url} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
                <p className="text-sm text-gray-500">
                  {item.score} points | Fetched comments: {item.comments.length}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
