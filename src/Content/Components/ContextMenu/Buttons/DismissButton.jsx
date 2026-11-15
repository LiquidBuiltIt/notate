import React from 'react';
import { ContextMenuHoverRegionContext } from '@content/Components/HoverRegions/ContextMenuHoverRegion.jsx';
import { WebContentContext } from '@content/content.jsx';
import { TAG_CLASS, TAG_GLYPH_CLASS, TAG_LABEL_CLASS } from '../ContextItem.jsx';
import { 
    dismissForSite, 
    dismissForSession 
} from './dismissUtils.js';

// The three ways to dismiss. ContextMenu shows them in place of the other tags.
export function useDismissOptions() {
    const { CONTEXT_MENU_CONTEXT } = React.useContext(ContextMenuHoverRegionContext);
    const [ , setContextMenuState ] = CONTEXT_MENU_CONTEXT;
    const { 
        USER_CONFIGURATION_DB_CONTEXT,
        REQUEST_CONTEXT,
        MENU_DISMISSED_CONTEXT
    } = React.useContext(WebContentContext);
    
    const [ database ] = USER_CONFIGURATION_DB_CONTEXT;
    const [ , makeRequest ] = REQUEST_CONTEXT;
    const [ , setIsMenuDismissed ] = MENU_DISMISSED_CONTEXT;
    
    // Dismissal handlers
    const handleDismissUntilReload = () => {
        // Just hide the menu UI without setting the global dismissed state
        setIsMenuDismissed(true);
    };
    
    const handleDismissForSite = () => {
        // First update the UI immediately
        setContextMenuState(false);
        setIsMenuDismissed(true);

        // Then save the site; Settings > Web Content can show the menu there again
        dismissForSite(window.location.hostname, database, makeRequest);
    };
    
    const handleDismissForSession = () => {
        // First update the UI immediately
        setContextMenuState(false);
        setIsMenuDismissed(true);
        
        // Then update the session storage
        dismissForSession();
    };
    
    return [
        { title: 'Until Page Reload', onClick: handleDismissUntilReload },
        { title: 'For This Site', onClick: handleDismissForSite },
        { title: 'For This Session', onClick: handleDismissForSession },
    ];
}

export function DismissOption({ title, onClick }) {
    return (
        <button 
            className={TAG_CLASS}
            title={title}
            onClick={onClick}
        >
            <span className={`${TAG_LABEL_CLASS} cursor-pointer`}>
                {title}
            </span>
        </button>
    );
}

export default function DismissButton({ open, onToggle }) {
    return (
        <button
            id="context-dismiss-btn"
            aria-expanded={open}
            className={`${TAG_CLASS} hover:!bg-vermilion-wash hover:!text-vermilion-ink`}
            onClick={onToggle}
        >
            {/* while the options show, the glyph reads as "back" */}
            <span aria-hidden="true" className={TAG_GLYPH_CLASS}>
                {open ? '\u2039' : '\u00D7'}
            </span>
            <label className={`${TAG_LABEL_CLASS} cursor-pointer`}>
                {`Dismiss Menu`}
            </label>
        </button>
    );
}
