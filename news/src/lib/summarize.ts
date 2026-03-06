import { StorySummary, TopStoryLite, HNComment } from "./types";
import OpenAI from "openai";

const dev = process.env.NODE_ENV;
const openaiKey = process.env.OPENAI_API_KEY;
const openaiBase = process.env.OPENAI_API_BASE_URL;
const openaiModel = process.env.OPENAI_MODEL ?? "gpt-4o";
const PLACEHOLDER_HINT = "LLM summary is not available yet.";

const openai = new OpenAI({
  apiKey: openaiKey,
  baseURL: openaiBase,
});

type LLMOutput = {
  tldrBullets?: string[];
  commentSummary?: string[];
  consensusView?: string;
  counterView?: string;
};

type NormalizedLLMOutput = {
  tldrBullets: string[];
  commentSummary: string[];
  consensusView: string;
  counterView: string;
};

function generateAt(): string {
  return new Date().toISOString();
}

function placeholderOutput(story: TopStoryLite, comments: HNComment[]): NormalizedLLMOutput {
  return {
    tldrBullets: [
      `This is a placeholder TLDR for story ${story.id}.`,
      PLACEHOLDER_HINT,
      "Set OPENAI_API_KEY to enable real summaries.",
    ],
    commentSummary: [
      `This is a placeholder comment summary based on ${comments.length} comments.`,
      "No LLM consensus generated.",
      "No LLM counter view generated.",
    ],
    consensusView: "Placeholder consensus view.",
    counterView: "Placeholder counter view.",
  };
}

export function isPlaceholderSummary(summary: StorySummary): boolean {
  return summary.tldrBullets.includes(PLACEHOLDER_HINT);
}

function normalizeOutput(raw: LLMOutput, story: TopStoryLite, comments: HNComment[]): NormalizedLLMOutput {
  const fallback = placeholderOutput(story, comments);

  return {
    tldrBullets: (raw.tldrBullets ?? fallback.tldrBullets).slice(0, 5),
    commentSummary: (raw.commentSummary ?? fallback.commentSummary).slice(0, 6),
    consensusView: raw.consensusView ?? fallback.consensusView,
    counterView: raw.counterView ?? fallback.counterView,
  };
}

function buildPrompt(story: TopStoryLite, comments: HNComment[]): string {
  const commentLines = comments
    .slice(0, 50)
    .map((c, i) => `${i + 1}. ${c.text ?? ""}`)
    .join("\n");

  return [
    `Story title: ${story.title}`,
    `Story url: ${story.url}`,
    "",
    "Top comments:",
    commentLines || "No comments",
    "",
    "Return JSON only with keys:",
    "tldrBullets (array, 3-5 strings)",
    "commentSummary (array, 3-6 strings)",
    "consensusView (string)",
    "counterView (string, optional)",
    "",
    "Requirements:",
    "- High information density",
    "- No fluff",
    "- Grounded in input only",
  ].join("\n");
}

async function callLLM(story: TopStoryLite, comments: HNComment[]): Promise<NormalizedLLMOutput> {
  if (!openaiKey || dev === "development") {
    return normalizeOutput(placeholderOutput(story, comments), story, comments);
  }

  console.log("LLM request start", {
    storyId: story.id,
    model: openaiModel,
    hasBaseURL: Boolean(openaiBase),
    commentsUsed: Math.min(comments.length, 50),
  });

  const completion = await openai.chat.completions.create({
    model: openaiModel,
    messages: [
      {
        role: "system",
        content:
          "You are a strict summarizer. Respond with valid JSON only. No markdown. No extra keys.",
      },
      {
        role: "user",
        content: buildPrompt(story, comments),
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  console.log("LLM request success", {
    storyId: story.id,
    outputLength: content.length,
  });

  const parsed = JSON.parse(content) as LLMOutput;
  return normalizeOutput(parsed, story, comments);
}

export async function summarizeStory(story:TopStoryLite, comments:HNComment[], topRank:number): Promise<StorySummary>  {
  const storyId = story.id;
  const title = story.title;
  const url = story.url;
  const generatedAt = generateAt();

  let out: NormalizedLLMOutput;
  try {
    out = await callLLM(story, comments);
  } catch (error) {
    console.error("summarizeStory LLM fallback:", error);
    out = normalizeOutput(placeholderOutput(story, comments), story, comments);
  }

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
    tldrBullets: out.tldrBullets,
    commentSummary: out.commentSummary,
    consensusView: out.consensusView,
    counterView: out.counterView,
    sourceMeta,
  };
}
