// @ts-check
import { generateGlobPatterns, serwist } from "@serwist/next/config";

export default serwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  globPatterns: [
    ...generateGlobPatterns(".next/"),
    ".next/static/**/*.{woff,woff2}",
  ],
});
