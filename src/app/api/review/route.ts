import Anthropic from "@anthropic-ai/sdk";
import { REVIEW_JSON_SCHEMA, REVIEW_SYSTEM_PROMPT, Review, ReviewRequest, renderReviewInput } from "@/lib/review";

// A review thinks before it writes, so allow more than the platform's default function time.
export const maxDuration = 120;

const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
/**
 * Best-effort per-instance limiter, so a public deployment can't be used to burn the API key.
 * Serverless instances don't share it — put a real limiter (e.g. at the edge) in front for heavy traffic.
 */
const recent = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > MAX_PER_WINDOW;
}

const error = (status: number, code: string, message: string) => Response.json({ error: code, message }, { status });

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return error(503, "not_configured", "AI review isn't enabled on this deployment. Set ANTHROPIC_API_KEY on the server to turn it on.");
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return error(429, "rate_limited", "Too many reviews in a minute. Give it a moment and try again.");

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return error(413, "too_large", "This design is too large to review.");
  let parsed;
  try {
    parsed = ReviewRequest.safeParse(JSON.parse(raw));
  } catch {
    return error(400, "bad_request", "The request wasn't valid JSON.");
  }
  if (!parsed.success) return error(400, "bad_request", "The design couldn't be read. Add at least one component and try again.");

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      // A review is moderately hard; medium effort keeps it thorough without a long wait.
      output_config: { effort: "medium", format: { type: "json_schema", schema: REVIEW_JSON_SCHEMA } },
      // If a safety classifier declines, retry server-side on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: REVIEW_SYSTEM_PROMPT,
      messages: [{ role: "user", content: renderReviewInput(parsed.data) }],
    });

    if (response.stop_reason === "refusal") {
      return error(422, "refused", "The reviewer declined this design. Try relabeling components and run it again.");
    }
    if (response.stop_reason === "max_tokens") {
      return error(502, "truncated", "The review ran long and was cut off. Try again.");
    }
    const text = response.content.find((b) => b.type === "text");
    const review = text ? Review.safeParse(JSON.parse(text.text)) : null;
    if (!review?.success) return error(502, "bad_output", "The review came back malformed. Try again.");
    return Response.json({ review: review.data, model: response.model });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return error(429, "upstream_rate_limited", "The AI service is busy. Try again shortly.");
    if (e instanceof Anthropic.AuthenticationError) return error(503, "not_configured", "The server's API key was rejected.");
    if (e instanceof Anthropic.APIError) return error(502, "upstream_error", "The AI service returned an error. Try again.");
    if (e instanceof SyntaxError) return error(502, "bad_output", "The review came back malformed. Try again.");
    throw e;
  }
}
