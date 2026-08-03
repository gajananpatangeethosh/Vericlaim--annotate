export type AIProvider =
  | 'openrouter'
  | 'groq'
  | 'gemini'
  | 'nvidia'
  | 'cerebras'
  | 'mistral'
  | 'together'

export interface ProviderConfig {
  id: AIProvider
  label: string
  baseUrl: string
  models: string[]
  defaultModel: string
  keyPlaceholder: string
}

export const PROVIDERS: Record<AIProvider, ProviderConfig> = {
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    models: ['openrouter/free'],
    defaultModel: 'openrouter/free',
    keyPlaceholder: 'sk-or-...',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'deepseek-r1-distill-llama-70b',
    ],
    defaultModel: 'llama-3.3-70b-versatile',
    keyPlaceholder: 'gsk_...',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    defaultModel: 'gemini-2.5-flash',
    keyPlaceholder: 'AIza...',
  },
  nvidia: {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
    models: [
      'deepseek-ai/deepseek-v4-flash',
      'z-ai/glm-5.2',
      'meta/llama-3.3-70b-instruct',
      'minimaxai/minimax-m3',
    ],
    defaultModel: 'deepseek-ai/deepseek-v4-flash',
    keyPlaceholder: 'nvapi-...',
  },
  cerebras: {
    id: 'cerebras',
    label: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1/chat/completions',
    models: ['gpt-oss-120b', 'llama-3.3-70b', 'zai-glm-4.7'],
    defaultModel: 'gpt-oss-120b',
    keyPlaceholder: 'cerebras...',
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    models: [
      'mistral-small-latest',
      'open-mistral-nemo',
      'ministral-8b-latest',
    ],
    defaultModel: 'mistral-small-latest',
    keyPlaceholder: 'MISTRAL...',
  },
  together: {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1/chat/completions',
    models: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
      'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free',
      'meta-llama/Llama-Vision-Free',
    ],
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
    keyPlaceholder: 'tgp...',
  },
}

export const PROVIDER_IDS: AIProvider[] = [
  'openrouter',
  'groq',
  'gemini',
  'nvidia',
  'cerebras',
  'mistral',
  'together',
]

export function getProviderConfig(provider: AIProvider): ProviderConfig {
  return PROVIDERS[provider] || PROVIDERS.openrouter
}

export function isModelInProvider(provider: AIProvider, model: string): boolean {
  return PROVIDERS[provider].models.includes(model)
}
