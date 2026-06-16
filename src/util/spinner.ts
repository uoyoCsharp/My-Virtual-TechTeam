import ora, { type Ora } from "ora";

export type SpinnerHandle = Ora;

export function startSpinner(text: string): SpinnerHandle {
  return ora({ text, color: "cyan" }).start();
}

export async function withSpinner<T>(
  text: string,
  fn: () => Promise<T> | T,
  options: {
    successText?: string;
    failText?: string;
  } = {},
): Promise<T> {
  const spinner = startSpinner(text);
  try {
    const result = await fn();
    spinner.succeed(options.successText ?? text);
    return result;
  } catch (err) {
    spinner.fail(options.failText ?? text);
    throw err;
  }
}
