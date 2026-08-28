export type AgentModelConfig =
  | {
      provider: 'scripted';
      model: 'component-selecting-scripted';
    }
  | {
      provider: 'deepseek';
      model: string;
      apiKey: string;
      baseUrl: string;
    }
  | {
      provider: 'openai-compatible';
      model: string;
      apiKey: string;
      baseUrl: string;
    };

export interface AgentModelDescriptor {
  provider: AgentModelConfig['provider'];
  model: string;
}

export function resolveAgentModelConfig(
  environment: Record<string, string | undefined>
): AgentModelConfig {
  const provider = environment.AGENT_MODEL_PROVIDER?.trim() || 'scripted';
  if (provider === 'scripted') {
    return {
      provider,
      model: 'component-selecting-scripted'
    };
  }
  if (provider === 'openai-compatible') {
    const baseUrl = environment.OPENAI_COMPATIBLE_BASE_URL?.trim();
    if (!baseUrl) {
      throw new Error('OPENAI_COMPATIBLE_BASE_URL 未在服务端环境配置');
    }
    const apiKey = environment.OPENAI_COMPATIBLE_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('OPENAI_COMPATIBLE_API_KEY 未在服务端环境配置');
    }
    const model = environment.OPENAI_COMPATIBLE_MODEL?.trim();
    if (!model) {
      throw new Error('OPENAI_COMPATIBLE_MODEL 未在服务端环境配置');
    }
    return {
      provider,
      apiKey,
      model,
      baseUrl
    };
  }
  if (provider !== 'deepseek') {
    throw new Error(`不支持的 AGENT_MODEL_PROVIDER:${provider}`);
  }

  const apiKey = environment.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 未在服务端环境配置');
  }
  return {
    provider,
    apiKey,
    model: environment.DEEPSEEK_MODEL?.trim() || 'deepseek-v4-pro',
    baseUrl:
      environment.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com'
  };
}

export function agentModelDescriptor(
  config: AgentModelConfig
): AgentModelDescriptor {
  return {
    provider: config.provider,
    model: config.model
  };
}
