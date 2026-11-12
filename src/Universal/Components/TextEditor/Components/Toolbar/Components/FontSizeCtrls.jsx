import React from 'react';

export default function FontSizeCtrls() {
  const fontSizes = [1, 2, 3, 4, 5, 6, 7];

  const handleFontSizeChange = (size) => {
    document.execCommand('fontSize', false, size);
  };

  React.useEffect(()=>{
	const initialFontSize = fontSizes[6]
	handleFontSizeChange(initialFontSize);
  },[])

  return (
    <div id="font-size-controls" className="flex items-center h-7 gap-[6px] pl-3 border-l border-paper-edge text-ink">
      {/* Two letters of different sizes, as on a proofreader's size mark */}
      <span aria-hidden="true" className="font-serif leading-none select-none"><span className="text-[12px]">A</span><span className="text-[19px]">A</span></span>
      <select
	defaultValue={7}
	aria-label="Font size"
	title="Font size"
        className="focus-ink px-1 h-7 w-12 text-[15px] text-center rounded-none border border-ink bg-paper-deep font-serif text-ink cursor-pointer"
        onChange={(e) => handleFontSizeChange(e.target.value)}
      >
        {fontSizes.map((size) => {
		return (
          <option key={size} value={size} className="bg-paper text-ink">
            {size}
          </option>
        )})}
      </select>
    </div>
  );
}

/*
	flex items-center justify-center size-6 p-1 text-sm rounded   
*/
