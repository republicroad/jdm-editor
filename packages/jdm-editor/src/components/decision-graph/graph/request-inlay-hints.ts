import type { editor, languages } from 'monaco-editor';

import type { RequestDefinition } from '../../../helpers/request-schema';
import { extractJsonFields } from '../../../helpers/json-path-extractor';

export function registerJsonInlayHintsProvider(
  monaco: typeof import('monaco-editor'),
  targetModel: editor.ITextModel,
  getDefinitions: () => RequestDefinition[],
): { dispose(): void } {
  return monaco.languages.registerInlayHintsProvider('json', {
    provideInlayHints: (model: editor.ITextModel): languages.InlayHintList => {
      if (model !== targetModel) {
        return { hints: [], dispose: () => {} };
      }

      const jsonText = model.getValue();
      const fields = extractJsonFields(jsonText);
      const descriptionMap = new Map<string, string>();

      const definitions = getDefinitions();
      definitions.forEach((def) => {
        if (def.description && def.description.trim()) {
          descriptionMap.set(def.path, def.description.trim());
        }
      });

      const hints: languages.InlayHint[] = [];

      fields.forEach((field) => {
        const description = descriptionMap.get(field.path);
        if (description) {
          hints.push({
            kind: monaco.languages.InlayHintKind.Type,
            position: {
              lineNumber: field.lineEnd,
              column: field.lineEndColumn,
            },
            label: `// ${description}`,
            paddingLeft: true,
          });
        }
      });

      return { hints, dispose: () => {} };
    },
  });
}
