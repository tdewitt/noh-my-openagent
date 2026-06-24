export type AgentScope = "user" | "project" | "opencode" | "opencode-project" | "definition-file" | "opencode-config"

export type PermissionValue = "ask" | "allow" | "deny"

/** Subset of upstream AgentPermissionSchema (config/schema/internal/permission.ts) exposable via markdown frontmatter. */
export interface AgentFrontmatterPermission {
  edit?: PermissionValue
  bash?: PermissionValue | Record<string, PermissionValue>
  webfetch?: PermissionValue
  task?: PermissionValue
}

export type ClaudeCodeAgentConfig = {
  description?: string
  mode?: "subagent" | "primary" | "all"
  prompt?: string
  tools?: Record<string, boolean>
  model?: string | { providerID: string; modelID: string }
  temperature?: number
  permission?: AgentFrontmatterPermission
}

export interface AgentFrontmatter {
  name?: string
  description?: string
  model?: string
  tools?: string
  mode?: "subagent" | "primary" | "all"
  temperature?: number
  permission?: AgentFrontmatterPermission
}

export interface AgentJsonDefinition {
  name: string
  description?: string
  model?: string
  tools?: string | string[]
  mode?: "subagent" | "primary" | "all"
  prompt: string
}

export interface LoadedAgent {
  name: string
  path: string
  config: ClaudeCodeAgentConfig
  scope: AgentScope
}
