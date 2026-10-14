#!/usr/bin/env node
import { executePageDataProgram } from './node';
import type { DqeGatewayConfig } from './dqe';

/** Deployment-only transport configuration; metadata never controls these values. */
function gatewayConfig(): DqeGatewayConfig {
  const endpoint = process.env.METRICCANVAS_DQE_ENDPOINT;
  const raw: unknown = JSON.parse(process.env.METRICCANVAS_DQE_HEADERS ?? '{}');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      Object.values(raw).some(value => typeof value !== 'string')) throw new Error('Invalid headers configuration');
  const headers: Record<string, string> = Object.fromEntries(Object.entries(raw));
  const configured = process.env.METRICCANVAS_DQE_TIMEOUT_MS;
  const timeoutMs = configured === undefined ? undefined : Number(configured);
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) throw new Error('Invalid timeout configuration');
  return { endpoint, headers, ...(timeoutMs === undefined ? {} : { timeoutMs }) };
}

try {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const metadata = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const result = await executePageDataProgram(metadata, gatewayConfig());
  process.stdout.write(JSON.stringify(result) + '\n');
} catch {
  // stdout is the complete artifact channel. stderr does not expose transport credentials.
  process.stderr.write('页面取数程序无法执行，请检查页面参数与部署配置。\n');
  process.exitCode = 1;
}
