interface SplineSceneProps {
  className?: string;
  title: string;
}

const configuredSceneUrl = import.meta.env.VITE_SPLINE_PUBLIC_URL?.trim() || "";

function isAllowedSplineUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "spline.design" || url.hostname.endsWith(".spline.design"));
  } catch {
    return false;
  }
}

export function SplineScene({ className = "", title }: SplineSceneProps) {
  if (!configuredSceneUrl || !isAllowedSplineUrl(configuredSceneUrl)) return null;

  return (
    <div className={["spline-scene-frame", className].filter(Boolean).join(" ")}>
      <iframe
        src={configuredSceneUrl}
        title={title}
        loading="eager"
        allow="autoplay; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
