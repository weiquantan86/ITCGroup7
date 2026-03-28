import { useCallback, useState } from "react";
import type {
  StoryChapterComponentProps,
  StoryChapterDefinition,
} from "../general/types";

const chapter3Rules = {
  sceneCallRules: [],
  rightPanelFillRules: [],
  gameRules: [],
  displayRules: [],
};

function Chapter3GameFrame({ setChapterUiState }: StoryChapterComponentProps) {
  const [started, setStarted] = useState(false);

  const startChapter = useCallback(() => {
    setStarted(true);
    setChapterUiState((previous) => ({
      ...previous,
      hideRightPanel: true,
    }));
  }, [setChapterUiState]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "18px",
      }}
    >
      {!started ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid #ff0000",
            background: "#000000",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.74rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#ff0000",
              fontWeight: 700,
            }}
          >
            Chapter Frame
          </p>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(1.35rem, 2.4vw, 2rem)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#ff0000",
            }}
          >
            chapter3
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.94rem",
              letterSpacing: "0.03em",
              color: "#ff0000",
            }}
          >
            Click Start to enter Chapter 3.
          </p>
          <button
            type="button"
            onClick={startChapter}
            style={{
              border: "1px solid #ff0000",
              borderRadius: "12px",
              background: "#000000",
              color: "#ff0000",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontWeight: 800,
              padding: "10px 18px",
              cursor: "pointer",
            }}
          >
            Start
          </button>
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "22px",
            border: "1px solid #ff0000",
            background: "#000000",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.78rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#ff0000",
              fontWeight: 700,
            }}
          >
            Chapter 3
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "clamp(1.05rem, 1.8vw, 1.45rem)",
              color: "#ff0000",
              lineHeight: 1.7,
            }}
          >
            Start cover ready.
          </p>
        </div>
      )}
    </div>
  );
}

function Chapter3RightPanel() {
  return null;
}

const chapter3: StoryChapterDefinition = {
  id: "chapter3",
  label: "chapter3",
  summary: "",
  rules: chapter3Rules,
  GameFrame: Chapter3GameFrame,
  RightPanel: Chapter3RightPanel,
  initialUiState: {
    hideRightPanel: true,
  },
};

export default chapter3;
