import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not available", { status: 404 });
  }

  try {
    const { stdout, stderr } = await execFileAsync("node", [
      "tools/character/gen_all_characters.mjs",
    ]);
    return new Response(
      JSON.stringify({
        ok: true,
        stdout: stdout || "",
        stderr: stderr || "",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: err?.message || "Generation failed",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
