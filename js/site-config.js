// js/site-config.js
import { db, doc, getDoc } from './firebase-config.js';

// Log message to help with debugging
console.log("Site config script loaded");

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
                console.log("Updated page title to:", settings.pageTitle);
            }
            
            // Update site title in header
            const siteTitleElement = document.querySelector('.title-container h1');
            if (siteTitleElement && settings.courseName) {
                siteTitleElement.textContent = settings.courseName;
                console.log("Updated header title to:", settings.courseName);
            }
            
            // Update site subtitle
            const siteSubtitleElement = document.querySelector('.title-container p');
            if (siteSubtitleElement && settings.courseSubtitle) {
                // Get current page
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                console.log("Current page:", currentPage);
                
                // List of pages with specific subtitles that shouldn't be overridden
                const pagesWithSpecificSubtitles = [
                    'assessment-editor.html', 
                    'trainer-review.html'
                ];
                
                // Only update subtitle if not on a page with specific subtitle
                if (!pagesWithSpecificSubtitles.includes(currentPage)) {
                    siteSubtitleElement.textContent = settings.courseSubtitle;
                    console.log("Updated subtitle to:", settings.courseSubtitle);
                } else {
                    console.log("Skipping subtitle update for page with specific subtitle");
                }
            }
            
            // Update footer
            const footerCourseName = document.getElementById('footer-course-name');
            if (footerCourseName && settings.courseName) {
                footerCourseName.textContent = settings.courseName;
                console.log("Updated footer course name to:", settings.courseName);
            }
            
            return settings;
        } else {
            console.log("No site settings found in Firestore");
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
    // DOM already loaded, run immediately
    loadSiteSettings();
}