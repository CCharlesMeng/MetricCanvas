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
