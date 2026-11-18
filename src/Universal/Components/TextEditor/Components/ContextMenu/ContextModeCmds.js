import { pickImage } from '../TextInput/images.js';


export const NormalModeCmds = [
	{
		type: 'paste',
		name: 'Paste',
    		action: () => {
      			document.execCommand('paste');
    		}
  	},{
    		type: 'selectAll',
		name: 'Select All',
    		action: () => {
			const range = document.createRange()
			// The content script shadow root is closed: reach it through the extension API.
			const host = document.getElementById('content-script-entry-point')
			const shadow = host && (globalThis.chrome?.dom?.openOrClosedShadowRoot(host) ?? host.openOrClosedShadowRoot)
			const target = document.getElementById('input-text-display') || shadow?.getElementById('input-text-display')

			range.selectNodeContents(target)

			const selection = window.getSelection()

			selection.removeAllRanges()
			selection.addRange(range)
    		}
  	},{
    		type: 'undo',
		name: 'Undo',
    		action: () => {
      			document.execCommand('undo');
    		}
  	},{
    		type: 'redo',
		name: 'Redo',
    		action: () => {
      			document.execCommand('redo');
    		}
  	},
	{
		type: 'insertImg',
		name: 'Insert Image',
		action: pickImage
	}
];


export const SelectionModeCmds = [
	{
    		type: 'cut',
		name: 'Cut',
    		action: () => {
      			document.execCommand('cut');
    		}
  	},{
    		type: 'copy',
		name: 'Copy',
    		action: () => {
      			document.execCommand('copy');
    		}
  	},{
    		type: 'delete',
		name: 'Delete',
    		action: () => {
      			document.execCommand('delete');
		}
  	},{
    		type: 'bold',
		name: 'Bold',
    		action: () => {
      			document.execCommand('bold');
    		}
  	},{
    		type: 'italic',
		name: 'Italic',
    		action: () => {
      			document.execCommand('italic');
		}
  	},{
    		type: 'underline',
		name: 'Underline',
    		action: () => {
      			document.execCommand('underline');
    		}
  	}
];
