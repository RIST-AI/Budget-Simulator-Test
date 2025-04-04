// js/site-config.js
import { db, doc, getDoc } from './firebase-config.js';

// Load and apply site settings
export async function loadSiteSettings() {
    try {
        const settingsRef = doc(db, 'siteConfig', 'settings');
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists()) {
            const settings = settingsDoc.data();
            
            // Update page title
            if (settings.pageTitle) {
                document.title = settings.pageTitle;
            }
            
            // Update site title and subtitle
            const siteTitleElement = document.querySelector('.title-container h1');
            if (siteTitleElement && settings.courseName) {
                siteTitleElement.textContent = settings.courseName;
            }
            
            const siteSubtitleElement = document.querySelector('.title-container p');
            if (siteSubtitleElement && settings.courseSubtitle) {
                // Don't override page-specific subtitles
                const currentPage = window.location.pathname.split('/').pop();
                if (currentPage !== 'assessment-editor.html' && 
                    currentPage !== 'trainer-review.html') {
                    siteSubtitleElement.textContent = settings.courseSubtitle;
                }
            }
            
            // Update footer
            const footerCourseName = document.getElementById('footer-course-name');
            if (footerCourseName && settings.courseName) {
                footerCourseName.textContent = settings.courseName;
            }
            
            return settings;
        }
    } catch (error) {
        console.error("Error loading site settings:", error);
    }
    
    return null;
}

// Load settings when the DOM is ready
document.addEventListener('DOMContentLoaded', loadSiteSettings);