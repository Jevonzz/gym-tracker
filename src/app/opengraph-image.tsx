import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Lift, personal bulk and training log";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logo =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0d0e12"/><g transform="rotate(-45 256 256)" fill="#b9f45a"><rect x="136" y="236" width="240" height="40" rx="12"/><rect x="96" y="166" width="52" height="180" rx="22"/><rect x="364" y="166" width="52" height="180" rx="22"/><rect x="60" y="200" width="44" height="112" rx="18"/><rect x="408" y="200" width="44" height="112" rx="18"/></g></svg>`,
  ).toString("base64");

// Geist, subset to just the letters on the card so the files stay tiny.
const titleFont = readFile(join(process.cwd(), "src/assets/geist-800-lift.ttf"));
const subtitleFont = readFile(join(process.cwd(), "src/assets/geist-500-subtitle.ttf"));

/** The card shown when a Lift link is shared in WhatsApp, Telegram, iMessage and so on. */
export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 30%, #2a3a12 0%, #14180f 45%, #0d0e12 100%)",
        color: "#fafafb",
      }}
    >
      <img src={logo} width={200} height={200} alt="" style={{ borderRadius: 44, boxShadow: "0 0 80px rgba(185,244,90,0.35)" }} />
      <div style={{ marginTop: 44, fontFamily: "Geist Title", fontSize: 112, fontWeight: 800, letterSpacing: -3 }}>Lift</div>
      <div style={{ marginTop: 8, fontFamily: "Geist Subtitle", fontSize: 38, color: "#b9f45a" }}>Bulk tracker &amp; training log</div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Geist Title", data: await titleFont, weight: 800, style: "normal" },
        { name: "Geist Subtitle", data: await subtitleFont, weight: 500, style: "normal" },
      ],
    },
  );
}
