// components/SearchBar.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function SearchBar({
  onSelectGene,
  defaultValue = 'TP53',              // 初始默认显示 TP53
  placeholder = '输入基因名称...',      // 删除内容后显示的提示
  suggestions = [],                    // 可选：基因候选列表（用于下拉联想）
}) {
  const [query, setQuery] = useState(defaultValue || '');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);

  // 父组件改变默认值时（例如切换默认基因），同步到输入框
  useEffect(() => {
    setQuery(defaultValue || '');
  }, [defaultValue]);

  // 过滤出联想候选（先前缀匹配，再包含匹配），最多 10 个
  const filteredList = useMemo(() => {
    const q = (query || '').trim().toUpperCase();
    if (!q) return [];
    const arr = (suggestions || []).map(String);
    const starts = arr.filter((g) => g.toUpperCase().startsWith(q));
    const contains = arr.filter(
      (g) => g.toUpperCase().includes(q) && !starts.includes(g)
    );
    return [...starts, ...contains].slice(0, 10);
  }, [query, suggestions]);

  const commit = (value) => {
    const gene = (value || '').trim().toUpperCase();
    if (!gene) return;
    onSelectGene && onSelectGene(gene);
    setQuery(gene);   // 保持输入框显示已选择的基因
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filteredList.length > 0) {
        commit(filteredList[highlight]);
      } else {
        commit(query);
      }
    } else if (e.key === 'ArrowDown' && filteredList.length > 0) {
      e.preventDefault();
      setOpen(true);
      setHighlight((prev) => (prev + 1) % filteredList.length);
    } else if (e.key === 'ArrowUp' && filteredList.length > 0) {
      e.preventDefault();
      setOpen(true);
      setHighlight((prev) => (prev - 1 + filteredList.length) % filteredList.length);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const onChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    setHighlight(0);
  };

  const onBlur = () => {
    // 延迟收起以允许点击下拉项
    setTimeout(() => setOpen(false), 150);
  };

  const clear = () => {
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full max-w-xl">
      <input
        ref={inputRef}
        type="text"
        className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
        placeholder={placeholder}
        value={query}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => query && setOpen(true)}
        onBlur={onBlur}
      />

      {query && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          onClick={clear}
          aria-label="清空"
          title="清空"
        >
          ×
        </button>
      )}

      {open && filteredList.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-auto">
          {filteredList.map((g, idx) => (
            <li
              key={`${g}-${idx}`}
              className={`px-3 py-2 cursor-pointer ${idx === highlight ? 'bg-gray-100' : ''}`}
              onMouseEnter={() => setHighlight(idx)}
              onMouseDown={(e) => e.preventDefault()}  // 防止 blur 导致点不到
              onClick={() => commit(g)}
            >
              {g}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

