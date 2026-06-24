import { z } from "zod"

const UserAgentOverrideSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  description: z.string().optional(),
  disable: z.boolean().optional(),
})

export const UserAgentsConfigSchema = z.object({
  /** Additional directories to scan for agent .md files (beyond defaults) */
  paths: z.array(z.string()).optional(),
  /** Override specific user agent settings (keyed by agent name) */
  overrides: z.record(z.string(), UserAgentOverrideSchema).optional(),
  /** Disable specific user agents from category generation and Sisyphus delegation */
  disable: z.array(z.string()).optional(),
})

export type UserAgentsConfig = z.infer<typeof UserAgentsConfigSchema>
export type UserAgentOverride = z.infer<typeof UserAgentOverrideSchema>
