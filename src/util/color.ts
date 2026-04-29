const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

function wrap(code: number, text: string): string {
  return useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}

export const color = {
  green: (s: string) => wrap(32, s),
  yellow: (s: string) => wrap(33, s),
  red: (s: string) => wrap(31, s),
  cyan: (s: string) => wrap(36, s),
  gray: (s: string) => wrap(90, s),
  bold: (s: string) => wrap(1, s),
};
