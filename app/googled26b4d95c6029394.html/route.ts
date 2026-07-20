/**
 * Google Search Console site-verification file.
 *
 * Google's "HTML file upload" verification method requires the literal
 * file content `google-site-verification: <filename>` to be served at
 * the exact path /<filename>.html with no extra whitespace or markup.
 * Do not change the body — Google does a byte-level match.
 *
 * Property: petitionhq.us
 * Verification file from GSC: googled26b4d95c6029394.html
 */
export function GET() {
  return new Response("google-site-verification: googled26b4d95c6029394.html", {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
