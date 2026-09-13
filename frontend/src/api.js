export async function fetchJson(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    let message = `请求失败（HTTP ${response.status}）`;
    try {
      const body = await response.json();
      if (body && body.error) message = body.error;
    } catch (_error) {
      // 非 JSON 错误响应使用状态码信息。
    }
    throw new Error(message);
  }
  return response.json();
}

function postJson(path, body, signal) {
  return fetchJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}

export function getExpression(gene, options = {}) {
  return fetchJson(`/expression/${encodeURIComponent(gene)}`, { signal: options.signal });
}

export function getAutocomplete(query, options = {}) {
  return fetchJson(`/autocomplete?q=${encodeURIComponent(query)}`, { signal: options.signal });
}

export function getDrugGroupSummary(highCosmicIds, lowCosmicIds, metric, options = {}) {
  const uniqueHighIds = Array.from(new Set(highCosmicIds));
  const highIdSet = new Set(uniqueHighIds.map(String));
  const uniqueLowIds = Array.from(new Set(lowCosmicIds)).filter((id) => !highIdSet.has(String(id)));
  return postJson('/drug_group_summary', {
    high_cosmic_ids: uniqueHighIds,
    low_cosmic_ids: uniqueLowIds,
    metric,
  }, options.signal);
}

export function getDrugResponse(cosmicIds, metric, drugName, options = {}) {
  const body = {
    cosmic_ids: Array.from(new Set(cosmicIds)),
    metric,
  };
  if (drugName !== undefined && drugName !== null) body.drug_name = String(drugName);
  return postJson('/drug_response', body, options.signal);
}

export function getDrugDetails(drugName, options = {}) {
  return fetchJson(`/drug_details/${encodeURIComponent(String(drugName))}`, { signal: options.signal });
}
