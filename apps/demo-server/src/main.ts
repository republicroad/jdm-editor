import { createApp } from './app';

const port = Number(process.env.PORT ?? 8787);

const server = Bun.serve({
  port,
  fetch: createApp().fetch,
});

console.log(`[demo-server] listening on http://localhost:${port} (demo only — no auth, no storage)`);

process.on('SIGINT', () => server.stop(true));
process.on('SIGTERM', () => server.stop(true));
