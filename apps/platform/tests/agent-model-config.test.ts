import { describe, expect, it } from 'vitest';
import {
  agentModelDescriptor,
  resolveAgentModelConfig
} from '../src/lib/server/agent-model-config.server';

describe('Agent 模型配置', () => {
  it('未知 provider 直接失败，不静默回退 scripted adapter', () => {
    expect(() =>
      resolveAgentModelConfig({
        AGENT_MODEL_PROVIDER: 'deepssek'
      })
    ).toThrow('不支持的 AGENT_MODEL_PROVIDER:deepssek');
  });

  it('DeepSeek 缺少 Key 时直接失败', () => {
    expect(() =>
      resolveAgentModelConfig({
        AGENT_MODEL_PROVIDER: 'deepseek',
        DEEPSEEK_API_KEY: '',
        DEEPSEEK_MODEL: 'deepseek-v4-flash'
      })
    ).toThrow('DEEPSEEK_API_KEY 未在服务端环境配置');
  });

  it('OpenAI 兼容 provider 解析显式的内网端点、凭据与模型', () => {
    const config = resolveAgentModelConfig({
      AGENT_MODEL_PROVIDER: 'openai-compatible',
      OPENAI_COMPATIBLE_API_KEY: '  server-only-compatible-secret  ',
      OPENAI_COMPATIBLE_MODEL: '  intranet-chat-model  ',
      OPENAI_COMPATIBLE_BASE_URL: '  https://models.intranet.example/v1  '
    });

    expect(config).toEqual({
      provider: 'openai-compatible',
      apiKey: 'server-only-compatible-secret',
      model: 'intranet-chat-model',
      baseUrl: 'https://models.intranet.example/v1'
    });
    expect(agentModelDescriptor(config)).toEqual({
      provider: 'openai-compatible',
      model: 'intranet-chat-model'
    });
    expect(JSON.stringify(agentModelDescriptor(config))).not.toContain('compatible-secret');
    expect(JSON.stringify(agentModelDescriptor(config))).not.toContain('models.intranet.example');
  });

  it('OpenAI 兼容 provider 缺少 Base URL 时直接失败', () => {
    expect(() =>
      resolveAgentModelConfig({
        AGENT_MODEL_PROVIDER: 'openai-compatible',
        OPENAI_COMPATIBLE_API_KEY: 'server-only-compatible-secret',
        OPENAI_COMPATIBLE_MODEL: 'intranet-chat-model',
        OPENAI_COMPATIBLE_BASE_URL: '  '
      })
    ).toThrow('OPENAI_COMPATIBLE_BASE_URL 未在服务端环境配置');
  });

  it('OpenAI 兼容 provider 缺少凭据时直接失败', () => {
    expect(() =>
      resolveAgentModelConfig({
        AGENT_MODEL_PROVIDER: 'openai-compatible',
        OPENAI_COMPATIBLE_API_KEY: '',
        OPENAI_COMPATIBLE_MODEL: 'intranet-chat-model',
        OPENAI_COMPATIBLE_BASE_URL: 'https://models.intranet.example/v1'
      })
    ).toThrow('OPENAI_COMPATIBLE_API_KEY 未在服务端环境配置');
  });

  it('OpenAI 兼容 provider 缺少模型名时直接失败', () => {
    expect(() =>
      resolveAgentModelConfig({
        AGENT_MODEL_PROVIDER: 'openai-compatible',
        OPENAI_COMPATIBLE_API_KEY: 'server-only-compatible-secret',
        OPENAI_COMPATIBLE_MODEL: '  ',
        OPENAI_COMPATIBLE_BASE_URL: 'https://models.intranet.example/v1'
      })
    ).toThrow('OPENAI_COMPATIBLE_MODEL 未在服务端环境配置');
  });

  it('只把 provider 与模型名暴露给工作台，不暴露 Key 或 Base URL', () => {
    const config = resolveAgentModelConfig({
      AGENT_MODEL_PROVIDER: 'deepseek',
      DEEPSEEK_API_KEY: 'server-only-secret',
      DEEPSEEK_MODEL: 'deepseek-v4-flash',
      DEEPSEEK_BASE_URL: 'https://api.deepseek.com'
    });

    expect(agentModelDescriptor(config)).toEqual({
      provider: 'deepseek',
      model: 'deepseek-v4-flash'
    });
    expect(JSON.stringify(agentModelDescriptor(config))).not.toContain(
      'server-only-secret'
    );
    expect(JSON.stringify(agentModelDescriptor(config))).not.toContain(
      'api.deepseek.com'
    );
  });
});
