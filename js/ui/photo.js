// Turns a chosen picture into a small square photo that fits inside a submission.
// Drawing it onto a canvas also drops the file's hidden details, such as where the photo was taken.
import { isPhoto, MAX_PHOTO_CHARS } from '../domain/validate.js';

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const ATTEMPTS = [[128, 0.72], [128, 0.55], [128, 0.4], [96, 0.6], [96, 0.4], [72, 0.5], [64, 0.35]];

function encode(image, size, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  // A photo with transparency would otherwise turn black as a JPEG.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, size, size);
  // Keeps the centre of the picture, as the largest square that fits.
  const side = Math.min(image.width, image.height);
  context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
  // Browsers that cannot make WebP quietly return a PNG, which is why this checks the result.
  const webp = canvas.toDataURL('image/webp', quality);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
}

/** Returns the photo as text, or throws an Error with a message to show. */
export async function photoFromFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('That picture is too large. Please choose one under 30 MB.');
  let image;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error('This browser could not read that picture. Please try a JPEG or PNG.');
  }
  try {
    for (const [size, quality] of ATTEMPTS) {
      const photo = encode(image, Math.min(size, Math.max(image.width, image.height)), quality);
      if (photo.length <= MAX_PHOTO_CHARS && isPhoto(photo)) return photo;
    }
  } finally {
    image.close();
  }
  throw new Error('That picture is too detailed to shrink enough. Please try a simpler one.');
}
