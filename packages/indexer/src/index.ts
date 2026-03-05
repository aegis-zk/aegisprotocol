import { serve } from '@hono/node-server';
import { app } from './server.js';
import { config, chainConfig } from './config.js';
import { initDb, closeDb } from './db/index.js';
import { initSync } from './sync/index.js';

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log('  AEGIS Protocol Indexer v0.1.0');
  console.log('═══════════════════════════════════════════');
  console.log(`  Chain:    ${config.chainId}`);
  console.log(`  Registry: ${chainConfig.registryAddress}`);
  console.log(`  RPC:      ${config.rpcUrl}`);
  console.log(`  DB:       ${config.dbPath}`);
  console.log(`  Port:     ${config.port}`);
  console.log('───────────────────────────────────────────');

  // Initialize DB (loads WASM SQLite, creates tables if needed)
  await initDb();

  // Start syncing events from chain
  const stopSync = await initSync();

  // Start HTTP server
  const server = serve({
    fetch: app.fetch,
    port: config.port,
  });

  console.log(`[server] Listening on http://localhost:${config.port}`);

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[shutdown] Stopping...');
    stopSync();
    closeDb();
    server.close(() => {
      console.log('[shutdown] Done');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
