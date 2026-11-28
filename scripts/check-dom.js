/**
 * Guard against selectors drifting away from the HTML.
 * Extracts every document.querySelector("#id") reference from the app
 * scripts and verifies the id exists in app/index.html.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const ids = new Set();
const dynamicIds = new Set();

for (const file of ["app/js/app.js", "app/js/onboard.js", "app/js/guide.js"]) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  for (const match of source.matchAll(/querySelector\(\s*["']#([A-Za-z0-9_-]+)/g)) {
    ids.add(match[1]);
  }
  for (const match of source.matchAll(/getElementById\(\s*["']([A-Za-z0-9_-]+)/g)) {
    ids.add(match[1]);
  }
  // Elements created at runtime and assigned an id are valid even when absent
  // from the static HTML.
  for (const match of source.matchAll(/\.id\s*=\s*["']([A-Za-z0-9_-]+)["']/g)) {
    dynamicIds.add(match[1]);
  }
}

const missing = [...ids].filter(
  (id) => !new RegExp(`id=["']${id}["']`).test(html) && !dynamicIds.has(id),
);
console.log(
  `check-dom.js: ${ids.size} referenced ids (${dynamicIds.size} created at runtime), ${missing.length} missing`,
);
if (missing.length) {
  console.error(`Missing ids: ${missing.join(", ")}`);
  process.exit(1);
}
