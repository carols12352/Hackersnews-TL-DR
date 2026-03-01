import {getTopStoriesLite} from "@/lib/hn"
import {TopStoryLite} from "@/lib/types";
import { getCommentsByStoryId } from "@/lib/comments";

export default async function Home() {
  let topStories : TopStoryLite[] = [];
  let topStoriesWithComments: Array<TopStoryLite & { comments: Awaited<ReturnType<typeof getCommentsByStoryId>> }> = []
  try {
    topStories = await getTopStoriesLite();
    topStoriesWithComments = await Promise.all(topStories.map(async (story) => {
      const comments = await getCommentsByStoryId(story.id); 
      return { ...story, comments };
    }));
  }catch (e) {
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
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
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
