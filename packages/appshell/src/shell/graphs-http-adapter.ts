import axios from 'axios';

import { type GraphPersistenceAdapter, GraphPersistenceError, type GraphRecordMeta } from './persistence';

interface HttpGraphMeta {
  id: string;
  name: string;
  description?: string;
  owner?: string;
  tags?: string[];
  extensions?: Record<string, unknown>;
  revision: string;
  auto?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface HttpGraph extends HttpGraphMeta {
  content: Record<string, unknown>;
}

/**
 * 将 /api/graphs 参考实现封装为 GraphPersistenceAdapter。
 * 宿主可原样复用，或照此实现自己的后端(契约见 persistence.ts)。
 * 404 → load 返回 null / delete 返回 false；409 CONFLICT → 抛 GraphPersistenceError。
 */
export const createGraphsHttpAdapter = (baseUrl = '/api/graphs'): GraphPersistenceAdapter => {
  const toMeta = (m: HttpGraphMeta): GraphRecordMeta => ({
    id: m.id,
    name: m.name,
    description: m.description,
    owner: m.owner,
    tags: m.tags,
    extensions: m.extensions,
    revision: m.revision,
    auto: m.auto,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  });

  return {
    async list(query) {
      const { data } = await axios.get<HttpGraphMeta[]>(baseUrl, { params: query });
      return data.map(toMeta);
    },

    async load(id, opts) {
      try {
        const { data } = await axios.get<HttpGraph>(`${baseUrl}/${encodeURIComponent(id)}`, {
          params: opts?.revision ? { revision: opts.revision } : undefined,
        });
        return { ...toMeta(data), content: data.content };
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 404) return null;
        throw e;
      }
    },

    async save(record, opts) {
      const { id, ...body } = record;
      try {
        const url = id ? `${baseUrl}/${encodeURIComponent(id)}` : baseUrl;
        const method = id ? 'put' : 'post';
        const { data } = await axios[method]<{ id: string; revision: string }>(url, {
          ...body,
          baseRevision: opts?.baseRevision,
        });
        return data;
      } catch (e) {
        if (axios.isAxiosError(e)) {
          const code = e.response?.data?.error?.code;
          if (e.response?.status === 409 || code === 'CONFLICT') {
            throw new GraphPersistenceError(
              'CONFLICT',
              `base revision ${opts?.baseRevision ?? '(none)'} does not match head`,
            );
          }
        }
        throw e;
      }
    },

    async delete(id) {
      try {
        await axios.delete(`${baseUrl}/${encodeURIComponent(id)}`);
        return true;
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 404) return false;
        throw e;
      }
    },

    async listVersions(id) {
      const { data } = await axios.get<Array<{ revision: string; updatedAt?: string; auto?: boolean }>>(
        `${baseUrl}/${encodeURIComponent(id)}/versions`,
      );
      return data;
    },
  };
};
