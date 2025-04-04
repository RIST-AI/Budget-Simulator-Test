// js/site-config.js
import { db, doc, getDoc } from './firebase-config.js';

// Load and apply site settings
export async function loadSiteSettings() {
    try {
        console.log("Loading site settings...");
        const settingsRef = doc(db, 'siteConfig', 'settings');
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists()) {
            const settings = settingsDoc.data();
            console.log("Site settings loaded:", settings);
            
            // Update page title
            if (settings.pageTitle) {
                document.title = settings.pageTitle;
            }
            
            // Update site title in header and footer
            const siteTitleElements = document.querySelectorAll('.title-container h1, #footer-course-name');
            siteTitleElements.forEach(element => {
                if (element && settings.courseName) {
                    element.textContent = settings.courseName;
                }
            });
            
            // Update all subtitles with the global-subtitle class
            const globalSubtitles = document.querySelectorAll('.global-subtitle');
            globalSubtitles.forEach(element => {
                if (element && settings.courseSubtitle) {
                    element.textContent = settings.courseSubtitle;
                    console.log("Updated global subtitle to:", settings.courseSubtitle);
                }
            });
            
            return settings;
        }
    } catch (error) {
        console.error("Error loading site settings:", error);
    }
    
    return null;
}

// Make sure the DOM is fully loaded before running
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSiteSettings);
} else {
    loadSiteSettings();
}