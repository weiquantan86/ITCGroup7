import type { ComponentType, Dispatch, SetStateAction } from "react";

export type StoryChapterUiState = {
  hideRightPanel?: boolean;
  chapter1ControlHintVisible?: boolean;
  chapter1FlareNearby?: boolean;
  chapter1FlareTalked?: boolean;
  chapter1FlareReachedDestination?: boolean;
  chapter1PrimaryAttackUnlocked?: boolean;
  chapter1WoodCollected?: number;
  chapter1WoodTotal?: number;
};

export type StoryChapterComponentProps = {
  chapterUiState: StoryChapterUiState;
  setChapterUiState: Dispatch<SetStateAction<StoryChapterUiState>>;
};

export type StoryChapterRuleGroups = {
  sceneCallRules: string[];
  rightPanelFillRules: string[];
  gameRules: string[];
  displayRules: string[];
};

export type StoryChapterDefinition = {
  id: string;
  label: string;
  summary: string;
  rules: StoryChapterRuleGroups;
  GameFrame: ComponentType<StoryChapterComponentProps>;
  RightPanel: ComponentType<StoryChapterComponentProps>;
  initialUiState?: StoryChapterUiState;
};
