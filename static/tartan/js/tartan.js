import { DEFAULT_SHADES, UNKNOWN_HEX } from "./colours.js";

// A slash number is the full pivot count, woven once. The stripes between
// the pivots are mirrored. DR/8 G64 K44 G/64 becomes
// DR8 G64 K44 G64 K44 G64 (288 threads) and that block repeats.
// A count wrapped in ... repeats in order, with no mirror.

const TOKEN_SOURCE = "([A-Za-z]+)(/)?(\\d+)";

/**
 * @param {string} text
 */
export function parsePalette(text) {
  const entries = [];
  const unread = [];
  const parts = String(text ?? "").split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([A-Za-z]+)=(?:#([0-9A-Fa-f]{6})#)?([^;]*)$/);
    if (!match) {
      unread.push(trimmed);
      continue;
    }
    const code = match[1].toUpperCase();
    const explicitHex = match[2] ? match[2].toUpperCase() : null;
    const name = match[3].trim();
    const hex = explicitHex || DEFAULT_SHADES[code] || null;
    entries.push({
      code,
      name,
      explicitHex,
      hex,
      known: Boolean(hex),
    });
  }
  return { entries, unread };
}

/**
 * @param {Array<{code: string, name: string, explicitHex: string | null}>} entries
 */
export function formatPalette(entries) {
  if (!entries.length) return "";
  return (
    entries
      .map((entry) => {
        if (entry.explicitHex) {
          return `${entry.code}=#${entry.explicitHex.toUpperCase()}#${entry.name}`;
        }
        return `${entry.code}=${entry.name}`;
      })
      .join(";") + ";"
  );
}

/**
 * @param {string} text
 */
export function parseThreadcount(text) {
  const raw = String(text ?? "");
  const trimmed = raw.trim();
  const hasDots = trimmed.includes("...");
  const hasSlash = trimmed.includes("/");
  let body = trimmed;
  if (body.startsWith("...")) body = body.slice(3).trimStart();
  if (body.endsWith("...")) body = body.slice(0, -3).trimEnd();

  const tokens = [];
  const tokenPattern = new RegExp(TOKEN_SOURCE, "g");
  let match;
  while ((match = tokenPattern.exec(body)) !== null) {
    tokens.push({
      code: match[1].toUpperCase(),
      pivot: Boolean(match[2]),
      count: Number(match[3]),
    });
  }

  const anySlash = tokens.some((token) => token.pivot);
  const firstPivot = Boolean(tokens[0]?.pivot);
  const lastPivot = Boolean(tokens.at(-1)?.pivot);
  const endsSlashed = tokens.length > 0 && firstPivot && lastPivot;
  const oneEnd = anySlash && firstPivot !== lastPivot;

  /** @type {Array<{id: string, message: string}>} */
  const hints = [];
  if (hasDots && hasSlash) {
    hints.push({
      id: "mixed",
      message: "Dots and slashes are mixed. Use slashes for a mirror, or dots for a straight repeat.",
    });
  }
  if (oneEnd) {
    hints.push({
      id: "one-slash",
      message: "A slash on only one end. Symmetric setts need a slash at both pivots.",
    });
  }
  if (tokens.some((token) => token.count % 2 === 1)) {
    hints.push({ id: "odd", message: "Counts are usually even." });
  }

  let mode = "plain";
  if (hasDots && hasSlash) mode = "mixed";
  else if (hasDots) mode = "asymmetric";
  else if (endsSlashed) mode = "symmetric";

  return { raw, tokens, mode, hints };
}

/**
 * @param {{tokens: Array<{code: string, pivot: boolean, count: number}>, mode: string}} parsed
 */
export function formatThreadcount(parsed) {
  if (!parsed.tokens.length) return "";
  const slashEnds = parsed.mode === "symmetric";
  const last = parsed.tokens.length - 1;
  const body = parsed.tokens
    .map((token, index) => {
      const slash = slashEnds && (index === 0 || index === last);
      return slash ? `${token.code}/${token.count}` : `${token.code}${token.count}`;
    })
    .join(" ");
  if (parsed.mode === "asymmetric" || parsed.mode === "mixed") return `...${body}...`;
  return body;
}

/**
 * @param {{tokens: Array<{code: string, count: number}>, mode: string}} parsed
 * @param {number} index
 * @param {number} count
 */
export function withCount(parsed, index, count) {
  const tokens = parsed.tokens.map((token, i) =>
    i === index ? { ...token, count } : { ...token },
  );
  return { ...parsed, tokens };
}

/**
 * @param {{tokens: Array<{code: string, count: number}>, mode: string}} parsed
 * @param {number} from
 * @param {number} to
 */
export function moveToken(parsed, from, to) {
  const tokens = parsed.tokens.slice();
  const [item] = tokens.splice(from, 1);
  tokens.splice(to, 0, item);
  return { ...parsed, tokens };
}

/**
 * Symmetric: pivot + forward + pivot + reverse(forward).
 * The pivot counts are not repeated.
 * @param {{tokens: Array<{code: string, count: number}>, mode: string}} parsed
 */
export function expandTokens(parsed) {
  const tokens = parsed.tokens.map(({ code, count }) => ({ code, count }));
  if (parsed.mode !== "symmetric" || tokens.length < 2) return tokens;
  const middle = tokens.slice(1, -1);
  return [tokens[0], ...middle, tokens.at(-1), ...middle.slice().reverse()];
}

/** @param {Array<{count: number}>} runs */
export function threadTotal(runs) {
  return runs.reduce((sum, run) => sum + run.count, 0);
}

/** @param {Array<{code: string, count: number}>} runs */
export function flattenRuns(runs) {
  /** @type {string[]} */
  const colours = [];
  for (const run of runs) {
    for (let i = 0; i < run.count; i += 1) colours.push(run.code);
  }
  return colours;
}

/**
 * Warp shows when (x + y) mod 4 is 0 or 1. Otherwise the weft shows.
 * @param {number} x
 * @param {number} y
 */
export function warpShows(x, y) {
  const mod = ((x + y) % 4 + 4) % 4;
  return mod === 0 || mod === 1;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Array<string>} warpColours
 * @param {Array<string>} weftColours
 */
export function colourAt(x, y, warpColours, weftColours) {
  const width = warpColours.length;
  const height = weftColours.length;
  if (width === 0 || height === 0) return null;
  const xi = ((x % width) + width) % width;
  const yi = ((y % height) + height) % height;
  return warpShows(x, y) ? warpColours[xi] : weftColours[yi];
}

/**
 * Merged 4×4 mask rects for the warp of a 2/2 twill.
 */
export function twillMaskRects() {
  /** @type {Array<{x: number, y: number, width: number, height: number}>} */
  const rects = [];
  for (let y = 0; y < 4; y += 1) {
    let x = 0;
    while (x < 4) {
      if (!warpShows(x, y)) {
        x += 1;
        continue;
      }
      let end = x + 1;
      while (end < 4 && warpShows(end, y)) end += 1;
      rects.push({ x, y, width: end - x, height: 1 });
      x = end;
    }
  }
  return rects;
}

/**
 * @param {ReturnType<typeof parsePalette>} palette
 * @param {ReturnType<typeof parseThreadcount>} thread
 * @param {number} total
 */
export function collectHints(palette, thread, total) {
  const hints = thread.hints.slice();
  /** @type {string[]} */
  const unknown = [];
  for (const entry of palette.entries) {
    if (!entry.known) unknown.push(entry.code);
  }
  const defined = new Set(palette.entries.map((entry) => entry.code));
  for (const token of thread.tokens) {
    if (defined.has(token.code)) {
      const entry = palette.entries.find((item) => item.code === token.code);
      if (entry && !entry.hex) unknown.push(token.code);
      continue;
    }
    if (!DEFAULT_SHADES[token.code]) unknown.push(token.code);
  }
  const unique = [...new Set(unknown)];
  if (unique.length === 1) {
    hints.push({ id: "unknown", message: `Unknown colour code ${unique[0]}.` });
  } else if (unique.length > 1) {
    hints.push({ id: "unknown", message: `Unknown colour codes ${unique.join(", ")}.` });
  }
  if (palette.unread.length) {
    hints.push({ id: "palette", message: "Part of the palette could not be read. Use CODE=NAME; or CODE=#HEX#NAME;." });
  }
  if (total > 0 && total < 100) {
    hints.push({
      id: "short",
      message: "Under 100 threads, this usually reads as a check, not a tartan.",
    });
  }
  return hints;
}

/**
 * @param {string} code
 * @param {Array<{code: string, hex: string | null, name: string}>} entries
 */
export function resolveColour(code, entries) {
  const entry = entries.find((item) => item.code === code);
  if (entry?.hex) return { hex: entry.hex, known: true, name: entry.name || code };
  if (DEFAULT_SHADES[code]) return { hex: DEFAULT_SHADES[code], known: true, name: code };
  return { hex: UNKNOWN_HEX, known: false, name: code };
}

/**
 * @param {string} paletteText
 * @param {string} threadcountText
 */
export function buildDesign(paletteText, threadcountText) {
  const palette = parsePalette(paletteText);
  const thread = parseThreadcount(threadcountText);
  const runs = expandTokens(thread);
  const total = threadTotal(runs);
  const written = threadTotal(thread.tokens);
  const hints = collectHints(palette, thread, total);
  const flat = flattenRuns(runs).map((code) => ({
    code,
    ...resolveColour(code, palette.entries),
  }));
  const colouredRuns = runs.map((run) => ({
    ...run,
    ...resolveColour(run.code, palette.entries),
  }));
  return { palette, thread, runs: colouredRuns, total, written, hints, flat };
}

/**
 * @param {{runs: Array<{code: string, count: number, hex: string}>, total: number}} design
 * @param {string} [title]
 */
export function settSvg(design, title = "Tartan") {
  const total = design.total;
  if (!total) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>\n`;
  }
  const mask = twillMaskRects()
    .map(
      (rect) =>
        `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="#ffffff"/>`,
    )
    .join("");
  let cursor = 0;
  const weft = design.runs
    .map((run) => {
      const rect = `<rect x="0" y="${cursor}" width="${total}" height="${run.count}" fill="#${run.hex}"/>`;
      cursor += run.count;
      return rect;
    })
    .join("");
  cursor = 0;
  const warp = design.runs
    .map((run) => {
      const rect = `<rect x="${cursor}" y="0" width="${run.count}" height="${total}" fill="#${run.hex}"/>`;
      cursor += run.count;
      return rect;
    })
    .join("");
  const safeTitle = title.replace(/[<&>]/g, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" shape-rendering="crispEdges">
<title>${safeTitle}</title>
<defs>
<pattern id="twill" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#000000"/>${mask}</pattern>
<mask id="warpMask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="${total}" height="${total}"><rect width="${total}" height="${total}" fill="url(#twill)"/></mask>
</defs>
<g id="weft">${weft}</g>
<g id="warp" mask="url(#warpMask)">${warp}</g>
</svg>
`;
}

/**
 * @param {string} palette
 * @param {string} threadcount
 */
export function encodeShare(palette, threadcount) {
  const params = new URLSearchParams();
  params.set("palette", palette);
  params.set("threadcount", threadcount);
  return params.toString();
}

/**
 * Absolute URL whose hash is the current palette and threadcount.
 * A hex shade's "#" is percent-encoded so it cannot split the fragment.
 * @param {string} pageHref
 * @param {string} palette
 * @param {string} threadcount
 */
export function shareHref(pageHref, palette, threadcount) {
  const url = new URL(pageHref, "https://example.com");
  url.hash = encodeShare(palette, threadcount);
  return url.href;
}

/**
 * @param {string | number} raw
 * @param {number} min
 * @param {number} max
 * @param {string} label
 * @returns {{ value: number | null, note: string }}
 */
export function limitNumber(raw, min, max, label) {
  const text = String(raw ?? "").trim();
  const number = Number(text);
  if (text === "" || !Number.isFinite(number)) {
    return { value: null, note: `${label} must be ${min}–${max}.` };
  }
  if (number < min) {
    return { value: null, note: `${label} must be at least ${min}.` };
  }
  if (Math.round(number) > max) return { value: max, note: `Capped at ${max}.` };
  return { value: Math.round(number), note: "" };
}

/**
 * Repeat size is 1–8, and the picture stays within 4096 pixels on a side.
 * Zero is rejected.
 * @param {string | number} raw
 * @param {number} total
 */
export function repeatScale(raw, total) {
  const bounded = limitNumber(raw, 1, 8, "Repeat size");
  if (bounded.value == null) return bounded;
  const threads = Math.max(1, Number(total) || 1);
  const maxFit = Math.max(1, Math.floor(4096 / threads));
  if (bounded.value > maxFit) return { value: maxFit, note: `Capped at ${maxFit}.` };
  return bounded;
}

/**
 * @param {string} hash
 */
export function decodeShare(hash) {
  const raw = String(hash ?? "").replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  if (!params.has("palette") && !params.has("threadcount")) return null;
  return {
    palette: params.get("palette") ?? "",
    threadcount: params.get("threadcount") ?? "",
  };
}
