import React from 'react';
import Select, { components } from 'react-select';

// 自定义选项组件，添加复选框
const CustomOption = (props) => {
  const { data, isSelected, innerRef, innerProps } = props;
  
  return (
    <div ref={innerRef} {...innerProps} className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => {}} // 由react-select处理
        className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded pointer-events-none"
      />
      <span className="text-sm text-gray-700">
        {data.label}
      </span>
    </div>
  );
};

// 自定义多值显示组件
const CustomMultiValue = (props) => {
  const { data } = props;
  if (data.value === 'all') {
    return (
      <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm mr-1">
        全部
      </div>
    );
  }
  return <components.MultiValue {...props} />;
};

const SelectWithAll = ({ options, value, onChange, placeholder }) => {
  const allOption = { value: 'all', label: '全部' };

  const handleChange = (selected) => {
    if (!selected || selected.length === 0) {
      // 如果没有选择任何项，默认选择"全部"
      onChange(['all']);
      return;
    }

    const selectedValues = selected.map(opt => opt.value);
    
    // 检查是否选择了"全部"
    if (selectedValues.includes('all')) {
      // 如果选择了"全部"，并且还选择了其他项
      if (selectedValues.length > 1) {
        // 移除"全部"，只保留其他选项
        const withoutAll = selectedValues.filter(val => val !== 'all');
        onChange(withoutAll);
      } else {
        // 只选择了"全部"
        onChange(['all']);
      }
    } else {
      // 没有选择"全部"
      // 检查是否选择了所有具体选项
      if (selectedValues.length === options.length) {
        // 如果选择了所有具体选项，转换为"全部"
        onChange(['all']);
      } else {
        onChange(selectedValues);
      }
    }
  };

  const getValue = () => {
    // 如果选择了'all'或者选择了所有选项，显示"全部"
    if (value.includes('all')) {
      return [allOption];
    }
    
    // 如果选择了所有具体选项，也显示"全部"
    if (value.length === options.length && options.length > 0) {
      return [allOption];
    }
    
    // 否则显示选中的具体选项
    return options.filter((opt) => value.includes(opt.value));
  };

  const finalOptions = [allOption, ...options];

  return (
    <div className="min-w-[200px]">
      <Select
        isMulti
        placeholder={placeholder}
        options={finalOptions}
        value={getValue()}
        onChange={handleChange}
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        components={{
          Option: CustomOption,
          MultiValue: CustomMultiValue,
        }}
        styles={{
          menu: (base) => ({ 
            ...base, 
            zIndex: 999 
          }),
          option: (base) => ({
            ...base,
            padding: 0, // 移除默认padding，让自定义组件控制
          }),
          multiValue: (base) => ({
            ...base,
            backgroundColor: '#e0e7ff',
          }),
          multiValueLabel: (base) => ({
            ...base,
            color: '#1e40af',
          }),
        }}
      />
    </div>
  );
};

export default SelectWithAll;
