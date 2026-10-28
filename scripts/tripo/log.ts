const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  dim: wrap("2"),
  bold: wrap("1"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  blue: wrap("34"),
  magenta: wrap("35"),
  cyan: wrap("36"),
};

const stamp = () => new Date().toISOString().slice(11, 19);

export const log = {
  info: (msg: string) => console.log(`${c.dim(stamp())} ${msg}`),
  step: (msg: string) => console.log(`${c.dim(stamp())} ${c.cyan("▸")} ${msg}`),
  ok: (msg: string) => console.log(`${c.dim(stamp())} ${c.green("✔")} ${msg}`),
  warn: (msg: string) => console.warn(`${c.dim(stamp())} ${c.yellow("!")} ${msg}`),
  error: (msg: string) => console.error(`${c.dim(stamp())} ${c.red("✖")} ${msg}`),
};

export const table = (rows: string[][], header: string[]) => {
  const all = [header, ...rows];
  const widths = header.map((_, i) => Math.max(...all.map((r) => stripAnsi(r[i] ?? "").length)));
  const fmt = (r: string[]) =>
    r.map((cell, i) => cell + " ".repeat(Math.max(0, widths[i] - stripAnsi(cell).length))).join("  ");
  console.log(c.bold(fmt(header)));
  console.log(c.dim(widths.map((w) => "─".repeat(w)).join("  ")));
  for (const r of rows) console.log(fmt(r));
};

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
