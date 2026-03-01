export interface StorySummary {
  storyId: number;
  title: string;
  url: string;
  generatedAt: string;
  tldrBullets: string[]; // 3-5
  commentSummary: string[]; // Core viewpoints
  consensusView?: string;
  counterView?: string;
  sourceMeta: {
    storyScore: number;
    commentsUsed: number;
    topRank: number;
  };
}

export interface HNItemBase {
  id: number;
  by?: string;
  time?: number;
  type?: "story" | "comment" | "job" | "poll" | "pollopt";
  dead?: boolean;
  deleted?: boolean;
}

export interface HNStory extends HNItemBase {
  type: "story";
  title: string;
  url?: string;
  score?: number;
  kids?: number[]; // comment ids
  descendants?: number;
}

export interface HNComment extends HNItemBase {
  type: "comment";
  parent: number;
  text?: string;
  score?: number;
  kids?: number[];
}

export interface TopStoryLite {
  id: number;
  title: string;
  url: string;
  score: number;
  kids: number[];
}
