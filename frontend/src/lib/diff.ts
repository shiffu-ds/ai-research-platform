/**
 * Word-level diff (longest common subsequence) for comparing report
 * versions. Small, exact and dependency-free — report sections are short.
 */

export type DiffOp = "equal" | "insert" | "delete";

export interface DiffPart {
  op: DiffOp;
  text: string;
}

/** Splits text into words while keeping whitespace attached, so joins are lossless. */
export function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const n = a.length;
  const m = b.length;

  // LCS length table, (n+1) x (m+1), filled from the end.
  const table: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (op: DiffOp, text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.op === op) last.text += text;
    else parts.push({ op, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("delete", a[i]);
      i++;
    } else {
      push("insert", b[j]);
      j++;
    }
  }
  while (i < n) push("delete", a[i++]);
  while (j < m) push("insert", b[j++]);

  return parts;
}

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

/**
 * Makes a word diff readable: short unchanged fragments (≤ 2 words) caught
 * between edits are folded into the edit, and adjacent edits are regrouped
 * as one deletion followed by one insertion. Lossless — both texts still
 * reconstruct exactly.
 */
export function cleanupSemantic(parts: DiffPart[]): DiffPart[] {
  let current = parts;
  for (let pass = 0; pass < 4; pass++) {
    const expanded: DiffPart[] = [];
    let changed = false;
    current.forEach((p, i) => {
      const prev = current[i - 1];
      const next = current[i + 1];
      if (p.op === "equal" && prev && next && prev.op !== "equal" && next.op !== "equal" && words(p.text) <= 2) {
        expanded.push({ op: "delete", text: p.text }, { op: "insert", text: p.text });
        changed = true;
      } else expanded.push(p);
    });

    const regrouped: DiffPart[] = [];
    let del = "";
    let ins = "";
    const flush = () => {
      if (del) regrouped.push({ op: "delete", text: del });
      if (ins) regrouped.push({ op: "insert", text: ins });
      del = "";
      ins = "";
    };
    for (const p of expanded) {
      if (p.op === "equal") {
        flush();
        regrouped.push(p);
      } else if (p.op === "delete") del += p.text;
      else ins += p.text;
    }
    flush();
    current = regrouped;
    if (!changed) break;
  }
  return current;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

export function diffStats(parts: DiffPart[]): DiffStats {
  const count = (t: string) => t.split(/\s+/).filter(Boolean).length;
  return parts.reduce<DiffStats>(
    (acc, p) => {
      if (p.op === "insert") acc.added += count(p.text);
      else if (p.op === "delete") acc.removed += count(p.text);
      else acc.unchanged += count(p.text);
      return acc;
    },
    { added: 0, removed: 0, unchanged: 0 }
  );
}

export type SectionChange = "added" | "removed" | "changed" | "unchanged";

export interface SectionDiff {
  key: string;
  title: string;
  change: SectionChange;
  parts: DiffPart[];
  stats: DiffStats;
}

/**
 * Aligns sections across two versions by their order number and diffs
 * the body text of each pair.
 */
export function diffSections(
  before: { order: number; title: string; contentMarkdown: string }[],
  after: { order: number; title: string; contentMarkdown: string }[]
): SectionDiff[] {
  const orders = Array.from(new Set([...before.map((s) => s.order), ...after.map((s) => s.order)])).sort(
    (x, y) => x - y
  );

  return orders.map((order) => {
    const a = before.find((s) => s.order === order);
    const b = after.find((s) => s.order === order);
    const raw = diffWords(a?.contentMarkdown ?? "", b?.contentMarkdown ?? "");
    const stats = diffStats(raw);
    const parts = cleanupSemantic(raw);
    let change: SectionChange;
    if (!a) change = "added";
    else if (!b) change = "removed";
    else if (stats.added === 0 && stats.removed === 0 && a.title === b.title) change = "unchanged";
    else change = "changed";
    return { key: String(order), title: (b ?? a)!.title, change, parts, stats };
  });
}
