import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';

const SERVER_ENTRY = {
  command: 'npx',
  args: ['-y', '@aegisaudit/mcp-server'],
  env: { AEGIS_CHAIN_ID: '8453' },
};

interface Target {
  name: string;
  configPath: string;
  detect: () => boolean;
}

function getClaudeDesktopPath(): string {
  const p = platform();
  if (p === 'darwin') return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  if (p === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  return join(homedir(), '.config', 'claude', 'claude_desktop_config.json');
}

function getClaudeCodePath(): string {
  const p = platform();
  if (p === 'darwin') return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  if (p === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  return join(homedir(), '.config', 'claude', 'claude_desktop_config.json');
}

function getCursorMcpPath(): string {
  return join(homedir(), '.cursor', 'mcp.json');
}

const TARGETS: Target[] = [
  {
    name: 'Claude Desktop',
    configPath: getClaudeDesktopPath(),
    detect: () => {
      const dir = join(getClaudeDesktopPath(), '..');
      return existsSync(dir);
    },
  },
  {
    name: 'Cursor',
    configPath: getCursorMcpPath(),
    detect: () => existsSync(join(homedir(), '.cursor')),
  },
];

function injectConfig(configPath: string, targetName: string): boolean {
  let config: Record<string, unknown> = {};

  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      console.log(`  ${RED}✗${RESET} Could not parse ${configPath}`);
      return false;
    }
  }

  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    config.mcpServers = {};
  }

  const servers = config.mcpServers as Record<string, unknown>;

  if (servers['aegis-protocol']) {
    console.log(`  ${YELLOW}●${RESET} ${targetName} — already configured, skipping`);
    return true;
  }

  servers['aegis-protocol'] = SERVER_ENTRY;

  // Ensure directory exists
  const dir = join(configPath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log(`  ${GREEN}✓${RESET} ${targetName} — configured at ${DIM}${configPath}${RESET}`);
  return true;
}

export function runSetup(): void {
  console.log();
  console.log(`  ${BOLD}${CYAN}◆ AEGIS Protocol${RESET} — MCP Server Setup`);
  console.log(`  ${DIM}Configures your AI clients to use the AEGIS MCP tools${RESET}`);
  console.log();

  let configured = 0;

  for (const target of TARGETS) {
    if (target.detect()) {
      const ok = injectConfig(target.configPath, target.name);
      if (ok) configured++;
    } else {
      console.log(`  ${DIM}○ ${target.name} — not detected, skipping${RESET}`);
    }
  }

  console.log();

  if (configured > 0) {
    console.log(`  ${GREEN}${BOLD}Done!${RESET} Restart your AI client to load the AEGIS tools.`);
    console.log(`  ${DIM}The server connects to Base Mainnet by default.${RESET}`);
  } else {
    console.log(`  ${YELLOW}No supported AI clients detected.${RESET}`);
    console.log(`  ${DIM}You can manually add the following to your MCP config:${RESET}`);
    console.log();
    console.log(`  ${DIM}${JSON.stringify({ 'aegis-protocol': SERVER_ENTRY }, null, 2).split('\n').join('\n  ')}${RESET}`);
  }

  console.log();
}
