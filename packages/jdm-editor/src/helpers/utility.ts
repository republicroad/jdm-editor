const unsecuredCopyToClipboard = (text: string) => {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Unable to copy to clipboard', err);
  }
  document.body.removeChild(textArea);
};

export const copyToClipboard = async (content: string) => {
  if (window.isSecureContext && navigator.clipboard) {
    await navigator.clipboard.writeText(content);
  } else {
    unsecuredCopyToClipboard(content);
  }
};

export const pasteFromClipboard = async (): Promise<string> => {
  try {
    return navigator.clipboard.readText();
  } catch {
    return '';
  }
};

export const get = <T>(obj: any, path: string, defaultValue: T): T => {
  return path.split('.').reduce((a, c) => (a && a[c] ? a[c] : defaultValue || null), obj) as T;
};

export const smartSplit = (str: string): string[] => {
  if (!str || typeof str !== 'string') {
    return [''];
  }

  const regex = /;;(?=(?:[^"'`]*["'`][^"'`]*["'`])*[^"'`]*$)/;
  return str.split(regex);
};

export const toOperatorExprArray = (value: string | string[]): string[] => {
  if (Array.isArray(value)) {
    return value;
  }

  return smartSplit(value);
};

export const toOperatorExprString = (value: string | string[]): string => {
  if (Array.isArray(value)) {
    return value.join(';;');
  }

  return value;
};

export const toOperatorExprDisplay = (value: string | string[]): string => {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  return value;
};

export const parseOperatorExprInput = (text: string): string | string[] => {
  const trimmed = text.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        return parsed;
      }
    } catch {
      // fall through
    }
  }

  return text.includes(';;') ? smartSplit(text) : text;
};

export const normalizeOperatorExprValue = (value: unknown): unknown => {
  if (typeof value === 'string' && value.includes(';;')) {
    return smartSplit(value);
  }

  return value;
};

export const normalizeCustomNodeExpressions = <T extends { type?: string }>(nodes: T[]): T[] =>
  nodes.map((node) => {
    if (node?.type !== 'customNode') {
      return node;
    }

    const content = (node as { content?: { config?: any } }).content;
    const config = content?.config;
    if (!config || !Array.isArray(config.expressions)) {
      return node;
    }

    return {
      ...node,
      content: {
        ...content,
        config: {
          ...config,
          expressions: config.expressions.map((expr: any) => ({
            ...expr,
            value: normalizeOperatorExprValue(expr?.value),
          })),
          expr_asts: Array.isArray(config.expr_asts)
            ? config.expr_asts.map((ast: any) => ({ ...ast, value: normalizeOperatorExprValue(ast?.value) }))
            : config.expr_asts,
        },
      },
    };
  });
