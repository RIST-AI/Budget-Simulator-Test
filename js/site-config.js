// js/site-config.js
import { db, doc, getDoc } from './firebase-config.js';

// Default settings if none are found in the database
const DEFAULT_SETTINGS = {
    courseName: 'AHCBUS408 Budget Master',
    courseSubtitle: 'Agricultural Budgeting Training Tool',
    pageTitle: 'Budget Simulator - RIST Budget Master'
};

// Load and apply site settings
export async function loadSiteSettings() {
    try {
        console.log("Site config: Loading settings...");
        const settingsRef = doc(db, 'siteConfig', 'settings');
        const settingsDoc = await getDoc(settingsRef);
        
        let settings;
        
        if (settingsDoc.exists()) {
            settings = settingsDoc.data();
            console.log("Site config: Settings loaded from database:", settings);
        } else {
            settings = DEFAULT_SETTINGS;
            console.log("Site config: No settings found, using defaults:", settings);
        }
        
        // Apply settings to the document
        applySettings(settings);
        // Reveal the page once settings are applied
        document.body.style.visibility = 'visible';
        
        return settings;
    } catch (error) {
        console.error("Site config: Error loading settings:", error);
        
        // Even if we have an error, try to apply default settings
        console.log("Site config: Applying default settings");
        applySettings(DEFAULT_SETTINGS);
        // Reveal the page even on error
        document.body.style.visibility = 'visible';
        
        return DEFAULT_SETTINGS;
    }
}


// Apply settings to the document
function applySettings(settings) {
    // Update page title
    if (settings.pageTitle) {
        const oldTitle = document.title;
        document.title = settings.pageTitle;
        console.log(`Site config: Updated page title from "${oldTitle}" to "${settings.pageTitle}"`);
    }
    
    // Update site title in header and footer
    const siteTitleElements = document.querySelectorAll('.title-container h1, #footer-course-name');
    if (siteTitleElements.length === 0) {
        console.warn("Site config: No title elements found to update");
    }
    
    siteTitleElements.forEach(element => {
        if (element && settings.courseName) {
            const oldText = element.textContent;
            element.textContent = settings.courseName;
            console.log(`Site config: Updated title element from "${oldText}" to "${settings.courseName}"`);
        }
    });
    
    // Update all subtitles with the global-subtitle class
    const globalSubtitles = document.querySelectorAll('.global-subtitle');
    
    if (globalSubtitles.length === 0) {
        console.warn("Site config: No global-subtitle elements found. Make sure your pages use the global-subtitle class on subtitle elements");
    }
    
    globalSubtitles.forEach(element => {
        if (element && settings.courseSubtitle) {
            const oldText = element.textContent;
            element.textContent = settings.courseSubtitle;
            console.log(`Site config: Updated subtitle from "${oldText}" to "${settings.courseSubtitle}"`);
        }
    });
}

// Execute when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSiteSettings);
    console.log("Site config: Waiting for DOM before loading settings");
} else {
    console.log("Site config: DOM already loaded, applying settings immediately");
    loadSiteSettings();
}

// Export the function for direct use in other modules
export default loadSiteSettings;