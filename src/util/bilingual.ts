/**
 * Combine an English string with its Chinese translation into a single
 * bilingual message. The English text always comes first, separated from the
 * Chinese text by " / ".
 *
 * @example
 *   bilingual("Install complete", "安装完成") // "Install complete / 安装完成"
 */
export function bilingual(en: string, zh: string): string {
  if (en === zh) return en; // Avoid redundancy when both languages are the same
  return `${en} / ${zh}`;
}
