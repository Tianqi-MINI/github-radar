/**
 * Unit tests for app/js/util.js + app/js/scoring.js.
 * Run with: node tests/scoring.test.js
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sandbox = { console, Date, Math, Intl };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ["app/js/util.js", "app/js/scoring.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file });
}

const Util = sandbox.RadarUtil;
const Scoring = sandbox.RadarScoring;

// --- util ---------------------------------------------------------------
assert.equal(Util.escapeHTML('<a href="x">'), "&lt;a href=&quot;x&quot;&gt;");
assert.equal(Util.normalizeInlineText(" a&#x20;b&nbsp;c "), "a b c");
assert.equal(Util.clamp(120, 0, 100), 100);
assert.equal(Util.daysSince("not-a-date"), Number.POSITIVE_INFINITY);
assert.equal(Util.localDateKey(new Date(2026, 0, 5)), "2026-01-05");

// --- score curves -------------------------------------------------------
assert.equal(Scoring.communityScore(100_000), 30);
assert.equal(Scoring.communityScore(499), 5);
assert.equal(Scoring.licenseScore("MIT"), 20);
assert.equal(Scoring.licenseScore("GPL-3.0"), 18);
assert.equal(Scoring.licenseScore("NOASSERTION"), 10);
assert.equal(Scoring.freshnessScore(30, 3), 100); // 100 + 8, clamped
assert.equal(Scoring.freshnessScore(3000, 3000), 18); // old project, no new-project bonus

// --- full score object --------------------------------------------------
const now = Date.now();
const isoDaysAgo = (days) => new Date(now - days * 86_400_000).toISOString();
const item = { metrics: { stars: 12_000, license: "MIT", documentationQuality: 8 } };
const source = { pushedAt: isoDaysAgo(3), createdAt: isoDaysAgo(6 * 365), stars: 12_000 };
const personal = { score: 90, components: {}, matchedTools: [], matchedFocus: [] };
const scores = Scoring.calculateScores(item, source, personal);

assert.equal(scores.profile, 90);
assert.equal(scores.community, 22); // 10k-20k bucket
assert.equal(scores.maturity, 15);
assert.equal(scores.maintenance, 20);
assert.equal(scores.license, 20);
assert.equal(scores.documentation, 8);
assert.equal(scores.security, 2); // no security block means the conservative default
assert.equal(scores.authority, 87);
assert.equal(scores.freshness, 100);

const combined = Scoring.recommendationScore(scores);
assert.ok(Math.abs(combined - (90 * 0.62 + 87 * 0.23 + 100 * 0.15)) < 1e-9);
assert.equal(Scoring.recommendationCategory(scores), "权威基准");

console.log("scoring.test.js: all assertions passed");
