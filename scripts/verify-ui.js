/**
 * Headless UI smoke test for the release build.
 *
 * Launches a dedicated headless Chrome, drives it over CDP, and verifies:
 *   - page loads without console errors
 *   - util/scoring modules are present
 *   - the archive render path produces project cards
 *   - desktop and mobile layouts have no horizontal overflow
 *
 * Usage: node scripts/verify-ui.js [baseUrl]
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "outputs");
const BASE_URL = process.argv[2] || "http://127.0.0.1:4183/";
const DEBUG_PORT = 9237;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE_DIR = path.join(OUTPUT, `verify-profile-${Date.now()}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CDP {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }
  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      this.events.push(message);
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.socket.close();
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || "evaluate failed");
  }
  return result.result.value;
}

async function waitFor(cdp, expression, label, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      if (await evaluate(cdp, expression)) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`${label} timed out`);
}

async function findPageTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`${DEBUG_URL}/json/list`).then((r) => r.json());
      const page = targets.find((target) => target.type === "page");
      if (page) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error("Chrome did not expose a page target");
}

async function screenshot(cdp, filename) {
  const result = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  fs.writeFileSync(path.join(OUTPUT, filename), Buffer.from(result.data, "base64"));
}

const PROFILE = {
  os: "windows",
  python: "latest",
  majorText: "食品科学与工程",
  focusText: "想做一个食品营养数据分析小产品，也关心课程 PPT 和科研文献",
  targetText: "先做出一个能演示的课程项目",
  aiTools: ["codex", "deepseek"],
  major: "food-science",
  target: "academic",
  research: { clarity: "experiment", block: "data", time: "week", output: "report" },
};

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );

  const checks = [];
  const check = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });
  try {
    const page = await findPageTarget();
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cdp.send("Page.navigate", { url: BASE_URL });
    await waitFor(
      cdp,
      `document.querySelector("#onboard-form") !== null &&
       Boolean(window.RadarUtil) && Boolean(window.RadarScoring) && Boolean(window.SIGNAL_ONBOARD)`,
      "modules + onboarding",
    );

    const modules = await evaluate(
      cdp,
      `({
        util: Boolean(window.RadarUtil && window.RadarUtil.escapeHTML),
        scoring: Boolean(window.RadarScoring && window.RadarScoring.calculateScores),
        onboard: Boolean(window.SIGNAL_ONBOARD && window.SIGNAL_ONBOARD.saveProfile),
      })`,
    );
    check("shared util module loaded", modules.util, JSON.stringify(modules));
    check("scoring module loaded", modules.scoring);
    check("onboarding module loaded", modules.onboard);

    const mathOk = await evaluate(
      cdp,
      `(() => {
        const s = window.RadarScoring.calculateScores(
          { metrics: { stars: 12000, license: "MIT", documentationQuality: 8 } },
          { stars: 12000, license: "MIT", pushedAt: new Date().toISOString(), createdAt: "2019-01-01T00:00:00Z" },
          { score: 90, components: {}, matchedTools: [], matchedFocus: [] },
        );
        return s.profile === 90 && s.authority > 0 && s.freshness > 0;
      })()`,
    );
    check("scoring maths returns a coherent result", mathOk);

    await evaluate(
      cdp,
      `(() => {
        localStorage.clear();
        window.SIGNAL_ONBOARD.saveProfile(${JSON.stringify(PROFILE)});
        localStorage.setItem("signal-radar-feed-source-v1", JSON.stringify("archive"));
        return true;
      })()`,
    );
    cdp.events = [];
    await cdp.send("Page.reload", { ignoreCache: true });
    await sleep(5000);
    const diagnostics = await evaluate(
      cdp,
      `(() => {
        return {
          profileComplete: window.SIGNAL_ONBOARD?.isProfileComplete?.(window.SIGNAL_ONBOARD.readProfile()),
          radarHidden: document.querySelector("#radar-page")?.hidden,
          onboardHidden: document.querySelector("#onboard-page")?.hidden,
          feedItems: document.querySelectorAll("#feed-list .feed-item").length,
          hasState: typeof state !== "undefined",
          dataItems: typeof state !== "undefined" ? state.data?.items?.length ?? null : null,
          feedSource: typeof state !== "undefined" ? state.feedSource : null,
          bodyClass: document.body.className,
        };
      })()`,
    );
    const verbose = Boolean(process.env.RADAR_VERBOSE);
    if (verbose) console.log("DIAG", JSON.stringify(diagnostics));
    const earlyErrors = cdp.events
      .filter((event) => event.method === "Runtime.consoleAPICalled" && event.params.type === "error")
      .map((event) => event.params.args?.[0]?.value ?? event.params.args?.[0]?.description ?? "error");
    if (verbose && earlyErrors.length) console.log("CONSOLE_ERRORS", JSON.stringify(earlyErrors));
    const runtimeErrors = cdp.events
      .filter((event) => event.method === "Runtime.exceptionThrown")
      .map((event) => event.params.exceptionDetails?.exception?.description || event.params.exceptionDetails?.text);
    if (verbose && runtimeErrors.length) console.log("RUNTIME_ERRORS", JSON.stringify(runtimeErrors));
    const logEntries = cdp.events
      .filter((event) => event.method === "Log.entryAdded")
      .map((event) => `${event.params.entry.level}: ${event.params.entry.text}`);
    if (verbose && logEntries.length) console.log("LOG_ENTRIES", JSON.stringify(logEntries.slice(-10)));
    const scripts = await evaluate(
      cdp,
      `[...document.scripts].map((s) => ({ src: s.getAttribute("src"), loaded: s.readyState || null }))`,
    );
    if (verbose) console.log("SCRIPTS", JSON.stringify(scripts));
    await waitFor(cdp, `document.querySelectorAll("#feed-list .feed-item").length > 0`, "feed cards", 120);

    const desktop = await evaluate(
      cdp,
      `({
        cards: document.querySelectorAll("#feed-list .feed-item").length,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      })`,
    );
    check("archive feed renders cards", desktop.cards >= 3, String(desktop.cards));
    check(
      "1440px layout has no horizontal overflow",
      desktop.scrollWidth <= desktop.innerWidth + 1,
      `${desktop.scrollWidth}/${desktop.innerWidth}`,
    );
    await screenshot(cdp, "verify-desktop.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(400);
    const mobile = await evaluate(
      cdp,
      `({
        cards: document.querySelectorAll("#feed-list .feed-item").length,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      })`,
    );
    check(
      "390px layout has no horizontal overflow",
      mobile.scrollWidth <= mobile.innerWidth + 1,
      `${mobile.scrollWidth}/${mobile.innerWidth}`,
    );
    check("cards survive the mobile resize", mobile.cards >= 3, String(mobile.cards));
    await screenshot(cdp, "verify-mobile.png");

    const errors = cdp.events.filter(
      (event) => event.method === "Runtime.consoleAPICalled" && event.params.type === "error",
    );
    check("no console errors", errors.length === 0, String(errors.length));
    cdp.close();
  } finally {
    chrome.kill();
  }

  for (const item of checks) {
    console.log(`${item.pass ? "PASS" : "FAIL"}  ${item.name}${item.detail ? `  (${item.detail})` : ""}`);
  }
  const failed = checks.filter((item) => !item.pass);
  console.log(`${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
