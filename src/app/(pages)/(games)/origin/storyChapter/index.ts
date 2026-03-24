import chapter1 from "./chapter1";
import type { StoryChapterDefinition } from "./types";

export const storyChapterList: StoryChapterDefinition[] = [chapter1];

const storyChapterMap = new Map<string, StoryChapterDefinition>(
  storyChapterList.map((chapter) => [chapter.id, chapter])
);

export const getStoryChapterById = (id: string) => {
  return storyChapterMap.get(id);
};
