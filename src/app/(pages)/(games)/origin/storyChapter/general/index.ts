import chapter1 from "../chapter1";
import chapter2 from "../chapter2";
import chapter3 from "../chapter3";
import type { StoryChapterDefinition } from "./types";

export const storyChapterList: StoryChapterDefinition[] = [chapter1, chapter2, chapter3];

const storyChapterMap = new Map<string, StoryChapterDefinition>(
  storyChapterList.map((chapter) => [chapter.id, chapter])
);

export const getStoryChapterById = (id: string) => {
  return storyChapterMap.get(id);
};
