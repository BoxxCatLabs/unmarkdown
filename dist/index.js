// src/core/width.ts
var WIDTH_PROFILES = {
  compact: 32,
  standard: 40,
  comfortable: 60
};
var ZERO_RANGES = [
  [0, 31],
  [127, 159],
  // C0 / C1 controls
  [173, 173],
  // soft hyphen (Cf)
  [768, 879],
  // combining diacritical marks
  [1155, 1161],
  // Arabic/Hebrew combining
  [1425, 1469],
  [1471, 1471],
  [1473, 1474],
  [1476, 1477],
  [1479, 1479],
  [1536, 1541],
  [1552, 1562],
  [1564, 1564],
  [1611, 1631],
  [1648, 1648],
  [1750, 1757],
  [1759, 1764],
  [1767, 1768],
  [1770, 1773],
  [1807, 1807],
  [1809, 1809],
  [1840, 1866],
  [1958, 1968],
  [2027, 2035],
  [2070, 2073],
  [2075, 2083],
  [2085, 2087],
  [2089, 2093],
  [2274, 2274],
  [2304, 2306],
  [2362, 2362],
  [2364, 2364],
  [2369, 2376],
  [2381, 2381],
  [2385, 2391],
  [2402, 2403],
  // Devanagari marks
  [3633, 3633],
  [3636, 3642],
  [3655, 3662],
  // Thai marks
  [6155, 6158],
  // Mongolian free variation selectors / FVS4 (Cf)
  [6832, 6911],
  [7616, 7679],
  // combining extended / supplement
  [8203, 8207],
  // ZWSP, ZWNJ, ZWJ, LRM, RLM (Cf)
  [8234, 8238],
  // bidi embedding controls (Cf)
  [8288, 8292],
  [8294, 8303],
  // word joiner, invisible ops, bidi isolates (Cf)
  [8400, 8432],
  // combining marks for symbols
  [65024, 65039],
  // variation selectors VS1–VS16
  [65056, 65071],
  // combining half marks
  [65279, 65279],
  // BOM / ZWNBSP (Cf)
  [119155, 119162],
  // musical control characters (Cf)
  [917505, 917505],
  [917536, 917631],
  // language tags (Cf)
  [917760, 917999]
  // variation selectors supplement VS17–VS256
];
var WIDE_RANGES = [
  [4352, 4447],
  // Hangul Jamo (leading)
  // Emoji-presentation singles in the BMP (⌚ ⌛ ⏏ ⏩ … ✅ ❎ ⭕ etc.)
  [8986, 8987],
  [9193, 9196],
  [9200, 9200],
  [9203, 9203],
  [9725, 9726],
  [9748, 9749],
  [9800, 9811],
  [9855, 9855],
  [9875, 9875],
  [9889, 9889],
  [9898, 9899],
  [9917, 9918],
  [9924, 9925],
  [9934, 9934],
  [9940, 9940],
  [9962, 9962],
  [9970, 9971],
  [9973, 9973],
  [9978, 9978],
  [9981, 9981],
  [9989, 9989],
  [9994, 9995],
  [10024, 10024],
  [10060, 10060],
  [10062, 10062],
  [10067, 10069],
  [10071, 10071],
  [10133, 10135],
  [10160, 10160],
  [10175, 10175],
  [11035, 11036],
  [11088, 11088],
  [11093, 11093],
  [11904, 42191],
  // CJK radicals, kana, bopomofo, CJK unified, Yi
  [43360, 43391],
  // Hangul Jamo extended-A
  [44032, 55291],
  // Hangul syllables + Jamo extended-B
  [63744, 64255],
  // CJK compatibility ideographs
  [65040, 65049],
  [65072, 65135],
  // vertical / CJK compatibility forms
  [65280, 65376],
  // fullwidth forms (halfwidth U+FF61–FF9F stays 1)
  [65504, 65510],
  // fullwidth sign forms
  [126980, 126980],
  [127183, 127183],
  // mahjong tile, playing-card joker
  // U+1F1E6–U+1F1FF (regional indicators) deliberately excluded: width 1 each.
  [127344, 127461],
  [127488, 127569],
  // enclosed alphanumeric emoji (🅰 🅱 🆎 …)
  [127744, 129535],
  // misc symbols/pictographs, emoticons, transport, supplemental
  [129536, 129791],
  // symbols and pictographs extended-A
  [131072, 262141]
  // CJK unified ideographs extensions B–G (plane 2–3)
];
var EMOJI_BASE_RANGES = [
  [8986, 8987],
  [9193, 9196],
  [9200, 9200],
  [9203, 9203],
  [9725, 9726],
  [9748, 9749],
  [9800, 9811],
  [9855, 9855],
  [9875, 9875],
  [9889, 9889],
  [9898, 9899],
  [9917, 9918],
  [9924, 9925],
  [9934, 9934],
  [9940, 9940],
  [9962, 9962],
  [9970, 9971],
  [9973, 9973],
  [9978, 9978],
  [9981, 9981],
  [9989, 9989],
  [9994, 9995],
  [10024, 10024],
  [10060, 10060],
  [10062, 10062],
  [10067, 10069],
  [10071, 10071],
  [10133, 10135],
  [10160, 10160],
  [10175, 10175],
  [11035, 11036],
  [11088, 11088],
  [11093, 11093],
  [126980, 126980],
  [127183, 127183],
  [127344, 127461],
  [127488, 127569],
  [127744, 129535],
  [129536, 129791]
];
var SKIN_TONE_RANGES = [[127995, 127999]];
function inRanges(cp, ranges) {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = lo + hi >>> 1;
    const [start, end] = ranges[mid];
    if (cp < start) hi = mid - 1;
    else if (cp > end) lo = mid + 1;
    else return true;
  }
  return false;
}
function displayWidth(s) {
  let total = 0;
  let clusterOpen = false;
  let joinedByZWJ = false;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === 8205) {
      if (clusterOpen) joinedByZWJ = true;
      continue;
    }
    if (inRanges(cp, ZERO_RANGES)) continue;
    if (clusterOpen && joinedByZWJ) {
      joinedByZWJ = false;
      if (inRanges(cp, EMOJI_BASE_RANGES)) continue;
      clusterOpen = false;
      total += inRanges(cp, WIDE_RANGES) ? 2 : 1;
      continue;
    }
    if (clusterOpen && inRanges(cp, SKIN_TONE_RANGES)) continue;
    clusterOpen = inRanges(cp, EMOJI_BASE_RANGES);
    total += inRanges(cp, WIDE_RANGES) ? 2 : 1;
  }
  return total;
}

// src/options.ts
var DEFAULT_TABLE_OPTIONS = {
  open: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 \u2727\uFF65\uFF9F \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
  close: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 \u2727\uFF65\uFF9F \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
  emptyCell: "(empty)",
  enabled: true,
  strategy: "auto"
};
var ASCII_TABLE_FRAME = "----------";
var DEFAULT_TASK_GLYPHS = { pending: "\u2610", done: "\u2611", cancelled: "\u2612" };
var ASCII_TASK_GLYPHS = { pending: "[ ]", done: "[x]", cancelled: "[-]" };
var DEFAULT_CODE_FRAME = { frame: "\u2504", topRun: 5, bottomRun: 15, label: true };
var ASCII_CODE_FRAME = { frame: "-", topRun: 5, bottomRun: 15, label: true };
var UNICODE_HEADINGS = {
  1: { frame: "\u2501" },
  2: { prefix: "\u3010 ", suffix: " \u3011" },
  3: { prefix: "\u25C6 " },
  4: { prefix: "\u25C7 " },
  5: { prefix: "\u25B8 " },
  6: { prefix: "\u203A " }
};
var ASCII_HEADINGS = {
  1: { frame: "=" },
  2: { prefix: "[ ", suffix: " ]" },
  3: { prefix: ":: " },
  4: { prefix: ";; " },
  5: { prefix: "~> " },
  6: { prefix: ".. " }
};
var TOP_LEVEL_KEYS = {
  profile: true,
  maxWidth: true,
  wrap: true,
  headingMode: true,
  headingDepth: true,
  headings: true,
  bullet: true,
  bulletNested: true,
  ordered: true,
  tasks: true,
  blockquotes: true,
  quotePrefix: true,
  inlineCode: true,
  strikethrough: true,
  hruleMode: true,
  hrule: true,
  links: true,
  guardUrlParens: true,
  codeBlock: true,
  code: true,
  glyphs: true,
  table: true
};
var HEADING_LEVEL_KEYS = { "1": true, "2": true, "3": true, "4": true, "5": true, "6": true };
var HEADING_STYLE_KEYS = { prefix: true, suffix: true, frame: true };
var TASK_KEYS = { pending: true, done: true, cancelled: true };
var CODE_KEYS = { frame: true, topRun: true, bottomRun: true, label: true };
var TABLE_KEYS = {
  open: true,
  close: true,
  emptyCell: true,
  enabled: true,
  strategy: true,
  twoColumnLabel: true
};
var HEADING_LEVELS = [1, 2, 3, 4, 5, 6];
function fail(message) {
  throw new TypeError(`unmarkdown: ${message}`);
}
function expectString(value, key) {
  if (typeof value !== "string") fail(`option "${key}" must be a string`);
}
function expectBoolean(value, key) {
  if (typeof value !== "boolean") fail(`option "${key}" must be a boolean`);
}
function expectEnum(value, key, allowed) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    fail(`option "${key}" must be one of ${allowed.map((v) => `'${v}'`).join(" | ")}`);
  }
}
function readOptionalString(value, key) {
  if (value === void 0) return void 0;
  expectString(value, key);
  return value;
}
function readOptionalBoolean(value, key) {
  if (value === void 0) return void 0;
  expectBoolean(value, key);
  return value;
}
function readOptionalNonNegativeInt(value, key) {
  if (value === void 0) return void 0;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail(`option "${key}" must be a non-negative integer`);
  }
  return value;
}
function expectObject(value, key) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`option "${key}" must be an object`);
}
function concretizeHeading(style) {
  return {
    prefix: style.prefix ?? "",
    suffix: style.suffix ?? "",
    frame: style.frame ?? ""
  };
}
function resolveHeadingsOverride(raw) {
  if (raw === void 0) return {};
  expectObject(raw, "headings");
  for (const key of Object.keys(raw)) {
    if (!HEADING_LEVEL_KEYS[key]) fail(`unknown key "${key}" inside headings/`);
  }
  const out = {};
  for (const level of HEADING_LEVELS) {
    const style = raw[level];
    if (style === void 0) continue;
    expectObject(style, `headings.${level}`);
    for (const styleKey of Object.keys(style)) {
      if (!HEADING_STYLE_KEYS[styleKey]) fail(`unknown key "${styleKey}" inside headings/${level}/`);
    }
    const resolved = {};
    if (style.prefix !== void 0) resolved.prefix = readOptionalString(style.prefix, `headings.${level}.prefix`);
    if (style.suffix !== void 0) resolved.suffix = readOptionalString(style.suffix, `headings.${level}.suffix`);
    if (style.frame !== void 0) resolved.frame = readOptionalString(style.frame, `headings.${level}.frame`);
    out[level] = resolved;
  }
  return out;
}
function resolveTasksOverride(raw) {
  if (raw === void 0) return void 0;
  if (typeof raw !== "object" || Array.isArray(raw)) fail('option "tasks" must be an object');
  for (const key of Object.keys(raw)) {
    if (!TASK_KEYS[key]) fail(`unknown key "${key}" inside tasks/`);
  }
  const out = {};
  if (raw.pending !== void 0) out.pending = readOptionalString(raw.pending, "tasks.pending");
  if (raw.done !== void 0) out.done = readOptionalString(raw.done, "tasks.done");
  if (raw.cancelled !== void 0) out.cancelled = readOptionalString(raw.cancelled, "tasks.cancelled");
  return out;
}
function resolveCodeOverride(raw) {
  if (raw === void 0) return {};
  expectObject(raw, "code");
  for (const key of Object.keys(raw)) {
    if (!CODE_KEYS[key]) fail(`unknown key "${key}" inside code/`);
  }
  const out = {};
  if (raw.frame !== void 0) out.frame = readOptionalString(raw.frame, "code.frame");
  if (raw.topRun !== void 0) out.topRun = readOptionalNonNegativeInt(raw.topRun, "code.topRun");
  if (raw.bottomRun !== void 0) out.bottomRun = readOptionalNonNegativeInt(raw.bottomRun, "code.bottomRun");
  if (raw.label !== void 0) out.label = readOptionalBoolean(raw.label, "code.label");
  return out;
}
function resolveTableOverride(raw) {
  if (raw === void 0) return {};
  expectObject(raw, "table");
  for (const key of Object.keys(raw)) {
    if (!TABLE_KEYS[key]) fail(`unknown key "${key}" inside table/`);
  }
  const out = {};
  if (raw.open !== void 0) out.open = readOptionalString(raw.open, "table.open");
  if (raw.close !== void 0) out.close = readOptionalString(raw.close, "table.close");
  if (raw.emptyCell !== void 0) out.emptyCell = readOptionalString(raw.emptyCell, "table.emptyCell");
  if (raw.enabled !== void 0) out.enabled = readOptionalBoolean(raw.enabled, "table.enabled");
  if (raw.strategy !== void 0) {
    expectEnum(raw.strategy, "table.strategy", ["auto", "record", "compact"]);
    out.strategy = raw.strategy;
  }
  if (raw.twoColumnLabel !== void 0) out.twoColumnLabel = readOptionalString(raw.twoColumnLabel, "table.twoColumnLabel");
  return out;
}
function validate(user) {
  for (const key of Object.keys(user)) {
    if (!TOP_LEVEL_KEYS[key]) fail(`unknown option "${key}"`);
  }
  if (user.profile !== void 0) expectEnum(user.profile, "profile", ["compact", "standard", "comfortable"]);
  if (user.maxWidth !== void 0) {
    if (typeof user.maxWidth !== "number" || !Number.isInteger(user.maxWidth) || user.maxWidth <= 0) {
      fail('option "maxWidth" must be a positive integer');
    }
  }
  if (user.wrap !== void 0) expectBoolean(user.wrap, "wrap");
  if (user.headingMode !== void 0) expectEnum(user.headingMode, "headingMode", ["decorate", "preserve"]);
  if (user.headingDepth !== void 0) {
    if (typeof user.headingDepth !== "number" || !Number.isInteger(user.headingDepth) || user.headingDepth < 1 || user.headingDepth > 6) {
      fail('option "headingDepth" must be an integer between 1 and 6');
    }
  }
  if (user.bullet !== void 0) expectString(user.bullet, "bullet");
  if (user.bulletNested !== void 0) expectString(user.bulletNested, "bulletNested");
  if (user.ordered !== void 0) expectEnum(user.ordered, "ordered", ["render", "preserve"]);
  if (user.blockquotes !== void 0) expectEnum(user.blockquotes, "blockquotes", ["bar", "preserve"]);
  if (user.quotePrefix !== void 0) expectString(user.quotePrefix, "quotePrefix");
  if (user.inlineCode !== void 0) expectEnum(user.inlineCode, "inlineCode", ["verbatim", "corner", "bracket"]);
  if (user.strikethrough !== void 0) {
    expectEnum(user.strikethrough, "strikethrough", ["strip", "brackets", "overline", "preserve"]);
  }
  if (user.hruleMode !== void 0) expectEnum(user.hruleMode, "hruleMode", ["decorate", "preserve"]);
  if (user.hrule !== void 0) expectString(user.hrule, "hrule");
  if (user.links !== void 0) expectEnum(user.links, "links", ["decorated", "urlOnly", "verbatim"]);
  if (user.guardUrlParens !== void 0) expectBoolean(user.guardUrlParens, "guardUrlParens");
  if (user.codeBlock !== void 0) expectEnum(user.codeBlock, "codeBlock", ["decorated", "verbatim"]);
  if (user.glyphs !== void 0) expectEnum(user.glyphs, "glyphs", ["unicode", "ascii"]);
}
function resolveOptions(pipeline = "plain", user) {
  if (pipeline !== "plain" && pipeline !== "pseudo") fail(`unknown pipeline "${String(pipeline)}"`);
  if (user !== void 0 && (typeof user !== "object" || user === null || Array.isArray(user))) {
    fail("options must be an object");
  }
  const headingsOverride = resolveHeadingsOverride(user?.headings);
  const tasksOverride = resolveTasksOverride(user?.tasks);
  const codeOverride = resolveCodeOverride(user?.code);
  const tableOverride = resolveTableOverride(user?.table);
  if (user !== void 0) validate(user);
  const ascii = user?.glyphs === "ascii";
  const headingBundle = ascii ? ASCII_HEADINGS : UNICODE_HEADINGS;
  const taskBundle = ascii ? ASCII_TASK_GLYPHS : DEFAULT_TASK_GLYPHS;
  const resolved = {
    profile: "standard",
    width: WIDTH_PROFILES.standard,
    wrap: pipeline === "plain",
    headingMode: pipeline === "plain" ? "decorate" : "preserve",
    headingDepth: 6,
    headings: {
      1: concretizeHeading(headingBundle[1]),
      2: concretizeHeading(headingBundle[2]),
      3: concretizeHeading(headingBundle[3]),
      4: concretizeHeading(headingBundle[4]),
      5: concretizeHeading(headingBundle[5]),
      6: concretizeHeading(headingBundle[6])
    },
    bullet: ascii ? "-" : "\u2022",
    bulletNested: ascii ? "-" : "\u25E6",
    ordered: pipeline === "plain" ? "render" : "preserve",
    tasks: { ...taskBundle },
    blockquotes: pipeline === "plain" ? "bar" : "preserve",
    quotePrefix: ascii ? "| " : "\u2503 ",
    inlineCode: pipeline === "plain" ? "corner" : "verbatim",
    strikethrough: pipeline === "plain" ? "strip" : "preserve",
    hruleMode: pipeline === "plain" ? "decorate" : "preserve",
    hrule: ascii ? "-----" : "\u2500\u2500\u2500\u2500\u2500",
    links: pipeline === "plain" ? "decorated" : "verbatim",
    guardUrlParens: true,
    codeBlock: pipeline === "plain" ? "decorated" : "verbatim",
    code: { ...ascii ? ASCII_CODE_FRAME : DEFAULT_CODE_FRAME },
    glyphs: ascii ? "ascii" : "unicode",
    table: ascii ? { ...DEFAULT_TABLE_OPTIONS, open: ASCII_TABLE_FRAME, close: ASCII_TABLE_FRAME } : { ...DEFAULT_TABLE_OPTIONS }
  };
  if (user !== void 0) {
    if (user.profile !== void 0) resolved.profile = user.profile;
    if (user.wrap !== void 0) resolved.wrap = user.wrap;
    if (user.headingMode !== void 0) resolved.headingMode = user.headingMode;
    if (user.headingDepth !== void 0) resolved.headingDepth = user.headingDepth;
    for (const level of HEADING_LEVELS) {
      const over = headingsOverride[level];
      if (over !== void 0) {
        resolved.headings[level] = {
          prefix: over.prefix ?? resolved.headings[level].prefix,
          suffix: over.suffix ?? resolved.headings[level].suffix,
          frame: over.frame ?? resolved.headings[level].frame
        };
      }
    }
    if (user.bullet !== void 0) resolved.bullet = user.bullet;
    if (user.bulletNested !== void 0) resolved.bulletNested = user.bulletNested;
    if (user.ordered !== void 0) resolved.ordered = user.ordered;
    if (tasksOverride !== void 0) {
      resolved.tasks = {
        pending: tasksOverride.pending ?? resolved.tasks.pending,
        done: tasksOverride.done ?? resolved.tasks.done,
        cancelled: tasksOverride.cancelled ?? resolved.tasks.cancelled
      };
    }
    if (user.blockquotes !== void 0) resolved.blockquotes = user.blockquotes;
    if (user.quotePrefix !== void 0) resolved.quotePrefix = user.quotePrefix;
    if (user.inlineCode !== void 0) resolved.inlineCode = user.inlineCode;
    if (user.strikethrough !== void 0) resolved.strikethrough = user.strikethrough;
    if (user.hruleMode !== void 0) resolved.hruleMode = user.hruleMode;
    if (user.hrule !== void 0) resolved.hrule = user.hrule;
    if (user.links !== void 0) resolved.links = user.links;
    if (user.guardUrlParens !== void 0) resolved.guardUrlParens = user.guardUrlParens;
    if (user.codeBlock !== void 0) resolved.codeBlock = user.codeBlock;
    resolved.code = {
      frame: codeOverride.frame ?? resolved.code.frame,
      topRun: codeOverride.topRun ?? resolved.code.topRun,
      bottomRun: codeOverride.bottomRun ?? resolved.code.bottomRun,
      label: codeOverride.label ?? resolved.code.label
    };
    if (user.glyphs !== void 0) resolved.glyphs = user.glyphs;
    resolved.table = { ...resolved.table, ...tableOverride };
  }
  resolved.width = user?.maxWidth ?? WIDTH_PROFILES[resolved.profile];
  return resolved;
}

// src/code/decorate.ts
function stripLeadingSpaces(line, max) {
  let i = 0;
  while (i < max && line.charCodeAt(i) === 32) i++;
  return line.slice(i);
}
function topLine(fence, code, width) {
  const match = /^\S+/.exec(fence.lang.trim());
  const label = match !== null ? match[0] : "";
  if (!code.label || label === "") return code.frame.repeat(code.bottomRun);
  let run = code.topRun;
  let top = `${code.frame.repeat(run)} ${label} ${code.frame.repeat(run)}`;
  while (run > 1 && displayWidth(top) > width) {
    run--;
    top = `${code.frame.repeat(run)} ${label} ${code.frame.repeat(run)}`;
  }
  return top;
}
function isCodeSeparator(line, code) {
  if (line === code.frame.repeat(code.bottomRun)) return true;
  const escaped = code.frame.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`^(${escaped}+) (.+) (${escaped}+)$`).exec(line);
  return m !== null && m[1].length === m[3].length;
}
function renderDecoratedCode(fence, opts) {
  const code = opts.code;
  const top = topLine(fence, code, opts.width);
  const lines = fence.body.split("\n").map((line) => stripLeadingSpaces(line, fence.indent.length));
  let lo = 0;
  let hi = lines.length;
  while (lo < hi && (lines[lo] ?? "").trim() === "") lo++;
  while (hi > lo && (lines[hi - 1] ?? "").trim() === "") hi--;
  const body = lines.slice(lo, hi);
  return `${top}
${body.join("\n")}
${code.frame.repeat(code.bottomRun)}`;
}

// src/core/rules.ts
var HRULE_RE = /^[ \t]{0,3}([-*_])[ \t]*\1[ \t]*\1(?:[ \t]*\1)*[ \t]*$/gm;
function transformHorizontalRules(text, opts) {
  return text.replace(HRULE_RE, opts.hruleMode === "preserve" ? "---" : opts.hrule);
}
function stripEmphasis(text) {
  return text.replace(/(\*\*|__)(.*?)\1/g, "$2").replace(/(\*|_)(.*?)\1/g, "$2");
}
function normalizeEmphasis(text) {
  return text.replace(/(\*\*\*|___)(.*?)\1/g, "***$2***").replace(/(\*\*|__)(.*?)\1/g, "**$2**").replace(/(?<!\*)(\*|_)(.*?)\1(?!\*)/g, "*$2*");
}
function strikeStripped(text) {
  return text.replace(/~~+(.*?)~~+/g, "$1");
}
function strikeWithBrackets(text) {
  return text.replace(/~~(.*?)~~/g, "[$1]");
}
function strikeWithOverline(text) {
  return text.replace(/~~(.*?)~~/g, (_match, content) => {
    return content.split("").map((c) => c + "\u0336").join("");
  });
}
function strikePreserved(text) {
  return text.replace(/~~+(.*?)~~+/g, "~~$1~~");
}
function transformStrikethrough(text, opts) {
  switch (opts.strikethrough) {
    case "strip":
      return strikeStripped(text);
    case "overline":
      return strikeWithOverline(text);
    case "preserve":
      return strikePreserved(text);
    default:
      return strikeWithBrackets(text);
  }
}
var REF_DEF_RE = /^[ \t]{0,3}\[([^\]]+)\]:[ \t]*(\S+)(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*(?:\n|$)/gm;
var REF_USE_RE = /\[([^\]]+)\]\[([^\]]*)\]/g;
function refKey(label) {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}
function consumeRefDefinitions(text) {
  const urls = /* @__PURE__ */ new Map();
  const stripped = text.replace(REF_DEF_RE, (_match, label, url) => {
    urls.set(refKey(label), url);
    return "";
  });
  return { text: stripped, urls };
}
function resolveRefLinks(text, urls) {
  return text.replace(REF_USE_RE, (match, label, ref) => {
    const url = urls.get(refKey(ref || label));
    return url === void 0 ? match : `[${label}](${url})`;
  });
}
function resolveReferences(text) {
  const { text: withoutDefs, urls } = consumeRefDefinitions(text);
  return { text: resolveRefLinks(withoutDefs, urls), urls };
}
var IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
var LINK_RE = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
function guardUrl(url, opts) {
  return opts.guardUrlParens ? `\u200B${url}\u200B` : url;
}
function transformImages(text, opts, expand) {
  if (opts.links === "verbatim") return text;
  return text.replace(IMAGE_RE, (_match, alt, url) => {
    if (opts.links === "urlOnly") return url;
    if (expand(alt).trim() === "") return url;
    return `${alt} (${guardUrl(url, opts)})`;
  });
}
function transformLinks(text, opts, expand) {
  if (opts.links === "verbatim") return text;
  return text.replace(LINK_RE, (_match, linkText, url) => {
    if (opts.links === "urlOnly") return url;
    if (expand(linkText).trim() === expand(url).trim()) return url;
    return `${linkText} (${guardUrl(url, opts)})`;
  });
}
function unescapeQuotes(text) {
  return text.replace(/\\"/g, '"');
}
function cleanupWhitespace(text, code) {
  const src = text.split("\n");
  const kept = [];
  let inCode = false;
  let blanks = 0;
  for (const line of src) {
    if (code !== void 0 && isCodeSeparator(line, code)) {
      inCode = !inCode;
      blanks = 0;
      kept.push(line);
      continue;
    }
    if (inCode) {
      kept.push(line);
      continue;
    }
    if (line.trim() === "") {
      blanks++;
      if (blanks <= 1) kept.push(line);
      continue;
    }
    blanks = 0;
    kept.push(line);
  }
  let out = kept.join("\n");
  out = out.replace(/^\s*\n/, "");
  if (!/^ {4}/.test(out)) out = out.replace(/^[ \t]+/, "");
  return out.trimEnd();
}
var identity = (text) => text;
var RAW_INLINE_CODE_RE = /`([^`\n]+)`/g;
function renderRawInlineCode(code, mode) {
  if (mode === "bracket") return `\u2997 ${code} \u2998`;
  if (mode === "corner") return `\u300E${code}\u300F`;
  return `\`${code}\``;
}
function normalizeInlineMarkdown(text, opts, expand = identity) {
  const withCode = text.replace(
    RAW_INLINE_CODE_RE,
    (_match, code) => renderRawInlineCode(code, opts.inlineCode)
  );
  return transformStrikethrough(stripEmphasis(transformLinks(transformImages(withCode, opts, expand), opts, expand)), opts);
}
function plainInlinePass(text, opts, expand = identity) {
  const { text: withRefs } = resolveReferences(text);
  return transformStrikethrough(stripEmphasis(transformLinks(transformImages(withRefs, opts, expand), opts, expand)), opts);
}
function pseudoInlinePass(text, opts, expand = identity) {
  const { text: withRefs } = resolveReferences(text);
  return transformStrikethrough(normalizeEmphasis(transformLinks(transformImages(withRefs, opts, expand), opts, expand)), opts);
}
function applyPlainInline(text, opts) {
  return unescapeQuotes(plainInlinePass(text, opts));
}

// src/table/parse.ts
function splitRow(line) {
  const cells = [];
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (ch === "\\" && line.charAt(i + 1) === "|") {
      current += "|";
      i++;
      continue;
    }
    if (ch === "|") {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  const first = cells[0];
  if (first !== void 0 && first.trim() === "") cells.shift();
  const last = cells[cells.length - 1];
  if (last !== void 0 && last.trim() === "") cells.pop();
  return cells.map((cell) => cell.trim());
}
var DELIMITER_CELL = /^:?-+:?$/;
function isDelimiterRow(line) {
  if (!line.includes("|")) return false;
  const cells = splitRow(line);
  return cells.length >= 1 && cells.every((cell) => DELIMITER_CELL.test(cell));
}
function isPipeRow(line) {
  return /^ {0,3}\|/.test(line);
}

// src/table/render/keyValue.ts
function collapseBreaks(s) {
  return s.replace(/<br\s*\/?>/gi, " ").replace(/ {2,}/g, " ").trim();
}
function renderKeyValue(table, renderCell, opts) {
  const columnCount = table.headers.length;
  const records = [];
  for (let r = 0; r < table.rows.length; r++) {
    const row = table.rows[r] ?? [];
    const headingCell = collapseBreaks(renderCell(row[0] ?? ""));
    const lines = [headingCell === "" ? `[${r + 1}]` : `[${r + 1}] ${headingCell}`];
    for (let c = 1; c < columnCount; c++) {
      const key = collapseBreaks(renderCell(table.headers[c] ?? ""));
      const label = key === "" ? String(c + 1) : key;
      const value = collapseBreaks(renderCell(row[c] ?? ""));
      lines.push(`    ${label}: ${value === "" ? opts.table.emptyCell : value}`);
    }
    records.push(lines.join("\n"));
  }
  if (records.length === 0) return `${opts.table.open}

${opts.table.close}`;
  return `${opts.table.open}

${records.join("\n\n")}

${opts.table.close}`;
}

// src/table/render/compact.ts
function pluralize(word) {
  if (/[^aeiouAEIOU]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(?:s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}
function renderCompact(table, renderCell, opts) {
  if (table.headers.length !== 2) {
    return renderKeyValue(table, renderCell, opts);
  }
  const headerCell = collapseBreaks(renderCell(table.headers[0] ?? ""));
  const label = opts.table.twoColumnLabel ?? pluralize(headerCell);
  const ascii = opts.glyphs === "ascii";
  const corner = ascii ? "+" : "\u250C";
  const bottomCorner = ascii ? "+" : "\u2514";
  const rule = ascii ? "-" : "\u2500";
  const sep = ascii ? "-" : "\u2500";
  const topLine2 = `${corner}${rule} ${label} ${rule.repeat(6)}`;
  const keys = table.headers.map((header) => collapseBreaks(renderCell(header)));
  const maxKeyWidth = keys.reduce((max, key) => Math.max(max, key.length), 0);
  const lines = [];
  for (const row of table.rows) {
    for (let c = 0; c < keys.length; c++) {
      const value = collapseBreaks(renderCell(row[c] ?? ""));
      lines.push(`${keys[c].padEnd(maxKeyWidth)}  ${sep} ${value === "" ? opts.table.emptyCell : value}`);
    }
  }
  const bottom = `${bottomCorner}${rule.repeat(Math.max(0, displayWidth(topLine2) - 1))}`;
  if (lines.length === 0) return `${topLine2}

${bottom}`;
  return `${topLine2}

${lines.join("\n")}

${bottom}`;
}

// src/table/render/index.ts
var tableRenderers = {
  keyValue: renderKeyValue,
  compact: renderCompact
};
function selectTableRenderer(table, opts) {
  if (opts.table.strategy === "record") return tableRenderers.keyValue;
  if (opts.table.strategy === "compact") return tableRenderers.compact;
  return table.headers.length === 2 ? tableRenderers.compact : tableRenderers.keyValue;
}
function renderTable(table, renderCell, opts) {
  return selectTableRenderer(table, opts)(table, renderCell, opts);
}

// src/table/index.ts
function normalizeRow(cells, width) {
  const row = cells.slice(0, width);
  while (row.length < width) row.push("");
  return row;
}
function decorateTablesInText(text, renderCell, opts) {
  if (!opts.table.enabled) return text;
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!isPipeRow(line)) {
      out.push(line);
      i++;
      continue;
    }
    let j = i + 1;
    while (j < lines.length && isPipeRow(lines[j] ?? "")) j++;
    if (j - i >= 2 && isDelimiterRow(lines[i + 1] ?? "")) {
      const headers = splitRow(line);
      const rows = [];
      for (let k = i + 2; k < j; k++) {
        rows.push(normalizeRow(splitRow(lines[k] ?? ""), headers.length));
      }
      const table = { headers, rows };
      out.push(renderTable(table, renderCell, opts));
    } else {
      for (let k = i; k < j; k++) out.push(lines[k] ?? "");
    }
    i = j;
  }
  return out.join("\n");
}
function decorateTable(input, userOpts) {
  if (typeof input !== "string" || input.trim() === "") return "";
  const opts = resolveOptions("plain", userOpts);
  const trimmed = input.trim();
  const lines = trimmed.split("\n");
  if (lines.length < 2 || !lines.every((l) => isPipeRow(l)) || !isDelimiterRow(lines[1] ?? "")) {
    return input;
  }
  const headers = splitRow(lines[0] ?? "");
  const rows = lines.slice(2).map((l) => normalizeRow(splitRow(l), headers.length));
  return renderTable({ headers, rows }, (cell) => applyPlainInline(cell, opts), opts);
}

// src/core/normalize.ts
function isUsableInput(input) {
  return typeof input === "string" && input.trim() !== "";
}
function normalizeLineEndings(input) {
  return input.replace(/\r\n?/g, "\n");
}

// src/core/protect.ts
var URL_RE = /https?:\/\/[^\s\[\]()\u200B\uE000-\uE0FF]+/g;
var OUTER_FENCE_RE = /^([ \t]*)(`{4,})\n([\s\S]*?)\n\2[ \t]*$/gm;
var FENCE_RE = /^([ \t]*)```([^\n]*)\n([\s\S]*?)```[ \t]*$/gm;
var INLINE_CODE_RE = /`([^`\n]+)`/g;
var SENTINEL_POOL_START = 57344;
var SENTINEL_POOL_END = 57599;
var TYPE_CODES = {
  url: "U",
  inlineCode: "I",
  fence: "C"
};
function allocateSentinels(text) {
  const used = /* @__PURE__ */ new Set();
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= SENTINEL_POOL_START && code <= SENTINEL_POOL_END) used.add(code);
  }
  const picked = [];
  for (let code = SENTINEL_POOL_START; code <= SENTINEL_POOL_END && picked.length < 3; code++) {
    if (!used.has(code)) picked.push(code);
  }
  if (picked.length < 3) {
    throw new Error(
      "unmarkdown: sentinel pool exhausted \u2014 input already uses nearly all U+E000\u2013U+E0FF codepoints"
    );
  }
  return {
    start: String.fromCodePoint(picked[0]),
    sep: String.fromCodePoint(picked[1]),
    end: String.fromCodePoint(picked[2])
  };
}
function protectSpans(input) {
  const { start, sep, end } = allocateSentinels(input);
  const spans = [];
  const makeToken = (type, index) => `${start}${type}${sep}${index}${end}`;
  const tokenize = (subject) => {
    let text2 = subject;
    text2 = text2.replace(OUTER_FENCE_RE, (raw, indent, _ticks, body) => {
      spans.push({ type: "fence", raw, indent, lang: "", body });
      return makeToken(TYPE_CODES.fence, spans.length - 1);
    });
    text2 = text2.replace(FENCE_RE, (raw, indent, langLine, body) => {
      spans.push({ type: "fence", raw, indent, lang: langLine.trim(), body });
      return makeToken(TYPE_CODES.fence, spans.length - 1);
    });
    text2 = text2.replace(INLINE_CODE_RE, (fullMatch, code) => {
      spans.push({ type: "inlineCode", raw: code });
      return makeToken(TYPE_CODES.inlineCode, spans.length - 1);
    });
    text2 = text2.replace(URL_RE, (raw) => {
      spans.push({ type: "url", raw });
      return makeToken(TYPE_CODES.url, spans.length - 1);
    });
    return text2;
  };
  const allTokenRe = new RegExp(`${start}(?:[UCI])${sep}(\\d+)${end}`, "g");
  const fenceTokenRe = new RegExp(`${start}C${sep}(\\d+)${end}`, "g");
  const inlineTokenRe = new RegExp(`${start}I${sep}(\\d+)${end}`, "g");
  const urlTokenRe = new RegExp(`${start}U${sep}(\\d+)${end}`, "g");
  const spanAt = (index) => spans[Number(index)];
  const renderInlineCode = (span, opts) => {
    if (opts.inlineCode === "bracket") return `\u2997 ${span.raw} \u2998`;
    if (opts.inlineCode === "corner") return `\u300E${span.raw}\u300F`;
    return `\`${span.raw}\``;
  };
  const renderFence = (span, opts) => {
    if (span.type !== "fence") return span.raw;
    return opts.codeBlock === "verbatim" ? span.raw : renderDecoratedCode({ indent: span.indent, lang: span.lang, body: span.body }, opts);
  };
  const text = tokenize(input);
  return {
    text,
    extend: tokenize,
    expandAll: (subject, opts) => {
      let out = subject;
      while (out.includes(start)) {
        const next = out.replace(allTokenRe, (match, index) => {
          const span = spanAt(index);
          if (!span) return match;
          if (span.type === "inlineCode") return renderInlineCode(span, opts);
          return span.raw;
        });
        if (next === out) break;
        out = next;
      }
      return out;
    },
    restore: (subject, opts) => {
      let out = subject.replace(fenceTokenRe, (match, index) => {
        const span = spanAt(index);
        return span && span.type === "fence" ? renderFence(span, opts) : match;
      });
      out = out.replace(inlineTokenRe, (match, index) => {
        const span = spanAt(index);
        return span && span.type === "inlineCode" ? renderInlineCode(span, opts) : match;
      });
      out = out.replace(urlTokenRe, (match, index) => {
        const span = spanAt(index);
        return span && span.type === "url" ? span.raw : match;
      });
      return out;
    }
  };
}

// src/core/wrap.ts
var CJK_RANGES = [
  [4352, 4447],
  // Hangul Jamo (leading)
  [11904, 42191],
  // CJK radicals, kana, bopomofo, CJK unified, Yi
  [43360, 43391],
  // Hangul Jamo extended-A
  [44032, 55291],
  // Hangul syllables + Jamo extended-B
  [63744, 64255],
  // CJK compatibility ideographs
  [65040, 65049],
  [65072, 65135],
  // vertical / CJK compatibility forms
  [65280, 65376],
  // fullwidth forms
  [65504, 65510],
  // fullwidth sign forms
  [131072, 262141]
  // CJK unified ideographs extensions B–G
];
var SENTINEL_RE = /[\uE000-\uE0FF]/;
var SOURCE_SKIPS = [
  /^#{1,6}[ \t]/,
  // ATX heading
  /^[ \t]{0,3}>/,
  // blockquote
  /^[ \t]*([-*+]|\d{1,9}[.)])[ \t]+/,
  // list item (bullet/ordered, incl. task items)
  /^[ \t]{0,3}([-*_])[ \t]*\1[ \t]*\1([ \t]*\1)*[ \t]*$/,
  // thematic break
  /^[ \t]{4,}\S/,
  // indented code
  /^[ \t]{0,3}\[[^\]]+\]:/
  // reference definition
];
function inRanges2(cp, ranges) {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = lo + hi >>> 1;
    const [start, end] = ranges[mid];
    if (cp < start) hi = mid - 1;
    else if (cp > end) lo = mid + 1;
    else return true;
  }
  return false;
}
function isCjkRun(token) {
  let hasBase = false;
  for (const ch of token) {
    const cp = ch.codePointAt(0);
    if (displayWidth(ch) === 0) continue;
    if (!inRanges2(cp, CJK_RANGES)) return false;
    hasBase = true;
  }
  return hasBase;
}
function clusterSplit(token) {
  const clusters = [];
  let cur = "";
  let open = false;
  for (const ch of token) {
    if (!open) {
      cur = ch;
      open = true;
    } else if (displayWidth(ch) === 0) {
      cur += ch;
    } else {
      clusters.push(cur);
      cur = ch;
    }
  }
  if (open) clusters.push(cur);
  return clusters;
}
function segmentCjkRun(token, width) {
  const out = [];
  let line = "";
  for (const cluster of clusterSplit(token)) {
    if (line !== "" && displayWidth(line + cluster) > width) {
      out.push(line);
      line = cluster;
    } else {
      line += cluster;
    }
  }
  if (line !== "") out.push(line);
  return out;
}
function scanWords(rest) {
  const words = [];
  const safe = [];
  let brackets = 0;
  let markers = 0;
  let ticks = 0;
  let gapSafe = false;
  let word = "";
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if (ch === " ") {
      if (word !== "") {
        words.push(word);
        safe.push(gapSafe);
        word = "";
      }
      gapSafe = brackets === 0 && markers % 2 === 0 && ticks % 2 === 0;
      continue;
    }
    if (ch === "[" || ch === "(") brackets++;
    else if (ch === "]" || ch === ")") brackets = Math.max(0, brackets - 1);
    else if (ch === "`") ticks++;
    else if ((ch === "*" || ch === "_" || ch === "~") && i + 1 < rest.length && rest[i + 1] === ch) {
      markers++;
      word += ch + rest[i + 1];
      i++;
      continue;
    }
    word += ch;
  }
  if (word !== "") {
    words.push(word);
    safe.push(gapSafe);
  }
  return { words, safe };
}
function markdownTokens(rest) {
  const { words, safe } = scanWords(rest);
  const tokens = [];
  for (let k = 0; k < words.length; k++) {
    if (k > 0 && !safe[k]) tokens[tokens.length - 1] += ` ${words[k]}`;
    else tokens.push(words[k]);
  }
  return tokens;
}
function wrapProseLine(line, width) {
  if (displayWidth(line) <= width) return [line];
  const lead = /^[ \t]*/.exec(line)[0];
  const words = markdownTokens(line.slice(lead.length));
  const out = [];
  let cur = "";
  let budget = width - displayWidth(lead);
  for (const word of words) {
    if (isCjkRun(word) && displayWidth(word) > width) {
      const owesLead = cur === "" && out.length === 0;
      const segBudget = owesLead ? width - displayWidth(lead) : width;
      if (cur !== "") out.push(cur);
      const segments = segmentCjkRun(word, segBudget);
      for (const segment of segments.slice(0, -1)) out.push(segment);
      cur = segments[segments.length - 1] ?? "";
      budget = owesLead && segments.length === 1 ? segBudget : width;
      continue;
    }
    const candidate = cur === "" ? word : `${cur} ${word}`;
    if (displayWidth(candidate) <= budget) {
      cur = candidate;
    } else {
      const flushed = cur !== "";
      if (flushed) out.push(cur);
      cur = word;
      budget = flushed ? width : width - displayWidth(lead);
    }
  }
  if (cur !== "") out.push(cur);
  if (out.length === 0) return [line];
  return [lead + (out[0] ?? ""), ...out.slice(1)];
}
function wrapProse(text, opts) {
  const width = opts.width;
  const out = [];
  let inCode = false;
  let inTable = false;
  let inCompact = false;
  for (const line of text.split("\n")) {
    if (SENTINEL_RE.test(line)) {
      out.push(line);
      continue;
    }
    if (inTable) {
      if (opts.table.close !== "" && line === opts.table.close) inTable = false;
      out.push(line);
      continue;
    }
    if (opts.table.open !== "" && line === opts.table.open) {
      inTable = true;
      out.push(line);
      continue;
    }
    if (isCodeSeparator(line, opts.code)) {
      inCode = !inCode;
      out.push(line);
      continue;
    }
    if (inCode) {
      out.push(line);
      continue;
    }
    if (inCompact) {
      if (line.startsWith("\u2514")) inCompact = false;
      out.push(line);
      continue;
    }
    if (line.startsWith("\u250C")) {
      inCompact = true;
      out.push(line);
      continue;
    }
    if (SOURCE_SKIPS.some((pattern) => pattern.test(line))) {
      out.push(line);
      continue;
    }
    out.push(...wrapProseLine(line, width));
  }
  return out.join("\n");
}

// src/core/pipeline.ts
function runPipeline(input, rules, pipeline, user) {
  if (!isUsableInput(input)) return "";
  const opts = resolveOptions(pipeline, user);
  const protection = protectSpans(normalizeLineEndings(input));
  const expand = (subject) => protection.expandAll(subject, opts);
  let result = protection.text;
  if (opts.table.enabled) {
    const renderCell = (cell) => {
      return protection.expandAll(rules.transformInline(cell, opts, expand), opts);
    };
    result = decorateTablesInText(result, renderCell, opts);
    result = protection.extend(result);
  }
  if (pipeline === "plain" && opts.wrap) result = wrapProse(result, opts);
  result = rules.transformLines(result, opts, expand);
  result = rules.transformInline(result, opts, expand);
  result = protection.restore(result, opts);
  result = unescapeQuotes(result);
  return cleanupWhitespace(result, opts.code);
}

// src/core/headings.ts
var HEADING_RE = /^(#{1,6})[ \t]+(.*)$/gm;
function renderDecorated(title, style, width) {
  const frame = style.frame ?? "";
  if (frame !== "") {
    const t = displayWidth(title);
    if (t + 6 > width) return title;
    const k = Math.min(4, Math.floor((width - t - 2) / 2));
    return `${frame.repeat(k)} ${title} ${frame.repeat(k)}`;
  }
  const decorated = `${style.prefix ?? ""}${title}${style.suffix ?? ""}`;
  return displayWidth(decorated) <= width ? decorated : title;
}
function transformHeadings(text, opts, expand) {
  return text.replace(HEADING_RE, (line, marks, content) => {
    if (marks.length > opts.headingDepth) return line;
    const title = content.trim();
    if (title === "") return "";
    if (opts.headingMode === "preserve") return `${marks} ${title}`;
    const style = opts.headings[marks.length] ?? {};
    let rendered = normalizeInlineMarkdown(title, opts, expand);
    if (expand) rendered = expand(rendered);
    return renderDecorated(rendered, style, opts.width);
  });
}

// src/core/lists.ts
var BULLET_RE = /^([ \t]*)([-*+])[ \t]+(.*)$/;
var TASK_RE = /^([ \t]*)([-*+])[ \t]+\[([ xX])\](?:[ \t]+(.*))?$/;
var ORDERED_RE = /^([ \t]*)(\d+)\.[ \t]+(.*)$/;
function indentDepth(indent) {
  return Math.max(1, Math.floor(indent.length / 2) + 1);
}
function pseudoPad(indent) {
  return "  ".repeat(Math.min(Math.floor(indent.length / 2), 3));
}
function letterMarker(n) {
  return `${String.fromCharCode(97 + (n - 1) % 26)}.`;
}
function splitCr(line) {
  return line.endsWith("\r") ? { body: line.slice(0, -1), cr: "\r" } : { body: line, cr: "" };
}
function normalizedIndent(indent) {
  return "  ".repeat(indentDepth(indent) - 1);
}
function transformPlainLists(text, opts) {
  const orderedCounters = [];
  return text.split("\n").map((line) => {
    const { body, cr } = splitCr(line);
    return renderPlainLine(body, opts, orderedCounters) + cr;
  }).join("\n");
}
function renderPlainLine(line, opts, counters) {
  if (line.trim() === "") return line;
  const task = TASK_RE.exec(line);
  if (task) {
    counters.length = 0;
    const glyph = task[3] === " " ? opts.tasks.pending : opts.tasks.done;
    const suffix = task[4] === void 0 ? "" : ` ${task[4]}`;
    return `${normalizedIndent(task[1])}${glyph}${suffix}`;
  }
  if (opts.ordered === "render") {
    const ordered = ORDERED_RE.exec(line);
    if (ordered) {
      const depth = indentDepth(ordered[1]);
      counters.length = depth + 1;
      counters[depth] = (counters[depth] ?? 0) + 1;
      const marker = depth === 1 ? `${counters[depth]}.` : letterMarker(counters[depth]);
      return `${normalizedIndent(ordered[1])}${marker} ${ordered[3]}`;
    }
  }
  const bullet = BULLET_RE.exec(line);
  if (bullet) {
    counters.length = 0;
    const depth = indentDepth(bullet[1]);
    const glyph = depth === 1 ? opts.bullet : opts.bulletNested;
    return `${normalizedIndent(bullet[1])}${glyph} ${bullet[3]}`;
  }
  counters.length = 0;
  return line;
}
function transformPseudoLists(text) {
  return text.split("\n").map((line) => {
    const { body, cr } = splitCr(line);
    return renderPseudoLine(body) + cr;
  }).join("\n");
}
function renderPseudoLine(line) {
  const task = TASK_RE.exec(line);
  if (task) {
    const check = task[3] === " " ? "[ ]" : "[x]";
    const suffix = task[4] === void 0 ? "" : ` ${task[4]}`;
    return `${pseudoPad(task[1])}- ${check}${suffix}`;
  }
  const bullet = BULLET_RE.exec(line);
  if (bullet) return `${pseudoPad(bullet[1])}- ${bullet[3]}`;
  const ordered = ORDERED_RE.exec(line);
  if (ordered) return `${pseudoPad(ordered[1])}${ordered[2]}. ${ordered[3]}`;
  return line;
}

// src/core/quotes.ts
var QUOTE_RE = /^((?:>[ \t]*)+)(.*)$/gm;
function transformBlockquotes(text, opts) {
  if (opts.blockquotes === "preserve") return text;
  return text.replace(QUOTE_RE, (_match, quotes, content) => {
    const depth = (quotes.match(/>/g) ?? []).length;
    return `${opts.quotePrefix.repeat(depth)}${content}`;
  });
}

// src/plain.ts
var PLAIN_RULES = {
  // Order mirrors the pseudo pipeline: headings → hrules → quotes → lists,
  // so quoted bullets are depth-prefixed before markers normalize.
  transformLines: (text, opts, expand) => {
    return transformPlainLists(
      transformBlockquotes(
        transformHorizontalRules(transformHeadings(text, opts, expand), opts),
        opts
      ),
      opts
    );
  },
  transformInline: (text, opts, expand) => plainInlinePass(text, opts, expand)
};
function toPlainText(input, options) {
  return runPipeline(input, PLAIN_RULES, "plain", options);
}

// src/pseudo.ts
var PSEUDO_RULES = {
  transformLines: (text, opts) => {
    return transformPseudoLists(
      transformBlockquotes(transformHorizontalRules(transformHeadings(text, opts), opts), opts)
    );
  },
  transformInline: (text, opts, expand) => pseudoInlinePass(text, opts, expand)
};
function toPseudoMarkdown(input, options) {
  return runPipeline(input, PSEUDO_RULES, "pseudo", options);
}

// src/analyze.ts
var RESIDUAL_MARKDOWN_RE = /(^#{1,6}\s+\S|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+\*(?!\*)|(?<!_)_[^_]+_(?!_)|`[^`]+`|^[ \t]{0,3}\[[^\]]+\]:[ \t]*\S|\[[^\]]+\]\[[^\]]*\])/m;
function analyze(input) {
  if (typeof input !== "string") return { hadResidualMarkdown: false };
  return { hadResidualMarkdown: RESIDUAL_MARKDOWN_RE.test(input) };
}
export {
  DEFAULT_TABLE_OPTIONS,
  WIDTH_PROFILES,
  analyze,
  decorateTable,
  displayWidth,
  resolveOptions,
  toPlainText,
  toPseudoMarkdown
};
//# sourceMappingURL=index.js.map