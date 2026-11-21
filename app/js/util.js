/**
 * RadarUtil — side-effect-free helpers shared by the radar UI.
 *
 * This file deliberately has no DOM dependencies (except copyText, which
 * degrades gracefully) so other pages in this project or a future project can
 * reuse it by loading it before their own script.
 */
(function (global) {
  "use strict";

  /** Safe JSON read from localStorage; never throws on corrupt data. */
  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  /** Write JSON to localStorage; throws only when storage is unavailable. */
  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  /** Escape a value before interpolating it into an HTML string. */
  function escapeHTML(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /** Normalise HTML entities and collapse whitespace in inline copy. */
  function normalizeInlineText(value = "") {
    return String(value)
      .replace(/&#x20;|&#32;|&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Local calendar day (YYYY-MM-DD); stable regardless of timezone offset. */
  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /** Compact zh-CN timestamp used in lists; returns a placeholder on bad input. */
  function formatRelativeTime(value) {
    if (!value) return "时间未知";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "时间未知";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  /** Whole days since an ISO timestamp; Infinity when the value is unusable. */
  function daysSince(value, now = Date.now()) {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
    return Math.max(0, (now - timestamp) / 86_400_000);
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  /**
   * Copy text to the clipboard.
   * The Clipboard API is blocked on plain-HTTP LAN origins, so an
   * execCommand fallback keeps the feature working there.
   */
  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // Fall through to the legacy path below.
      }
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy failed");
  }

  global.RadarUtil = {
    readJSON,
    writeJSON,
    escapeHTML,
    normalizeInlineText,
    localDateKey,
    formatRelativeTime,
    daysSince,
    clamp,
    copyText,
  };
})(window);
