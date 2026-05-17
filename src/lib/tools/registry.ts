import type { Tool } from "./types";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool already registered: ${tool.id}`);
    }
    this.tools.set(tool.id, tool);
  }

  get(id: string): Tool {
    const tool = this.tools.get(id);
    if (!tool) {
      throw new Error(`Tool not registered: ${id}`);
    }
    return tool;
  }

  has(id: string): boolean {
    return this.tools.has(id);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }
}

export const tools = new ToolRegistry();
