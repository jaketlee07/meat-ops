import { ImageResponse } from "next/og";

// The app's icon: white bold "MO" on a #1d4ed8 blue square, drawn at the given size.
export function appIcon(size: number): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d4ed8",
          color: "#ffffff",
          fontSize: Math.round(size * 0.5),
          fontWeight: 700,
        }}
      >
        MO
      </div>
    ),
    { width: size, height: size },
  );
}
