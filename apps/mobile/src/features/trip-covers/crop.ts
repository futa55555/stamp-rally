const COVER_RATIO = 8 / 5;

/** Largest centered 8:5 rectangle in an orientation-corrected image. */
export function centerCropRectangle(image: { width: number; height: number }) {
  if (
    ![image.width, image.height].every(Number.isFinite) ||
    image.width < 8 ||
    image.height < 5
  )
    throw new Error('画像のサイズを確認できません。別の写真を選んでください。');
  const width =
    Math.floor(Math.min(image.width, image.height * COVER_RATIO) / 8) * 8;
  const height = width / COVER_RATIO;
  return {
    originX: Math.round((image.width - width) / 2),
    originY: Math.round((image.height - height) / 2),
    width,
    height,
  };
}
