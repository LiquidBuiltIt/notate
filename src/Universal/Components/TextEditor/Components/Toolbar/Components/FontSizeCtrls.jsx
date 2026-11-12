import React from 'react';

// execCommand('fontSize') takes 1-7; the labels say what each one looks like.
const fontSizes = [
	{ value: 1, label: 'Tiny' },
	{ value: 2, label: 'Small' },
	{ value: 3, label: 'Normal' },
	{ value: 4, label: 'Medium' },
	{ value: 5, label: 'Large' },
	{ value: 6, label: 'X-Large' },
	{ value: 7, label: 'Huge' },
];

export default function FontSizeCtrls() {
  const handleFontSizeChange = (size) => {
    document.execCommand('fontSize', false, size);
  };

  // Text starts at the editor's own size, which is "Normal" (3). The box used to start on 7.
  return (
    <div id="font-size-controls" className="flex items-center h-7 gap-[6px] pl-3 border-l border-paper-edge text-ink">
      {/* Two letters of different sizes, as on a proofreader's size mark */}
      <span aria-hidden="true" className="font-serif leading-none select-none"><span className="text-[12px]">A</span><span className="text-[19px]">A</span></span>
      <div className="relative">
        <select
	defaultValue={3}
	aria-label="Font size"
	title="Font size"
        className="focus-ink appearance-none pl-2 pr-6 h-7 w-[5.75rem] text-[15px] rounded-none border border-ink bg-paper-deep font-serif text-ink cursor-pointer"
        onChange={(e) => handleFontSizeChange(e.target.value)}
        >
          {fontSizes.map(({ value, label }) => (
            <option key={value} value={value} className="bg-paper text-ink">
              {label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] leading-none" aria-hidden="true">&#9662;</span>
      </div>
    </div>
  );
}
