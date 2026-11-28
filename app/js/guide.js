/**
 * Lightweight, framework-free tour for the GitHub radar.
 *
 * The project ships as plain HTML/CSS/JS, so React Joyride is not a runtime
 * dependency here. This module keeps the same useful ideas: stable targets,
 * explicit progress, optional skip, keyboard close, and persisted completion.
 */

(() => {
  const SEEN_KEY = "signal-radar-guide-seen-v1";

  const steps = [
    {
      target: "#profile-impact",
      title: "先看你的配置如何影响推荐",
      body: "这里会说明专业、目标、科研阶段和已有工具怎样参与排序。推荐不是随机的，理由都能在这里追溯。",
      placement: "bottom",
    },
    {
      target: "#spotlight",
      title: "从今日重点选择第一个项目",
      body: "先看今日重点里的项目定位、推荐理由和最省事的打开方式。判断它是否值得投入，再决定打开详情。",
      placement: "bottom",
    },
    {
      target: ".feed-toolbar",
      title: "用筛选和数据源控制推荐范围",
      body: "项目、作者和稍后读视图可以切换内容类型；排序方式决定更看重个人匹配、权威度还是近期更新。实时数据不稳定时可切到本地存档。",
      placement: "bottom",
    },
    {
      target: ".reading-rail",
      title: "把今天的阅读排成一条路线",
      body: "右侧路线把推荐拆成少量可完成的小步骤。先读一个完整项目，再决定是否收藏或继续关注作者。",
      placement: "left",
    },
    {
      target: "#github-auth-button-top",
      title: "需要更稳定的实时数据时再连接 GitHub",
      body: "匿名访问有时会达到额度限制。只有需要持续刷新时，才创建无权限的只读 Token；Token 只保存在本机，不会回传浏览器。",
      placement: "bottom",
    },
  ];

  const state = {
    index: 0,
    initialized: false,
  };

  function elements() {
    return {
      overlay: document.querySelector("[data-guide-overlay]"),
      card: document.querySelector("[data-guide-card]"),
      highlight: document.querySelector("[data-guide-highlight]"),
      title: document.querySelector("[data-guide-title]"),
      body: document.querySelector("[data-guide-body]"),
      progress: document.querySelector("[data-guide-progress]"),
      next: document.querySelector("[data-guide-next]"),
      back: document.querySelector("[data-guide-back]"),
      close: document.querySelector("[data-guide-close]"),
      opener: document.querySelector("#guide-button"),
    };
  }

  function findTarget(selector) {
    const target = document.querySelector(selector);
    if (!target) return null;
    return target;
  }

  function positionForTarget(target, card, placement) {
    if (!target || !card) return;
    const rect = target.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const gap = 18;
    const margin = 16;
    const preferredTop =
      placement === "top"
        ? rect.top - cardRect.height - gap
        : placement === "left"
          ? rect.top + (rect.height - cardRect.height) / 2
          : rect.bottom + gap;
    const preferredLeft =
      placement === "left" ? rect.left - cardRect.width - gap : rect.left + (rect.width - cardRect.width) / 2;
    const top = Math.min(window.innerHeight - cardRect.height - margin, Math.max(margin, preferredTop));
    const left = Math.min(window.innerWidth - cardRect.width - margin, Math.max(margin, preferredLeft));
    card.style.transform = "none";
    card.style.top = `${Math.round(top)}px`;
    card.style.left = `${Math.round(left)}px`;
  }

  function renderStep() {
    const refs = elements();
    if (!refs.overlay || !refs.card || !refs.title || !refs.body || !refs.highlight) return;
    const step = steps[state.index];
    if (!step) return;
    const target = findTarget(step.target);
    refs.title.textContent = step.title;
    refs.body.textContent = step.body;
    if (refs.progress) refs.progress.textContent = `${state.index + 1} / ${steps.length}`;
    if (refs.back) refs.back.hidden = state.index === 0;
    if (refs.next) refs.next.textContent = state.index === steps.length - 1 ? "完成" : "下一步";

    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        refs.highlight.hidden = false;
        refs.highlight.style.top = `${Math.max(8, rect.top - 6)}px`;
        refs.highlight.style.left = `${Math.max(8, rect.left - 6)}px`;
        refs.highlight.style.width = `${Math.max(0, rect.width + 12)}px`;
        refs.highlight.style.height = `${Math.max(0, rect.height + 12)}px`;
        positionForTarget(target, refs.card, step.placement);
      }, 220);
    } else {
      refs.highlight.hidden = true;
      refs.card.style.top = "50%";
      refs.card.style.left = "50%";
      refs.card.style.transform = "translate(-50%, -50%)";
    }
  }

  function open(index = 0) {
    const refs = elements();
    if (!refs.overlay) return;
    state.index = Math.min(Math.max(0, index), steps.length - 1);
    refs.overlay.hidden = false;
    document.body.classList.add("guide-is-open");
    refs.card?.setAttribute("tabindex", "-1");
    renderStep();
    refs.next?.focus();
  }

  function close() {
    const refs = elements();
    if (!refs.overlay) return;
    localStorage.setItem(SEEN_KEY, "1");
    refs.overlay.hidden = true;
    if (refs.highlight) refs.highlight.hidden = true;
    document.body.classList.remove("guide-is-open");
    refs.opener?.focus();
  }

  function next() {
    if (state.index >= steps.length - 1) {
      close();
      return;
    }
    state.index += 1;
    renderStep();
  }

  function back() {
    if (state.index === 0) return;
    state.index -= 1;
    renderStep();
  }

  function initialize() {
    if (state.initialized) return;
    state.initialized = true;
    document.querySelector("#guide-button")?.addEventListener("click", () => open());
    document.querySelector("[data-guide-next]")?.addEventListener("click", next);
    document.querySelector("[data-guide-back]")?.addEventListener("click", back);
    document.querySelector("[data-guide-close]")?.addEventListener("click", close);
    document.querySelector("[data-guide-skip]")?.addEventListener("click", close);
    document.querySelector("[data-guide-overlay]")?.addEventListener("click", (event) => {
      if (event.target.closest("[data-guide-close]")) close();
      if (event.target.matches("[data-guide-overlay]")) close();
    });
    document.addEventListener("keydown", (event) => {
      const overlay = document.querySelector("[data-guide-overlay]");
      if (!overlay || overlay.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "Tab") {
        const focusable = [...overlay.querySelectorAll("button:not([hidden]):not([disabled])")];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    window.addEventListener("resize", () => {
      const overlay = document.querySelector("[data-guide-overlay]");
      if (overlay && !overlay.hidden) renderStep();
    });

    const profile = window.SIGNAL_ONBOARD?.readProfile?.();
    const profileReady = window.SIGNAL_ONBOARD?.isProfileComplete?.(profile);
    if (profileReady && localStorage.getItem(SEEN_KEY) !== "1") {
      window.setTimeout(() => {
        const overlay = document.querySelector("[data-guide-overlay]");
        if (overlay?.hidden) open();
      }, 260);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  window.RadarGuide = {
    open,
    close,
  };
})();
