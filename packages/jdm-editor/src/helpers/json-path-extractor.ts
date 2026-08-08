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

  throw new Error('Unterminated string');
};

export const extractJsonFields = (jsonText: string): JsonFieldInfo[] => {
  const fields: JsonFieldInfo[] = [];
  const pathStack: string[] = [];
  let i = 0;
  let line = 1;
  let column = 1;

  // Helper function to find the end of a specific line
  const findLineEnd = (targetLine: number): { lineEnd: number; lineEndColumn: number } => {
    let currentLine = 1;
    let currentColumn = 1;
    let lastNonWhitespaceColumn = 1;
    let idx = 0;

    while (idx < jsonText.length) {
      const char = jsonText[idx];

      if (currentLine === targetLine) {
        if (char === '\n') {
          return { lineEnd: targetLine, lineEndColumn: lastNonWhitespaceColumn + 1 };
        }
        if (!isWhitespace(char)) {
          lastNonWhitespaceColumn = currentColumn;
        }
      } else if (currentLine > targetLine) {
        break;
      }

      if (char === '\n') {
        currentLine++;
        currentColumn = 1;
        lastNonWhitespaceColumn = 1;
      } else {
        currentColumn++;
      }
      idx++;
    }

    // If we reached the end of the file on the target line
    if (currentLine === targetLine) {
      return { lineEnd: targetLine, lineEndColumn: lastNonWhitespaceColumn + 1 };
    }

    return { lineEnd: targetLine, lineEndColumn: 1 };
  };

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
      const lineEndInfo = findLineEnd(keyStartLine);

      fields.push({
        path: fieldPath,
        name: key,
        line: keyStartLine,
        column: keyStartColumn,
        lineEnd: lineEndInfo.lineEnd,
        lineEndColumn: lineEndInfo.lineEndColumn,
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
