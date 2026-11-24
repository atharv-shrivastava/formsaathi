import sharp from "sharp";

export async function prepareImage(file, constraints) {
  if (!file?.buffer || !String(file.mimetype || "").startsWith("image/")) {
    throw new Error("Choose an image file. PDF conversion is not supported by this preparation endpoint yet.");
  }

  const maxKb = Math.min(5000, Math.max(5, Number(constraints.maxKb) || 50));
  let width = Math.min(4000, Math.max(32, Number(constraints.width) || 300));
  let height = Math.min(4000, Math.max(32, Number(constraints.height) || 300));
  const maxBytes = Math.round(maxKb * 1024);
  let quality = 88;
  let output;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    output = await sharp(file.buffer)
      .rotate()
      .resize({
        width,
        height,
        fit: "inside",
        withoutEnlargement: true
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (output.length <= maxBytes) break;
    if (quality > 42) {
      quality -= 8;
    } else {
      width = Math.max(32, Math.floor(width * 0.85));
      height = Math.max(32, Math.floor(height * 0.85));
      quality = 76;
    }
  }

  if (!output || output.length > maxBytes) {
    throw new Error("Could not reach the requested size without shrinking the image too far. Increase the file-size limit.");
  }

  const metadata = await sharp(output).metadata();
  return {
    buffer: output,
    width: metadata.width || width,
    height: metadata.height || height,
    bytes: output.length
  };
}
