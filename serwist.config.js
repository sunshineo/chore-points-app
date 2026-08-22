// @ts-check
import fs from "node:fs";
import { generateGlobPatterns, serwist } from "@serwist/next/config";

const revision = fs.readFileSync(".next/BUILD_ID", "utf8").trim();

export default serwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  globPatterns: [
    ...generateGlobPatterns(".next/"),
    ".next/static/**/*.{woff,woff2}",
  ],
  additionalPrecacheEntries: [{ url: "/", revision }],
});
