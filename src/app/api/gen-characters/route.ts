import { regenerateCharacterGlbs } from "../../asset/entity/character/regenerateCharacterGlbs";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not available", { status: 404 });
  }

  try {
    const summary = await regenerateCharacterGlbs();
    const ok = summary.failedScripts.length === 0;
    const status = ok ? 200 : 500;

    return new Response(
      JSON.stringify({
        ok,
        ...summary,
      }),
      {
        status,
        headers: { "content-type": "application/json" },
      }
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Generation failed";

    return new Response(
      JSON.stringify({
        ok: false,
        message,
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
