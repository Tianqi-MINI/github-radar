const STORAGE_KEYS = {
  profile: "signal-radar-profile-v1",
  saved: "signal-radar-saved-v1",
  hiddenTopics: "signal-radar-hidden-topics-v1",
  plan: "signal-radar-plan-",
};

const PROFILE_LABELS = {
  os: { windows: "Windows", macos: "macOS", linux: "Linux", other: "其他系统" },
  python: {
    latest: "Python 3.10+",
    39: "Python 3.9",
    38: "Python 3.8",
    none: "未配置 Python",
    unknown: "Python 版本未知",
  },
  major: {
    "food-science": "食品科学与工程",
    "cs-ai": "计算机 / 人工智能",
    marine: "海洋 / 水产 / 环境",
    business: "经济 / 管理 / 商科",
    design: "设计 / 传媒 / 艺术",
    general: "其他 / 交叉学科",
  },
  researchStage: {
    exploring: "探索方向",
    question: "选题与查资料",
    literature: "文献综述",
    experiment: "实验 / 数据收集",
    analysis: "数据分析",
    writing: "论文写作",
    communication: "汇报与答辩",
    none: "暂不参与科研",
  },
  target: {
    practical: "立即落地",
    career: "求职与实习",
    academic: "课程与科研",
    fun: "兴趣深耕",
  },
  focus: {
    study: "学习 AI / 编程",
    product: "小产品 / 副业",
    presentation: "PPT / 演讲",
    research: "科研与论文",
    content: "自媒体 / 内容",
    music: "音乐制作",
  },
  aiTools: {
    codex: "Codex",
    deepseek: "DeepSeek",
    cursor: "Cursor",
    claude: "Claude",
    gpt: "ChatGPT",
    notion: "Notion AI",
    others: "其他 AI 工具",
  },
};

const TOPIC_FOCUS_MAP = {
  study: ["ai-tools", "micro-product"],
  product: ["micro-product", "ai-tools"],
  presentation: ["presentation", "content"],
  research: ["research", "ai-tools"],
  content: ["content", "presentation", "ai-tools"],
  music: ["music", "content"],
};

const FOCUS_INTENTS = [
  {
    id: "presentation",
    label: "PPT / 演讲",
    topics: ["presentation"],
    keywords: ["ppt", "演示", "汇报", "演讲", "路演", "组会", "答辩", "幻灯片", "图表", "绘图", "slide", "keynote", "marp", "slidev"],
    terms: ["presentation", "slide", "pptx"],
  },
  {
    id: "research",
    label: "科研与论文",
    topics: ["research"],
    keywords: ["科研", "论文", "文献", "实验", "数据分析", "统计", "毕业设计", "大创", "课题", "综述", "引用", "zotero"],
    terms: ["research", "paper", "literature"],
  },
  {
    id: "product",
    label: "小产品 / 副业",
    topics: ["micro-product"],
    keywords: ["小产品", "小工具", "上线", "网站", "app", "小程序", "副业", "创业", "saas", "全栈", "web"],
    terms: ["web app", "saas", "full stack"],
  },
  {
    id: "content",
    label: "自媒体 / 内容",
    topics: ["content"],
    keywords: ["自媒体", "短视频", "视频", "剪辑", "公众号", "图文", "字幕", "内容", "小红书", "b站", "抖音", "播客"],
    terms: ["content creation", "video editing", "subtitle"],
  },
  {
    id: "music",
    label: "音乐制作",
    topics: ["music"],
    keywords: ["音乐", "编曲", "作曲", "音频", "midi", "音效", "remix", "混音", "配乐", "daw", "音色"],
    terms: ["music production", "audio", "midi"],
  },
  {
    id: "study",
    label: "学习 AI / 编程",
    topics: ["ai-tools"],
    keywords: ["ai", "人工智能", "编程", "代码", "python", "codex", "deepseek", "agent", "自动化", "学习", "提示词", "llm"],
    terms: ["ai agent", "coding agent", "python"],
  },
];

const MAJOR_INTENTS = [
  {
    id: "food-science",
    label: "食品科学与工程",
    topics: ["research", "ai-tools"],
    keywords: ["食品", "营养", "感官", "微生物", "食品安全", "food", "nutrition", "sensory", "microbiology"],
  },
  {
    id: "cs-ai",
    label: "计算机 / 人工智能",
    topics: ["ai-tools", "micro-product"],
    keywords: ["计算机", "软件", "人工智能", "数据科学", "算法", "编程", "computer", "software", "ai", "data science", "coding"],
  },
  {
    id: "marine",
    label: "海洋 / 水产 / 环境",
    topics: ["research", "ai-tools"],
    keywords: ["海洋", "水产", "环境", "生态", "遥感", "marine", "ocean", "fishery", "environment", "remote sensing"],
  },
  {
    id: "business",
    label: "经济 / 管理 / 商科",
    topics: ["micro-product", "research"],
    keywords: ["经济", "管理", "会计", "金融", "商科", "business", "finance", "accounting", "management"],
  },
  {
    id: "design",
    label: "设计 / 传媒 / 艺术",
    topics: ["content", "presentation"],
    keywords: ["设计", "传媒", "新闻", "艺术", "视觉", "设计学", "design", "media", "art", "visual"],
  },
];

const TARGET_INTENTS = [
  {
    id: "practical",
    label: "马上做出来/用起来",
    topics: ["micro-product", "presentation"],
    keywords: ["马上", "立刻", "落地", "先做", "演示", "能跑", "上线", "作业", "这周", "组会", "practical", "demo"],
  },
  {
    id: "career",
    label: "求职 / 实习 / 作品集",
    topics: ["micro-product", "ai-tools"],
    keywords: ["求职", "实习", "简历", "面试", "作品集", "就业", "career", "internship", "portfolio", "job"],
  },
  {
    id: "academic",
    label: "课程 / 科研 / 论文",
    topics: ["research", "presentation"],
    keywords: ["课程", "科研", "论文", "毕业", "大创", "竞赛", "答辩", "文献", "保研", "考研", "升学", "academic", "paper", "thesis"],
  },
  {
    id: "fun",
    label: "兴趣 / 玩得深入",
    topics: ["music", "content"],
    keywords: ["兴趣", "好玩", "玩", "爱好", "音乐", "编曲", "自媒体", "创意", "fun", "hobby", "creative"],
  },
];

const RESEARCH_STAGE_RULES = {
  exploring: {
    label: "探索方向",
    topics: ["research", "ai-tools"],
    keywords: ["guide", "awesome", "roadmap", "tutorial", "curated", "prompt", "research", "入门", "指南", "清单", "选题"],
    reason: "能帮你快速建立方向的指南、清单和入门工具",
  },
  question: {
    label: "选题与查资料",
    topics: ["research"],
    keywords: ["paper", "literature", "survey", "arxiv", "scholar", "research", "citation", "文献", "选题", "综述"],
    reason: "选题、查文献和搭建研究框架的工具",
  },
  literature: {
    label: "文献综述",
    topics: ["research"],
    keywords: ["citation", "zotero", "bibtex", "paper", "literature", "survey", "arxiv", "reference", "文献", "引用", "综述"],
    reason: "文献检索、引用管理和综述整理工具",
  },
  experiment: {
    label: "实验 / 数据收集",
    topics: ["research"],
    keywords: ["experiment", "laboratory", "sensor", "data collection", "notebook", "jupyter", "experiment", "实验", "数据采集", "传感器", "记录"],
    reason: "实验记录、数据采集和可复现流程",
  },
  analysis: {
    label: "数据分析",
    topics: ["research"],
    keywords: ["data analysis", "pandas", "statistics", "visualization", "matplotlib", "seaborn", "jupyter", "notebook", "数据", "统计", "可视化", "分析"],
    reason: "数据清洗、统计分析和可视化工具",
  },
  writing: {
    label: "论文写作",
    topics: ["research", "presentation"],
    keywords: ["latex", "overleaf", "writing", "paper", "markdown", "citation", "zotero", "论文", "写作", "排版", "引用"],
    reason: "论文写作、排版和引用工具",
  },
  communication: {
    label: "汇报与答辩",
    topics: ["presentation", "research"],
    keywords: ["slide", "presentation", "ppt", "marp", "slidev", "chart", "dashboard", "汇报", "答辩", "图表", "演示"],
    reason: "图表、PPT 和答辩汇报工具",
  },
  none: { label: "暂不参与科研", topics: [], keywords: [], reason: "通用学习或项目工具" },
};

const BLOCK_LABELS = {
  direction: "找方向",
  literature: "读文献",
  design: "实验设计",
  data: "数据分析",
  writing: "写作表达",
  presentation: "图表与汇报",
  none: "没有明显卡点",
};

const TIME_LABELS = {
  low: "每周 2 小时以内",
  medium: "每周 2–5 小时",
  high: "每周 5–10 小时",
  intense: "每周 10 小时以上",
};

const OUTPUT_LABELS = {
  course: "课程作业 / 课程论文",
  competition: "学科竞赛",
  project: "大创 / 课题组任务",
  thesis: "毕业设计 / 毕业论文",
  paper: "准备投稿的论文",
  none: "暂无明确交付",
};

const LEGACY_FOCUS_TEXT = {
  study: "学习 AI 与编程",
  product: "做一个小产品",
  presentation: "做课程汇报 PPT",
  research: "科研与论文写作",
  content: "做自媒体内容",
  music: "音乐制作与编曲",
};

const LEGACY_MAJOR_TEXT = {
  "food-science": "食品科学与工程",
  "cs-ai": "计算机科学与技术",
  general: "交叉学科",
};

const LEGACY_TARGET_TEXT = {
  practical: "能马上落地使用",
  career: "对求职和实习有帮助",
  academic: "对课程和科研有帮助",
  fun: "兴趣深耕",
};

const LEGACY_RESEARCH = {
  starter: { clarity: "none", block: "direction", time: "low", output: "course" },
  course: { clarity: "topic", block: "literature", time: "medium", output: "course" },
  lab: { clarity: "experiment", block: "data", time: "high", output: "project" },
  thesis: { clarity: "writing", block: "writing", time: "high", output: "thesis" },
  exploring: { clarity: "none", block: "direction", time: "low", output: "none" },
};

const ITEM_TOOL_AFFINITY = {
  "prompt-papers": ["codex", "deepseek", "cursor", "claude", "gpt", "notion"],
  supabase: ["codex", "cursor", "claude", "deepseek", "gpt"],
  slidev: ["notion", "gpt", "claude", "others"],
  marp: ["notion", "gpt", "claude", "others"],
  pptxgenjs: ["notion", "gpt", "claude", "others"],
  zotero: ["notion", "gpt", "deepseek"],
  langgraph: ["codex", "deepseek", "claude", "gpt"],
  audiocraft: ["gpt", "claude", "others"],
  lmms: ["others"],
  spleeter: ["gpt", "claude", "others"],
  "shadcn-ui": ["codex", "cursor", "claude", "gpt"],
  nextjs: ["codex", "cursor", "claude", "deepseek", "gpt"],
  logseq: ["notion", "gpt", "deepseek"],
  appwrite: ["codex", "cursor", "claude", "deepseek", "gpt"],
  "future-agi": ["codex", "deepseek", "claude", "gpt"],
  t3code: ["codex", "cursor", "claude"],
  openchatcut: ["deepseek", "claude", "gpt", "others"],
  nod: ["codex", "cursor", "claude", "gpt"],
};

const KNOWN_ITEMS = [
  { id: "marp", label: "Marp", aliases: ["marp"] },
  { id: "slidev", label: "Slidev", aliases: ["slidev"] },
  { id: "pptxgenjs", label: "PptxGenJS", aliases: ["pptxgenjs"] },
  { id: "zotero", label: "Zotero", aliases: ["zotero"] },
  { id: "logseq", label: "Logseq", aliases: ["logseq"] },
  { id: "supabase", label: "Supabase", aliases: ["supabase"] },
  { id: "appwrite", label: "Appwrite", aliases: ["appwrite"] },
  { id: "nextjs", label: "Next.js", aliases: ["next.js", "nextjs"] },
  { id: "shadcn-ui", label: "shadcn/ui", aliases: ["shadcn/ui", "shadcn"] },
  { id: "langgraph", label: "LangGraph", aliases: ["langgraph"] },
  { id: "audiocraft", label: "AudioCraft", aliases: ["audiocraft", "musicgen"] },
  { id: "lmms", label: "LMMS", aliases: ["lmms"] },
  { id: "spleeter", label: "Spleeter", aliases: ["spleeter"] },
  { id: "openchatcut", label: "OpenChatCut", aliases: ["openchatcut", "open chat cut"] },
  { id: "future-agi", label: "Future AGI", aliases: ["future agi", "future-agi"] },
  { id: "t3code", label: "t3code", aliases: ["t3code", "t3 code"] },
  { id: "nod", label: "Nod", aliases: ["nod"] },
  {
    id: "prompt-papers",
    label: "Prompt Engineering Guide",
    aliases: ["prompt engineering guide", "prompt-engineering-guide"],
  },
];

const SETUP_PROMPT = `你是我的本地 AI 配置盘点助手。请只做只读检查，不要安装、修改、删除任何文件或环境。
不要输出 API Key、Token、密码、用户名、完整文件路径、私有仓库内容或任何敏感信息；不确定就写“不确定”。

请盘点并汇总：
1. Codex / Claude / Cursor 等 AI 工具里已有的 Skills（名称 + 一句话用途）
2. 已安装的 VS Code、Obsidian、浏览器插件
3. 已安装且与科研、AI、PPT、数据分析、音视频相关的 Python 包
4. 全局 Node/npm/pnpm 包
5. Docker 容器或自托管服务
6. 已 Star 或常用的 GitHub 仓库（只输出 owner/repo）

Windows 可优先使用只读命令，例如：
- Get-ChildItem 查看 skills / extensions 目录
- code --list-extensions
- pip list
- npm ls -g --depth=0
- docker ps

请严格按下面格式输出，便于我粘贴回网站：
已有 Skills: skill-a, skill-b
已有插件: plugin-a, plugin-b
Python 相关包: package-a, package-b
Node 全局包: package-c, package-d
Docker: service-a, service-b
GitHub 仓库: owner/repo-a, owner/repo-b
总体说明: 5 行以内，说明我最常用的工具和明显缺口。`;

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readProfile() {
  return readJSON(STORAGE_KEYS.profile, null);
}

function saveProfile(profile) {
  writeJSON(STORAGE_KEYS.profile, profile);
}

function clearProfile() {
  localStorage.removeItem(STORAGE_KEYS.profile);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalized(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function keywordHits(text, keywords) {
  const base = normalized(text);
  if (!base) return [];
  return unique(keywords.filter((keyword) => base.includes(normalized(keyword))));
}

function asciiTerms(text) {
  const stop = new Set(["the", "and", "for", "with", "from", "this", "that", "you", "your", "are", "how", "use", "using"]);
  return unique(
    normalized(text)
      .match(/[a-z][a-z0-9+#.-]{2,}/g)
      ?.filter((term) => !stop.has(term)) ?? [],
  ).slice(0, 8);
}

function matchRules(text, rules) {
  const base = normalized(text);
  if (!base) return [];
  return rules
    .map((rule) => {
      const hits = keywordHits(base, rule.keywords);
      return { ...rule, hits, score: hits.length };
    })
    .filter((rule) => rule.score > 0)
    .sort((left, right) => right.score - left.score);
}

function parseExistingSetup(text) {
  const source = String(text ?? "").slice(0, 20000);
  const lower = normalized(source);
  const repos = new Set();
  const names = new Set();
  const labels = new Set();

  for (const match of source.matchAll(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/gi)) {
    const repo = match[1].replace(/\.git$/i, "");
    if (!/^\/(?:users|appdata|program|home|usr|var|opt|mnt|tmp)\//i.test(`/${repo}/`)) {
      repos.add(repo.toLowerCase());
    }
  }

  const repoLines = source
    .split(/\r?\n/)
    .filter((line) => /(github|仓库|repos?|repositories|stars?)/i.test(line));
  repoLines.forEach((line) => {
    const matches = line.match(/(?<![A-Za-z0-9_.-])([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?![A-Za-z0-9_.-])/g) ?? [];
    matches.forEach((value) => {
      const [owner, repo] = value.replace(/\.git$/i, "").split("/");
      if (
        owner &&
        repo &&
        !/^(users|appdata|program|home|usr|var|opt|mnt|tmp|documents|desktop|downloads|projects)$/i.test(owner)
      ) {
        repos.add(`${owner}/${repo}`.toLowerCase());
      }
    });
  });

  const hasAlias = (alias) => {
    const value = normalized(alias);
    if (!value) return false;
    if (/^[a-z0-9.+#/-]+$/.test(value) && value.length <= 5) {
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(lower);
    }
    return lower.includes(value);
  };

  KNOWN_ITEMS.forEach((item) => {
    if (item.aliases.some(hasAlias)) {
      names.add(item.id);
      labels.add(item.label);
    }
  });

  repos.forEach((repo) => {
    names.add(repo);
    labels.add(repo);
  });

  return {
    repos: [...repos],
    names: [...names],
    labels: [...labels],
    count: labels.size,
  };
}

function normalizeResearch(raw = {}) {
  const legacy = LEGACY_RESEARCH[raw.researchStage] ?? {};
  return {
    clarity: raw.research?.clarity ?? raw.researchClarity ?? legacy.clarity ?? "none",
    block: raw.research?.block ?? raw.researchBlock ?? legacy.block ?? "direction",
    time: raw.research?.time ?? raw.researchTime ?? legacy.time ?? "low",
    output: raw.research?.output ?? raw.researchOutput ?? legacy.output ?? "none",
    note: String(raw.research?.note ?? raw.researchNote ?? "").trim(),
  };
}

function deriveResearchStage(research = {}) {
  const note = normalized(research.note);
  const noteBlock =
    /ppt|答辩|汇报|图表/.test(note)
      ? "presentation"
      : /数据|统计|可视化|清洗/.test(note)
        ? "data"
        : /文献|引用|综述/.test(note)
          ? "literature"
          : /写作|论文|latex|排版/.test(note)
            ? "writing"
            : /实验设计|变量|方案/.test(note)
              ? "design"
              : /选题|方向|不知道做什么/.test(note)
                ? "direction"
                : "";
  const noteClarity =
    /文献综述|读文献|查文献/.test(note)
      ? "topic"
      : /写论文|写报告|答辩|组会汇报|准备汇报/.test(note)
      ? "writing"
      : /收数据|做实验|实验进行/.test(note)
        ? "experiment"
        : /拿到结果|分析数据/.test(note)
          ? "analysis"
          : "";
  const effectiveResearch = {
    ...research,
    clarity: research.clarity === "none" && noteClarity ? noteClarity : research.clarity,
    block: research.block === "none" && noteBlock ? noteBlock : research.block,
  };
  const clarityToStage = {
    none: "exploring",
    direction: "question",
    topic: "literature",
    experiment: "experiment",
    analysis: "analysis",
    writing: "writing",
  };
  let stage = clarityToStage[effectiveResearch.clarity] ?? "exploring";
  if (effectiveResearch.clarity === "none" && effectiveResearch.block === "none") stage = "none";
  if (effectiveResearch.block === "presentation" && ["topic", "analysis", "writing"].includes(effectiveResearch.clarity)) {
    stage = "communication";
  } else if (effectiveResearch.block === "data" && ["topic", "experiment"].includes(effectiveResearch.clarity)) {
    stage = "analysis";
  } else if (effectiveResearch.block === "literature" && effectiveResearch.clarity === "direction") {
    stage = "literature";
  }
  const rule = RESEARCH_STAGE_RULES[stage] ?? RESEARCH_STAGE_RULES.exploring;
  return {
    ...effectiveResearch,
    stage,
    label: rule.label,
    need: effectiveResearch.block ?? "none",
    needLabel: BLOCK_LABELS[effectiveResearch.block] ?? BLOCK_LABELS.none,
    timeLabel: TIME_LABELS[effectiveResearch.time] ?? TIME_LABELS.low,
    outputLabel: OUTPUT_LABELS[effectiveResearch.output] ?? OUTPUT_LABELS.none,
  };
}

function interpretProfile(raw = {}) {
  const majorText =
    String(raw.majorText ?? "").trim() ||
    LEGACY_MAJOR_TEXT[raw.major] ||
    "";
  const focusText =
    String(raw.focusText ?? "").trim() ||
    (raw.focus ?? []).map((value) => LEGACY_FOCUS_TEXT[value]).filter(Boolean).join("、");
  const targetText =
    String(raw.targetText ?? "").trim() ||
    LEGACY_TARGET_TEXT[raw.target] ||
    "";
  const research = normalizeResearch(raw);
  const stageInfo = deriveResearchStage(research);

  const majorMatches = matchRules(majorText, MAJOR_INTENTS);
  const focusMatches = matchRules(focusText, FOCUS_INTENTS);
  const targetMatches = matchRules(targetText, TARGET_INTENTS);
  const majorKey = majorMatches[0]?.id ?? (PROFILE_LABELS.major[raw.major] ? raw.major : "general");
  const targetKey = targetMatches[0]?.id ?? (PROFILE_LABELS.target[raw.target] ? raw.target : "practical");

  const fallbackTopics =
    majorMatches[0]?.topics ??
    targetMatches[0]?.topics ??
    ["ai-tools"];
  const legacyFocusTopics =
    focusMatches.length === 0
      ? (raw.focus ?? []).flatMap((value) => TOPIC_FOCUS_MAP[value] ?? [])
      : [];
  const focusTopics = unique([
    ...focusMatches.flatMap((match) => match.topics),
    ...legacyFocusTopics,
    ...fallbackTopics,
  ]);
  const terms = unique([
    ...focusMatches.flatMap((match) => match.terms ?? []),
    ...asciiTerms(focusText),
    ...(majorMatches[0] ? asciiTerms(majorText) : []),
  ]).slice(0, 8);

  return {
    majorText,
    focusText,
    targetText,
    research,
    majorKey,
    majorLabel: majorMatches[0]?.label || majorText || PROFILE_LABELS.major[majorKey] || "未填写专业",
    focusTopics: focusTopics.length ? focusTopics : ["ai-tools"],
    focusLabels: focusMatches.length
      ? focusMatches.map((match) => match.label)
      : focusText
        ? ["自定义关注"]
        : [],
    focusMatches,
    targetKey,
    targetLabel: targetMatches[0]?.label || targetText || PROFILE_LABELS.target[targetKey] || "未填写目标",
    targetMatches,
    stageInfo,
    majorMatches,
    terms,
    keywords: unique([
      ...focusMatches.flatMap((match) => match.keywords),
      ...majorMatches.flatMap((match) => match.keywords),
      ...targetMatches.flatMap((match) => match.keywords),
      ...asciiTerms(`${focusText} ${majorText} ${targetText}`),
    ]).slice(0, 24),
  };
}

function isProfileComplete(profile) {
  if (!profile) return false;
  const research = normalizeResearch(profile);
  return Boolean(
    profile.os &&
      profile.python &&
      String(profile.majorText ?? "").trim() &&
      String(profile.focusText ?? "").trim() &&
      String(profile.targetText ?? "").trim() &&
      research.clarity &&
      research.block &&
      research.time &&
      research.output,
  );
}

function itemText(item) {
  return normalized(
    [
      item.title,
      item.description,
      item.repo,
      item.language,
      ...(item.tags ?? []),
      ...(item.topics ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function scoreMajor(intent, text, topics) {
  const rule = MAJOR_INTENTS.find((entry) => entry.id === intent.majorKey);
  let score = 0;
  if (rule) score += Math.min(8, keywordHits(text, rule.keywords).length * 3);
  if (rule?.topics?.some((topic) => topics.includes(topic))) score += 4;
  return Math.min(12, score);
}

function scoreStage(stageInfo, text, topics) {
  const rule = RESEARCH_STAGE_RULES[stageInfo.stage] ?? RESEARCH_STAGE_RULES.exploring;
  let score = 0;
  const stageHits = keywordHits(text, rule.keywords);
  const topicHit = rule.topics.some((topic) => topics.includes(topic));
  if (stageHits.length) {
    score += topicHit ? 3 : 0;
    score += Math.min(9, stageHits.length * 3);
  } else if (topicHit) {
    score += 1;
  }
  const blockKeywords = {
    direction: ["guide", "awesome", "roadmap", "tutorial", "入门", "指南"],
    literature: ["citation", "zotero", "paper", "literature", "文献", "引用"],
    design: ["experiment", "design", "protocol", "实验", "设计"],
    data: ["pandas", "statistics", "visualization", "data", "数据", "统计", "可视化"],
    writing: ["latex", "writing", "markdown", "paper", "写作", "排版"],
    presentation: ["slide", "presentation", "ppt", "chart", "汇报", "图表"],
  };
  score += Math.min(4, keywordHits(text, blockKeywords[stageInfo.need] ?? []).length * 2);
  if (stageInfo.time === "low" && /template|plugin|skill|cli|extension|模板|插件/.test(text)) score += 2;
  return Math.min(16, score);
}

function scoreTarget(intent, text, topics) {
  const rule = TARGET_INTENTS.find((entry) => entry.id === intent.targetKey);
  let score = 0;
  if (rule) score += Math.min(6, keywordHits(text, rule.keywords).length * 2);
  if (rule?.topics?.some((topic) => topics.includes(topic))) score += 6;
  return Math.min(12, score);
}

function runtimeForItem(item) {
  const text = itemText(item);
  if (/docker/.test(text)) return "docker";
  if (/python|jupyter/.test(normalized(item.language)) || /pip install|uv pip/.test(text)) return "python";
  if (/typescript|javascript/.test(normalized(item.language)) || /node\.js|npm|pnpm|next\.js|react/.test(text)) return "node";
  if (/desktop|electron|tauri/.test(text)) return "desktop";
  return "generic";
}

function buildPersonalization(item, profile) {
  if (!profile) {
    return {
      score: Math.round(item.signal ?? 0),
      fitLabel: "等待配置",
      reasons: ["完成配置后会生成个性化推荐理由"],
      components: {},
      matchedTools: [],
      matchedFocus: [],
    };
  }

  const intent = interpretProfile(profile);
  const topics = item.topicIds ?? [];
  const text = itemText(item);
  const profileTools = profile.aiTools ?? [];
  const matchedFocus = intent.focusTopics.filter((topic) => topics.includes(topic));
  const staticTools = ITEM_TOOL_AFFINITY[item.id] ?? [];
  const genericTools = profileTools.filter((tool) => {
    if (tool === "codex" || tool === "cursor" || tool === "claude" || tool === "deepseek") {
      return /agent|coding|cli|api|python|typescript|javascript|next\.js|react|developer/.test(text);
    }
    if (tool === "notion") return /note|knowledge|writing|markdown|documentation/.test(text);
    return /ai|llm|model|prompt/.test(text);
  });
  const matchedTools = unique([...staticTools, ...genericTools]).filter((tool) => profileTools.includes(tool));

  const focusPoints = Math.min(30, matchedFocus.length * 10);
  const toolPoints = matchedTools.length ? 18 : 0;
  const majorPoints = scoreMajor(intent, text, topics);
  const stagePoints = scoreStage(intent.stageInfo, text, topics);
  const targetPoints = scoreTarget(intent, text, topics);
  const runtime = runtimeForItem(item);
  const osPoints = intent.stageInfo ? 5 : 3;
  const needsPython = runtime === "python";
  let pythonPoints = needsPython ? 0 : 3;
  if (profile.python === "none") pythonPoints = needsPython ? -14 : 6;
  else if (needsPython) pythonPoints = profile.python === "38" ? -4 : 6;

  const rawScore = 16 + focusPoints + toolPoints + majorPoints + stagePoints +
    targetPoints + osPoints + pythonPoints;
  const score = Math.round(Math.min(100, Math.max(12, rawScore)));
  const reasons = [];

  if (stagePoints >= 4) {
    reasons.push(
      `你现在处于「${intent.stageInfo.label}」，最需要「${intent.stageInfo.needLabel}」，优先推荐${RESEARCH_STAGE_RULES[intent.stageInfo.stage].reason}`,
    );
  }
  if (matchedFocus.length) {
    const labels = matchedFocus
      .map((topic) => PROFILE_LABELS.focus[topic] ?? topic)
      .join("、");
    reasons.push(`匹配你写的「${intent.focusText}」，识别为 ${labels}`);
  }
  if (majorPoints >= 5) reasons.push(`和你的专业「${intent.majorText}」相关`);
  if (targetPoints >= 5) reasons.push(`优先服务你写的「${intent.targetText}」`);
  if (matchedTools.length) {
    reasons.push(`可配合你在用的 ${matchedTools.map((tool) => PROFILE_LABELS.aiTools[tool] ?? tool).join("、")}`);
  }
  reasons.push(
    `${PROFILE_LABELS.os[profile.os] ?? "当前系统"}可按${
      { desktop: "桌面安装包", node: "Node.js 项目", python: "Python 环境", docker: "Docker 服务", generic: "通用方式" }[runtime]
    }运行`,
  );

  const fitLabel = score >= 85 ? "高度匹配" : score >= 70 ? "比较匹配" : score >= 55 ? "有参考价值" : "一般相关";
  return {
    score,
    fitLabel,
    reasons: reasons.slice(0, 6),
    components: {
      focus: focusPoints,
      tools: toolPoints,
      major: majorPoints,
      stage: stagePoints,
      target: targetPoints,
      environment: osPoints + pythonPoints,
    },
    matchedTools,
    matchedFocus,
    stage: intent.stageInfo.stage,
    intent,
  };
}

function scoreItem(item, profile) {
  return buildPersonalization(item, profile).score;
}

function computeSortedItems(data, profile) {
  if (!data?.items) return [];
  return [...data.items].sort((left, right) => scoreItem(right, profile) - scoreItem(left, profile));
}

function showOnboard() {
  const form = document.getElementById("onboard-form");
  const radarPage = document.getElementById("radar-page");
  const onboardingPage = document.querySelector("[data-onboarding-page]");
  if (!form || !radarPage) return;
  if (onboardingPage) onboardingPage.hidden = false;
  radarPage.hidden = true;
  form.style.display = "";
}

function showRadar() {
  const form = document.getElementById("onboard-form");
  const radarPage = document.getElementById("radar-page");
  const onboardingPage = document.querySelector("[data-onboarding-page]");
  if (!form || !radarPage) return;
  if (onboardingPage) onboardingPage.hidden = true;
  form.style.display = "none";
  radarPage.hidden = false;
}

function showFormNotice(message) {
  const form = document.getElementById("onboard-form");
  if (!form) return;
  let notice = document.getElementById("onboard-notice");
  if (!notice) {
    notice = document.createElement("p");
    notice.id = "onboard-notice";
    notice.setAttribute("role", "alert");
    notice.style.cssText =
      "grid-column:1/-1;margin:-6px 0 0;color:#a94336;font-size:11px;font-weight:650;";
    form.appendChild(notice);
  }
  notice.textContent = message;
}

function populateForm(profile) {
  if (!profile) return;
  const intent = interpretProfile(profile);
  const osSelect = document.getElementById("os-select");
  const pythonSelect = document.getElementById("python-select");
  const majorInput = document.getElementById("major-text");
  const focusInput = document.getElementById("focus-text");
  const targetInput = document.getElementById("target-text");
  const existingInput = document.getElementById("existing-setup");
  if (osSelect) osSelect.value = profile.os ?? "windows";
  if (pythonSelect) pythonSelect.value = profile.python ?? "latest";
  if (majorInput) majorInput.value = intent.majorText;
  if (focusInput) focusInput.value = intent.focusText;
  if (targetInput) targetInput.value = intent.targetText;
  if (existingInput) existingInput.value = String(profile.existingSetupText ?? "");
  const research = normalizeResearch(profile);
  const clarity = document.getElementById("research-clarity");
  const block = document.getElementById("research-block");
  const time = document.getElementById("research-time");
  const output = document.getElementById("research-output");
  const note = document.getElementById("research-note");
  if (clarity) clarity.value = research.clarity;
  if (block) block.value = research.block;
  if (time) time.value = research.time;
  if (output) output.value = research.output;
  if (note) note.value = research.note;
  if (Array.isArray(profile.aiTools)) {
    document.querySelectorAll('input[name="aiTools"]').forEach((checkbox) => {
      checkbox.checked = profile.aiTools.includes(checkbox.value);
    });
  }
}

function formRawData() {
  const form = document.getElementById("onboard-form");
  if (!form) return null;
  const data = new FormData(form);
  return {
    os: data.get("os") ?? "windows",
    python: data.get("python") ?? "latest",
    aiTools: Array.from(form.querySelectorAll('input[name="aiTools"]:checked')).map((el) => el.value),
    majorText: String(data.get("majorText") ?? "").trim(),
    focusText: String(data.get("focusText") ?? "").trim(),
    targetText: String(data.get("targetText") ?? "").trim(),
    existingSetupText: String(data.get("existingSetupText") ?? "").slice(0, 20000),
    research: {
      clarity: data.get("researchClarity") ?? "none",
      block: data.get("researchBlock") ?? "direction",
      time: data.get("researchTime") ?? "low",
      output: data.get("researchOutput") ?? "none",
      note: String(data.get("researchNote") ?? "").trim(),
    },
  };
}

function getFormData() {
  const raw = formRawData();
  if (!raw) return null;
  const intent = interpretProfile(raw);
  const owned = parseExistingSetup(raw.existingSetupText);
  return {
    ...raw,
    major: intent.majorKey,
    focus: intent.focusTopics,
    target: intent.targetKey,
    researchStage: intent.stageInfo.stage,
    researchStageLabel: intent.stageInfo.label,
    majorLabel: intent.majorLabel,
    targetLabel: intent.targetLabel,
    focusLabels: intent.focusLabels,
    interpretation: {
      focusLabels: intent.focusLabels,
      majorLabel: intent.majorLabel,
      targetLabel: intent.targetLabel,
      stageLabel: intent.stageInfo.label,
      needLabel: intent.stageInfo.needLabel,
      terms: intent.terms,
    },
    owned,
    updatedAt: new Date().toISOString(),
  };
}

function updateInterpretPreview() {
  const preview = document.getElementById("interpret-preview");
  const chips = document.getElementById("interpret-chips");
  const stageLine = document.getElementById("interpret-stage");
  const raw = formRawData();
  if (!preview || !chips || !stageLine || !raw) return;
  if (!raw.majorText && !raw.focusText && !raw.targetText) {
    preview.hidden = true;
    return;
  }
  const intent = interpretProfile(raw);
  preview.hidden = false;
  chips.innerHTML = [
    `专业：${intent.majorLabel}`,
    ...intent.focusLabels.map((label) => `关注：${label}`),
    `目标：${intent.targetLabel}`,
  ]
    .map((label) => `<span>${label.replace(/[<>&"]/g, "")}</span>`)
    .join("");
  stageLine.textContent =
    `判断为「${intent.stageInfo.label}」阶段；当前最需要：${intent.stageInfo.needLabel}；` +
    `${intent.stageInfo.timeLabel}，近期交付：${intent.stageInfo.outputLabel}。`;
}

function updateExistingPreview() {
  const input = document.getElementById("existing-setup");
  const preview = document.getElementById("existing-preview");
  if (!input || !preview) return;
  const parsed = parseExistingSetup(input.value);
  if (!parsed.count) {
    preview.hidden = true;
    preview.textContent = "";
    return;
  }
  preview.hidden = false;
  preview.innerHTML =
    `<strong>已识别 ${parsed.count} 项，推荐时会排除：</strong>` +
    parsed.labels
      .slice(0, 12)
      .map((label) => `<span>${label.replace(/[<>&"]/g, "")}</span>`)
      .join("");
}

async function copySetupPrompt(button) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(SETUP_PROMPT);
    button.textContent = "已复制";
  } catch {
    const helper = document.createElement("textarea");
    helper.value = SETUP_PROMPT;
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
    button.textContent = "已复制";
  }
  window.setTimeout(() => {
    button.textContent = original;
  }, 1800);
}

function importExistingSetupFile(file) {
  if (!file) return;
  if (file.size > 200_000) {
    showFormNotice("文件超过 200KB，请只保留工具名、插件名和仓库名。");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const field = document.getElementById("existing-setup");
    if (!field) return;
    field.value = String(reader.result ?? "").slice(0, 20000);
    updateExistingPreview();
  };
  reader.readAsText(file);
}

function fillExample() {
  const values = {
    "major-text": "食品科学与工程",
    "focus-text": "想用 AI 自动做课程汇报 PPT，也做一个食品实验数据分析的小工具，课余尝试 AI 编曲",
    "target-text": "这学期要做组会汇报，同时想积累一个能放进简历、可以演示的作品",
    "research-clarity": "topic",
    "research-block": "data",
    "research-time": "medium",
    "research-output": "project",
    "research-note": "食品感官实验已经做了一部分，现在卡在数据清洗和组会汇报",
  };
  Object.entries(values).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field) field.value = value;
  });
  document.querySelectorAll('input[name="aiTools"]').forEach((checkbox) => {
    checkbox.checked = ["codex", "deepseek"].includes(checkbox.value);
  });
  updateInterpretPreview();
}

let onboardingInitialized = false;

function initializeOnboarding() {
  if (onboardingInitialized) return;
  onboardingInitialized = true;
  const profile = readProfile();
  populateForm(profile);
  if (isProfileComplete(profile)) showRadar();
  else showOnboard();
  updateInterpretPreview();
  updateExistingPreview();

  const form = document.getElementById("onboard-form");
  const exampleButton = document.getElementById("onboard-edit");
  const reconfigureButton = document.getElementById("reconfigure-button");

  form?.addEventListener("input", updateInterpretPreview);
  form?.addEventListener("change", updateInterpretPreview);
  document.getElementById("existing-setup")?.addEventListener("input", updateExistingPreview);
  document.getElementById("copy-setup-prompt")?.addEventListener("click", (event) => {
    copySetupPrompt(event.currentTarget);
  });
  document.getElementById("existing-setup-file")?.addEventListener("change", (event) => {
    importExistingSetupFile(event.target.files?.[0]);
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = getFormData();
    if (!data) return;
    if (!data.majorText) {
      showFormNotice("请填写你的专业或主攻方向。");
      document.getElementById("major-text")?.focus();
      return;
    }
    if (!data.focusText) {
      showFormNotice("请写一下你最近最关心什么，越具体越好。");
      document.getElementById("focus-text")?.focus();
      return;
    }
    if (!data.targetText) {
      showFormNotice("请填写你现在更在意什么结果。");
      document.getElementById("target-text")?.focus();
      return;
    }
    saveProfile(data);
    showRadar();
    window.location.reload();
  });

  exampleButton?.addEventListener("click", fillExample);

  reconfigureButton?.addEventListener("click", () => {
    clearProfile();
    showOnboard();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeOnboarding, { once: true });
} else {
  initializeOnboarding();
}

window.SIGNAL_ONBOARD = {
  STORAGE_KEYS,
  PROFILE_LABELS,
  readProfile,
  saveProfile,
  isProfileComplete,
  buildPersonalization,
  scoreItem,
  computeSortedItems,
  interpretProfile,
  deriveResearchStage,
};
