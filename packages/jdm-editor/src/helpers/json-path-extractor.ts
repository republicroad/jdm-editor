export interface JsonFieldInfo {
  path: string;
  name: string;
  line: number;
  column: number;
  lineEnd: number;
  lineEndColumn: number;
}

const isWhitespace = (char: string): boolean => {
  return /\s/.test(char);
};

const isQuote = (char: string): boolean => {
  return char === '"' || char === "'";
};

const parseString = (
  text: string,
  startIndex: number,
  currentLine: number,
  currentColumn: number,
): { value: string; endIndex: number; endLine: number; endColumn: number } => {
  const quoteChar = text[startIndex];
  let value = '';
  let i = startIndex + 1;
  let line = currentLine;
  let column = currentColumn;
  let escaped = false;

  while (i < text.length) {
    const char = text[i];

    if (escaped) {
      value += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === quoteChar) {
      return { value, endIndex: i, endLine: line, endColumn: column + 1 };
    } else {
      value += char;
    }

    if (char === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
    i++;
  }

  return { value, endIndex: text.length - 1, endLine: line, endColumn: column };
};

export const extractJsonFields = (jsonText: string): JsonFieldInfo[] => {
  const fields: JsonFieldInfo[] = [];
  const pathStack: string[] = [];
  let i = 0;
  let line = 1;
  let column = 1;

  // Precompute, for every line, the column just past its last non-whitespace char,
  // so each field's end position can be looked up in O(1) instead of rescanning the file.
  const lineEndByLine: number[] = [0];
  let scanLine = 1;
  let scanColumn = 1;
  let lastNonWhitespaceColumn = 1;
  for (let idx = 0; idx < jsonText.length; idx++) {
    const char = jsonText[idx];
    if (char === '\n') {
      lineEndByLine[scanLine] = lastNonWhitespaceColumn + 1;
      scanLine++;
      scanColumn = 1;
      lastNonWhitespaceColumn = 1;
    } else {
      if (!isWhitespace(char)) {
        lastNonWhitespaceColumn = scanColumn;
      }
      scanColumn++;
    }
  }
  lineEndByLine[scanLine] = lastNonWhitespaceColumn + 1;

  const skipWhitespace = () => {
    while (i < jsonText.length && isWhitespace(jsonText[i])) {
      if (jsonText[i] === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
      i++;
    }
  };

  const parseValue = () => {
    skipWhitespace();

    if (i >= jsonText.length) return;

    const char = jsonText[i];

    if (char === '{') {
      parseObject();
    } else if (char === '[') {
      parseArray();
    } else if (isQuote(char)) {
      const result = parseString(jsonText, i, line, column);
      i = result.endIndex + 1;
      line = result.endLine;
      column = result.endColumn;
    } else if (char === 't' || char === 'f') {
      // true or false
      while (i < jsonText.length && /[a-z]/.test(jsonText[i])) {
        i++;
        column++;
      }
    } else if (char === 'n') {
      // null
      while (i < jsonText.length && /[a-z]/.test(jsonText[i])) {
        i++;
        column++;
      }
    } else if (char === '-' || /[0-9]/.test(char)) {
      // number
      while (i < jsonText.length && /[0-9.eE+\-]/.test(jsonText[i])) {
        i++;
        column++;
      }
    }
  };

  const parseObject = () => {
    i++; // skip {
    column++;
    skipWhitespace();

    while (i < jsonText.length && jsonText[i] !== '}') {
      skipWhitespace();

      if (jsonText[i] === '}') break;

      // Parse key
      if (!isQuote(jsonText[i])) break;

      const keyStartLine = line;
      const keyStartColumn = column;
      const result = parseString(jsonText, i, line, column);
      const key = result.value;

      i = result.endIndex + 1;
      line = result.endLine;
      column = result.endColumn;

      const fieldPath = pathStack.length > 0 ? `${pathStack.join('.')}.${key}` : key;

      // Find the end of this line
      const lineEndInfo = lineEndByLine[keyStartLine] ?? 1;

      fields.push({
        path: fieldPath,
        name: key,
        line: keyStartLine,
        column: keyStartColumn,
        lineEnd: keyStartLine,
        lineEndColumn: lineEndInfo,
      });

      skipWhitespace();

      // Expect colon
      if (jsonText[i] !== ':') break;
      i++;
      column++;

      skipWhitespace();

      // Parse value
      const valueChar = jsonText[i];
      if (valueChar === '{') {
        pathStack.push(key);
        parseObject();
        pathStack.pop();
      } else if (valueChar === '[') {
        pathStack.push(key);
        parseArray();
        pathStack.pop();
      } else {
        parseValue();
      }

      skipWhitespace();

      // Expect comma or end
      if (jsonText[i] === ',') {
        i++;
        column++;
      }
    }

    if (i < jsonText.length && jsonText[i] === '}') {
      i++;
      column++;
    }
  };

  const parseArray = () => {
    i++; // skip [
    column++;
    skipWhitespace();

    let index = 0;
    while (i < jsonText.length && jsonText[i] !== ']') {
      skipWhitespace();

      if (jsonText[i] === ']') break;

      const valueChar = jsonText[i];
      if (valueChar === '{') {
        pathStack.push(String(index));
        parseObject();
        pathStack.pop();
      } else if (valueChar === '[') {
        pathStack.push(String(index));
        parseArray();
        pathStack.pop();
      } else {
        parseValue();
      }

      index++;
      skipWhitespace();

      if (jsonText[i] === ',') {
        i++;
        column++;
      }
    }

    if (i < jsonText.length && jsonText[i] === ']') {
      i++;
      column++;
    }
  };

  parseValue();

  return fields;
};
