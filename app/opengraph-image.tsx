import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PetitionHQ — Free EB-2 NIW case-strength assessment scored against Matter of Dhanasar.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Dynamic Open Graph card rendered at /opengraph-image.
 *
 * Served whenever a crawler resolves the site-level OG image. Per-page OG
 * images can override by exporting their own opengraph-image.tsx alongside
 * the page.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #1c1917 0%, #292524 60%, #44403c 100%)",
          padding: "80px",
          color: "white",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "white",
              color: "#1c1917",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            P
          </div>
          <span style={{ fontSize: 32, letterSpacing: -0.5 }}>petitionhq.us</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <p style={{ fontSize: 28, color: "#d6d3d1", margin: 0, letterSpacing: 1, textTransform: "uppercase" }}>
            EB-2 National Interest Waiver
          </p>
          <h1 style={{ fontSize: 64, lineHeight: 1.05, margin: 0, fontWeight: 700, letterSpacing: -2 }}>
            Know if your EB-2 NIW case is strong — before you spend $15,000 on an attorney.
          </h1>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", color: "#a8a29e", fontSize: 24 }}>
          <span>Free 5-min assessment · Scored against Matter of Dhanasar</span>
          <span>petitionhq.us</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
