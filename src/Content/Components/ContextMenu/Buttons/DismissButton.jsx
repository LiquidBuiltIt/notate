import React from 'react';
import { ContextMenuHoverRegionContext } from '@content/Components/HoverRegions/ContextMenuHoverRegion.jsx';
import { WebContentContext } from '@content/content.jsx';
import { TAG_CLASS, TAG_GLYPH_CLASS, TAG_LABEL_CLASS } from '../ContextItem.jsx';
import { 
    dismissForSite, 
    dismissForSession 
} from './dismissUtils.js';

export default function DismissButton() {
    const { CONTEXT_MENU_CONTEXT, CORNER_CONTEXT } = React.useContext(ContextMenuHoverRegionContext);
    const [ contextMenuState, setContextMenuState ] = CONTEXT_MENU_CONTEXT;
    const [ corner ] = CORNER_CONTEXT;
    const left = corner.endsWith('left');
    const { 
        USER_CONFIGURATION_DB_CONTEXT,
        REQUEST_CONTEXT,
        MENU_DISMISSED_CONTEXT
    } = React.useContext(WebContentContext);
    
    const [ database ] = USER_CONFIGURATION_DB_CONTEXT;
    const [ , makeRequest ] = REQUEST_CONTEXT;
    const [ , setIsMenuDismissed ] = MENU_DISMISSED_CONTEXT;
    
    const [showExtraButtons, setShowExtraButtons] = React.useState(false);
    
    // Reset extra buttons when context menu is hidden
    React.useEffect(() => {
        if (!contextMenuState && showExtraButtons) {
            setShowExtraButtons(false);
        }
    }, [contextMenuState]);
    
    const handleDismissClick = () => {
        setShowExtraButtons(!showExtraButtons);
    };
    
    // Dismissal handlers
    const handleDismissUntilReload = () => {
        // Just hide the menu UI without setting the global dismissed state
        setIsMenuDismissed(true);
    };
    
    const handleDismissForSite = async () => {
        const currentSite = window.location.hostname;
        
        // First update the UI immediately
        setContextMenuState(false);
        setIsMenuDismissed(true);
        
        // Use session storage instead of database storage
        dismissForSession();
    };
    
    const handleDismissForSession = () => {
        // First update the UI immediately
        setContextMenuState(false);
        setIsMenuDismissed(true);
        
        // Then update the session storage
        dismissForSession();
    };
    
    const ExtraButton = ({ title, onClick }) => {
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
    };
    
    return (
        <div className="relative">
            {/* Extra options that open beside the dismiss tag, toward the middle of the page */}
            <div 
                className={`
                    absolute bottom-0 flex items-center gap-2
                    transition-all duration-300 ease-out
                    ${left ? 'left-full ml-3' : 'right-full mr-3'}
                    ${showExtraButtons ? 'opacity-100 translate-x-0' : `opacity-0 ${left ? '-translate-x-6' : 'translate-x-6'} pointer-events-none`}
                `}
            >
                <ExtraButton 
                    title="Until Page Reload"
                    onClick={handleDismissUntilReload}
                />
                <ExtraButton 
                    title="For This Site"
                    onClick={handleDismissForSite}
                />
                <ExtraButton 
                    title="For This Session"
                    onClick={handleDismissForSession}
                />
            </div>
            
            {/* Main dismiss button */}
            <button
                id="context-dismiss-btn"
                className={`${TAG_CLASS} hover:!bg-vermilion-wash hover:!text-vermilion-ink`}
                onClick={handleDismissClick}
            >
                <span aria-hidden="true" className={TAG_GLYPH_CLASS}>
                    {showExtraButtons ? (left ? '\u203A' : '\u2039') : '\u00D7'}
                </span>
                <label className={`${TAG_LABEL_CLASS} cursor-pointer`}>
                    {`Dismiss Menu`}
                </label>
            </button>
        </div>
    );
}
