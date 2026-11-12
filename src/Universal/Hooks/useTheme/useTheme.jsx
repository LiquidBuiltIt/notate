import React from 'react';
import themes from './themes.json'



export default function useTheme(style) {
	return React.useMemo(()=>{
		return themes[style] || themes["notePaper"]
	},[style])
}
