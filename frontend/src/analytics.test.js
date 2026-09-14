import {
  buildDrugViolinData,
  normalizeViolinGroups,
  pearsonCorrelation,
  sampleStandardDeviation,
  welchTTest,
} from './analytics';
import { expect, test } from 'vitest';

test('样本标准差使用 n-1', () => {
  expect(sampleStandardDeviation([1, 2, 3])).toBeCloseTo(1, 10);
});

test('Welch 检验拒绝样本不足和零标准误', () => {
  expect(welchTTest([1], [2, 3])).toBeNull();
  expect(welchTTest([1, 1], [1, 1])).toBeNull();
});

test('Pearson 相关过滤非有限值并处理常量数组', () => {
  expect(pearsonCorrelation([1, 1, 1], [1, 2, 3])).toBeNull();
  expect(pearsonCorrelation([1, 2, 3, Number.NaN], [2, 4, 6, 8]).r).toBeCloseTo(1, 10);
});

test('药物小提琴数据只给有效响应匹配对应标签', () => {
  const expression = [
    { COSMIC_ID: 1, CELL_LINE: 'A' },
    { COSMIC_ID: 2, CELL_LINE: 'B' },
    { COSMIC_ID: 3, CELL_LINE: 'C' },
  ];
  const responses = [
    { COSMIC_ID: 2, Drug_Name: 'DrugA', AUC: 0.2 },
    { COSMIC_ID: 3, Drug_Name: 'DrugA', AUC: 0.4 },
  ];
  const result = buildDrugViolinData(responses, expression, [1, 2], [3], 'AUC');
  expect(result.high).toEqual([0.2]);
  expect(result.highLabels).toEqual(['B']);
  expect(result.low).toEqual([0.4]);
  expect(result.lowLabels).toEqual(['C']);
});

test('other unknown 和小类别只合并一次', () => {
  const result = normalizeViolinGroups(
    { other: [1], unknown: [2], common: [3, 4, 5], rare: [6] },
    {
      other: [{ value: 1 }],
      unknown: [{ value: 2 }],
      common: [{ value: 3 }, { value: 4 }, { value: 5 }],
      rare: [{ value: 6 }],
    },
    'histology'
  );
  expect(result.data.common).toEqual([3, 4, 5]);
  expect(result.data['其他']).toEqual([1, 2, 6]);
  expect(result.details['其他']).toHaveLength(3);
});
