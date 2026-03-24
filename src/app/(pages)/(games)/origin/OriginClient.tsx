"use client";

import { useEffect, useMemo, useState } from "react";
import { getStoryChapterById, storyChapterList } from "./storyChapter";
import type { StoryChapterUiState } from "./storyChapter/types";
import styles from "./origin.module.css";

const FALLBACK_CHAPTER_ID = storyChapterList[0]?.id ?? "";

export default function OriginClient() {
  const [selectedChapterId, setSelectedChapterId] =
    useState<string>(FALLBACK_CHAPTER_ID);
  const [chapterUiState, setChapterUiState] = useState<StoryChapterUiState>({});

  const selectedChapter = useMemo(() => {
    return (
      getStoryChapterById(selectedChapterId) ??
      getStoryChapterById(FALLBACK_CHAPTER_ID) ??
      null
    );
  }, [selectedChapterId]);

  useEffect(() => {
    setChapterUiState(selectedChapter?.initialUiState ?? {});
  }, [selectedChapter?.id]);

  if (!selectedChapter) {
    return (
      <main className={styles.pageShell}>
        <div className={styles.pageChrome}>
          <header className={styles.titleBar}>
            <h1 className={styles.titleText}>Strike Origin</h1>
          </header>
          <section className={styles.mainGrid}>
            <div className={styles.emptyState}>No chapter is configured.</div>
          </section>
        </div>
      </main>
    );
  }

  const ChapterGameFrame = selectedChapter.GameFrame;
  const ChapterRightPanel = selectedChapter.RightPanel;
  const hasSummary = selectedChapter.summary.trim().length > 0;

  return (
    <main className={styles.pageShell}>
      <div className={styles.pageChrome}>
        <header className={styles.titleBar}>
          <h1 className={styles.titleText}>Strike Origin</h1>
        </header>

        <section className={styles.mainGrid}>
          <aside className={styles.sidePanel}>
            <p className={styles.panelLabel}>Chapter</p>
            <div className={styles.chapterList}>
              {storyChapterList.map((chapter) => {
                const isActive = chapter.id === selectedChapter.id;
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    className={`${styles.chapterButton} ${
                      isActive ? styles.chapterButtonActive : ""
                    }`}
                    onClick={() => setSelectedChapterId(chapter.id)}
                  >
                    {chapter.label}
                  </button>
                );
              })}
            </div>
            {hasSummary ? (
              <div className={styles.chapterSummaryCard}>
                <p className={styles.cardTitle}>Summary</p>
                <p className={styles.cardBody}>{selectedChapter.summary}</p>
              </div>
            ) : null}
          </aside>

          <section className={styles.gamePanel}>
            <ChapterGameFrame
              chapterUiState={chapterUiState}
              setChapterUiState={setChapterUiState}
            />
          </section>

          <aside
            className={
              chapterUiState.hideRightPanel
                ? styles.sidePanelBlank
                : styles.sidePanel
            }
          >
            {chapterUiState.hideRightPanel ? null : (
              <ChapterRightPanel
                chapterUiState={chapterUiState}
                setChapterUiState={setChapterUiState}
              />
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
