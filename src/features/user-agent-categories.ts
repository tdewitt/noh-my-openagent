import type { CategoriesConfig, CategoryConfig } from "../config/schema"
import type { OhMyOpenCodeConfig } from "../config"
import type { ClaudeCodeAgentConfig } from "./claude-code-agent-loader"
import {
  loadUserAgents,
  loadProjectAgents,
  loadOpencodeGlobalAgents,
  loadOpencodeProjectAgents,
  loadAgentsFromDir,
} from "./claude-code-agent-loader"
import { DEFAULT_CATEGORIES } from "../tools/delegate-task/constants"
import { log } from "../shared/logger"

const TEMPERATURE_MIN = 0
const TEMPERATURE_MAX = 2

function agentConfigToCategory(config: ClaudeCodeAgentConfig): CategoryConfig | null {
  const model = typeof config.model === "string"
    ? config.model
    : config.model
      ? `${config.model.providerID}/${config.model.modelID}`
      : undefined

  if (!config.prompt) return null

  // Strip the scope prefix ("(user) ...", "(project) ...") injected by parseMarkdownAgentFile.
  // The scope prefix is useful for agent-switcher UI but is noise in Sisyphus's category table.
  const rawDescription = (config.description as string | undefined) ?? ""
  const description = rawDescription.replace(/^\([^)]+\)\s*/, "").trim() || undefined

  // Clamp temperature to the valid API range [0, 2]. Out-of-range values bypass Zod
  // (auto-generated categories are not re-validated) and cause API errors at task runtime.
  let temperature: number | undefined
  if (typeof config.temperature === "number") {
    temperature = Math.min(TEMPERATURE_MAX, Math.max(TEMPERATURE_MIN, config.temperature))
  }

  const category: CategoryConfig = {
    ...(model ? { model } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(description ? { description } : {}),
    prompt_append: config.prompt as string,
  }

  return category
}

function collectAgentsFromPaths(
  paths: string[],
): Record<string, ClaudeCodeAgentConfig> {
  const result: Record<string, ClaudeCodeAgentConfig> = Object.create(null)
  for (const dirPath of paths) {
    const expanded = dirPath === "~" || dirPath.startsWith("~/")
      ? dirPath.replace("~", process.env.HOME ?? "")
      : dirPath
    const agents = loadAgentsFromDir(expanded, "user")
    for (const agent of agents) {
      result[agent.name] = agent.config
    }
  }
  return result
}

/**
 * Generate CategoriesConfig entries from user-defined agent .md files.
 * Each agent becomes a category that Sisyphus can delegate to via task(category="agent-name").
 */
export function generateUserAgentCategories(
  pluginConfig: OhMyOpenCodeConfig,
  directory: string,
): CategoriesConfig {
  const disableSet = new Set(
    (pluginConfig.user_agents?.disable ?? []).map(n => n.toLowerCase()),
  )

  // Normalize override keys to lowercase so lookup is case-insensitive, matching disable semantics.
  const rawOverrides = pluginConfig.user_agents?.overrides ?? {}
  const overrides: Record<string, typeof rawOverrides[string]> = Object.create(null)
  for (const [k, v] of Object.entries(rawOverrides)) {
    overrides[k.toLowerCase()] = v
  }

  // Load agents from all default scopes
  // Project-level agents override user-level (later entries win in the merge)
  const allAgents: Record<string, ClaudeCodeAgentConfig> = {
    ...loadUserAgents(),
    ...loadOpencodeGlobalAgents(),
    ...loadProjectAgents(directory),
    ...loadOpencodeProjectAgents(directory),
  }

  // Load agents from additional configured paths
  const extraPaths = pluginConfig.user_agents?.paths ?? []
  if (extraPaths.length > 0) {
    const extraAgents = collectAgentsFromPaths(extraPaths)
    Object.assign(allAgents, extraAgents)
  }

  const categories: CategoriesConfig = {}
  let generated = 0

  for (const [name, config] of Object.entries(allAgents)) {
    if (disableSet.has(name.toLowerCase())) continue

    const category = agentConfigToCategory(config)
    if (!category) continue

    // Apply overrides from user_agents.overrides config (lookup is case-insensitive via normalized keys)
    const override = overrides[name.toLowerCase()]
    if (override) {
      if (override.model) category.model = override.model
      if (typeof override.temperature === "number") {
        category.temperature = Math.min(TEMPERATURE_MAX, Math.max(TEMPERATURE_MIN, override.temperature))
      }
      if (override.description) category.description = override.description
      if (override.disable) continue
    }

    if (DEFAULT_CATEGORIES[name] !== undefined) {
      log("[user-agent-categories] User agent name collides with builtin category — builtin model config will be replaced", {
        name,
      })
    }

    categories[name] = category
    generated++
  }

  if (generated > 0) {
    log("[user-agent-categories] Generated categories from user agents", {
      count: generated,
      names: Object.keys(categories),
    })
  }

  return categories
}

/**
 * Augment pluginConfig.categories with auto-generated categories from user agent .md files.
 * Explicit user categories in config take precedence over auto-generated ones.
 * Also propagates user_agents.disable into pluginConfig.disabled_agents.
 */
export function augmentCategoriesFromUserAgents(
  pluginConfig: OhMyOpenCodeConfig,
  directory: string,
): void {
  const agentCategories = generateUserAgentCategories(pluginConfig, directory)
  if (Object.keys(agentCategories).length === 0) return

  // Auto-generated categories have lower priority than explicit user config
  pluginConfig.categories = {
    ...agentCategories,
    ...(pluginConfig.categories ?? {}),
  }

  // Propagate disabled user agents so they don't register as named agents either
  const disableList = pluginConfig.user_agents?.disable
  if (disableList && disableList.length > 0) {
    pluginConfig.disabled_agents = [
      ...(pluginConfig.disabled_agents ?? []),
      ...disableList,
    ]
  }
}
