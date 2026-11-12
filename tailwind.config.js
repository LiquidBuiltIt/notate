
module.exports = {
	important: true,
	mode: 'jit',
  	content: [
		"./src/**/*.{html,js,jsx}", 
		"./src/**/*.css",
		"./src/**/*.json"
	],
  	theme: {
  		extend: {
			screen: {
				'short': { 'raw': '(max-height: 400px)' },
				'tall': { 'raw': '(max-height: 900px)' }
			},
			animation: {
				'spin-slow': 'spin 3s linear infinite',
				'rise': 'rise 520ms cubic-bezier(.2,.7,.1,1) both',
				'draw': 'draw 700ms cubic-bezier(.65,0,.35,1) both',
				'unfold': 'unfold 380ms cubic-bezier(.2,.8,.2,1) both',
				'stamp': 'stamp 420ms cubic-bezier(.3,1.6,.5,1) both',
			},

			// Marginalia design tokens: paper, ink, one vermilion accent.
			fontFamily: {
				display: ["'notate-playfair'", 'serif'],
				serif: ["'notate-garamond'", 'serif'],
			},
			boxShadow: {
				'print': '4px 4px 0 0 #1B1A17',
				'print-sm': '2px 2px 0 0 #1B1A17',
				'print-lg': '8px 8px 0 0 #1B1A17',
				'lift': '0 1px 0 #1B1A17, 0 18px 40px -24px rgba(27,26,23,.45)',
			},
			letterSpacing: {
				'caps': '.18em',
			},

			backgroundImage: {
				'dark-wood': "url('./Backgrounds/wood-bg.jpg')",
    				'cork-board': "url('./Backgrounds/note-board-bg.jpg')",
    				'note-paper': "url('./Backgrounds/note-paper-bg.jpg')",
    				'marble-chess-board': "url('./Backgrounds/marble-chess-bg.jpeg')",
			},

			keyframes: {
				spin: {
					'0%': { transform: 'rotate(0deg)' },
					'100%': { transform: 'rotate(360deg)' }
				},
				rise: {
					'0%': { opacity: '0', transform: 'translateY(14px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				draw: {
					'0%': { transform: 'scaleX(0)' },
					'100%': { transform: 'scaleX(1)' }
				},
				unfold: {
					'0%': { opacity: '0', transform: 'translateY(10px) scale(.97)', clipPath: 'inset(0 0 100% 0)' },
					'100%': { opacity: '1', transform: 'none', clipPath: 'inset(0 0 0 0)' }
				},
				stamp: {
					'0%': { opacity: '0', transform: 'scale(1.6) rotate(-14deg)' },
					'100%': { opacity: '1', transform: 'scale(1) rotate(-6deg)' }
				}
			},
  	      		colors: {
  	      			'list-marker': '#FFEE58',
				paper: { DEFAULT: '#F2ECE0', deep: '#E8DFCE', edge: '#D9CDB6' },
				ink: { DEFAULT: '#1B1A17', soft: '#5B554A', faint: '#8F8778' },
				vermilion: { DEFAULT: '#E0451F', ink: '#B8321A', wash: '#F6D5C9' },
				// Note swatches, keyed by the stored color name (see noteSwatch.js).
				swatch: {
					red: '#C2412D',
					yellow: '#D9A62E',
					blue: '#3A5BA0',
					green: '#4E7D5B',
					orange: '#D9782D',
					pink: '#C9607E',
					purple: '#6E4E8E',
				},
  	    		},
  	    		fontSize: {
  	      			'2xl': '1.5rem',
  	    		},
  	    		brightness: {
  	      			'75': '.75',
  	 		},

  	  	},
  	},
	variants: {
		extend: {
			animation: ['hover', 'focus']	
		}
	},

  	plugins: [
  		require('tailwind-scrollbar')
  	],
	
	safelist: [
	] 
}

