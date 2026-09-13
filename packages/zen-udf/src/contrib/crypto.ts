// crypto 域(摘要签名，有专属 UI 设计，文件名即 namespace)
import { createHash, createHmac } from 'node:crypto';

import { defineContrib, defineTool } from '../register.ts';

const CRYPTO_ALGORITHMS = new Set(['md5', 'sha1', 'sha256', 'sha512']);
const CRYPTO_ENCODINGS = new Set(['hex', 'base64', 'base64url']);

export default defineContrib(import.meta.url, {
  tools: [
    defineTool({
      name: 'crypto',
      description:
        '计算字符串摘要或 HMAC 签名，返回摘要字符串. algorithm 支持 md5/sha1/sha256/sha512(非法值回退 sha256)，' +
        'secret 非空时启用 HMAC 模式，encoding 支持 hex/base64/base64url(非法值回退 hex)，upper 仅对 hex 生效(大写输出).',
      parametersSchema: {
        properties: {
          input: {
            type: 'string',
            title: 'Input',
            description: '待摘要内容',
          },
          algorithm: {
            type: 'string',
            title: 'Algorithm',
            description: '摘要算法(md5/sha1/sha256/sha512)，默认 sha256，非法值回退 sha256',
            default: 'sha256',
          },
          secret: {
            type: 'string',
            title: 'Secret',
            description: 'HMAC 密钥，非空启用 HMAC 模式，留空则为普通摘要',
            default: '',
          },
          encoding: {
            type: 'string',
            title: 'Encoding',
            description: '输出编码(hex/base64/base64url)，默认 hex，非法值回退 hex',
            default: 'hex',
          },
          upper: {
            type: 'boolean',
            title: 'Upper',
            description: 'hex 输出转大写(仅 encoding=hex 时生效)，默认 false',
            default: false,
          },
        },
        required: ['input'],
        title: 'crypto',
        type: 'object',
      },
      returnsSchema: { type: 'string', title: 'crypto 函数返回', properties: {} },
      fn: function cryptoDigestUdf(kwargs: Record<string, unknown>) {
        const input = String(kwargs?.input ?? '');
        const algorithmRaw = String(kwargs?.algorithm ?? 'sha256')
          .trim()
          .toLowerCase();
        const algorithm = CRYPTO_ALGORITHMS.has(algorithmRaw) ? algorithmRaw : 'sha256';
        const secret = String(kwargs?.secret ?? '');
        const encodingRaw = String(kwargs?.encoding ?? 'hex')
          .trim()
          .toLowerCase();
        const encoding = CRYPTO_ENCODINGS.has(encodingRaw) ? encodingRaw : 'hex';
        const upper = kwargs?.upper === true;

        const algo = algorithm as 'md5' | 'sha1' | 'sha256' | 'sha512';
        const hasher = secret ? createHmac(algo, secret) : createHash(algo);
        hasher.update(input);
        const digest = hasher.digest(encoding as 'hex' | 'base64' | 'base64url');
        return upper && encoding === 'hex' ? digest.toUpperCase() : digest;
      },
    }),
  ],
});
