/**
 * GitHub 兴趣雷达 — UI orchestration.
 *
 * Dependencies (loaded before this file):
 *   util.js      → RadarUtil     pure helpers
 *   scoring.js   → RadarScoring  pure ranking maths
 *   onboard.js   → SIGNAL_ONBOARD questionnaire + semantic parsing
 *
 * File map
 *   1. State & DOM references ................. STORAGE .. elements
 *   2. Topics & personalisation ............... getTopic .. personalizedWhy
 *   3. Content profiling & README digest ...... contentProfile .. buildReadmeDigest
 *   4. Scoring & sorting ...................... daysSince .. sortRecommendedItems
 *   5. Authors ................................ liveAuthors .. authorRelevance
 *   6. Recommendation history & batches ....... recommendationKey .. batchMetaForView
 *   7. Motion & reveal ........................ prefersReducedMotion .. animateRecommendationScores
 *   8. Rendering .............................. renderSourceStatus .. updateRecommendationControls
 *   9. User actions ........................... setView .. showToast
 *  10. Live GitHub data ....................... livePageUrl .. refreshFeed
 *  11. Local data loaders ..................... loadFeed .. loadRepoSnapshots
 *  12. Event wiring & bootstrap ................ document.addEventListener .. initializeRadar
 */

// ============================================================================
// 1. State & DOM references
// ============================================================================
const STORAGE = {
  saved: "signal-radar-saved-v1",
  hiddenTopics: "signal-radar-hidden-topics-v1",
  plan: "signal-radar-plan-",
  recommended: "signal-radar-recommendation-history-v1",
  feedSource: "signal-radar-feed-source-v1",
};

const FEED_BATCH_SIZE = 6;
const FEED_MAX_PER_TOPIC = 2;
const SMALL_FINDS_PAGE_SIZE = 3;

const icons = {
  bookmark:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  copy:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
};

const AUTHOR_PROFILES = {
  antfu: {
    works: ["Slidev", "Vue", "Vite"],
    what: "能持续看到 Slidev 的新功能、技术演讲做法，以及高质量前端工具是怎么设计的。",
    bestFor: "做课程或路演 PPT、学习现代前端工具链",
  },
  simonw: {
    works: ["LLM 小工具", "Datasette"],
    what: "他经常把大模型、数据抓取和网页界面组合成能马上运行的小工具，适合模仿完整产品思路。",
    bestFor: "快速验证 AI 小产品、学习如何把想法做成可用工具",
  },
  shadcn: {
    works: ["shadcn/ui"],
    what: "组件源码可以直接复制修改，能学到设计系统、可访问性和前端工程化。",
    bestFor: "把课程项目或小产品的界面做得更专业",
  },
  "lmms-team": {
    works: ["LMMS"],
    what: "能看到开源 DAW 的功能更新、插件生态和低成本音乐制作流程。",
    bestFor: "零成本开始编曲、了解开源音频工具",
  },
  langchain: {
    works: ["LangGraph"],
    what: "持续输出 Agent、RAG、工作流编排和评测相关实践，适合观察 AI 应用如何从演示走向可靠系统。",
    bestFor: "科研自动化、Agent 工作流和小产品后端逻辑",
  },
  "logseq-team": {
    works: ["Logseq"],
    what: "围绕本地优先知识库、双向链接和插件生态持续迭代，适合学习长期可迁移的笔记方法。",
    bestFor: "文献笔记、选题积累和课程知识管理",
  },
  "appwrite-team": {
    works: ["Appwrite"],
    what: "把认证、数据库、存储和函数做成完整开源后端，适合观察一个产品型基础设施如何组织。",
    bestFor: "给小产品快速接后端、学习部署与权限设计",
  },
  "t3-tools": {
    works: ["T3 Code"],
    what: "持续探索多智能体桌面和远程协作，能看到 AI 编程产品的新交互方式。",
    bestFor: "做 AI 编程工具、研究 Agent 产品交互",
  },
};

const state = {
  data: null,
  view: "all",
  topic: "all",
  saved: new Set(readJSON(STORAGE.saved, [])),
  hiddenTopics: new Set(readJSON(STORAGE.hiddenTopics, [])),
  planDone: new Set(),
  syncing: false,
  sort: "combined",
  spotlightId: null,
  profile: window.SIGNAL_ONBOARD?.readProfile?.() ?? null,
  researchKits: null,
  activeResearchKit: null,
  repoGuides: null,
  repoGuidesLoaded: false,
  repoSnapshots: null,
  repoSnapshotsLoaded: false,
  activeRepoId: null,
  smallResources: null,
  smallCategory: "all",
  recommended: new Set(readJSON(STORAGE.recommended, [])),
  feedSelection: [],
  feedContextKey: "",
  feedExhausted: false,
  feedHistoryMode: false,
  smallSelection: [],
  smallContextKey: "",
  smallExhausted: false,
  smallHistoryMode: false,
  feedSource: readJSON(STORAGE.feedSource, "live") === "archive" ? "archive" : "live",
  liveData: null,
  liveLoading: false,
  liveError: null,
  livePage: 1,
  githubAuth: null,
  authPrompted: false,
  initializing: true,
};

const motionState = {
  hintObserver: null,
  hintInitialized: false,
  pointerFrame: 0,
  pointerTarget: null,
  pointerX: 50,
  pointerY: 50,
  frameRequest: 0,
};

const elements = {
  feedList: document.querySelector("#feed-list"),
  spotlight: document.querySelector("#spotlight"),
  topicFilter: document.querySelector("#topic-filter"),
  topicPulse: document.querySelector("#topic-pulse"),
  authorPreview: document.querySelector("#author-preview"),
  readingPlan: document.querySelector("#reading-plan"),
  planProgress: document.querySelector("#plan-progress"),
  resultCount: document.querySelector("#result-count"),
  liveStatus: document.querySelector("#live-status"),
  sourceButtons: [...document.querySelectorAll("[data-feed-source]")],
  refreshButton: document.querySelector("#refresh-button"),
  toast: document.querySelector("#toast"),
  todayLine: document.querySelector("#today-line"),
  footerTime: document.querySelector("#footer-time"),
  profileImpact: document.querySelector("#profile-impact"),
  profileImpactSummary: document.querySelector("#profile-impact-summary"),
  profileImpactRules: document.querySelector("#profile-impact-rules"),
  profileChipRow: document.querySelector("#profile-chip-row"),
  profileTopTitle: document.querySelector("#profile-top-title"),
  profileTopReason: document.querySelector("#profile-top-reason"),
  researchKit: document.querySelector("#research-kit"),
  researchKitTitle: document.querySelector("#research-kit-title"),
  researchKitSummary: document.querySelector("#research-kit-summary"),
  researchKitMajor: document.querySelector("#research-kit-major"),
  researchKitStage: document.querySelector("#research-kit-stage"),
  kitDatabases: document.querySelector("#kit-databases"),
  kitTools: document.querySelector("#kit-tools"),
  kitWorkflow: document.querySelector("#kit-workflow"),
  kitSearchRecipe: document.querySelector("#kit-search-recipe"),
  kitNotice: document.querySelector("#kit-notice"),
  smallFinds: document.querySelector("#small-finds"),
  smallFindsSummary: document.querySelector("#small-finds-summary"),
  smallFindsTabs: document.querySelector("#small-finds-tabs"),
  smallFindsGrid: document.querySelector("#small-finds-grid"),
  smallFindsCount: document.querySelector("#small-finds-count"),
  smallFindsRefresh: document.querySelector("#small-finds-refresh"),
  smallFindsNotice: document.querySelector("#small-finds-notice"),
  repoDialog: document.querySelector("#repo-dialog"),
  repoDialogBody: document.querySelector("#repo-dialog-body"),
  repoDialogClose: document.querySelector("#repo-dialog-close"),
  githubAuthButton: document.querySelector("#github-auth-button"),
  githubAuthButtons: [...document.querySelectorAll("[data-github-auth]")],
  githubAuthDialog: document.querySelector("#github-auth-dialog"),
  githubAuthClose: document.querySelector("#github-auth-close"),
  githubAuthCurrent: document.querySelector("#github-auth-current"),
  githubTokenInput: document.querySelector("#github-token-input"),
  githubAuthSave: document.querySelector("#github-auth-save"),
  githubAuthFeedback: document.querySelector("#github-auth-feedback"),
  githubAuthDisconnect: document.querySelector("#github-auth-disconnect"),
};

// Thin wrappers keep the UI code readable while the real implementation lives
// in the reusable util.js module. They are function declarations (not const)
// because onboard.js also declares helpers with these names in the shared
// classic-script scope.
function readJSON(key, fallback) {
  return window.RadarUtil.readJSON(key, fallback);
}

function writeJSON(key, value) {
  return window.RadarUtil.writeJSON(key, value);
}

function escapeHTML(value = "") {
  return window.RadarUtil.escapeHTML(value);
}

function normalizeInlineText(value = "") {
  return window.RadarUtil.normalizeInlineText(value);
}

function localDateKey(date = new Date()) {
  return window.RadarUtil.localDateKey(date);
}

function formatRelativeTime(value) {
  return window.RadarUtil.formatRelativeTime(value);
}

// ============================================================================
// 2. Topics & personalisation
// ============================================================================
function getTopic(topicId) {
  return state.data?.topics.find((topic) => topic.id === topicId);
}

function topicPoolItems() {
  return currentFeedItems().filter((item) => {
    if (isOwnedItem(item)) return false;
    return !item.topicIds.every((topicId) => state.hiddenTopics.has(topicId));
  });
}

function personalizedTopicLabel(topic) {
  const intent = window.SIGNAL_ONBOARD?.interpretProfile?.(state.profile ?? {}) ?? {};
  const text = normalizedTopicText(`${intent.focusText ?? ""} ${intent.targetText ?? ""}`);
  const stage = intent.stageInfo?.stage ?? "exploring";
  if (topic.id === "ai-tools") {
    if (/(编程|代码|codex|deepseek|agent|自动化)/i.test(text)) return "AI 编程 / Agent";
    if (["question", "literature", "experiment", "analysis", "writing"].includes(stage)) {
      return "AI 科研工具";
    }
    return "AI 学习与使用";
  }
  if (topic.id === "micro-product") {
    if (/(作品集|求职|实习|面试)/.test(text)) return "作品集 / 小产品";
    if (/(上线|网站|app|小程序|全栈)/i.test(text)) return "网站 / 小产品";
    return "小产品 / 副业";
  }
  if (topic.id === "presentation") {
    if (stage === "communication") return "答辩 / 汇报";
    if (/(课程|作业)/.test(text)) return "课程 PPT";
    if (/(路演|演讲)/.test(text)) return "路演 / 演讲";
    return "演讲与 PPT";
  }
  if (topic.id === "research") {
    const stageLabels = {
      exploring: "科研入门",
      question: "文献与选题",
      literature: "文献与综述",
      experiment: "实验与数据",
      analysis: "数据分析",
      writing: "论文写作",
      communication: "汇报与图表",
      none: "科研效率",
    };
    return stageLabels[stage] ?? "科研效率";
  }
  if (topic.id === "content") {
    return /(短视频|视频|剪辑|b站|抖音)/i.test(text) ? "短视频 / 自媒体" : "自媒体内容";
  }
  if (topic.id === "music") {
    return /(编曲|音频|midi|配乐)/i.test(text) ? "编曲 / 音频" : "音乐制作";
  }
  return topic.label;
}

function normalizedTopicText(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ");
}

function getVisibleTopics() {
  const pool = topicPoolItems();
  const intent = window.SIGNAL_ONBOARD?.interpretProfile?.(state.profile ?? {}) ?? {};
  const stage = intent.stageInfo?.stage ?? "exploring";
  const stageTopic =
    stage === "communication"
      ? "presentation"
      : ["question", "literature", "experiment", "analysis", "writing"].includes(stage)
        ? "research"
        : "ai-tools";
  const priority = [...(intent.focusTopics ?? []), stageTopic];
  return (state.data?.topics ?? [])
    .filter((topic) => !state.hiddenTopics.has(topic.id))
    .map((topic, index) => ({
      ...topic,
      label: personalizedTopicLabel(topic),
      count: pool.filter((item) => item.topicIds.includes(topic.id)).length,
      _index: index,
    }))
    .filter((topic) => topic.count > 0)
    .sort((left, right) => {
      const leftPriority = priority.indexOf(left.id);
      const rightPriority = priority.indexOf(right.id);
      const normalizedLeft = leftPriority === -1 ? 999 : leftPriority;
      const normalizedRight = rightPriority === -1 ? 999 : rightPriority;
      return normalizedLeft - normalizedRight || left._index - right._index;
    });
}

function ensureValidTopic() {
  if (state.topic === "all") return;
  if (!getVisibleTopics().some((topic) => topic.id === state.topic)) {
    state.topic = "all";
  }
}

function getTopicColor(topicId) {
  return getTopic(topicId)?.color ?? "#5974b9";
}

function scoreWithProfile(item) {
  return personalizationFor(item).score;
}

function personalizationFor(item) {
  return (
    window.SIGNAL_ONBOARD?.buildPersonalization?.(item, state.profile) ?? {
      score: item.signal ?? 0,
      fitLabel: "等待配置",
      reasons: ["完成配置后会生成个性化推荐理由"],
      components: {},
      matchedTools: [],
      matchedFocus: [],
    }
  );
}

/**
 * Build a three-part explanation instead of concatenating clauses:
 * the questionnaire basis, the strongest match reasons, and the project's value.
 */
const FOCUS_PRIMARY_TOPIC = {
  study: "ai-tools",
  product: "micro-product",
  presentation: "presentation",
  research: "research",
  content: "content",
  music: "music",
};

function personalizedWhy(item) {
  const profile = state.profile;
  const value = normalizeInlineText(item.why ?? "");
  if (!profile) return { basis: "", match: "", value };

  const personal = personalizationFor(item);
  const matchedFocus = personal.matchedFocus ?? [];
  const matchedTools = personal.matchedTools ?? [];
  const components = personal.components ?? {};
  const focusLabels = (profile.focus ?? [])
    .map((focusId) => profileLabel("focus", focusId))
    .filter(Boolean);
  const basis = [
    profileLabel("major", profile.major),
    profileLabel("researchStage", profile.researchStage),
    focusLabels.join("、"),
    profileLabel("target", profile.target),
  ]
    .filter(Boolean)
    .join(" · ");

  const primaryFocusMatches = matchedFocus.filter((focusId) =>
    item.topicIds?.includes(FOCUS_PRIMARY_TOPIC[focusId]),
  );
  const focusForCopy = primaryFocusMatches;
  const matchParts = [];
  if (focusForCopy.length) {
    matchParts.push(
      `对应你关注的「${focusForCopy
        .slice(0, 2)
        .map((focusId) => profileLabel("focus", focusId))
        .join("、")}」`,
    );
  }
  if (matchedTools.length) {
    matchParts.push(
      `可以用你常用的 ${matchedTools
        .slice(0, 2)
        .map((toolId) => profileLabel("aiTools", toolId))
        .join("、")} 打开`,
    );
  }
  if ((components.major ?? 0) > 0) {
    matchParts.push(`贴合${profileLabel("major", profile.major)}的学习或科研场景`);
  } else if ((components.stage ?? 0) > 0) {
    matchParts.push(`适合${profileLabel("researchStage", profile.researchStage)}`);
  }
  if ((components.target ?? 0) > 0) {
    matchParts.push(`服务「${profileLabel("target", profile.target)}」目标`);
  }
  if (!matchParts.length) {
    matchParts.push("按你的专业、阶段和目标做了通用匹配");
  }

  return {
    basis,
    match: `${matchParts.slice(0, 2).join("，")}。`,
    value,
  };
}

// ============================================================================
// 3. Content profiling & README digest
// ============================================================================
function contentProfile(item) {
  const profile = state.profile ?? {};
  const guide = findRepoGuideForItem(item);
  const topics = item.topicIds ?? [];
  const language = String(item.language || "").toLowerCase();
  const raw = [
    item.title,
    item.description,
    item.why,
    item.repo,
    item.homepage,
    ...(item.tags ?? []),
    ...(item.topics ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const has = (pattern) => pattern.test(raw);
  const isPython = /python|jupyter/.test(language) || has(/python|pip install|uv pip/);
  const isJs = /typescript|javascript/.test(language) || has(/node\.js|npm |pnpm |next\.js|react/);
  const isVideoTool =
    has(/video editor|video editing|video timeline|multitrack|subtitle|caption|视频编辑|视频剪辑|多轨|时间线|字幕/) &&
    !has(/slide deck|powerpoint|\bppt\b/);
  const isPresentation =
    !isVideoTool &&
    (topics.includes("presentation") ||
      has(/presentation|powerpoint|\bppt\b|slide deck|slides\b|keynote/));
  const effectiveTopic = isPresentation
    ? "presentation"
    : isVideoTool
      ? "content"
      : primaryTopicId(item) ?? topics[0];

  const personal = personalizationFor(item);
  const matchedFocus = (personal.matchedFocus ?? [])
    .filter((focusId) => FOCUS_PRIMARY_TOPIC[focusId] === effectiveTopic)
    .slice(0, 2)
    .map((focusId) => profileLabel("focus", focusId));
  const direction =
    matchedFocus.length > 0
      ? matchedFocus.join(" / ")
      : getTopic(effectiveTopic)?.label ?? "综合成长";

  let kindShort = "开源项目";
  let kindDetail = "GitHub 上的开源项目";
  if (has(/\b(agent|claude|codex|llm)[ -]?skills?\b|\bskill pack\b/)) {
    kindShort = "Agent Skill";
    kindDetail = "给 AI 编程助手使用的技能包";
  } else if (has(/obsidian/)) {
    kindShort = "Obsidian 插件";
    kindDetail = "安装在 Obsidian 里的笔记插件";
  } else if (has(/vscode|vs code|jetbrains|ide extension/)) {
    kindShort = "编辑器插件";
    kindDetail = "安装在 VS Code / IDE 里的插件";
  } else if (has(/chrome extension|browser extension/)) {
    kindShort = "浏览器插件";
    kindDetail = "安装在浏览器里的扩展";
  } else if (isPresentation && has(/template|theme/)) {
    kindShort = "PPT 模板";
    kindDetail = "可套用的演示文稿模板与主题";
  } else if (isPresentation && has(/api|self[- ]?host|docker|web app|next\.js/)) {
    kindShort = "Web 应用";
    kindDetail = "AI 演示文稿 Web 应用（附 API）";
  } else if (isPresentation) {
    kindShort = "演示工具";
    kindDetail = "生成或编辑演示文稿的工具";
  } else if (has(/note[- ]taking|knowledge management|personal knowledge|\bpkm\b|outliner|backlinks|知识管理|双向链接|笔记工具/)) {
    kindShort = "笔记 / 知识库";
    kindDetail = "本地优先的笔记与知识管理工具";
  } else if (has(/text[- ]to[- ]music|musicgen|music generation|audio generation|音频生成|文本到音乐|音乐生成/)) {
    kindShort = "AI 音频工具";
    kindDetail = "用文字生成音乐或音频的 AI 工具";
  } else if (has(/\bevals?\b|evaluation|observability|guardrails|tracing/)) {
    kindShort = "AI 评估平台";
    kindDetail = "Agent 评估、追踪与护栏平台";
  } else if (has(/dataset|benchmark/)) {
    kindShort = "数据 / 基准";
    kindDetail = "公开数据集或评测基准";
  } else if (has(/\bawesome\b|curated list|resource list/)) {
    kindShort = "资源清单";
    kindDetail = "整理好的开源资源清单";
  } else if (has(/\bguide\b|handbook|tutorial|course|cheat sheet|roadmap/)) {
    kindShort = "学习指南";
    kindDetail = "系统化的开源学习指南";
  } else if (has(/template|boilerplate|starter kit/)) {
    kindShort = "模板 / 脚手架";
    kindDetail = "可直接改用的项目模板";
  } else if (has(/\bcli\b|command[- ]line|terminal tool/)) {
    kindShort = "命令行工具";
    kindDetail = "在终端里运行的命令行工具";
  } else if (has(/desktop app|electron|tauri/)) {
    kindShort = "桌面应用";
    kindDetail = "安装在电脑上的桌面应用";
  } else if (has(/backend|database|postgres|firebase|baas|authentication|object storage/)) {
    kindShort = "后端平台";
    kindDetail = "数据库、登录与存储一体的后端平台";
  } else if (has(/framework|next\.js|react|vue|svelte|django|flask|fastapi/)) {
    kindShort = "开发框架";
    kindDetail = "用于开发网页或后端应用的代码框架";
  } else if (has(/web app|dashboard|self[- ]?host|docker|next\.js/) || item.homepage) {
    kindShort = "Web 应用";
    kindDetail = "可在本机或服务器部署的网页应用";
  } else if (has(/\bapi\b|\bsdk\b/)) {
    kindShort = "API / SDK";
    kindDetail = "供其他程序调用的 API 或 SDK";
  } else if (has(/library|package|framework/)) {
    kindShort = isPython ? "Python 库" : isJs ? "前端库" : "开发库";
    kindDetail = isPython ? "可 import 的 Python 库" : "可安装到项目里的代码库";
  }

  let purpose = "";
  if (isPresentation) {
    purpose = has(/template|theme/)
      ? "提供可直接套用的版式和主题，把课程内容快速排成统一风格的幻灯片。"
      : "输入主题、大纲或文档生成整套幻灯片，可编辑并导出 PPTX/PDF，适合课程汇报和路演。";
  } else if (has(/zotero|citation|bibtex|reference manager/)) {
    purpose = "管理文献条目和引用格式，自动生成 BibTeX/参考文献，适合课程论文和毕设。";
  } else if (has(/latex|overleaf/)) {
    purpose = "辅助 LaTeX 写作、排版和编译，适合论文与理工科报告。";
  } else if (has(/paper|literature|arxiv|scholar|academic research/)) {
    purpose = "检索、整理或分析论文，帮你更快搭建文献综述和研究思路。";
  } else if (has(/note[- ]taking|knowledge management|personal knowledge|\bpkm\b|outliner|backlinks|知识管理|双向链接|笔记工具/)) {
    purpose = "把课程笔记、文献摘要和选题用双向链接组织成知识库，适合长期积累。";
  } else if (has(/text[- ]to[- ]music|musicgen|music generation|audio generation|音频生成|文本到音乐|音乐生成/)) {
    purpose = "输入文字提示生成音乐或音效，适合做伴奏、声音实验和短视频配乐。";
  } else if (has(/\bevals?\b|evaluation|observability|guardrails|tracing/)) {
    purpose = "评估 Agent 回答质量、追踪调用日志并做上线前检查，适合把演示做成可靠产品。";
  } else if (has(/midi|daw|music production|synthesizer/)) {
    purpose = "编辑 MIDI、音色或编曲工程，适合音乐制作练习和声音实验。";
  } else if (has(/audio|sound|dsp|speech/)) {
    purpose = "处理音频、降噪或语音，适合播客、短视频和音乐素材整理。";
  } else if (has(/video editor|video editing|video timeline|multitrack|视频编辑|视频剪辑|多轨|时间线/)) {
    purpose = "在时间线上用自然语言做粗剪、字幕和版式，适合课程视频和自媒体。";
  } else if (has(/subtitle|caption/)) {
    purpose = "生成或编辑字幕文件，减少自媒体视频的逐句校对时间。";
  } else if (has(/video|ffmpeg|clip/)) {
    purpose = "处理视频剪辑、转码或批量导出，适合自媒体内容生产。";
  } else if (has(/ui component|component library|tailwind|react components/)) {
    purpose = "提供现成 UI 组件和页面样式，可直接用于小产品前端。";
  } else if (has(/backend|database|postgres|firebase|baas|authentication|object storage/)) {
    purpose = "提供数据库、登录、文件存储和 API，适合给小产品快速搭后端。";
  } else if (has(/framework|next\.js|react|vue|svelte|django|flask|fastapi/)) {
    purpose = "这是开发框架，帮你更快搭建网页或后端应用；业务代码仍需自己写，不是开箱即用的成品。";
  } else if (has(/prompt/)) {
    purpose = "整理提示词方法、案例和论文，帮你建立可复用的 AI 使用框架。";
  } else if (has(/agent|autonomous|coding assistant/)) {
    purpose = "给 AI 助手增加工具调用、任务编排或自动化能力，适合做小产品和批量处理。";
  } else if (has(/rag|embedding|vector database/)) {
    purpose = "搭建资料检索和知识库问答，把课程资料或项目文档接进 AI。";
  } else if (has(/dataframe|data analysis|visuali[sz]ation|statistics/)) {
    purpose = "读取、清洗、分析或可视化数据，适合实验数据和课程项目。";
  } else if (effectiveTopic === "micro-product") {
    purpose = "提供小产品需要的功能模块或项目骨架，减少从零搭建的时间。";
  } else if (effectiveTopic === "content") {
    purpose = "辅助图文、视频或字幕内容生产，适合自媒体持续更新。";
  } else if (effectiveTopic === "music") {
    purpose = "辅助音乐制作、音频处理或声音设计，适合课余编曲练习。";
  } else if (effectiveTopic === "research") {
    purpose = "辅助文献、数据或论文流程，适合课程论文和科研项目。";
  } else {
    purpose = "提供可直接运行的 AI 或开发工具，适合边做项目边学习。";
  }

  const requirements = Array.isArray(guide?.requirements)
    ? guide.requirements.map((value) => String(value).trim()).filter(Boolean).slice(0, 3)
    : [];
  const setupParts = [];
  if (requirements.length) {
    setupParts.push(...requirements);
  } else if (kindShort === "Agent Skill") {
    setupParts.push("支持 Skill 的 AI 编程助手");
  } else if (isPython) {
    setupParts.push(profile.python === "none" ? "需先安装 Python 3.10+" : "Python 3.10+（你已具备）");
    setupParts.push("pip 或 uv");
  } else if (isJs) {
    setupParts.push("Node.js 18+");
    setupParts.push("npm 或 pnpm");
  } else if (has(/docker/)) {
    setupParts.push("Docker Desktop");
  } else {
    setupParts.push("按 README 安装依赖");
  }
  if (has(/macos only|requires macos|xcode/)) {
    setupParts.push("仅 macOS");
  } else if (profile.os === "windows") {
    setupParts.push("Windows 可用");
  }
  const aiTools = profile.aiTools ?? [];
  if (aiTools.includes("codex") && aiTools.includes("deepseek")) {
    setupParts.push("可用 Codex 或 DeepSeek Harness 代装");
  } else if (aiTools.includes("codex")) {
    setupParts.push("可用 Codex 代装");
  } else if (aiTools.includes("deepseek")) {
    setupParts.push("可交给 DeepSeek Harness 安装");
  }

  return {
    direction,
    kindShort,
    kindDetail,
    purpose,
    setup: [...new Set(setupParts)].join("；"),
  };
}

function getRepoGuide(item) {
  return state.repoGuides?.projects?.[item?.id] ?? null;
}

function findRepoGuideForItem(item) {
  const direct = getRepoGuide(item);
  if (direct) return direct;
  const repo = String(item?.repo || "").toLowerCase();
  if (!repo) return null;
  const curatedItem = (state.data?.items ?? []).find(
    (entry) => String(entry.repo || "").toLowerCase() === repo,
  );
  return curatedItem ? state.repoGuides?.projects?.[curatedItem.id] ?? null : null;
}

const README_HEADING_ZH = {
  overview: "项目概览",
  features: "功能特性",
  "getting started": "快速开始",
  installation: "安装",
  install: "安装",
  "quick start": "快速开始",
  usage: "使用方法",
  "how to use": "使用方法",
  documentation: "文档",
  docs: "文档",
  examples: "示例",
  "tech stack": "技术栈",
  requirements: "环境要求",
  configuration: "配置",
  contributing: "贡献指南",
  license: "许可证",
  "project structure": "项目结构",
  faq: "常见问题",
  troubleshooting: "故障排查",
  "how it works": "工作原理",
  architecture: "架构",
  "api reference": "API 参考",
  roadmap: "路线图",
  community: "社区与支持",
  results: "结果",
  citing: "引用",
  citation: "引用",
  "current summary": "当前摘要",
  "interactive notebooks": "交互式 Notebook",
  "rules optimal fair and reproducible": "规则：最优、公平与可复现",
  "non stiff odes": "非刚性常微分方程",
  "stiff odes": "刚性常微分方程",
  "dynamical odes": "动力系统常微分方程",
  "non stiff sdes": "非刚性随机微分方程",
  "stiff sdes": "刚性随机微分方程",
  "non stiff ddes": "非刚性延迟微分方程",
  "stiff ddes": "刚性延迟微分方程",
  "parameter estimation": "参数估计",
  "handling method omissions and errors in benchmarks": "基准中的方法遗漏与错误处理",
  "reporting bugs and issues": "报告问题",
  "inspecting benchmark results": "查看基准结果",
  "ci architecture": "持续集成架构",
  "manually generating files": "手动生成文件",
  "choosing a reference solution": "选择参考解",
  "benchmark results": "基准结果",
  benchmarks: "基准测试",
  benchmark: "基准测试",
  installation: "安装",
  setup: "设置",
  development: "开发",
  testing: "测试",
  "release notes": "发布说明",
  changelog: "更新日志",
  "security policy": "安全策略",
  "code of conduct": "行为准则",
};

function translateReadmeHeading(heading) {
  const normalized = String(heading)
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return README_HEADING_ZH[normalized] ?? String(heading).trim();
}

function extractReadmeHeadings(readme, maximum = 6) {
  const primary = [];
  const secondary = [];
  let inFence = false;
  for (const line of String(readme).split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = line.match(/^\s*(#{2,4})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const label = translateReadmeHeading(match[2]);
    if (!label) continue;
    const target = match[1].length === 2 ? primary : secondary;
    if (!primary.includes(label) && !secondary.includes(label)) target.push(label);
  }
  return [...primary, ...secondary].slice(0, maximum);
}

/**
 * Restore the previous "README 中文提炼" block for live projects.
 * Curated projects use their reviewed Chinese summary; live projects get a
 * deterministic digest from the README headings plus the topic explanation.
 */
function buildReadmeDigest(item, readme, guide) {
  if (guide?.readmeSummary) {
    return {
      summary: guide.readmeSummary,
      quickest:
        guide.quickest ?? "按项目官方 README 的安装说明操作，先执行最小验证。",
      sourceNote: "来自本地精选中对 README 的中文提炼；完整原文见下方 README。",
    };
  }

  const headings = extractReadmeHeadings(readme);
  const summaryParts = [
    normalizeInlineText(item.why || item.description || "该项目来自 GitHub 官方实时搜索。"),
  ];
  if (headings.length) {
    summaryParts.push(`README 的主要章节包括：${headings.join("、")}。`);
  } else {
    const firstParagraph = String(readme)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length > 30 &&
          !/^[#>*\-|`]/.test(line) &&
          !/^\[?!\[/.test(line) &&
          !/^https?:\/\//i.test(line),
      )
      .slice(0, 2)
      .join(" ");
    summaryParts.push(
      firstParagraph
        ? `README 开头说明：${firstParagraph.slice(0, 260)}`
        : "README 未识别到清晰的章节标题，建议直接查看下方的安装与使用部分。",
    );
  }
  summaryParts.push("建议先看“快速开始 / 安装”和“使用方法”，确认环境要求后再执行命令。");

  const installCommandPattern =
    /^(?:npm\s+(?:i|install)|pnpm\s+(?:i|install|add)|yarn\s+(?:add|install)|pip3?\s+install|python\d?\s+-m\s+pip\s+install|uv\s+(?:pip\s+install|add|sync|run)|docker\s+(?:run|compose)|git\s+clone|cargo\s+install|go\s+install|brew\s+install)\b/i;
  const installLine = String(readme)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(
      (line) =>
        line.length > 4 &&
        line.length < 160 &&
        installCommandPattern.test(line),
    );

  return {
    summary: summaryParts.join(" "),
    quickest: installLine
      ? `README 中最短的上手命令可能是：${installLine}`
      : "先读 README 的 Quick Start / Installation 部分，只执行最少必要命令；遇到系统级操作先确认。",
    sourceNote: "这是根据实时 README 章节与项目元数据自动生成的中文提炼；完整内容见下方 README。",
  };
}

// ============================================================================
// 4. Scoring & sorting
// ============================================================================
function daysSince(value) {
  return window.RadarUtil.daysSince(value);
}

function clamp(value, minimum, maximum) {
  return window.RadarUtil.clamp(value, minimum, maximum);
}

function calculateScores(item, source = getRepoGuide(item)) {
  return window.RadarScoring.calculateScores(item, source, personalizationFor(item));
}

function recommendationScore(item, scores = calculateScores(item)) {
  return window.RadarScoring.recommendationScore(scores);
}

function recommendationCategory(item, scores = calculateScores(item)) {
  return window.RadarScoring.recommendationCategory(scores);
}

function sortWithProfile(items) {
  return [...items].sort((left, right) => {
    const scoreDelta = scoreWithProfile(right) - scoreWithProfile(left);
    if (scoreDelta !== 0) return scoreDelta;
    return Number(Boolean(right.featured)) - Number(Boolean(left.featured));
  });
}

function sortRecommendedItems(items) {
  const ranked = [...items].sort((left, right) => {
    const leftScores = calculateScores(left);
    const rightScores = calculateScores(right);
    if (state.sort === "authority") {
      return rightScores.authority - leftScores.authority ||
        rightScores.freshness - leftScores.freshness ||
        left.title.localeCompare(right.title, "zh-CN");
    }
    if (state.sort === "recent") {
      return rightScores.freshness - leftScores.freshness ||
        rightScores.maintenance - leftScores.maintenance ||
        leftScores.createdDays - rightScores.createdDays ||
        rightScores.authority - leftScores.authority ||
        left.title.localeCompare(right.title, "zh-CN");
    }
    if (state.sort === "personal") {
      return rightScores.profile - leftScores.profile ||
        rightScores.authority - leftScores.authority ||
        left.title.localeCompare(right.title, "zh-CN");
    }
    return recommendationScore(right, rightScores) - recommendationScore(left, leftScores) ||
      rightScores.authority - leftScores.authority;
  });
  return ranked;
}

function itemMatchesTopic(item) {
  return state.topic === "all" || item.topicIds.includes(state.topic);
}

function currentFeedItems() {
  if (state.feedSource === "live") return state.liveData?.items ?? [];
  return state.data?.items ?? [];
}

function normalizeOwnedToken(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

function isOwnedItem(item) {
  const owned = state.profile?.owned;
  if (!owned) return false;
  const repo = String(item.repo ?? "").toLowerCase();
  if (repo && (owned.repos ?? []).some((value) => String(value).toLowerCase() === repo)) {
    return true;
  }
  const title = normalizeOwnedToken(item.title);
  const itemId = normalizeOwnedToken(item.id);
  if (!title && !itemId) return false;
  return (owned.names ?? []).some((raw) => {
    const name = normalizeOwnedToken(raw);
    if (!name) return false;
    if (name === title || name === itemId) return true;
    return (
      name.length >= 6 &&
      (title.includes(name) || itemId.includes(name) || (title.length >= 6 && name.includes(title)))
    );
  });
}

function visibleItems() {
  return sortRecommendedItems(currentFeedItems()).filter((item) => {
    if (item.topicIds.every((topicId) => state.hiddenTopics.has(topicId))) return false;
    return itemMatchesTopic(item);
  });
}

// ============================================================================
// 5. Authors
// ============================================================================
function liveAuthors() {
  const authors = new Map();
  for (const item of currentFeedItems()) {
    const current = authors.get(item.author) ?? {
      id: `live-author:${item.author}`,
      name: item.author,
      handle: `@${item.author}`,
      url: `https://github.com/${item.author}`,
      reason: "GitHub 实时推荐中出现的活跃维护者。",
      topicIds: [],
      color: "#2d6b54",
      initials: item.author.slice(0, 2).toUpperCase(),
      signal: 60,
    };
    item.topicIds.forEach((topicId) => {
      if (!current.topicIds.includes(topicId)) current.topicIds.push(topicId);
    });
    authors.set(item.author, current);
  }
  return [...authors.values()];
}

function authorProfileInfo(author) {
  const intent = window.SIGNAL_ONBOARD?.interpretProfile?.(state.profile ?? {}) ?? {};
  const profileKey = String(author.id ?? "").replace(/^live-author:/, "");
  const base = AUTHOR_PROFILES[author.id] ?? AUTHOR_PROFILES[profileKey];
  const allItems = [
    ...(state.data?.items ?? []),
    ...(state.liveData?.items ?? []),
  ];
  const authorName = String(author.name ?? "").toLowerCase();
  const handle = String(author.handle ?? "").replace(/^@/, "").toLowerCase();
  const related = allItems
    .filter((item, index, list) => list.findIndex((entry) => entry.id === item.id) === index)
    .filter((item) => {
      const itemAuthor = String(item.author ?? "").toLowerCase();
      return (
        (authorName && itemAuthor === authorName) ||
        (handle && itemAuthor === handle) ||
        base?.works?.some((work) => {
          const workName = String(work).toLowerCase();
          return String(item.title ?? "").toLowerCase() === workName;
        })
      );
    })
    .slice(0, 2);
  const works = base?.works ?? related.map((item) => item.title).slice(0, 2);
  const fallbackBestFor = {
    "ai-tools": "跟进 AI 编程、Agent 与自动化实践",
    presentation: "做 PPT、图表和汇报",
    research: "补齐科研工具和论文工作流",
    music: "跟进音乐制作与音频工具",
    "micro-product": "做小产品、学完整开发流程",
    content: "做自媒体内容和视频工作流",
  };
  const bestFor =
    base?.bestFor ??
    fallbackBestFor[author.topicIds?.[0]] ??
    "观察这个方向里持续活跃的维护者";
  const what =
    base?.what ??
    `最近主要围绕 ${works.join("、") || "这个方向"} 持续更新，可以直接从他的项目观察技术选择。`;
  const matchedFocusIds = (author.topicIds ?? []).filter((topic) =>
    (intent.focusTopics ?? []).includes(topic),
  );
  const focusLabels = matchedFocusIds
    .map((topic) => getTopic(topic)?.label)
    .filter(Boolean);
  const stageTopics = {
    exploring: ["ai-tools", "research"],
    question: ["research"],
    literature: ["research"],
    experiment: ["research"],
    analysis: ["research"],
    writing: ["research", "presentation"],
    communication: ["presentation"],
    none: [],
  };
  const stageMatch = (stageTopics[intent.stageInfo?.stage] ?? [])
    .some((topic) => (author.topicIds ?? []).includes(topic));
  const stageLabel = intent.stageInfo?.label ?? "";
  const needLabel = intent.stageInfo?.needLabel ?? "";
  let whyNow;
  if (stageMatch) {
    whyNow = `你现在处于「${stageLabel}」，最需要「${needLabel}」，他的 ${works[0] ?? "项目"} 能直接补到这条线。`;
  } else if (matchedFocusIds.length) {
    whyNow = `你最近写到「${intent.focusText || focusLabels.join("、")}」，其中「${focusLabels.join("、")}」和他的主要方向一致。`;
  } else {
    whyNow = `你更在意「${intent.targetText || profileLabel("target", state.profile?.target) || "做出实际成果"}」，他长期输出这类可复用项目。`;
  }
  return {
    ...base,
    works,
    what,
    bestFor,
    related,
    focusLabels,
    stageMatch,
    whyNow,
    matchLabel: stageMatch ? `${stageLabel}优先` : focusLabels[0] ?? "长期观察",
  };
}

function authorRelevance(author) {
  const info = authorProfileInfo(author);
  const topicScore = (info.focusLabels?.length ?? 0) * 12;
  const stageScore = info.stageMatch ? 22 : 0;
  const relatedScore = Math.min(8, (info.related?.length ?? 0) * 4);
  const baseScore = Math.round((personalizationFor(author).score ?? 0) * 0.25);
  return topicScore + stageScore + relatedScore + baseScore;
}

function visibleAuthors() {
  if (!state.data) return [];
  const sourceAuthors = state.feedSource === "live" ? liveAuthors() : state.data.authors;
  const authors = sourceAuthors.filter((author) => {
    if (author.topicIds.every((topicId) => state.hiddenTopics.has(topicId))) return false;
    return state.topic === "all" || author.topicIds.includes(state.topic);
  });
  return authors
    .map((author) => ({ ...author, signal: 60 }))
    .sort((left, right) =>
      authorRelevance(right) - authorRelevance(left) ||
      String(left.name).localeCompare(String(right.name), "zh-CN"),
    );
}

function itemsForView(view = state.view) {
  const items = visibleItems();
  const scoped =
    view === "saved"
      ? items.filter((item) => state.saved.has(item.id))
      : view === "project"
        ? items.filter((item) => item.type === "project" || item.repo)
        : items;
  return view === "saved" ? scoped : scoped.filter((item) => !isOwnedItem(item));
}

function filteredItemsForView() {
  return itemsForView();
}

// ============================================================================
// 6. Recommendation history & diverse batches
// ============================================================================
function recommendationKey(kind, itemId) {
  return `${kind}:${itemId}`;
}

function hasRecommended(kind, itemId) {
  return state.recommended.has(recommendationKey(kind, itemId));
}

function markRecommended(kind, itemIds) {
  itemIds.forEach((itemId) => state.recommended.add(recommendationKey(kind, itemId)));
  writeJSON(STORAGE.recommended, [...state.recommended]);
}

function recommendedCount(kind, items) {
  return items.filter((item) => hasRecommended(kind, item.id)).length;
}

function feedContextKey() {
  return [
    state.feedSource,
    state.view,
    state.topic,
    [...state.hiddenTopics].sort().join(","),
  ].join("|");
}

function primaryTopicId(item) {
  return item.topicIds?.[0] ?? "misc";
}

/**
 * Pick a batch with topic coverage. Candidates arrive already sorted by the
 * active sort mode, so the first item of each topic stays the strongest one.
 */
function selectDiverseBatch(candidates, size = FEED_BATCH_SIZE) {
  const groups = new Map();
  for (const item of candidates) {
    const topicId = primaryTopicId(item);
    if (!groups.has(topicId)) groups.set(topicId, []);
    groups.get(topicId).push(item);
  }

  const topicOrder = [...groups.entries()]
    .sort((left, right) => scoreWithProfile(right[1][0]) - scoreWithProfile(left[1][0]))
    .map(([topicId]) => topicId);

  const picked = [];
  const pickedIds = new Set();
  const counts = new Map();
  let progressed = true;

  while (picked.length < size && progressed) {
    progressed = false;
    for (const topicId of topicOrder) {
      if (picked.length >= size) break;
      const queue = groups.get(topicId);
      if (!queue?.length) continue;
      if ((counts.get(topicId) ?? 0) >= FEED_MAX_PER_TOPIC) continue;
      const item = queue.shift();
      picked.push(item);
      pickedIds.add(item.id);
      counts.set(topicId, (counts.get(topicId) ?? 0) + 1);
      progressed = true;
    }
  }

  // When a topic filter leaves fewer than three topic groups, fill the rest in
  // score order instead of returning a short batch.
  if (picked.length < size) {
    for (const item of candidates) {
      if (picked.length >= size) break;
      if (pickedIds.has(item.id)) continue;
      picked.push(item);
      pickedIds.add(item.id);
    }
  }

  return picked;
}

function ensureFeedSelection(force = false) {
  if (state.view === "creator") {
    state.feedSelection = [];
    state.feedExhausted = false;
    state.feedHistoryMode = false;
    return;
  }

  const contextKey = feedContextKey();
  const eligible = filteredItemsForView();
  const eligibleIds = new Set(eligible.map((item) => item.id));
  const selectionIsValid =
    state.feedContextKey === contextKey &&
    state.feedSelection.every((itemId) => eligibleIds.has(itemId));

  if (!force && selectionIsValid && (state.feedHistoryMode || state.feedSelection.length || !eligible.length)) {
    return;
  }

  state.feedContextKey = contextKey;
  state.feedHistoryMode = false;
  const unseen = eligible.filter((item) => !hasRecommended("feed", item.id));
  if (!unseen.length) {
    state.feedSelection = [];
    state.feedExhausted = eligible.length > 0;
    return;
  }

  const selected = selectDiverseBatch(unseen);
  state.feedSelection = selected.map((item) => item.id);
  state.feedExhausted = false;
  markRecommended("feed", state.feedSelection);
}

function showFeedHistory() {
  const items = filteredItemsForView().filter((item) => hasRecommended("feed", item.id));
  if (!items.length) {
    showToast("当前筛选还没有推荐记录");
    return;
  }
  state.feedHistoryMode = true;
  state.feedExhausted = true;
  state.feedSelection = items.map((item) => item.id);
  state.spotlightId = null;
  renderFrame();
}

function resetRecommendationHistory() {
  state.recommended = new Set();
  writeJSON(STORAGE.recommended, []);
  state.feedSelection = [];
  state.feedContextKey = "";
  state.feedExhausted = false;
  state.feedHistoryMode = false;
  state.smallSelection = [];
  state.smallContextKey = "";
  state.smallExhausted = false;
  state.smallHistoryMode = false;
  renderFrame();
  showToast("推荐记录已清除，会重新从未推荐内容开始");
}

function batchMetaForView() {
  const allItems = filteredItemsForView();
  const selectedIds = new Set(state.feedSelection);
  const items = allItems.filter((item) => selectedIds.has(item.id));
  const seen = recommendedCount("feed", allItems);
  const remaining = allItems.length - seen;
  return {
    items,
    total: allItems.length,
    seen,
    remaining,
    historyMode: state.feedHistoryMode,
    exhausted: state.feedExhausted,
  };
}

function itemMark(item) {
  const label = item.title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return label || "GH";
}

function recommendationsEnabled() {
  const radarPage = document.querySelector("#radar-page");
  return Boolean(
    state.data &&
    window.SIGNAL_ONBOARD?.isProfileComplete?.(state.profile) &&
    radarPage &&
    !radarPage.hidden,
  );
}

function renderFrame() {
  if (!state.data) return;
  if (state.initializing) return;
  if (!recommendationsEnabled()) return;

  if (elements.todayLine) {
    elements.todayLine.textContent = new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(new Date());
  }

  ensureValidTopic();
  ensureFeedSelection();
  renderTopicFilter();
  renderProfileImpact();
  renderSpotlight();
  renderResearchKit();
  renderSmallFinds();
  renderFeed();
  renderTopicPulse();
  renderAuthors();
  renderPlan();
  syncViewControls();
  renderSourceStatus();

  if (elements.footerTime) {
    elements.footerTime.textContent = state.feedSource === "live"
      ? `实时数据 ${formatRelativeTime(state.liveData?.fetchedAt)}`
      : `本地存档 ${formatRelativeTime(state.data.meta.generatedAt)}`;
  }

  scheduleMotionLayer();
}

// ============================================================================
// 7. Motion & reveal
// ============================================================================
function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function supportsFinePointer() {
  return window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false;
}

function scheduleMotionLayer() {
  window.cancelAnimationFrame(motionState.frameRequest);
  motionState.frameRequest = window.requestAnimationFrame(() => {
    setupScrollReveal();
    animateRecommendationScores();
  });
}

function setupScrollReveal() {
  if (motionState.hintInitialized || prefersReducedMotion()) return;
  if (document.querySelector("#radar-page")?.hidden) return;
  motionState.hintInitialized = true;

  const targets = [
    elements.profileImpact,
    elements.spotlight,
    elements.researchKit,
    elements.smallFinds,
    document.querySelector(".content-layout .feed-panel"),
    document.querySelector(".content-layout .reading-rail"),
  ].filter((node) => node && !node.hidden);

  if (!targets.length) return;

  const reveal = (node) => {
    node.classList.add("is-revealed");
    motionState.hintObserver?.unobserve(node);
  };

  if (!("IntersectionObserver" in window)) {
    targets.forEach(reveal);
    return;
  }

  motionState.hintObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) reveal(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
  );

  targets.forEach((node, index) => {
    node.classList.add("motion-reveal");
    node.style.setProperty("--reveal-delay", `${Math.min(index * 45, 140)}ms`);
    motionState.hintObserver.observe(node);
  });
}

function animateRecommendationScores() {
  if (prefersReducedMotion()) return;

  const scoreNodes = [
    document.querySelector("#spotlight .score-ring [data-score-target]"),
    ...document.querySelectorAll(".feed-item [data-score-target]"),
  ].filter(Boolean).slice(0, 4);

  scoreNodes.forEach((node, index) => {
    const target = Number(node.dataset.scoreTarget);
    if (!Number.isFinite(target)) return;

    const duration = 360 + index * 36;
    const startValue = Math.max(0, target - 22);
    const startedAt = performance.now();
    node.classList.add("is-counting");

    const tick = (timestamp) => {
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      node.textContent = String(Math.round(startValue + (target - startValue) * eased));
      if (progress < 1) {
        window.requestAnimationFrame(tick);
      } else {
        node.textContent = String(target);
        node.classList.remove("is-counting");
      }
    };

    node.textContent = String(startValue);
    window.requestAnimationFrame(tick);
  });
}

function profileLabel(group, value, fallback = value) {
  if (group === "major" && state.profile?.majorText) return state.profile.majorText;
  if (group === "target" && state.profile?.targetText) return state.profile.targetText;
  if (group === "researchStage" && state.profile?.researchStageLabel) {
    return state.profile.researchStageLabel;
  }
  return window.SIGNAL_ONBOARD?.PROFILE_LABELS?.[group]?.[value] ?? fallback ?? "";
}

// ============================================================================
// 8. Rendering
// ============================================================================
function renderSourceStatus() {
  elements.sourceButtons.forEach((button) => {
    const active = button.dataset.feedSource === state.feedSource;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderGithubAuth();
  if (!elements.liveStatus) return;

  const auth = state.githubAuth;
  const connected = Boolean(auth?.connected);
  const accountLabel = connected
    ? `登录额度 (@${auth.login || "已连接"})`
    : "匿名额度";
  const quotaLimit = connected ? 5000 : 60;

  elements.liveStatus.classList.remove("is-fallback");
  elements.liveStatus.classList.toggle("is-error", Boolean(state.liveError));
  elements.liveStatus.classList.toggle(
    "is-live",
    state.feedSource === "live" && !state.liveError && !state.liveLoading,
  );
  if (state.feedSource === "archive") {
    elements.liveStatus.classList.add("is-fallback");
    const reason = state.liveError ? ` · 原因: ${state.liveError}` : "";
    const modeLabel = connected ? `登录令牌 (@${auth.login})` : "匿名抓取";
    elements.liveStatus.textContent = `本地存档兜底${reason} · ${modeLabel}`;
    return;
  }
  if (state.liveLoading) {
    elements.liveStatus.textContent = connected
      ? `正在请求 GitHub 官方 API (@${auth.login})，最多 12 秒`
      : "正在请求 GitHub 官方 API (匿名)，最多 12 秒";
    return;
  }
  if (state.liveError) {
    elements.liveStatus.classList.add("is-fallback");
    elements.liveStatus.textContent = `实时抓取失败 · ${state.liveError}`;
    return;
  }
  if (state.liveData) {
    const remaining = state.liveData.rateLimit?.remaining;
    let rateLabel;
    if (Number.isFinite(remaining)) {
      rateLabel = remaining === 0
        ? " · 额度已用完"
        : ` · ${accountLabel}剩余 ${remaining}/${quotaLimit} 次/小时`;
    } else {
      rateLabel = "";
    }
    elements.liveStatus.textContent =
      `GitHub 官方实时 · ${formatRelativeTime(state.liveData.fetchedAt)}${rateLabel}`;
    return;
  }
  elements.liveStatus.textContent = "等待实时抓取";
}

function renderGithubAuth() {
  const auth = state.githubAuth;
  const connected = Boolean(auth?.connected);
  const label = connected ? `@${auth.login || "已连接"}` : "连接 GitHub";
  elements.githubAuthButtons.forEach((button) => {
    button.classList.toggle("is-connected", connected);
    const textTarget = button.querySelector("span") || button;
    textTarget.textContent = label;
    button.title = connected
      ? "已使用 GitHub Token，点击可修改或断开"
      : "粘贴 GitHub Token，把抓取额度提升到 5,000 次/小时";
  });
  if (elements.githubAuthCurrent) {
    const rate = auth?.rateLimit;
    const remaining = Number.isFinite(rate?.remaining) ? ` · 剩余 ${rate.remaining}` : "";
    const limit = Number.isFinite(rate?.limit) ? ` / ${rate.limit} 次/小时` : "";
    elements.githubAuthCurrent.classList.toggle("is-connected", connected);
    elements.githubAuthCurrent.textContent = connected
      ? `当前：已连接 @${auth.login || "GitHub"}${remaining}${limit}`
      : "当前：匿名访问 · 每小时 60 次";
  }
  if (elements.githubAuthDisconnect) {
    elements.githubAuthDisconnect.hidden = !connected;
  }
}

function setAuthFeedback(message, tone = "") {
  if (!elements.githubAuthFeedback) return;
  elements.githubAuthFeedback.textContent = message || "";
  elements.githubAuthFeedback.classList.toggle("is-error", tone === "error");
  elements.githubAuthFeedback.classList.toggle("is-ok", tone === "ok");
}

async function loadGithubAuth() {
  try {
    const response = await fetch("/api/github-auth", { cache: "no-store" });
    if (!response.ok) return;
    state.githubAuth = await response.json();
    renderGithubAuth();
  } catch (error) {
    console.warn("GitHub auth status unavailable:", error);
  }
}

function openGithubAuthDialog() {
  if (!elements.githubAuthDialog) return;
  setAuthFeedback("");
  if (elements.githubTokenInput) elements.githubTokenInput.value = "";
  const canManage = state.githubAuth?.canManage !== false;
  if (elements.githubTokenInput) elements.githubTokenInput.disabled = !canManage;
  if (elements.githubAuthSave) elements.githubAuthSave.disabled = !canManage;
  renderGithubAuth();
  if (typeof elements.githubAuthDialog.showModal === "function") {
    elements.githubAuthDialog.showModal();
  } else {
    elements.githubAuthDialog.setAttribute("open", "");
  }
  if (!canManage) {
    setAuthFeedback("Token 只能在运行这个网站的这台电脑上保存。", "error");
  } else {
    window.setTimeout(() => elements.githubTokenInput?.focus(), 60);
  }
}

async function saveGithubToken() {
  if (state.githubAuth?.canManage === false) {
    setAuthFeedback("Token 只能在运行这个网站的这台电脑上保存。", "error");
    return;
  }
  const token = elements.githubTokenInput?.value.trim() || "";
  if (!token) {
    setAuthFeedback("请先粘贴 Token。", "error");
    return;
  }
  if (elements.githubAuthSave) elements.githubAuthSave.disabled = true;
  setAuthFeedback("正在向 GitHub 验证…");
  try {
    const response = await fetch("/api/github-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || `验证失败（HTTP ${response.status}）`);
    }
    state.githubAuth = payload;
    if (elements.githubTokenInput) elements.githubTokenInput.value = "";
    setAuthFeedback(`已连接 @${payload.login}，额度提升到 5,000 次/小时。`, "ok");
    renderGithubAuth();
    renderFrame();
    showToast(`GitHub 已连接 @${payload.login}`);
    window.setTimeout(() => {
      elements.githubAuthDialog?.close?.();
      if (state.feedSource === "live") refreshLiveFeed();
    }, 700);
  } catch (error) {
    setAuthFeedback(error.message || "保存失败，请稍后重试。", "error");
  } finally {
    if (elements.githubAuthSave) elements.githubAuthSave.disabled = false;
  }
}

async function disconnectGithub() {
  if (elements.githubAuthDisconnect) elements.githubAuthDisconnect.disabled = true;
  setAuthFeedback("正在断开…");
  try {
    const response = await fetch("/api/github-auth", { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "断开失败");
    state.githubAuth = payload;
    renderGithubAuth();
    renderFrame();
    setAuthFeedback("已断开，恢复匿名访问（60 次/小时）。", "ok");
    showToast("已断开 GitHub，恢复匿名额度");
  } catch (error) {
    setAuthFeedback(error.message || "断开失败，请稍后重试。", "error");
  } finally {
    if (elements.githubAuthDisconnect) elements.githubAuthDisconnect.disabled = false;
  }
}

function profileChips(profile = state.profile) {
  if (!profile) return [];
  const focusLabels = profile.focusLabels?.length
    ? profile.focusLabels
    : (profile.focus ?? []).map((value) => profileLabel("focus", value));
  const toolLabels = (profile.aiTools ?? []).map((value) => profileLabel("aiTools", value));
  return [
    ["系统", profileLabel("os", profile.os)],
    ["Python", profileLabel("python", profile.python)],
    ["专业", profile.majorText || profileLabel("major", profile.major)],
    ["科研阶段", profileLabel("researchStage", profile.researchStage)],
    ["当前卡点", profile.interpretation?.needLabel ?? ""],
    ["AI 场景", toolLabels.length ? toolLabels.join(" / ") : "未选择"],
    ["目标", profile.targetText || profileLabel("target", profile.target)],
    ["关注方向", focusLabels.length ? focusLabels.join(" / ") : "未选择"],
    ["已有配置", profile.owned?.count ? `${profile.owned.count} 项` : ""],
  ].filter(([, value]) => value);
}

function renderProfileImpact() {
  if (!elements.profileImpact || !state.data || !state.profile) return;
  const chips = profileChips();
  const focusLabels = state.profile.focusLabels?.length
    ? state.profile.focusLabels
    : (state.profile.focus ?? []).map((value) => profileLabel("focus", value));
  const toolLabels = (state.profile.aiTools ?? []).map((value) => profileLabel("aiTools", value));
  const topItem = [...currentFeedItems()]
    .sort((left, right) => calculateScores(right).profile - calculateScores(left).profile)[0];
  const topPersonalization = topItem ? personalizationFor(topItem) : null;

  if (elements.profileImpactSummary) {
    elements.profileImpactSummary.textContent =
      `本轮会优先放大“${focusLabels.slice(0, 4).join("、") || "你的关注方向"}”相关内容，` +
      `并结合你在用的 ${toolLabels.slice(0, 3).join("、") || "AI 工具场景"}、` +
      `专业「${state.profile.majorText || profileLabel("major", state.profile.major)}」和` +
      `「${profileLabel("researchStage", state.profile.researchStage)}」阶段重新排序。` +
      `当前最需要「${state.profile.interpretation?.needLabel || "通用支持"}」，科研相关项目会按这个阶段优先。` +
      (state.profile.owned?.count
        ? `已识别 ${state.profile.owned.count} 项已有配置，推荐时会排除同名或同仓库项目。`
        : "");
  }
  if (elements.profileImpactRules) {
    elements.profileImpactRules.innerHTML = [
      ["关注方向", "最高 +30"],
      ["AI 工具场景", "最高 +18"],
      ["专业方向", "最高 +12"],
      ["科研阶段", `${profileLabel("researchStage", state.profile.researchStage)} · 最高 +16`],
      ["当前目标", "最高 +12"],
      ["系统与 Python", "兼容性加减分"],
    ]
      .map(
        ([label, value]) => `
          <span><strong>${escapeHTML(label)}</strong><small>${escapeHTML(value)}</small></span>`,
      )
      .join("");
  }
  if (elements.profileChipRow) {
    elements.profileChipRow.innerHTML = chips
      .map(
        ([label, value]) => `
          <span class="profile-chip"><small>${escapeHTML(label)}</small>${escapeHTML(value)}</span>`,
      )
      .join("");
  }
  if (elements.profileTopTitle) {
    elements.profileTopTitle.textContent = topItem
      ? `${topItem.title} · ${topPersonalization.score} 分`
      : "暂无匹配项目";
  }
  if (elements.profileTopReason) {
    elements.profileTopReason.textContent = topPersonalization?.reasons?.slice(0, 2).join("；") ??
      "配置会用于项目排序和推荐理由。";
  }
}

function renderResearchKit() {
  if (!elements.researchKit) return;
  if (!state.researchKits?.majors?.length) {
    elements.researchKit.hidden = true;
    return;
  }

  const profile = state.profile;
  const kit =
    state.researchKits.majors.find((entry) => entry.id === profile?.major) ??
    state.researchKits.majors.find((entry) => entry.id === "general") ??
    state.researchKits.majors[0];
  const stage = state.researchKits.stages?.[profile?.researchStage] ?? null;
  state.activeResearchKit = kit;

  elements.researchKit.hidden = false;
  if (elements.researchKitTitle) {
    elements.researchKitTitle.textContent = `${kit.label}科研工具箱`;
  }
  if (elements.researchKitSummary) {
    elements.researchKitSummary.textContent = [kit.summary, stage?.summary]
      .filter(Boolean)
      .join(" ");
  }
  if (elements.researchKitMajor) elements.researchKitMajor.textContent = kit.short;
  if (elements.researchKitStage) elements.researchKitStage.textContent = stage?.label ?? "通用路线";
  if (elements.kitDatabases) elements.kitDatabases.innerHTML = renderKitItems(kit.databases);
  if (elements.kitTools) elements.kitTools.innerHTML = renderKitItems(kit.tools);
  if (elements.kitWorkflow) {
    elements.kitWorkflow.innerHTML = kit.workflow
      .map(
        (step, index) => `
          <li>
            <span class="kit-workflow-number">${index + 1}</span>
            <span>
              <strong>${escapeHTML(step.label)}</strong>
              <p>${escapeHTML(step.detail)}</p>
            </span>
          </li>`,
      )
      .join("");
  }
  if (elements.kitSearchRecipe) {
    const recipe = kit.searchRecipe;
    elements.kitSearchRecipe.style.setProperty("--kit-accent", kit.accent ?? "#5974b9");
    elements.kitSearchRecipe.innerHTML = `
      <div class="kit-search-copy">
        <span class="kit-search-title">${escapeHTML(recipe.title)}</span>
        <code class="kit-search-query">${escapeHTML(recipe.query)}</code>
        <span class="kit-search-note">${escapeHTML(recipe.note)}</span>
      </div>
      <button
        class="kit-copy-button"
        type="button"
        data-copy-recipe
        aria-label="复制检索式"
        title="复制检索式"
      >${icons.copy}</button>`;
  }
  if (elements.kitNotice) elements.kitNotice.textContent = state.researchKits.notice ?? "";
}

function renderKitItems(items = []) {
  return items
    .map(
      (item) => `
        <a class="kit-item" href="${escapeHTML(item.url)}" target="_blank" rel="noreferrer">
          <span class="kit-item-top">
            <span class="kit-item-name">${escapeHTML(item.name)}</span>
            <span class="kit-item-kind">${escapeHTML(item.kind)}</span>
          </span>
          <span class="kit-item-why">${escapeHTML(item.why)}</span>
          <span class="kit-item-access">${escapeHTML(item.access)}</span>
        </a>`,
    )
    .join("");
}

function findInstallTarget(itemId) {
  return [...currentFeedItems(), ...(state.data?.items ?? [])]
    .find((item) => item.id === itemId) ?? null;
}

function buildInstallPrompt(item) {
  const profile = state.profile ?? {};
  const guide = getRepoGuide(item);
  const focusLabels = profile.focusLabels?.length
    ? profile.focusLabels
    : (profile.focus ?? []).map((value) => profileLabel("focus", value));
  const toolLabels = (profile.aiTools ?? []).map((value) => profileLabel("aiTools", value));
  const requirements = Array.isArray(guide?.requirements)
    ? guide.requirements.join("；")
    : String(guide?.requirements ?? "").trim();
  const repoFolder = item.repo.split("/").pop().replace(/[^A-Za-z0-9._-]/g, "-");
  const sourceLabel = item.source === "live" ? "GitHub 官方 API 实时抓取" : "本地精选存档";

  return `你是我电脑上的 AI 编程助手。请帮我在 Windows 上安全安装并验证下面这个 GitHub 开源项目。请先检查、再解释、最后执行，不要一上来批量运行安装命令。

【项目】
- 名称：${item.title}
- 仓库：${item.repo}
- 官方地址：${item.url}
- 用途：${item.description}
- 数据来源：${sourceLabel}
- 许可证：${guide?.license ?? item.metrics?.license ?? "请在仓库中核对"}
- 已知环境要求：${requirements || "未预置，请以仓库当前 README、Release 和官方文档为准"}

【我的环境】
- 操作系统：${profileLabel("os", profile.os, "Windows")}
- Python：${profileLabel("python", profile.python, "不确定")}
- AI Harness / 工具：${toolLabels.join("、") || "当前使用的 AI 编程助手"}
- 专业方向：${profile.majorText || profileLabel("major", profile.major, "未设置")}
- 当前关注：${focusLabels.join("、") || "未设置"}
- 当前目标：${profile.targetText || profileLabel("target", profile.target, "未设置")}
- 科研阶段：${profile.researchStageLabel || profileLabel("researchStage", profile.researchStage, "未设置")}
- 当前卡点：${profile.interpretation?.needLabel || "未设置"}

【安装目标】
- 只在当前用户范围安装，不修改系统级环境。
- 安装目录建议使用：%USERPROFILE%\\Projects\\github-radar\\${repoFolder}
- 如果是独立应用，完成安装并启动一次。
- 如果是 Agent Skill、模板或代码库而不是应用，不要强行安装；请说明正确使用位置、复制哪些文件以及如何验证。

【安全约束】
1. 只使用官方 GitHub 仓库、官方 Release、官方文档和可信包管理器，不使用第三方 GitHub 加速通道。
2. 先阅读 README、LICENSE、安装脚本和依赖声明，列出会执行的命令及风险。不要执行来源不明的二进制、远程脚本或需要关闭安全软件的步骤。
3. 下列操作必须先解释并征得我的确认：管理员权限、系统级安装、全局 npm/pip 包、修改 PATH 或环境变量、修改注册表、修改系统 Python、自动启动服务、对外开放端口。
4. 优先使用项目级虚拟环境、项目级依赖目录和独立工作目录，不覆盖已有文件。
5. 不要在提示词、日志或命令中写入 GitHub Token、API Key、密码、个人身份信息或未公开数据。
6. 下载失败或 GitHub 网络超时，就停止并报告具体错误；不要自行改用未知镜像或代理。
7. 安装前先检查 Git、Python、Node、Docker 等所需工具是否已经存在和版本是否满足要求，不要直接全局安装缺失工具。

【执行流程】
1. 只读检查仓库当前 README、Release、LICENSE、目录结构和运行要求。
2. 给出安装计划：需要的前置软件、将创建的文件、将执行的命令、预计风险和占用空间。
3. 创建独立项目目录，按项目官方推荐方式安装。Python 项目优先使用项目内 venv；Node 项目先读取 package.json 并确认 Node 版本。
4. 执行最小化、非破坏性的启动或测试命令，确认程序能运行。
5. 如果失败，先读取错误信息并定位原因，不要反复盲目重装或修改系统环境。

【完成后请输出】
- 实际安装位置
- 使用的版本或 commit
- 安装与启动命令
- 验证结果
- 仍然存在的风险或限制
- 安全卸载方法

请从只读检查和安装计划开始。`;
}

async function copyText(text) {
  return window.RadarUtil.copyText(text);
}

async function copyInstallPrompt(itemId) {
  const item = findInstallTarget(itemId);
  if (!item) {
    showToast("没有找到对应的项目");
    return;
  }
  try {
    await copyText(buildInstallPrompt(item));
    showToast("AI 安装提示词已复制，可粘贴到你的 Harness");
  } catch {
    showToast("复制失败，请检查浏览器剪贴板权限");
  }
}

function smallFindsMatch(item) {
  const profile = state.profile;
  if (!profile) {
    return {
      score: 40,
      reasons: [item.useCase],
      matchedFocus: [],
      matchedTools: [],
    };
  }

  const profileFocus = profile.focus ?? [];
  const profileTools = profile.aiTools ?? [];
  const matchedFocus = profileFocus.filter((focusId) => item.focus.includes(focusId));
  const matchedTools = profileTools.filter((toolId) => item.tools.includes(toolId));
  const majorMatch = item.majors.includes(profile.major);
  const stageAliases = {
    exploring: ["exploring", "starter"],
    question: ["exploring", "starter"],
    literature: ["starter", "course"],
    experiment: ["lab", "course"],
    analysis: ["lab", "thesis"],
    writing: ["course", "thesis"],
    communication: ["course", "thesis"],
    none: [],
  };
  const stageMatch = (stageAliases[profile.researchStage] ?? [profile.researchStage])
    .some((stage) => item.stages.includes(stage));
  const targetMatch = item.targets.includes(profile.target);
  const focusPoints = Math.min(32, matchedFocus.length * 16);
  const toolPoints = matchedTools.length ? 14 : 0;
  const majorPoints = majorMatch ? 8 : 0;
  const stagePoints = stageMatch ? 6 : 0;
  const targetPoints = targetMatch ? 10 : 0;
  let categoryPoints = 0;
  if (item.category === "ppt" && profileFocus.includes("presentation")) categoryPoints = 10;
  else if (item.category === "skill" && profileFocus.some((focusId) => ["study", "product"].includes(focusId))) categoryPoints = 10;
  else if (item.category === "skill" && profileFocus.includes("research")) categoryPoints = 8;
  else if (item.category === "ppt" && profileFocus.includes("content")) categoryPoints = 4;

  const score = Math.round(clamp(
    12 + focusPoints + toolPoints + majorPoints + stagePoints + targetPoints + categoryPoints,
    15,
    100,
  ));
  const reasons = [];

  if (matchedFocus.length) {
    reasons.push(`对应你正在关注的${matchedFocus
      .map((focusId) => profileLabel("focus", focusId))
      .join("、")}`);
  }
  if (matchedTools.length) {
    reasons.push(`可直接配合${matchedTools
      .map((toolId) => profileLabel("aiTools", toolId))
      .join("、")}使用`);
  }
  if (targetMatch) {
    reasons.push(`优先满足“${profileLabel("target", profile.target)}”目标`);
  }
  if (stageMatch || majorMatch) {
    const stageLabel = stageMatch ? profileLabel("researchStage", profile.researchStage) : "";
    const majorLabel = majorMatch ? profileLabel("major", profile.major) : "";
    reasons.push(`贴合${[stageLabel, majorLabel].filter(Boolean).join(" · ")}`);
  }
  if (!reasons.length) reasons.push(item.useCase);

  return {
    score,
    reasons: reasons.slice(0, 3),
    matchedFocus,
    matchedTools,
  };
}

function smallFindsForCategory(categoryId = state.smallCategory) {
  const items = state.smallResources?.items ?? [];
  return items
    .filter((item) => categoryId === "all" || item.category === categoryId)
    .sort((left, right) => {
      const scoreDelta = smallFindsMatch(right).score - smallFindsMatch(left).score;
      if (scoreDelta !== 0) return scoreDelta;
      return Number(right.stars ?? 0) - Number(left.stars ?? 0);
    });
}

function smallFindsContextKey() {
  return state.smallCategory;
}

function ensureSmallSelection(force = false) {
  const contextKey = smallFindsContextKey();
  const eligible = smallFindsForCategory();
  const eligibleIds = new Set(eligible.map((item) => item.id));
  const selectionIsValid =
    state.smallContextKey === contextKey &&
    state.smallSelection.every((itemId) => eligibleIds.has(itemId));

  if (!force && selectionIsValid && (state.smallHistoryMode || state.smallSelection.length || !eligible.length)) {
    return;
  }

  state.smallContextKey = contextKey;
  state.smallHistoryMode = false;
  const unseen = eligible.filter((item) => !hasRecommended("small", item.id));
  if (!unseen.length) {
    state.smallSelection = [];
    state.smallExhausted = eligible.length > 0;
    return;
  }

  const selected = unseen.slice(0, SMALL_FINDS_PAGE_SIZE);
  state.smallSelection = selected.map((item) => item.id);
  state.smallExhausted = false;
  markRecommended("small", state.smallSelection);
}

function showSmallHistory() {
  const items = smallFindsForCategory().filter((item) => hasRecommended("small", item.id));
  if (!items.length) {
    showToast("当前分类还没有推荐记录");
    return;
  }
  state.smallHistoryMode = true;
  state.smallExhausted = true;
  state.smallSelection = items.map((item) => item.id);
  renderSmallFinds();
}

function smallFindsBatch() {
  const allItems = smallFindsForCategory();
  const byId = new Map(allItems.map((item) => [item.id, item]));
  const items = state.smallSelection.map((itemId) => byId.get(itemId)).filter(Boolean);
  const seen = recommendedCount("small", allItems);
  return {
    allItems,
    items,
    seen,
    remaining: allItems.length - seen,
    historyMode: state.smallHistoryMode,
    exhausted: state.smallExhausted,
  };
}

function formatStars(value) {
  const stars = Number(value ?? 0);
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(stars >= 10_000 ? 0 : 1)}k`;
  }
  return String(stars);
}

function renderSmallFinds() {
  if (!elements.smallFinds || !elements.smallFindsGrid) return;
  if (!recommendationsEnabled()) return;
  if (!state.smallResources?.items?.length) {
    elements.smallFinds.hidden = true;
    return;
  }

  ensureSmallSelection();
  elements.smallFinds.hidden = false;
  const batch = smallFindsBatch();
  const focusLabels = (state.profile?.focus ?? [])
    .slice(0, 4)
    .map((focusId) => profileLabel("focus", focusId));
  const toolLabels = (state.profile?.aiTools ?? [])
    .slice(0, 3)
    .map((toolId) => profileLabel("aiTools", toolId));
  if (elements.smallFindsSummary) {
    elements.smallFindsSummary.textContent = state.profile
      ? `你选择了“${focusLabels.join("、") || "综合成长"}”，并在使用 ${toolLabels.join("、") || "不同 AI 工具"}；这里优先放入能直接服务这些方向的小模板和 Agent Skill。`
      : "从小而具体的模板和 Agent Skill 开始，直接放进你的下一步任务。";
  }
  if (elements.smallFindsCount) {
    elements.smallFindsCount.textContent = batch.historyMode
      ? `已推荐 ${batch.seen} / ${batch.allItems.length} 个`
      : `本次 ${batch.items.length} 个 · 已推荐 ${batch.seen} / ${batch.allItems.length} · 剩余 ${batch.remaining}`;
  }
  if (elements.smallFindsTabs) {
    elements.smallFindsTabs.innerHTML = state.smallResources.categories
      .map((category) => {
        const categoryItems = smallFindsForCategory(category.id);
        const seen = recommendedCount("small", categoryItems);
        return `
          <button
            class="small-finds-tab ${state.smallCategory === category.id ? "is-active" : ""}"
            type="button"
            role="tab"
            aria-selected="${state.smallCategory === category.id}"
            data-small-category="${escapeHTML(category.id)}"
          >
            <span>${escapeHTML(category.label)}</span>
            <small class="tab-history">已推荐 ${seen}/${categoryItems.length}</small>
          </button>`;
      })
      .join("");
  }

  if (!batch.items.length && batch.exhausted) {
    elements.smallFindsGrid.innerHTML = `
      <div class="small-finds-empty">
        <div class="empty-mark">✓</div>
        <strong>当前分类已全部推荐过</strong>
        <p>这里不会自动重复旧资源。可以查看历史，或清除推荐记录后重新开始。</p>
        <div class="empty-actions">
          <button class="button primary" type="button" data-show-small-history>查看已推荐资源</button>
          <button class="button ghost" type="button" data-reset-recommendations>清除推荐记录</button>
        </div>
      </div>`;
  } else {
    elements.smallFindsGrid.innerHTML = batch.items
    .map((item, index) => {
      const match = smallFindsMatch(item);
      const categoryName = state.smallResources.categories.find(
        (category) => category.id === item.category,
      )?.label ?? item.category;
      return `
        <article class="small-find-card" data-small-id="${escapeHTML(item.id)}" style="--small-index:${index};--small-accent:${
          item.category === "ppt" ? "#b9683d" : "#2d6b54"
        }">
          <div class="small-find-card-head">
            <span class="small-find-type">${escapeHTML(categoryName)}</span>
            <span class="small-find-head-badges">
              ${batch.historyMode ? '<span class="history-badge">已推荐过</span>' : ""}
              <span class="small-find-score"><strong>${match.score}</strong><small>匹配</small></span>
            </span>
          </div>
          <div class="small-find-title-row">
            <h3>${escapeHTML(item.title)}</h3>
            <span class="small-find-safety" title="${escapeHTML(item.safety.reasons.join("；"))}">
              ${escapeHTML(item.safety.label)}
            </span>
          </div>
          <p class="small-find-summary">${escapeHTML(item.summary)}</p>
          <p class="small-find-usecase"><strong>适合</strong>${escapeHTML(item.useCase)}</p>
          <div class="small-find-reasons">
            ${match.reasons
              .map((reason) => `<span>${escapeHTML(reason)}</span>`)
              .join("")}
          </div>
          <div class="small-find-start">
            <strong>怎么用</strong>
            <p>${escapeHTML(item.quickStart)}</p>
          </div>
          <div class="small-find-tags">
            ${item.tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join("")}
          </div>
          <div class="small-find-meta">
            <span>${escapeHTML(item.license)}</span>
            <span>${formatStars(item.stars)} stars</span>
            <span>${escapeHTML(item.setupLevel)}</span>
          </div>
          <div class="small-find-actions">
            <a class="small-find-primary" href="${escapeHTML(item.entryUrl)}" target="_blank" rel="noreferrer">
              ${escapeHTML(item.entryLabel)} ${icons.arrow}
            </a>
            <a class="small-find-secondary" href="${escapeHTML(item.downloadUrl)}" target="_blank" rel="noreferrer">
              下载 ZIP
            </a>
          </div>
        </article>`;
    })
    .join("");
  }

  if (elements.smallFindsRefresh) {
    const unseen = batch.allItems.filter((item) => !hasRecommended("small", item.id));
    elements.smallFindsRefresh.disabled = unseen.length === 0;
    const label = elements.smallFindsRefresh.querySelector("span");
    if (label) label.textContent = unseen.length ? "换一组" : "已推荐完";
  }

  if (elements.smallFindsNotice) {
    elements.smallFindsNotice.textContent = state.smallResources.notice ?? "";
  }
}

function setSmallCategory(categoryId) {
  if (!state.smallResources?.categories?.some((category) => category.id === categoryId)) return;
  state.smallCategory = categoryId;
  renderSmallFinds();
}

function refreshSmallFinds() {
  const eligible = smallFindsForCategory();
  if (!eligible.some((item) => !hasRecommended("small", item.id))) {
    renderSmallFinds();
    showToast("当前分类已全部推荐过，可在标签页查看推荐进度");
    return;
  }
  ensureSmallSelection(true);
  renderSmallFinds();
  const next = smallFindsBatch();
  showToast(
    next.items.length
      ? `新增 ${next.items.length} 个未推荐资源，当前分类剩余 ${next.remaining} 个`
      : "当前分类已全部推荐过",
  );
}

function renderTopicFilter() {
  if (!elements.topicFilter) return;
  const topics = getVisibleTopics();
  const totalCount = topicPoolItems().length;
  elements.topicFilter.innerHTML = [
    `<button class="topic-chip ${state.topic === "all" ? "is-active" : ""}" type="button" data-topic="all">
      <i style="--chip-color:#17201c"></i><span>全部</span><small>${totalCount}</small>
    </button>`,
    ...topics.map(
      (topic) => `
        <button class="topic-chip ${state.topic === topic.id ? "is-active" : ""}" type="button" data-topic="${escapeHTML(topic.id)}">
          <i style="--chip-color:${escapeHTML(topic.color)}"></i>
          <span>${escapeHTML(topic.label)}</span>
          <small>${topic.count}</small>
        </button>`,
    ),
  ].join("");
}

function renderSpotlight() {
  if (!elements.spotlight) return;
  if (state.view === "creator" || state.view === "saved" || state.feedHistoryMode) {
    state.spotlightId = null;
    elements.spotlight.innerHTML = "";
    elements.spotlight.hidden = true;
    return;
  }

  const batch = batchMetaForView();
  const item = batch.items[0];
  if (!item) {
    state.spotlightId = null;
    elements.spotlight.innerHTML = "";
    elements.spotlight.hidden = true;
    return;
  }

  state.spotlightId = item.id;
  elements.spotlight.hidden = false;
  const color = getTopicColor(item.topicIds[0]);
  const detail = contentProfile(item);
  elements.spotlight.innerHTML = `
    <article class="spotlight-card spotlight-brief-card" style="--item-color:${escapeHTML(color)}">
      <div class="spotlight-main">
        <div class="spotlight-label-row">
          <div class="spotlight-label">本期重点 · ${escapeHTML(detail.direction)}</div>
          <span class="brief-kind">${escapeHTML(detail.kindShort)}</span>
        </div>
        <h2>${escapeHTML(item.title)}</h2>
        <div class="brief-grid brief-grid--spotlight">
          <div class="brief-item">
            <span>关注方向</span>
            <p>${escapeHTML(detail.direction)}</p>
          </div>
          <div class="brief-item">
            <span>是什么</span>
            <p>${escapeHTML(detail.kindDetail)}</p>
          </div>
          <div class="brief-item brief-item--wide">
            <span>作用</span>
            <p>${escapeHTML(detail.purpose)}</p>
          </div>
          <div class="brief-item brief-item--wide">
            <span>配置</span>
            <p>${escapeHTML(detail.setup)}</p>
          </div>
        </div>
        <div class="spotlight-footer">
          <div class="spotlight-actions">
            <button class="spotlight-link" type="button" data-preview-id="${escapeHTML(item.id)}">
              查看部署指南
            </button>
            <button class="spotlight-link" type="button" data-copy-install-prompt="${escapeHTML(item.id)}">
              复制安装提示词
            </button>
            <a class="spotlight-link" href="${escapeHTML(item.url)}" target="_blank" rel="noreferrer">
              打开 GitHub ${icons.arrow}
            </a>
          </div>
        </div>
      </div>
    </article>`;
}

function renderFeed() {
  if (!elements.feedList) return;
  if (state.view === "creator") {
    renderAuthorsFeed();
    return;
  }

  const batch = batchMetaForView();
  if (!batch.total) {
    if (state.feedSource === "live" && (state.liveLoading || state.liveError)) {
      renderLiveFeedState();
      return;
    }
    if (elements.resultCount) elements.resultCount.textContent = "0 条结果";
    renderEmptyState();
    return;
  }

  if (!batch.items.length && batch.exhausted) {
    renderRecommendationExhausted(batch);
    return;
  }

  const items = batch.items.filter((item) => item.id !== state.spotlightId);
  if (elements.resultCount) {
    const stageLabel = state.profile?.researchStageLabel || "";
    const ownedExcluded = currentFeedItems().filter((item) => isOwnedItem(item)).length;
    elements.resultCount.textContent = batch.historyMode
      ? `已推荐 ${batch.seen} / ${batch.total} 条`
      : `本次 ${batch.items.length} 条${stageLabel ? ` · ${stageLabel}优先` : ""}` +
        `${ownedExcluded ? ` · 已排除 ${ownedExcluded} 个已有项目` : ""}`;
  }

  if (!items.length) {
    if (batch.items.length && state.spotlightId) {
      elements.feedList.innerHTML =
        '<div class="empty-state"><div class="empty-mark">✓</div><h3>本批重点已在上方</h3><p>这一批的新内容已全部展示。点击右上角继续获取未推荐过的内容。</p></div>';
    } else {
      renderEmptyState();
    }
    return;
  }

  elements.feedList.innerHTML = items
    .map((item) => renderFeedItem(item, { history: batch.historyMode }))
    .join("");
}

function renderLiveFeedState() {
  if (!elements.feedList) return;
  const loading = state.liveLoading;
  if (elements.resultCount) {
    elements.resultCount.textContent = loading ? "正在抓取" : "实时不可用";
  }
  elements.feedList.innerHTML = `
    <div class="empty-state live-state ${loading ? "is-loading" : "is-error"}">
      <div class="empty-mark">${loading ? icons.search : icons.close}</div>
      <h3>${loading ? "正在从 GitHub 获取新内容" : "实时 GitHub 暂时不可用"}</h3>
      <p>${
        loading
          ? "正在查询官方 Search API，并核对仓库是否公开、是否归档以及许可证状态。"
          : escapeHTML(state.liveError || "请稍后重试，或先查看明确标注的本地存档。")
      }</p>
      <div class="empty-actions">
        ${
          loading
            ? ""
            : '<button class="button primary" type="button" data-retry-live>重新抓取</button>'
        }
        <button class="button ghost" type="button" data-feed-source="archive">查看本地存档</button>
      </div>
    </div>`;
}

function renderRecommendationExhausted(batch) {
  if (!elements.feedList) return;
  if (elements.resultCount) {
    elements.resultCount.textContent = `已推荐 ${batch.seen} / ${batch.total} 条`;
  }
  elements.feedList.innerHTML = `
    <div class="empty-state recommendation-exhausted">
      <div class="empty-mark">✓</div>
      <h3>当前筛选已全部推荐过</h3>
      <p>这个筛选下共 ${batch.total} 条内容，已经推荐 ${batch.seen} 条。为了不让旧内容冒充新推荐，这里不会自动重复。</p>
      <div class="empty-actions">
        <button class="button primary" type="button" data-show-feed-history>
          查看已推荐内容
        </button>
        <button class="button ghost" type="button" data-reset-recommendations>
          清除推荐记录
        </button>
      </div>
    </div>`;
}

function renderFeedItem(item, options = {}) {
  const color = getTopicColor(item.topicIds[0]);
  const isSaved = state.saved.has(item.id);
  const detail = contentProfile(item);

  return `
    <article class="feed-item item-brief-card" style="--item-color:${escapeHTML(color)}">
      <div class="item-content">
        <div class="item-title-row brief-head">
          <button class="item-title" type="button" data-preview-id="${escapeHTML(item.id)}">${escapeHTML(item.title)}</button>
          <span class="brief-kind">${escapeHTML(detail.kindShort)}</span>
          ${item.source === "live" ? '<span class="live-item-badge">实时</span>' : ""}
          ${options.history ? '<span class="history-badge">已推荐过</span>' : ""}
          <button
            class="save-button brief-save ${isSaved ? "is-saved" : ""}"
            type="button"
            data-save-id="${escapeHTML(item.id)}"
            aria-label="${isSaved ? "移出稍后读" : "加入稍后读"}：${escapeHTML(item.title)}"
            aria-pressed="${isSaved}"
            title="${isSaved ? "移出稍后读" : "加入稍后读"}"
          >${icons.bookmark}</button>
        </div>
        <div class="brief-grid">
          <div class="brief-item">
            <span>关注方向</span>
            <p>${escapeHTML(detail.direction)}</p>
          </div>
          <div class="brief-item">
            <span>是什么</span>
            <p>${escapeHTML(detail.kindDetail)}</p>
          </div>
          <div class="brief-item brief-item--wide">
            <span>作用</span>
            <p>${escapeHTML(detail.purpose)}</p>
          </div>
          <div class="brief-item brief-item--wide">
            <span>配置</span>
            <p>${escapeHTML(detail.setup)}</p>
          </div>
        </div>
        <div class="brief-actions">
          <button class="brief-action brief-action--primary" type="button" data-preview-id="${escapeHTML(item.id)}">
            查看部署指南
          </button>
          <button class="brief-action" type="button" data-copy-install-prompt="${escapeHTML(item.id)}">
            ${icons.copy}
            复制安装提示词
          </button>
          <a class="brief-action" href="${escapeHTML(item.url)}" target="_blank" rel="noreferrer">
            GitHub ${icons.arrow}
          </a>
        </div>
      </div>
    </article>`;
}

function formatRepoSize(sizeKb) {
  const value = Number(sizeKb);
  if (!Number.isFinite(value) || value <= 0) return "";
  const megabytes = value / 1024;
  return `${megabytes >= 100 ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
}

function cleanReadmeText(value = "") {
  return String(value)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<picture[\s\S]*?<\/picture>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[!\[[^\]]*]\([^)]*\)]\([^)]*\)/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
    .replace(/^\s*([-*_])\1{2,}\s*$/gm, "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 16_000);
}

function renderAuthorityBreakdown(scores) {
  return [
    ["社区认可", scores.community, 30],
    ["项目成熟度", scores.maturity, 15],
    ["近期维护", scores.maintenance, 20],
    ["开源许可证", scores.license, 20],
    ["部署文档", scores.documentation, 10],
    ["来源安全初筛", scores.security, 5],
  ]
    .map(
      ([label, value, maximum]) => `
        <div class="authority-factor">
          <span>${escapeHTML(label)}</span>
          <i><b style="--factor-width:${Math.round((value / maximum) * 100)}%"></b></i>
          <strong>${value}/${maximum}</strong>
        </div>`,
    )
    .join("");
}

function renderPersonalBreakdown(personalization) {
  const components = personalization.components ?? {};
  return [
    ["关注方向", components.focus ?? 0, 30],
    ["AI 工具场景", components.tools ?? 0, 18],
    ["专业匹配", components.major ?? 0, 12],
    ["科研阶段", components.stage ?? 0, 8],
    ["当前目标", components.target ?? 0, 12],
    ["系统与 Python", components.environment ?? 0, 16],
  ]
    .map(
      ([label, value, maximum]) => `
        <div class="authority-factor">
          <span>${escapeHTML(label)}</span>
          <i><b style="--factor-width:${Math.round((clamp(value, 0, maximum) / maximum) * 100)}%"></b></i>
          <strong>${value >= 0 ? "+" : ""}${value}</strong>
        </div>`,
    )
    .join("");
}

function renderGuideSteps(steps = []) {
  return steps
    .map(
      (step, index) => `
        <li class="guide-step">
          <span class="guide-step-number">${index + 1}</span>
          <div class="guide-step-body">
            <strong>${escapeHTML(step.title)}</strong>
            <p>${escapeHTML(step.detail)}</p>
            ${
              step.command
                ? `<div class="guide-command">
                    <pre><code>${escapeHTML(step.command)}</code></pre>
                    <button type="button" data-copy-command="${escapeHTML(step.command)}" aria-label="复制步骤命令" title="复制命令">${icons.copy}</button>
                  </div>`
                : ""
            }
          </div>
        </li>`,
    )
    .join("");
}

function showRepoDialog() {
  if (!elements.repoDialog) return;
  if (typeof elements.repoDialog.showModal === "function") {
    if (!elements.repoDialog.open) elements.repoDialog.showModal();
  } else {
    elements.repoDialog.setAttribute("open", "");
  }
}

async function openLiveRepoPreview(item) {
  if (!elements.repoDialogBody) return;
  state.activeRepoId = item.id;
  const dialogTitle = document.querySelector("#repo-dialog-title");
  if (dialogTitle) dialogTitle.textContent = "GitHub 实时项目详情";
  const scores = calculateScores(item);
  const personal = scores.personalization;
  elements.repoDialogBody.innerHTML = `
    <div class="repo-detail-kicker"><span>LIVE GITHUB</span><span>${escapeHTML(item.repo)}</span></div>
    <h3 class="repo-detail-title">${escapeHTML(item.title)}</h3>
    <p class="repo-detail-description">${escapeHTML(item.description)}</p>
    <p class="live-preview-loading">正在实时读取 README 和仓库详情...</p>`;
  showRepoDialog();

  let payload = null;
  let errorMessage = "";
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(
      `/api/live-repo?repo=${encodeURIComponent(item.repo)}`,
      { cache: "no-store", signal: controller.signal },
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
    payload = result;
  } catch (error) {
    errorMessage =
      error.name === "AbortError"
        ? "读取 README 超时（20 秒），可稍后重试"
        : error.message || "无法读取实时仓库详情";
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (state.activeRepoId !== item.id) return;
  const repo = payload?.repo ?? {
    stargazers_count: item.metrics?.stars,
    forks_count: item.metrics?.forks,
    open_issues_count: item.metrics?.openIssues,
    pushed_at: item.metrics?.pushedAt,
    license: { spdx_id: item.metrics?.license },
    topics: item.tags,
    default_branch: "main",
  };
  const rawReadme = payload?.readme || "";
  const readme = cleanReadmeText(rawReadme);
  const zhReadme = cleanReadmeText(payload?.zhReadme || "");
  const guide = findRepoGuideForItem(item);
  const digest = buildReadmeDigest(item, rawReadme, guide);
  const homepage = String(repo.homepage || item.metrics?.homepage || "");
  const branch = repo.default_branch || "main";
  const zipUrl = `https://github.com/${item.repo}/archive/refs/heads/${branch}.zip`;
  const warnings = payload?.warnings ?? [];
  elements.repoDialogBody.innerHTML = `
    <div class="repo-detail-kicker">
      <span>LIVE GITHUB</span>
      <span>${escapeHTML(repo.language || item.language)}</span>
      <span>${escapeHTML(item.metrics?.license || "许可证未知")}</span>
    </div>
    <h3 class="repo-detail-title">${escapeHTML(item.title)}</h3>
    <div class="repo-detail-meta">
      <span>${escapeHTML(item.repo)}</span>
      <span>${Number(repo.stargazers_count || 0).toLocaleString("zh-CN")} stars</span>
      <span>${Number(repo.forks_count || 0).toLocaleString("zh-CN")} forks</span>
      <span>更新于 ${escapeHTML(formatRelativeTime(repo.pushed_at))}</span>
    </div>
    <p class="repo-detail-description">${escapeHTML(repo.description || item.description)}</p>
    <div class="guide-score-grid">
      <div class="guide-score guide-score--match">
        <span>PERSONAL MATCH</span>
        <strong>${personal.score}<small>/100</small></strong>
        <p>${escapeHTML(personal.fitLabel)}</p>
      </div>
      <div class="guide-score guide-score--primary">
        <span>AUTHORITY</span>
        <strong>${scores.authority}<small>/100</small></strong>
        <p>基于实时元数据</p>
      </div>
      <div class="guide-score">
        <span>FRESHNESS</span>
        <strong>${scores.freshness}<small>/100</small></strong>
        <p>最近推送时间</p>
      </div>
      <div class="guide-score guide-score--safe">
        <span>SOURCE</span>
        <strong>实时<small>核验</small></strong>
        <p>公开状态与许可证</p>
      </div>
    </div>
    <section class="guide-section guide-section--personal">
      <p class="guide-section-kicker">WHY THIS FITS YOU</p>
      <h4>为什么实时推荐这个项目</h4>
      <ul class="guide-personal-reasons">
        ${personal.reasons.map((reason) => `<li>${escapeHTML(normalizeInlineText(reason))}</li>`).join("")}
      </ul>
    </section>
    <section class="guide-section">
      <p class="guide-section-kicker">README 中文提炼</p>
      <h4>这个项目是做什么的</h4>
      <p class="guide-lead">${escapeHTML(digest.summary)}</p>
      <p class="guide-quickest"><strong>最省事的打开方式</strong>${escapeHTML(digest.quickest)}</p>
      <p class="readme-digest-note">${escapeHTML(digest.sourceNote)}</p>
    </section>
    <section class="guide-section">
      <p class="guide-section-kicker">LIVE README</p>
      <h4>打开与部署入口</h4>
      <p class="guide-lead">${
        errorMessage
          ? `实时详情读取失败：${escapeHTML(errorMessage)}。仍可打开官方仓库查看最新说明。`
          : "README 来自本次点击时的 GitHub 官方响应，没有使用本地预下载内容。"
      }</p>
      ${
        warnings.length
          ? `<ul class="guide-cautions">${warnings.map((warning) => `<li>${escapeHTML(warning)}</li>`).join("")}</ul>`
          : ""
      }
    </section>
    ${
      zhReadme
        ? `<details class="repo-readme-details" open>
            <summary>README 官方中文版</summary>
            <div class="repo-readme-meta">
              <strong>${escapeHTML(payload?.zhReadmePath || "README 中文版")}</strong>
              <span>仓库自带的中文 README，已清理图片和徽章</span>
            </div>
            <pre class="repo-readme">${escapeHTML(zhReadme)}</pre>
          </details>`
        : ""
    }
    ${
      readme
        ? `<details class="repo-readme-details" open>
            <summary>GitHub 实时 README</summary>
            <div class="repo-readme-meta">
              <strong>README</strong>
              <span>已清理图片、徽章和 HTML 标签</span>
            </div>
            <pre class="repo-readme">${escapeHTML(readme)}</pre>
          </details>`
        : '<p class="repo-snapshot-note">没有读到 README。请以 GitHub 官方仓库当前页面为准。</p>'
    }
    <div class="repo-detail-actions">
      <button class="button primary is-wide" type="button" data-copy-install-prompt="${escapeHTML(item.id)}">
        复制 AI 安装提示词
      </button>
      <a class="action-link primary" href="${escapeHTML(item.url)}" target="_blank" rel="noreferrer">
        打开 GitHub 官方仓库
      </a>
      ${
        homepage
          ? `<a class="action-link" href="${escapeHTML(homepage)}" target="_blank" rel="noreferrer">打开项目主页</a>`
          : ""
      }
      <a class="action-link is-wide" href="${escapeHTML(zipUrl)}" target="_blank" rel="noreferrer">
        GitHub 源码 ZIP
      </a>
      <button class="button ghost is-wide" type="button" data-copy-repo-url="${escapeHTML(item.url)}">
        复制仓库地址
      </button>
    </div>`;
}

function openRepoPreview(itemId) {
  const item = [...currentFeedItems(), ...(state.data?.items ?? [])].find((entry) => entry.id === itemId);
  if (!item || !elements.repoDialog || !elements.repoDialogBody) return;
  if (item.source === "live") {
    openLiveRepoPreview(item);
    return;
  }

  state.activeRepoId = item.id;
  const dialogTitle = document.querySelector("#repo-dialog-title");
  if (dialogTitle) dialogTitle.textContent = "中文部署指南";
  const snapshot = state.repoSnapshots?.repos?.[item.id] ?? null;
  const guide = getRepoGuide(item);
  const scores = calculateScores(item, guide);
  const personal = scores.personalization;
  const category = recommendationCategory(item, scores);
  const topicLabels = item.topicIds
    .map((id) => getTopic(id)?.label)
    .filter(Boolean)
    .join(" / ");
  const sizeLabel = formatRepoSize(snapshot?.sizeKb);
  const readme = cleanReadmeText(snapshot?.readme);
  const branch = snapshot?.defaultBranch || "main";
  const zipUrl = `https://github.com/${item.repo}/archive/refs/heads/${branch}.zip`;
  const sizeWarning =
    Number(snapshot?.sizeKb) > 20000
      ? `<p class="repo-size-note">源码约 ${escapeHTML(sizeLabel)}，体积较大。优先按中文步骤使用发布版或安装包，不要直接下载整个源码仓库。</p>`
      : "";
  const requirementMarkup = (guide?.requirements ?? [])
    .map((requirement) => `<li>${escapeHTML(requirement)}</li>`)
    .join("");
  const cautionMarkup = (guide?.cautions ?? [])
    .map((caution) => `<li>${escapeHTML(caution)}</li>`)
    .join("");
  const securityReasons = (guide?.security?.reasons ?? [])
    .map((reason) => `<li>${escapeHTML(reason)}</li>`)
    .join("");

  elements.repoDialogBody.innerHTML = `
    <div class="repo-detail-kicker">
      <span>${escapeHTML(topicLabels || "精选项目")}</span>
      <span>${escapeHTML(item.language)}</span>
      <span class="recommendation-badge" data-category="${escapeHTML(category)}">${escapeHTML(category)}</span>
    </div>
    <h3 class="repo-detail-title">${escapeHTML(item.title)}</h3>
    <div class="repo-detail-meta">
      <span>${escapeHTML(item.repo)}</span>
      <span>${escapeHTML(item.author)}</span>
      <span>${scores.stars.toLocaleString("zh-CN")} stars</span>
      <span>${escapeHTML(scores.licenseName || "许可证未知")}</span>
      ${sizeLabel ? `<span>源码约 ${escapeHTML(sizeLabel)}</span>` : ""}
    </div>
    <p class="repo-detail-description">${escapeHTML(item.description)}</p>

    <div class="guide-score-grid">
      <div class="guide-score guide-score--match">
        <span>PERSONAL MATCH</span>
        <strong>${personal.score}<small>/100</small></strong>
        <p>${escapeHTML(personal.fitLabel)}</p>
      </div>
      <div class="guide-score guide-score--primary">
        <span>AUTHORITY</span>
        <strong>${scores.authority}<small>/100</small></strong>
        <p>权威度</p>
      </div>
      <div class="guide-score">
        <span>FRESHNESS</span>
        <strong>${scores.freshness}<small>/100</small></strong>
        <p>新鲜度</p>
      </div>
      <div class="guide-score guide-score--safe">
        <span>SAFETY</span>
        <strong>初筛<small>通过</small></strong>
        <p>公开来源与开源许可证</p>
      </div>
    </div>

    <details class="guide-breakdown">
      <summary>查看权威度是怎么算出来的</summary>
      <div class="authority-factor-list">${renderAuthorityBreakdown(scores)}</div>
      <p>分数只用于帮助比较项目可信基础，不等同于安全审计或学术质量评价。</p>
    </details>

    <section class="guide-section guide-section--personal">
      <p class="guide-section-kicker">WHY THIS FITS YOU</p>
      <h4>为什么这个项目适合你</h4>
      <ul class="guide-personal-reasons">
        ${personal.reasons.map((reason) => `<li>${escapeHTML(normalizeInlineText(reason))}</li>`).join("")}
      </ul>
      <details class="guide-breakdown">
        <summary>查看个人匹配分构成</summary>
        <div class="authority-factor-list">${renderPersonalBreakdown(personal)}</div>
        <p>“为你推荐”由个人匹配 62%、权威度 23%、新鲜度 15% 综合计算；“最适合我”只按个人匹配排序。</p>
      </details>
      <p class="guide-muted">这些理由来自你在问卷中选择的系统、Python、专业、科研阶段、AI 场景、关注方向和目标。</p>
    </section>

    <section class="guide-section">
      <p class="guide-section-kicker">README 中文提炼</p>
      <h4>这个项目是做什么的</h4>
      <p class="guide-lead">${escapeHTML(guide?.readmeSummary ?? item.description)}</p>
      <p class="guide-quickest"><strong>最省事的打开方式</strong>${escapeHTML(guide?.quickest ?? "按项目官方 README 的安装说明操作。")}</p>
    </section>

    <section class="guide-section">
      <p class="guide-section-kicker">BEFORE YOU START</p>
      <h4>先确认电脑环境</h4>
      ${requirementMarkup ? `<ul class="guide-requirements">${requirementMarkup}</ul>` : '<p class="guide-muted">该项目的运行要求较少，仍建议使用独立项目目录。</p>'}
    </section>

    <section class="guide-section">
      <p class="guide-section-kicker">RUN LOCALLY</p>
      <h4>在电脑上打开 / 部署</h4>
      ${
        guide?.steps?.length
          ? `<ol class="guide-steps">${renderGuideSteps(guide.steps)}</ol>`
          : '<p class="guide-muted">当前没有整理好的中文步骤，请查看下方清理后的 README 和官方文档。</p>'
      }
      ${
        guide?.launch
          ? `<div class="guide-launch">
              <div>
                <span>${escapeHTML(guide.launch.label)}</span>
                <code>${escapeHTML(guide.launch.url)}</code>
                <p>${escapeHTML(guide.launch.note)}</p>
              </div>
              <a class="action-link" href="${escapeHTML(guide.launch.url)}" target="_blank" rel="noreferrer">打开入口</a>
            </div>`
          : ""
      }
    </section>

    <section class="guide-section">
      <p class="guide-section-kicker">SAFETY NOTES</p>
      <h4>使用前要留意</h4>
      <ul class="guide-cautions">${cautionMarkup || "<li>不要把密钥、个人身份信息或未公开数据放进测试项目。</li>"}</ul>
      <details class="guide-breakdown">
        <summary>开源安全初筛依据</summary>
        <ul class="guide-safety-list">${securityReasons}</ul>
        <p>${escapeHTML(guide?.security?.limitations ?? "初筛不等同于完整代码安全审计。")}</p>
      </details>
    </section>

    ${
      readme
        ? `<details class="repo-readme-details">
            <summary>展开清理后的英文 README</summary>
            <div class="repo-readme-meta">
              <strong>${escapeHTML(snapshot.readmeFile || "README")}</strong>
              <span>已移除图片、徽章、HTML 注释与多余空行</span>
            </div>
            <pre class="repo-readme">${escapeHTML(readme)}</pre>
          </details>`
        : '<p class="repo-snapshot-note">该项目暂时没有本地 README 缓存；上方中文部署卡和官方文档仍然可用。</p>'
    }
    ${
      snapshot?.fetchedAt
        ? `<p class="repo-snapshot-note">缓存时间：${escapeHTML(formatRelativeTime(snapshot.fetchedAt))}</p>`
        : ""
    }
    <div class="repo-detail-actions">
      <button class="button primary is-wide" type="button" data-copy-install-prompt="${escapeHTML(item.id)}">
        复制 AI 安装提示词
      </button>
      <a class="action-link primary" href="${escapeHTML(item.url)}" target="_blank" rel="noreferrer">
        打开 GitHub 官方仓库
      </a>
      <a class="action-link" href="${escapeHTML(guide?.docsUrl ?? item.url)}" target="_blank" rel="noreferrer">
        打开官方文档
      </a>
      <a class="action-link is-wide" href="${escapeHTML(zipUrl)}" target="_blank" rel="noreferrer">
        GitHub 源码 ZIP${sizeLabel ? ` · ${escapeHTML(sizeLabel)}` : ""}
      </a>
      <button class="button ghost is-wide" type="button" data-copy-repo-url="${escapeHTML(item.url)}">
        复制仓库地址
      </button>
      ${sizeWarning}
    </div>`;

  if (typeof elements.repoDialog.showModal === "function") {
    if (!elements.repoDialog.open) elements.repoDialog.showModal();
  } else {
    elements.repoDialog.setAttribute("open", "");
  }

  if (!state.repoSnapshotsLoaded) {
    loadRepoSnapshots().then(() => {
      if (state.repoSnapshots && state.activeRepoId === item.id) openRepoPreview(item.id);
    });
  }
  if (!state.repoGuidesLoaded) {
    loadRepoGuides().then(() => {
      if (state.repoGuides && state.activeRepoId === item.id) openRepoPreview(item.id);
    });
  }
}

function closeRepoPreview() {
  if (!elements.repoDialog) return;
  if (typeof elements.repoDialog.close === "function" && elements.repoDialog.open) {
    elements.repoDialog.close();
  } else {
    elements.repoDialog.removeAttribute("open");
  }
  state.activeRepoId = null;
}

function renderAuthorsFeed() {
  if (!elements.feedList) return;
  const authors = visibleAuthors();
  if (elements.resultCount) {
    elements.resultCount.textContent = `${authors.length} 位作者 · 按你的关注与科研阶段排序`;
  }
  if (!authors.length) {
    renderEmptyState("没有匹配的作者", "换个主题再看看。");
    return;
  }

  elements.feedList.innerHTML = `
    <div class="authors-grid authors-grid--profile">
      ${authors
        .map((author) => {
          const info = authorProfileInfo(author);
          const topicMarkup = author.topicIds
            .map((id) => {
              const topic = getTopic(id);
              if (!topic) return "";
              return `<span style="--author-topic-color:${escapeHTML(topic.color)}">${escapeHTML(topic.label)}</span>`;
            })
            .join("");
          const relatedMarkup = info.related.length
            ? info.related
                .map(
                  (item) =>
                    `<button type="button" class="author-work-chip" data-preview-id="${escapeHTML(item.id)}">${escapeHTML(item.title)}</button>`,
                )
                .join("")
            : info.works
                .map((work) => `<span class="author-work-chip">${escapeHTML(work)}</span>`)
                .join("");
          return `
            <article class="author-card author-card--profile">
              <div class="author-card-head">
                <div class="author-avatar" style="--avatar-color:${escapeHTML(author.color)}" aria-hidden="true">${escapeHTML(author.initials)}</div>
                <div>
                  <div class="author-name-row">
                    <h3><a href="${escapeHTML(author.url)}" target="_blank" rel="noreferrer">${escapeHTML(author.name)}</a></h3>
                    <span class="author-match-chip">${escapeHTML(info.matchLabel)}</span>
                  </div>
                  <p class="author-handle">${escapeHTML(author.handle)}</p>
                </div>
              </div>
              <p class="author-now">${escapeHTML(info.whyNow)}</p>
              <div class="author-brief-grid">
                <div>
                  <span>关注能得到</span>
                  <p>${escapeHTML(info.what)}</p>
                </div>
                <div>
                  <span>适合你</span>
                  <p>${escapeHTML(info.bestFor)}</p>
                </div>
              </div>
              <div class="author-related-row">
                <span>可先看</span>
                ${relatedMarkup}
              </div>
              <div class="author-card-actions">
                <a class="brief-action" href="${escapeHTML(author.url)}" target="_blank" rel="noreferrer">打开 GitHub ${icons.arrow}</a>
                ${
                  info.related[0]
                    ? `<button class="brief-action brief-action--primary" type="button" data-preview-id="${escapeHTML(info.related[0].id)}">查看 ${escapeHTML(info.related[0].title)} 的部署指南</button>`
                    : ""
                }
              </div>
              <div class="author-topic-row">${topicMarkup}</div>
            </article>`;
        })
        .join("")}
    </div>`;
}

function renderEmptyState(
  title = state.view === "saved" ? "稍后读还是空的" : "这里暂时没有匹配内容",
  copy = state.view === "saved"
    ? "在精选项目右侧点书签，就会收进这里。"
    : "试试切换到“全部”主题继续浏览。",
) {
  if (!elements.feedList) return;
  elements.feedList.innerHTML = `
    <div class="empty-state">
      <div class="empty-mark">${icons.search}</div>
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(copy)}</p>
      <button class="button ghost" type="button" data-reset-filters>清空筛选</button>
    </div>`;
}

function renderTopicPulse() {
  if (!elements.topicPulse) return;
  const items = topicPoolItems();
  const topics = getVisibleTopics();
  const maxCount = Math.max(
    1,
    ...topics.map((topic) => items.filter((item) => item.topicIds.includes(topic.id)).length),
  );
  elements.topicPulse.innerHTML = topics
    .map((topic) => {
      const count = items.filter((item) => item.topicIds.includes(topic.id)).length;
      const width = Math.max(7, Math.round((count / maxCount) * 100));
      return `
        <button class="pulse-row" type="button" data-topic="${escapeHTML(topic.id)}">
          <span>${escapeHTML(topic.label)}</span>
          <i class="pulse-bar"><i style="--pulse-width:${width}%;--pulse-color:${escapeHTML(topic.color)}"></i></i>
          <small>${count}</small>
        </button>`;
    })
    .join("");
}

function renderAuthors() {
  if (!elements.authorPreview) return;
  const authors = visibleAuthors().slice(0, 3);
  elements.authorPreview.innerHTML = authors.length
    ? authors
        .map(
          (author) => {
            const info = authorProfileInfo(author);
            return `
            <a class="author-preview-row" href="${escapeHTML(author.url)}" target="_blank" rel="noreferrer">
              <span class="mini-avatar" style="--avatar-color:${escapeHTML(author.color)}">${escapeHTML(author.initials)}</span>
              <span class="author-preview-copy">
                <strong>${escapeHTML(author.name)}</strong>
                <span>${escapeHTML(info.matchLabel)} · ${escapeHTML(info.bestFor)}</span>
              </span>
              ${icons.arrow}
            </a>`;
          },
        )
        .join("")
    : '<p class="dialog-copy">当前主题下没有作者。</p>';
}

function renderPlan() {
  if (!elements.readingPlan || !state.data.readingPlan) return;
  const plan = state.data.readingPlan;
  if (elements.planProgress) {
    elements.planProgress.textContent = `${state.planDone.size}/${plan.steps.length}`;
  }
  elements.readingPlan.innerHTML = plan.steps
    .map(
      (step, index) => `
        <li class="plan-step ${state.planDone.has(index) ? "is-done" : ""}" tabindex="0" role="checkbox" aria-checked="${state.planDone.has(index)}" data-plan-step="${index}">
          <span class="plan-step-number">${state.planDone.has(index) ? "✓" : index + 1}</span>
          <span>
            <strong>${escapeHTML(step.label)}</strong>
            <p>${escapeHTML(step.detail)}</p>
          </span>
        </li>`,
    )
    .join("");
}

function syncViewControls() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    if (button.getAttribute("role") === "tab") {
      button.setAttribute("aria-selected", String(active));
    }
    let historyBadge = button.querySelector(".tab-history");
    if (!historyBadge) {
      historyBadge = document.createElement("small");
      historyBadge.className = "tab-history";
      button.appendChild(historyBadge);
    }
    if (button.dataset.view === "creator") {
      historyBadge.textContent = `${visibleAuthors().length} 位`;
    } else {
      const items = itemsForView(button.dataset.view);
      historyBadge.textContent = items.length
        ? `已推荐 ${recommendedCount("feed", items)}/${items.length}`
        : "0 条";
    }
  });
  document.querySelectorAll("[data-sort]").forEach((button) => {
    const active = button.dataset.sort === state.sort;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  updateRecommendationControls();
}

function updateRecommendationControls() {
  if (elements.refreshButton) {
    const items = state.view === "creator" ? [] : filteredItemsForView();
    const hasUnseen = items.some((item) => !hasRecommended("feed", item.id));
    const liveWaiting = state.feedSource === "live" && (state.liveLoading || !state.liveData);
    const liveRateExhausted = state.feedSource === "live" && rateLimitExhausted();
    elements.refreshButton.disabled =
      state.syncing ||
      liveWaiting ||
      state.view === "creator" ||
      (!hasUnseen && (state.feedSource === "archive" || liveRateExhausted));
    const label = elements.refreshButton.querySelector("span");
    if (label) {
      label.textContent = state.syncing
        ? state.feedSource === "live" ? "抓取中" : "整理中"
        : liveWaiting
          ? "连接 GitHub"
        : liveRateExhausted
          ? hasUnseen ? "继续浏览" : "额度已用完"
        : state.view === "creator"
          ? "作者列表"
          : hasUnseen
            ? state.feedSource === "live" ? "抓取新内容" : "换一批"
            : state.feedSource === "live" ? "继续抓取" : "已推荐完";
    }
  }

  if (elements.smallFindsRefresh && state.smallResources?.items?.length) {
    const items = smallFindsForCategory();
    const hasUnseen = items.some((item) => !hasRecommended("small", item.id));
    elements.smallFindsRefresh.disabled = !hasUnseen;
    const label = elements.smallFindsRefresh.querySelector("span");
    if (label) label.textContent = hasUnseen ? "换一组" : "已推荐完";
  }
}

// ============================================================================
// 9. User actions
// ============================================================================
function setView(view) {
  state.view = view;
  if (view === "creator") state.topic = "all";
  renderFrame();
}

function setTopic(topic) {
  state.topic = state.topic === topic ? "all" : topic;
  if (state.view === "creator") state.view = "all";
  renderFrame();
}

function setSort(sort) {
  if (!["combined", "personal", "authority", "recent"].includes(sort)) return;
  state.sort = sort;
  renderFrame();
}

function toggleSaved(itemId) {
  if (state.saved.has(itemId)) {
    state.saved.delete(itemId);
    showToast("已从稍后读移除");
  } else {
    state.saved.add(itemId);
    showToast("已加入稍后读");
  }
  writeJSON(STORAGE.saved, [...state.saved]);
  renderFrame();
}

function togglePlanStep(index) {
  if (state.planDone.has(index)) state.planDone.delete(index);
  else state.planDone.add(index);
  writeJSON(`${STORAGE.plan}${localDateKey()}`, [...state.planDone]);
  renderPlan();
}

function resetFilters() {
  state.view = "all";
  state.topic = "all";
  renderFrame();
}

function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

function setSyncing(value) {
  state.syncing = value;
  if (elements.refreshButton) {
    elements.refreshButton.classList.toggle("is-spinning", value);
  }
  updateRecommendationControls();
}

// ============================================================================
// 10. Live GitHub data
// ============================================================================
function livePageUrl(page, advance) {
  const profile = state.profile ?? {};
  const nextPage = advance ? (page % 5) + 1 : page;
  const focuses = (profile.focus ?? []).filter(Boolean);
  const focus = (focuses.length ? focuses : ["study"]).join(",");
  const intent = window.SIGNAL_ONBOARD?.interpretProfile?.(profile) ?? {};
  const params = new URLSearchParams({
    focus,
    major: profile.major ?? "general",
    stage: profile.researchStage ?? "exploring",
    need: profile.research?.block ?? "none",
    target: profile.target ?? "practical",
    terms: (intent.terms ?? []).join(","),
    majorText: profile.majorText ?? "",
    page: String(nextPage),
    _: String(Date.now()),
  });
  return {
    url: `/api/live-feed?${params.toString()}`,
    page: nextPage,
  };
}

async function loadLiveFeed({ advance = false } = {}) {
  if (state.liveLoading) return false;
  const request = livePageUrl(state.livePage, advance);
  state.liveLoading = true;
  state.liveError = null;
  state.feedSource = "live";
  writeJSON(STORAGE.feedSource, "live");
  renderFrame();

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(request.url, {
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || `HTTP ${response.status}`);
    if (!Array.isArray(payload.items) || !payload.items.length) {
      throw new Error("GitHub 本次没有返回可用的开源项目");
    }
    const pooledItems = new Map(
      (state.liveData?.items ?? []).map((item) => [item.id, item]),
    );
    payload.items.forEach((item) => pooledItems.set(item.id, item));
    state.liveData = {
      ...payload,
      items: [...pooledItems.values()],
      latestFetchedCount: payload.items.length,
      poolCount: pooledItems.size,
    };
    state.livePage = request.page;
    state.liveError = null;
    state.feedContextKey = "";
    state.feedSelection = [];
    state.feedHistoryMode = false;
    ensureFeedSelection(true);
    return true;
  } catch (error) {
    state.liveError = error.name === "AbortError"
      ? "实时请求超时（12 秒）"
      : error.message || "实时 GitHub 抓取失败";
    if (!state.liveData) {
      window.setTimeout(() => fallbackToArchive(state.liveError || "网络超时"), 0);
    }
    return false;
  } finally {
    window.clearTimeout(timeoutId);
    state.liveLoading = false;
    setSyncing(false);
    renderFrame();
  }
}

async function refreshLiveFeed() {
  if (state.liveLoading || state.syncing) return;
  setSyncing(true);
  const success = await loadLiveFeed({ advance: true });
  if (!success) {
    const unseenInPool = filteredItemsForView()
      .some((item) => !hasRecommended("feed", item.id));
    if (state.liveData && unseenInPool) {
      showToast(`实时抓取失败（${state.liveError}），继续用本次已抓到的未推荐项目`);
      return;
    }
    fallbackToArchive(state.liveError || "网络超时");
    return;
  }
  const batch = batchMetaForView();
  showToast(
    batch.items.length
      ? `GitHub 本次返回 ${state.liveData.latestFetchedCount} 个项目，累计 ${state.liveData.poolCount} 个，已补入 ${batch.items.length} 条未推荐内容`
      : "GitHub 实时数据已更新，但当前筛选暂时没有新的未推荐项目",
  );
}

function rateLimitExhausted() {
  const rate = state.liveData?.rateLimit;
  if (rate?.remaining !== 0) return false;
  const resetAt = Date.parse(rate.resetAt || "");
  return !Number.isFinite(resetAt) || Date.now() < resetAt;
}

function setFeedSource(source) {
  if (!["live", "archive"].includes(source)) return;
  if (state.feedSource === source) return;
  state.feedSource = source;
  writeJSON(STORAGE.feedSource, source);
  state.feedContextKey = "";
  state.feedSelection = [];
  state.feedHistoryMode = false;
  state.feedExhausted = false;
  if (source === "live" && !state.liveData && !state.liveLoading) {
    loadLiveFeed();
    return;
  }
  renderFrame();
}

// When live GitHub fails, auto-fallback to local archive so "换一批"
// can still serve un-recommended items from the curated data set.
function fallbackToArchive(reason) {
  if (state.feedSource === "archive") return;
  state.feedSource = "archive";
  writeJSON(STORAGE.feedSource, "archive");
  state.liveError = reason || state.liveError || "网络超时";
  state.feedContextKey = "";
  state.feedSelection = [];
  state.feedHistoryMode = false;
  state.feedExhausted = false;
  renderFrame();
  showToast(`已切换到本地存档兜底 · 原因: ${state.liveError}`);

  const looksLikeQuota = /rate limit|额度|403/i.test(state.liveError);
  if (looksLikeQuota && !state.githubAuth?.connected && !state.authPrompted) {
    state.authPrompted = true;
    window.setTimeout(() => {
      openGithubAuthDialog();
      setAuthFeedback("匿名额度已用完。粘贴 Token 后可以继续实时抓取。", "error");
    }, 400);
  }
}

function refreshFeed() {
  if (state.syncing) return;
  if (state.feedSource === "live") {
    if (rateLimitExhausted()) {
      const items = filteredItemsForView();
      const hasUnseen = items.some((item) => !hasRecommended("feed", item.id));
      if (!hasUnseen) {
          showToast("GitHub 额度已用完，抓取池也已推荐完");
          fallbackToArchive("GitHub 实时额度已用完");
        return;
      }
      ensureFeedSelection(true);
      renderFrame();
        showToast("GitHub 额度暂时用完，继续展示已实时抓取的未推荐项目");
      return;
    }
    refreshLiveFeed();
    return;
  }
  if (state.view === "creator") {
    showToast("作者列表没有分批推荐");
    return;
  }

  const items = filteredItemsForView();
  const unseen = items.filter((item) => !hasRecommended("feed", item.id));
  if (!unseen.length) {
    state.feedSelection = [];
    state.feedExhausted = items.length > 0;
    renderFrame();
    showToast("当前筛选已全部推荐过，可在标签页查看推荐进度");
    return;
  }

  setSyncing(true);
  ensureFeedSelection(true);
  renderFrame();
  const nextBatch = batchMetaForView();
  showToast(
    nextBatch.items.length
      ? `新增 ${nextBatch.items.length} 条未推荐内容，当前筛选剩余 ${nextBatch.remaining} 条`
      : "当前筛选已全部推荐过",
  );
  window.setTimeout(() => {
    setSyncing(false);
  }, 360);
}

// ============================================================================
// 11. Local data loaders
// ============================================================================
async function loadFeed() {
  try {
    const response = await fetch("/api/feed", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
  } catch (error) {
    console.warn("Feed API unavailable:", error);
    if (elements.feedList) {
      elements.feedList.innerHTML = `
        <div class="empty-state">
          <div class="empty-mark">${icons.close}</div>
          <h3>请通过本地服务打开页面</h3>
          <p>启动服务后刷新浏览器。页面需要读取 /api/feed 中的本地数据。</p>
        </div>`;
    }
    return;
  }

  state.planDone = new Set(readJSON(`${STORAGE.plan}${localDateKey()}`, []));
  renderFrame();
}

async function loadResearchKits() {
  try {
    const response = await fetch("/api/research-kits", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.researchKits = await response.json();
    if (state.data && !state.initializing) renderFrame();
  } catch (error) {
    console.warn("Research kits API unavailable:", error);
    if (elements.researchKit) elements.researchKit.hidden = true;
  }
}

async function loadSmallResources() {
  try {
    const response = await fetch("/api/small-resources", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.smallResources = await response.json();
    if (state.data && !state.initializing) renderSmallFinds();
  } catch (error) {
    console.warn("Small resources API unavailable:", error);
    if (elements.smallFinds) elements.smallFinds.hidden = true;
  }
}

async function loadRepoGuides() {
  try {
    const response = await fetch("/api/repo-guides", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.repoGuides = await response.json();
  } catch (error) {
    console.warn("Repository guides API unavailable:", error);
    state.repoGuides = null;
  } finally {
    state.repoGuidesLoaded = true;
  }
}

async function loadRepoSnapshots() {
  try {
    const response = await fetch("/api/repo-snapshots", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.repoSnapshots = await response.json();
  } catch (error) {
    console.warn("Repository snapshots API unavailable:", error);
    state.repoSnapshots = null;
  } finally {
    state.repoSnapshotsLoaded = true;
  }
}

// ============================================================================
// 12. Event wiring & bootstrap
// ============================================================================
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-edit-profile]")) {
    document.querySelector("#reconfigure-button")?.click();
    return;
  }

  const sourceButton = event.target.closest("[data-feed-source]");
  if (sourceButton) {
    setFeedSource(sourceButton.dataset.feedSource);
    return;
  }

  if (event.target.closest("[data-retry-live]")) {
    loadLiveFeed({ advance: false });
    return;
  }

  if (event.target.closest("[data-reset-recommendations]")) {
    resetRecommendationHistory();
    return;
  }

  if (event.target.closest("[data-show-feed-history]")) {
    showFeedHistory();
    return;
  }

  if (event.target.closest("[data-show-small-history]")) {
    showSmallHistory();
    return;
  }

  const installPromptButton = event.target.closest("[data-copy-install-prompt]");
  if (installPromptButton) {
    copyInstallPrompt(installPromptButton.dataset.copyInstallPrompt);
    return;
  }

  const previewButton = event.target.closest("[data-preview-id]");
  if (previewButton) {
    openRepoPreview(previewButton.dataset.previewId);
    return;
  }

  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    setView(viewButton.dataset.view);
    return;
  }

  const smallCategoryButton = event.target.closest("[data-small-category]");
  if (smallCategoryButton) {
    setSmallCategory(smallCategoryButton.dataset.smallCategory);
    return;
  }

  const sortButton = event.target.closest("[data-sort]");
  if (sortButton) {
    setSort(sortButton.dataset.sort);
    return;
  }

  const topicButton = event.target.closest("[data-topic]");
  if (topicButton) {
    setTopic(topicButton.dataset.topic);
    return;
  }

  const saveButton = event.target.closest("[data-save-id]");
  if (saveButton) {
    toggleSaved(saveButton.dataset.saveId);
    return;
  }

  const planStep = event.target.closest("[data-plan-step]");
  if (planStep) {
    togglePlanStep(Number(planStep.dataset.planStep));
    return;
  }

  if (event.target.closest("[data-reset-filters]")) {
    resetFilters();
    return;
  }

  const copyCommandButton = event.target.closest("[data-copy-command]");
  if (copyCommandButton) {
    const command = copyCommandButton.dataset.copyCommand;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(command)
        .then(() => showToast("命令已复制"))
        .catch(() => showToast("复制失败，请手动选择命令"));
    } else {
      showToast("当前浏览器不支持自动复制");
    }
    return;
  }

  const copyRepoButton = event.target.closest("[data-copy-repo-url]");
  if (copyRepoButton) {
    const repoUrl = copyRepoButton.dataset.copyRepoUrl;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(repoUrl)
        .then(() => showToast("仓库地址已复制"))
        .catch(() => showToast("复制失败，请手动打开 GitHub"));
    } else {
      showToast("当前浏览器不支持自动复制");
    }
    return;
  }

  const copyButton = event.target.closest("[data-copy-recipe]");
  if (copyButton) {
    const query = state.activeResearchKit?.searchRecipe?.query;
    if (!query) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(query)
        .then(() => showToast("检索式已复制"))
        .catch(() => showToast("复制失败，请手动选择检索式"));
    } else {
      showToast("当前浏览器不支持自动复制");
    }
  }
});

document.addEventListener(
  "pointermove",
  (event) => {
    if (!supportsFinePointer()) return;
    const card = event.target.closest?.(".spotlight-card, .feed-item");
    if (!card) return;

    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    motionState.pointerTarget = card;
    motionState.pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    motionState.pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    if (motionState.pointerFrame) return;

    motionState.pointerFrame = window.requestAnimationFrame(() => {
      motionState.pointerFrame = 0;
      const target = motionState.pointerTarget;
      if (!target) return;
      target.style.setProperty("--pointer-x", `${motionState.pointerX.toFixed(2)}%`);
      target.style.setProperty("--pointer-y", `${motionState.pointerY.toFixed(2)}%`);
      target.classList.add("is-pointer-active");
    });
  },
  { passive: true },
);

document.addEventListener(
  "pointerleave",
  (event) => {
    const card = event.target.closest?.(".spotlight-card, .feed-item");
    if (!card) return;
    card.classList.remove("is-pointer-active");
    if (motionState.pointerTarget === card) motionState.pointerTarget = null;
  },
  true,
);

document.addEventListener("keydown", (event) => {
  const planStep = event.target.closest("[data-plan-step]");
  if (planStep && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    togglePlanStep(Number(planStep.dataset.planStep));
  }
});

if (elements.refreshButton) {
  elements.refreshButton.addEventListener("click", refreshFeed);
}

if (elements.smallFindsRefresh) {
  elements.smallFindsRefresh.addEventListener("click", refreshSmallFinds);
}

if (elements.repoDialogClose) {
  elements.repoDialogClose.addEventListener("click", closeRepoPreview);
}

if (elements.repoDialog) {
  elements.repoDialog.addEventListener("click", (event) => {
    if (event.target === elements.repoDialog) closeRepoPreview();
  });
}

elements.githubAuthButtons.forEach((button) => {
  button.addEventListener("click", openGithubAuthDialog);
});

if (elements.githubAuthClose) {
  elements.githubAuthClose.addEventListener("click", () => elements.githubAuthDialog?.close?.());
}

if (elements.githubAuthDialog) {
  elements.githubAuthDialog.addEventListener("click", (event) => {
    if (event.target === elements.githubAuthDialog) elements.githubAuthDialog.close();
  });
}

if (elements.githubAuthSave) {
  elements.githubAuthSave.addEventListener("click", saveGithubToken);
}

if (elements.githubTokenInput) {
  elements.githubTokenInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveGithubToken();
    }
  });
}

if (elements.githubAuthDisconnect) {
  elements.githubAuthDisconnect.addEventListener("click", disconnectGithub);
}

async function initializeRadar() {
  state.initializing = true;
  await Promise.all([loadFeed(), loadGithubAuth()]);
  await Promise.all([
    loadResearchKits(),
    loadSmallResources(),
    loadRepoGuides(),
    loadRepoSnapshots(),
  ]);
  state.initializing = false;

  const profileReady = window.SIGNAL_ONBOARD?.isProfileComplete?.(state.profile);
  if (profileReady && state.feedSource === "live") {
    loadLiveFeed();
  } else {
    renderFrame();
  }
}

initializeRadar();
