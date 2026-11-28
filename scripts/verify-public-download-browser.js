/**
 * Download the public portable ZIP through a fresh headless Chrome profile.
 *
 * This exercises the same browser download path a visitor uses, with no GitHub
 * credentials, cookies or local browser profile. It prints the downloaded file
 * path and SHA-256 so a separate smoke test can start that exact archive.
 */
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ZIP_URL =
  process.argv[2] ||
  "https://github.com/Tianqi-MINI/github-radar/raw/refs/heads/master/downloads/github-radar-portable_1.zip";
const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "outputs", `public-browser-download-${Date.now()}`);
const PROFILE_DIR = path.join(OUTPUT, "chrome-profile");
const DOWNLOAD_DIR = path.join(OUTPUT, "download");
const DEBUG_PORT = 9239;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
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

async function findPageTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`${DEBUG_URL}/json/list`).then((response) => response.json());
      const page = targets.find((target) => target.type === "page");
      if (page) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error("Chrome did not expose a page target");
}

async function waitForDownload() {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const names = fs.existsSync(DOWNLOAD_DIR) ? fs.readdirSync(DOWNLOAD_DIR) : [];
    const partial = names.find((name) => name.endsWith(".crdownload"));
    const complete = names.find((name) => name.endsWith(".zip"));
    if (complete && !partial) return path.join(DOWNLOAD_DIR, complete);
    await sleep(500);
  }
  throw new Error("browser download did not finish within 180 seconds");
}

async function main() {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-crash-reporter",
      "--disable-extensions",
      "--no-proxy-server",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );

  let cdp;
  try {
    const page = await findPageTarget();
    cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: DOWNLOAD_DIR,
      eventsEnabled: true,
    });
    await cdp.send("Page.navigate", { url: ZIP_URL });

    const downloaded = await waitForDownload();
    const bytes = fs.readFileSync(downloaded);
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
    console.log(
      JSON.stringify(
        {
          zipUrl: ZIP_URL,
          downloaded,
          bytes: bytes.length,
          sha256,
          downloadEvents: cdp.events.filter(
            (event) =>
              event.method === "Browser.downloadWillBegin" ||
              event.method === "Browser.downloadProgress",
          ),
        },
        null,
        2,
      ),
    );
  } finally {
    if (cdp) cdp.close();
    chrome.kill();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
