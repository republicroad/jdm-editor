import { VariableType } from '@gorules/zen-engine-wasm';

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  nullable?: boolean;
};

const normalizeType = (schema: JsonSchema): string | undefined => {
  if (Array.isArray(schema.type)) {
    const preferredType = schema.type.find((type) => type !== 'null');
    return preferredType ?? schema.type[0];
  }

  return schema.type;
};

export const jsonSchemaToVariableType = (schema?: JsonSchema | null): VariableType => {
  if (!schema || typeof schema !== 'object') {
    return VariableType.fromJson('Any');
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return jsonSchemaToVariableType(schema.oneOf[0]);
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return jsonSchemaToVariableType(schema.anyOf[0]);
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return schema.allOf.reduce(
      (acc, item) => acc.merge(jsonSchemaToVariableType(item)),
      VariableType.fromJson({ Object: {} }),
    );
  }

  const schemaType = normalizeType(schema);
  switch (schemaType) {
    case 'object': {
      const objectType = VariableType.fromJson({ Object: {} });
      Object.entries(schema.properties ?? {}).forEach(([key, value]) => {
        objectType.set(key, jsonSchemaToVariableType(value));
      });

      return objectType;
    }
    case 'array': {
      const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
      return jsonSchemaToVariableType(itemSchema).toArray();
    }
    case 'string':
      return VariableType.fromJson('String');
    case 'boolean':
      return VariableType.fromJson('Bool');
    case 'number':
    case 'integer':
      return VariableType.fromJson('Number');
    case 'null':
      return VariableType.fromJson('Null');
    default: {
      if (schema.properties) {
        return jsonSchemaToVariableType({ ...schema, type: 'object' });
      }

      if (schema.items) {
        return jsonSchemaToVariableType({ ...schema, type: 'array' });
      }

      if (schema.nullable) {
        return VariableType.fromJson('Null');
      }

      return VariableType.fromJson('Any');
    }
  }
};
