// The one place an inline SVG is drawn. The icon is decoration beside a text label, so it is hidden
// from assistive technology. The file is not named icon.tsx: Next.js reserves that for the app icon route.
export function LineIcon({
  path,
  size,
  strokeWidth,
  roundJoin = false,
}: {
  path: string;
  size: number;
  strokeWidth: number;
  roundJoin?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin={roundJoin ? "round" : undefined}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
