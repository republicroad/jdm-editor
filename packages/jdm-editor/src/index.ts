import './styles.scss';

export * from './components';
export * from './theme';
export * from './locales';

export { codemirror } from './helpers/codemirror';
export { useNodeType } from './helpers/node-type';
export { usePersistentState } from './helpers/use-persistent-state';
export { ensureWasmLoaded, useWasmReady } from './helpers/wasm';
export * from './helpers/schema';

// for web browser https protocol, crypto is work.
// for web browser http protocol, crypto.randomUUID is undefined for security.
// so mock it when no this function.
// Example of a basic polyfill for environments without crypto.randomUUID
if (typeof crypto.randomUUID !== 'function') {
    crypto.randomUUID = function () {
        // 生成uuid4格式字符串
        const s = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        // const [p1,p2,p3,p4,p5] = s.split('-');
        // return `${p1}-${p2}-${p3}-${p4}-${p5}` as `${string}-${string}-${string}-${string}-${string}`;
        return s as `${string}-${string}-${string}-${string}-${string}`;
    };
}

