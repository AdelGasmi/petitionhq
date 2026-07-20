"use client";

// ---------------------------------------------------------------------------
// Diff engine
//
// Algorithm: sentence-level LCS across the whole document (ignoring paragraph
// boundaries for matching purposes), with fingerprint-based equality so that
// a sentence with one word appended still matches its near-twin.
// Changed sentences get word-level highlighting inside.
// ---------------------------------------------------------------------------

type DiffItem =
  | { type: "equal";  text: string }
  | { type: "change"; oldText: string; newText: string }
  | { type: "delete"; text: string }
  | { type: "insert"; text: string };

type WordSegment = { text: string; changed: boolean };

// ---------------------------------------------------------------------------
// Sentence splitter
// Avoids splitting on abbreviations by requiring 2+ lowercase letters before
// the period.  "Dr.", "Mr.", "U.S.", "AI." won't trigger a split.
// ---------------------------------------------------------------------------

const SENT_BOUNDARY = /(?<=[a-z]{2,}[.!?]|[!?])\s+(?=[A-Z"])/g;

function splitSentences(text: string): string[] {
  const parts: string[] = [];
  let last = 0;
  for (const m of text.matchAll(SENT_BOUNDARY)) {
    const s = text.slice(last, m.index).trim();
    if (s) parts.push(s);
    last = m.index! + m[0].length;
  }
  const tail = text.slice(last).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
}

function tokenizeDocument(text: string): string[] {
  return text
    .split(/\n\n+/)
    .filter(Boolean)
    .flatMap(splitSentences);
}

// First 6 words, lowercased — good enough to identify a sentence across minor edits
function fingerprint(sent: string): string {
  return (sent.toLowerCase().match(/\w+/g) ?? []).slice(0, 6).join(" ");
}

// ---------------------------------------------------------------------------
// LCS on sentence fingerprints
// Returns a raw diff referencing indices into oldSents / newSents
// ---------------------------------------------------------------------------

type RawSent =
  | { type: "equal";  oi: number; ni: number }
  | { type: "delete"; oi: number }
  | { type: "insert"; ni: number };

function lcsRaw(oldFPs: string[], newFPs: string[]): RawSent[] {
  const m = oldFPs.length, n = newFPs.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldFPs[i - 1] === newFPs[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const result: RawSent[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldFPs[i - 1] === newFPs[j - 1]) {
      result.unshift({ type: "equal", oi: i - 1, ni: j - 1 });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "insert", ni: j - 1 });
      j--;
    } else {
      result.unshift({ type: "delete", oi: i - 1 });
      i--;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Build DiffItems from raw LCS — pair consecutive delete+insert runs
// ---------------------------------------------------------------------------

function buildDiffItems(
  raw: RawSent[],
  oldSents: string[],
  newSents: string[]
): DiffItem[] {
  const result: DiffItem[] = [];
  let k = 0;
  while (k < raw.length) {
    const cur = raw[k];
    if (cur.type === "equal") {
      // If fingerprint matched but actual text differs → treat as change
      const ot = oldSents[cur.oi], nt = newSents[cur.ni];
      if (ot === nt) {
        result.push({ type: "equal", text: ot });
      } else {
        result.push({ type: "change", oldText: ot, newText: nt });
      }
      k++;
      continue;
    }
    // Collect run of deletes then inserts
    const dels: number[] = [];
    while (k < raw.length && raw[k].type === "delete") { dels.push((raw[k] as { type: "delete"; oi: number }).oi); k++; }
    const ins: number[] = [];
    while (k < raw.length && raw[k].type === "insert") { ins.push((raw[k] as { type: "insert"; ni: number }).ni); k++; }

    const pairs = Math.min(dels.length, ins.length);
    for (let p = 0; p < pairs; p++)
      result.push({ type: "change", oldText: oldSents[dels[p]], newText: newSents[ins[p]] });
    for (let p = pairs; p < dels.length; p++)
      result.push({ type: "delete", text: oldSents[dels[p]] });
    for (let p = pairs; p < ins.length; p++)
      result.push({ type: "insert", text: newSents[ins[p]] });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Word-level diff (used inside changed sentences)
// ---------------------------------------------------------------------------

function diffWords(oldText: string, newText: string): [WordSegment[], WordSegment[]] {
  const tok = (t: string) => t.match(/\S+|\s+/g) ?? [];
  const ow = tok(oldText), nw = tok(newText);
  const m = ow.length, n = nw.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = ow[i - 1] === nw[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const oldSegs: WordSegment[] = [], newSegs: WordSegment[] = [];
  let i = m, j = n;
  const raw: Array<{ type: string; text: string }> = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ow[i - 1] === nw[j - 1]) {
      raw.unshift({ type: "equal", text: ow[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.unshift({ type: "insert", text: nw[j - 1] }); j--;
    } else {
      raw.unshift({ type: "delete", text: ow[i - 1] }); i--;
    }
  }
  for (const it of raw) {
    if (it.type === "equal") {
      oldSegs.push({ text: it.text, changed: false });
      newSegs.push({ text: it.text, changed: false });
    } else if (it.type === "delete") {
      oldSegs.push({ text: it.text, changed: true });
    } else {
      newSegs.push({ text: it.text, changed: true });
    }
  }
  return [oldSegs, newSegs];
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function WordSpans({ segs, side }: { segs: WordSegment[]; side: "old" | "new" }) {
  const cls = side === "old"
    ? "rounded bg-danger-border px-0.5 text-danger-text"
    : "rounded bg-success-border px-0.5 text-success-text";
  return (
    <>
      {segs.map((s, i) =>
        s.changed ? <mark key={i} className={cls}>{s.text}</mark> : <span key={i}>{s.text}</span>
      )}
    </>
  );
}

// Group consecutive equal items so they share one row (reduces visual clutter)
type GroupedItem =
  | { type: "equal";  text: string }         // one or more merged equal sentences
  | { type: "change"; oldText: string; newText: string }
  | { type: "delete"; text: string }
  | { type: "insert"; text: string };

function groupItems(items: DiffItem[]): GroupedItem[] {
  const result: GroupedItem[] = [];
  let i = 0;
  while (i < items.length) {
    if (items[i].type === "equal") {
      const texts: string[] = [];
      while (i < items.length && items[i].type === "equal") {
        texts.push((items[i] as { type: "equal"; text: string }).text);
        i++;
      }
      result.push({ type: "equal", text: texts.join(" ") });
    } else {
      result.push(items[i] as GroupedItem);
      i++;
    }
  }
  return result;
}

function SentenceRow({ item }: { item: GroupedItem }) {
  if (item.type === "equal") {
    return (
      <div className="grid grid-cols-2 gap-px bg-surface-muted">
        <p className="whitespace-pre-wrap px-4 py-2 text-sm text-text-secondary">{item.text}</p>
        <p className="whitespace-pre-wrap px-4 py-2 text-sm text-text-secondary">{item.text}</p>
      </div>
    );
  }
  if (item.type === "delete") {
    return (
      <div className="grid grid-cols-2 gap-px">
        <p className="whitespace-pre-wrap bg-danger-bg px-4 py-2 text-sm text-danger-text">
          <mark className="rounded bg-danger-border px-0.5 text-danger-text">{item.text}</mark>
        </p>
        <div className="bg-surface-subtle" />
      </div>
    );
  }
  if (item.type === "insert") {
    return (
      <div className="grid grid-cols-2 gap-px">
        <div className="bg-surface-subtle" />
        <p className="whitespace-pre-wrap bg-success-bg px-4 py-2 text-sm text-success-text">
          <mark className="rounded bg-success-border px-0.5 text-success-text">{item.text}</mark>
        </p>
      </div>
    );
  }
  // change — word-level diff
  const [oldSegs, newSegs] = diffWords(item.oldText, item.newText);
  return (
    <div className="grid grid-cols-2 gap-px">
      <p className="whitespace-pre-wrap bg-danger-bg px-4 py-2 text-sm leading-relaxed text-danger-text">
        <WordSpans segs={oldSegs} side="old" />
      </p>
      <p className="whitespace-pre-wrap bg-success-bg px-4 py-2 text-sm leading-relaxed text-success-text">
        <WordSpans segs={newSegs} side="new" />
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

type Props = {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
};

export function DiffView({ oldText, newText, oldLabel = "Previous", newLabel = "Current" }: Props) {
  const oldSents = tokenizeDocument(oldText);
  const newSents = tokenizeDocument(newText);

  const raw = lcsRaw(oldSents.map(fingerprint), newSents.map(fingerprint));
  const items = buildDiffItems(raw, oldSents, newSents);
  const grouped = groupItems(items);
  const changed = grouped.filter((g) => g.type !== "equal").length;

  return (
    <div className="overflow-hidden rounded-xl border border-border-default">
      {/* Column headers */}
      <div className="grid grid-cols-2 gap-px bg-surface-muted">
        <div className="bg-danger-bg px-4 py-2">
          <span className="text-xs font-semibold text-danger-text">{oldLabel}</span>
        </div>
        <div className="bg-success-bg px-4 py-2">
          <span className="text-xs font-semibold text-success-text">{newLabel}</span>
        </div>
      </div>

      {changed === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-text-muted">
          No differences — versions are identical.
        </div>
      ) : (
        <div className="divide-y divide-border-subtle">
          {grouped.map((item, i) => (
            <SentenceRow key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
