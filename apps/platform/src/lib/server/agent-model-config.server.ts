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
