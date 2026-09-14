import { fetchJson, getDrugGroupSummary, getDrugResponse } from './api';
import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

test('fetchJson 将后端错误信息转换为异常', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: false,
    status: 400,
    json: async () => ({ error: '非法请求' }),
  });
  await expect(fetchJson('/bad')).rejects.toThrow('非法请求');
});

test('药物汇总使用单个专用请求', async () => {
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => [] });
  await getDrugGroupSummary([1], [2], 'AUC');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('/drug_group_summary', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ high_cosmic_ids: [1], low_cosmic_ids: [2], metric: 'AUC' }),
  }));
});

test('药物汇总在发送前消除高低组 ID 交集', async () => {
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => [] });
  await getDrugGroupSummary([1], [1, 2], 'AUC');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    high_cosmic_ids: [1],
    low_cosmic_ids: [2],
    metric: 'AUC',
  });
});

test('单药响应请求包含药名且透传 AbortSignal', async () => {
  const controller = new AbortController();
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => [] });
  await getDrugResponse([1, 2], 'Z_SCORE', 'DrugA', { signal: controller.signal });
  expect(fetchMock).toHaveBeenCalledWith('/drug_response', expect.objectContaining({
    signal: controller.signal,
    body: JSON.stringify({ cosmic_ids: [1, 2], metric: 'Z_SCORE', drug_name: 'DrugA' }),
  }));
});
