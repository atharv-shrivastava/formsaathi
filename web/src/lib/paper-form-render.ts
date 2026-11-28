export interface PaperPlacementForRender {
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the scanned form preview."));
    image.src = source;
  });
}

/** Render only user-approved placements onto the EXIF-corrected source image. */
export async function renderPaperFormImage(
  sourceUrl: string,
  placements: PaperPlacementForRender[]
): Promise<Blob> {
  const image = await loadImage(sourceUrl);
  if (!image.naturalWidth || !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 20_000_000) {
    throw new Error("The scanned page is too large to render safely.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the filled image.");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.fillStyle = "#17243a";
  context.textBaseline = "middle";

  for (const placement of placements) {
    const value = String(placement.value || "").trim();
    const values = [placement.x, placement.y, placement.width, placement.height];
    if (!value || !values.every(Number.isFinite)) continue;
    if (placement.x < 0 || placement.y < 0 || placement.width <= 0 ||
        placement.height <= 0 || placement.x + placement.width > 1000 ||
        placement.y + placement.height > 1000) continue;

    const left = Math.round(placement.x / 1000 * canvas.width);
    const top = Math.round(placement.y / 1000 * canvas.height);
    const boxWidth = Math.round(placement.width / 1000 * canvas.width);
    const boxHeight = Math.round(placement.height / 1000 * canvas.height);
    if (boxWidth < 8 || boxHeight < 8) continue;

    const maxWidth = Math.max(4, boxWidth - 4);
    const fontSize = Math.max(9, Math.min(42, boxHeight * 0.68, boxWidth / Math.max(4, value.length * 0.57)));
    context.font = "500 " + Math.round(fontSize) + "px Arial, sans-serif";
    context.fillText(value, left + 2, top + boxHeight / 2, maxWidth);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not encode the filled image."));
    }, "image/jpeg", 0.92);
  });
}
