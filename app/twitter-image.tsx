// Twitter Card uses the same image as Open Graph by default in Next.js,
// but Twitter parses opengraph-image differently in edge cases — exporting
// twitter-image alongside it guarantees a dedicated card.
export { default, alt, size, contentType, runtime } from "./opengraph-image";
