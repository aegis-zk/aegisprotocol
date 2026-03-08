// If called with "setup", run the interactive installer instead of the MCP server
if (process.argv[2] === 'setup') {
  const { runSetup } = await import('./setup.js');
  runSetup();
} else {
  // Default: run as MCP stdio server
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { registerAllTools } = await import('./tools/index.js');

  const server = new McpServer({
    name: 'aegis-protocol',
    version: '0.5.0',
  });

  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
