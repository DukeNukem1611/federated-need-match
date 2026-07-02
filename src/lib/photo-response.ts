// Turns a stored data-URL photo into a binary image response with cache
// headers. Photos are immutable once posted (there's no edit), so the browser
// can cache aggressively; `private` keeps shared proxies from storing what is
// auth-gated content.
import { NextResponse } from "next/server";

const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/;

export function dataUrlToImageResponse(dataUrl: string): NextResponse {
  const m = DATA_URL_RE.exec(dataUrl);
  if (!m) {
    return NextResponse.json({ error: "Invalid stored image" }, { status: 500 });
  }
  const [, mime, b64] = m;
  const bytes = Buffer.from(b64, "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
