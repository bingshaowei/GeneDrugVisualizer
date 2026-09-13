import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';

import SearchBar from './SearchBar';


test('输入后防抖加载最多十条远程候选', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const getSuggestions = jest.fn().mockResolvedValue(
    Array.from({ length: 12 }, (_, index) => `TP${index}`)
  );
  await act(async () => {
    root.render(<SearchBar defaultValue="" getSuggestions={getSuggestions} onSelectGene={() => {}} />);
  });

  const input = container.querySelector('input');
  await act(async () => {
    Simulate.change(input, { target: { value: 'tp' } });
  });
  expect(getSuggestions).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(250);
    await Promise.resolve();
  });

  expect(getSuggestions).toHaveBeenCalledWith('tp', expect.objectContaining({ signal: expect.any(Object) }));
  expect(container.querySelectorAll('li')).toHaveLength(10);
  await act(async () => root.unmount());
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  jest.useRealTimers();
});
