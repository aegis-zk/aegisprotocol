import { defineConfig } from 'tsup';
import { copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  // SDK library
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    onSuccess: async () => {
      // Bundle the compiled circuit artifact into dist/ so consumers don't need the circuits package
      const src = resolve(__dir, '../circuits/target/attestation.json');
      const dest = resolve(__dir, 'dist/attestation.json');
      if (existsSync(src)) {
        copyFileSync(src, dest);
        console.log('Copied attestation.json circuit artifact to dist/');
      } else {
        console.warn('Warning: circuits/target/attestation.json not found — circuit artifact not bundled');
      }
    },
  },
  // MCP server CLI
  {
    entry: ['src/mcp/server.ts'],
    format: ['esm'],
    outDir: 'dist/mcp',
    target: 'node20',
    platform: 'node',
    dts: false,
    sourcemap: true,
    clean: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
