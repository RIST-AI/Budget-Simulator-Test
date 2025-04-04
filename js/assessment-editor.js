// js/assessment-editor.js

import { auth, db, collection, doc, getDoc, setDoc, addDoc, deleteDoc, updateDoc, serverTimestamp } from './firebase-config.js';
import { requireRole, getCurrentUser } from './auth.js';

// Global variables
let currentUser = null;
let assessmentData = null;
let currentQuestionId = 1;
let siteSettings = null; // Added for site settings

// Initialize the assessment editor
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Ensure user is authenticated and has trainer role
        currentUser = await requireRole('trainer');
        if (!currentUser) return; // User was redirected
        
        // Load existing assessment if available
        await loadAssessment();
        
        // Load site settings
        await loadSiteSettings();
        
        // Set up event listeners
        setupEventListeners();
        
        // Show the editor
        document.getElementById('loading-indicator').style.display = 'none';
        document.getElementById('editor-container').style.display = 'block';
        
        // Show the general tab by default
        showTab('general-tab');
    } catch (error) {
        console.error("Error initializing editor:", error);
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = `
                <div class="error-message">Error initializing editor: ${error.message}</div>
                <button class="btn" onclick="location.reload()">Try Again</button>
            `;
        }
    }
});

// Update the help text in the site settings tab
// Improved approach with better condition matching
function updateSiteSettingsHelpText() {
    if (!siteSettings) {
        console.error("Site settings not available for help text update");
        return;
    }
    
    console.log("Updating site settings help text with:", siteSettings);
    
    // Find all small elements with form-hint class in the entire document
    const allHints = document.querySelectorAll('small.form-hint');
    console.log(`Found ${allHints.length} hint elements`, allHints);
    
    // Process each hint
    allHints.forEach(hint => {
        const hintText = hint.textContent;
        console.log("Processing hint:", hintText);
        
        // Check which field this hint is for using more specific conditions
        if (hintText.includes("header of all pages")) {
            hint.textContent = `This name appears in the header of all pages (currently "${siteSettings.courseName}")`;
            console.log("Updated course name hint");
        }
        else if (hintText.includes("below the course name")) {
            hint.textContent = `This text appears below the course name (currently "${siteSettings.courseSubtitle}")`;
            console.log("Updated subtitle hint");
        }
        else if (hintText.includes("browser tab")) {
            hint.textContent = `This text appears in the browser tab (currently "${siteSettings.pageTitle}")`;
            console.log("Updated page title hint");
        }
    });
}

// Set up event listeners for the editor
function setupEventListeners() {
    // Check if elements exist before adding event listeners
    const saveButton = document.getElementById('save-assessment');
    if (saveButton) {
        saveButton.addEventListener('click', saveAssessment);
    }
    
    const publishButton = document.getElementById('publish-assessment');
    if (publishButton) {
        publishButton.addEventListener('click', publishAssessment);
    }
    
    const previewButton = document.getElementById('preview-assessment');
    if (previewButton) {
        previewButton.addEventListener('click', previewAssessment);
    }
    
    const addQuestionButton = document.getElementById('add-question');
    if (addQuestionButton) {
        addQuestionButton.addEventListener('click', addQuestion);
    }
    
    const addScenarioButton = document.getElementById('add-scenario');
    if (addScenarioButton) {
        addScenarioButton.addEventListener('click', addScenario);
    }
    
    // Site Settings buttons and inputs
    const saveSiteSettingsButton = document.getElementById('save-site-settings');
    if (saveSiteSettingsButton) {
        saveSiteSettingsButton.addEventListener('click', saveSiteSettings);
    }
    
    // Live preview for site settings
    const courseNameInput = document.getElementById('course-name');
    const courseSubtitleInput = document.getElementById('course-subtitle');
    const pageTitleInput = document.getElementById('page-title');
    
    if (courseNameInput) {
        courseNameInput.addEventListener('input', updateSiteSettingsPreview);
    }
    
    if (courseSubtitleInput) {
        courseSubtitleInput.addEventListener('input', updateSiteSettingsPreview);
    }
    
    if (pageTitleInput) {
        pageTitleInput.addEventListener('input', updateSiteSettingsPreview);
    }
    
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            showTab(tabId);
        });
    });
    
    // Add event listeners for remove buttons
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('btn-remove')) {
            const container = event.target.closest('.question-container, .scenario-container');
            if (container) {
                container.remove();
            }
        }
    });
}

// Load existing assessment data
async function loadAssessment() {
    try {
        // Check if there's an existing assessment
        const assessmentRef = doc(db, 'assessmentTemplate', 'current');
        const assessmentDoc = await getDoc(assessmentRef);
        
        if (assessmentDoc.exists()) {
            assessmentData = assessmentDoc.data();
            
            // Populate the form with existing data
            document.getElementById('assessment-title').value = assessmentData.title || '';
            document.getElementById('assessment-description').value = assessmentData.description || '';
            document.getElementById('assessment-instructions').value = assessmentData.instructions || '';
            
            // Inside loadAssessment() function, replace the questions loading code with:
            if (assessmentData.questions && assessmentData.questions.length > 0) {
                const questionsContainer = document.getElementById('questions-container');
                if (questionsContainer) {
                    questionsContainer.innerHTML = ''; // Clear existing questions
                    
                    assessmentData.questions.forEach((question, index) => {
                        const questionId = index + 1;
                        
                        // Create a temporary container
                        const tempContainer = document.createElement('div');
                        tempContainer.innerHTML = createQuestionHTML(questionId, question.text);
                        
                        // Get the question element and append it
                        const questionElement = tempContainer.firstElementChild;
                        questionsContainer.appendChild(questionElement);
                        
                        // Add event listeners
                        const removeButton = questionElement.querySelector('.btn-remove');
                        if (removeButton) {
                            removeButton.addEventListener('click', function() {
                                questionElement.remove();
                            });
                        }
                    });
                    
                    currentQuestionId = assessmentData.questions.length + 1;
                }
            }
            
            // And replace the scenarios loading code with:
            if (assessmentData.scenarios && assessmentData.scenarios.length > 0) {
                const scenariosContainer = document.getElementById('scenarios-container');
                if (scenariosContainer) {
                    scenariosContainer.innerHTML = ''; // Clear existing scenarios
                    
                    assessmentData.scenarios.forEach((scenario, index) => {
                        // Create a temporary container
                        const tempContainer = document.createElement('div');
                        tempContainer.innerHTML = createScenarioHTML(index + 1, scenario.title, scenario.description);
                        
                        // Get the scenario element and append it
                        const scenarioElement = tempContainer.firstElementChild;
                        scenariosContainer.appendChild(scenarioElement);
                        
                        // Add event listeners
                        const removeButton = scenarioElement.querySelector('.btn-remove');
                        if (removeButton) {
                            removeButton.addEventListener('click', function() {
                                scenarioElement.remove();
                            });
                        }
                    });
                }
            }
            
            // Show success message
            showStatusMessage('Assessment loaded successfully.', 'success');
        } else {
            // No existing assessment, create a new one with example content
            assessmentData = {
                title: 'Farm Budget Assessment',
                description: 'Complete this assessment to demonstrate your understanding of farm budget management and financial planning.',
                instructions: 'Please complete all sections of this assessment. First, create a budget based on the scenario you are assigned. Then, answer the analysis questions to demonstrate your understanding of farm financial management principles.',
                questions: [
                    {
                        id: 1,
                        text: 'Explain the key factors that influenced your income projections in your budget. What assumptions did you make about prices, yields, or production levels?'
                    },
                    {
                        id: 2,
                        text: 'Identify the major expense categories in your budget and explain how you would prioritize them if you needed to reduce costs by 15% due to financial constraints.'
                    },
                    {
                        id: 3,
                        text: 'Based on your budget analysis, what are three specific recommendations you would make to improve the farm\'s profitability? Explain the potential impact of each recommendation.'
                    }
                ],
                scenarios: [
                    {
                        id: 1,
                        title: 'Dairy Farm Scenario',
                        description: 'You are managing Green Valley Dairy Farm with 200 milking cows. The farm produces milk for a local processor and sells bull calves and excess heifers. Current milk price is $6.80 per kg of milk solids. The farm has 150 hectares of pasture and employs 3 full-time staff. Create a comprehensive annual budget that includes all relevant income and expenses for this operation.'
                    },
                    {
                        id: 2,
                        title: 'Crop Farm Scenario',
                        description: 'You are managing Hillside Crop Farm, a 500-hectare property that produces wheat, canola, and barley. The farm has irrigation infrastructure for 200 hectares, with the remaining area being dryland farming. Equipment includes 2 tractors, a harvester, and various implements. The farm employs 1 full-time manager and 3 seasonal workers. Create an annual budget that includes all relevant income and expenses for this operation.'
                    },
                    {
                        id: 3,
                        title: 'Sheep Grazing Enterprise',
                        description: 'You are managing Riverside Sheep Station, a 1,200-hectare property with 5,000 Merino sheep primarily raised for wool production with some meat sales. The property has 4 main paddocks with rotational grazing systems, basic shearing facilities, and employs 2 full-time staff with additional seasonal workers during shearing. Create an annual budget that includes all relevant income and expenses for this operation.'
                    }
                ],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: currentUser.uid,
                published: false
            };
            
            // Set default values in the form
            document.getElementById('assessment-title').value = assessmentData.title;
            document.getElementById('assessment-description').value = assessmentData.description;
            document.getElementById('assessment-instructions').value = assessmentData.instructions;
            
            // Add example questions to the UI
            const questionsContainer = document.getElementById('questions-container');
            if (questionsContainer) {
                questionsContainer.innerHTML = '';
                
                assessmentData.questions.forEach((question, index) => {
                    const questionId = index + 1;
                    const questionHTML = createQuestionHTML(questionId, question.text);
                    questionsContainer.innerHTML += questionHTML;
                });
                
                currentQuestionId = assessmentData.questions.length + 1;
            }
            
            // Add example scenarios to the UI
            const scenariosContainer = document.getElementById('scenarios-container');
            if (scenariosContainer) {
                scenariosContainer.innerHTML = '';
                
                assessmentData.scenarios.forEach((scenario, index) => {
                    const scenarioHTML = createScenarioHTML(index + 1, scenario.title, scenario.description);
                    scenariosContainer.innerHTML += scenarioHTML;
                });
            }
            
            showStatusMessage('Created new assessment with example content.', 'success');
        }
    } catch (error) {
        console.error("Error loading assessment:", error);
        showStatusMessage('Error loading assessment: ' + error.message, 'error');
    }
}

// Load site settings from Firestore
async function loadSiteSettings() {
    try {
        // Get settings document
        const settingsRef = doc(db, 'siteConfig', 'settings');
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists()) {
            // Store settings in global variable
            siteSettings = settingsDoc.data();
            console.log("Loaded settings from Firestore:", siteSettings);
            
            // Populate form fields
            document.getElementById('course-name').value = siteSettings.courseName || 'AHCBUS408 Budget Master';
            document.getElementById('course-subtitle').value = siteSettings.courseSubtitle || 'Agricultural Budgeting Training Tool';
            document.getElementById('page-title').value = siteSettings.pageTitle || 'Budget Simulator - RIST Budget Master';
            
            // Update the help text
            updateSiteSettingsHelpText();
            
            // Update preview
            updateSiteSettingsPreview();
        } else {
            // Initialize with default values if no settings exist
            siteSettings = {
                courseName: 'AHCBUS408 Budget Master',
                courseSubtitle: 'Agricultural Budgeting Training Tool',
                pageTitle: 'Budget Simulator - RIST Budget Master'
            };
            console.log("Using default settings:", siteSettings);
            
            // Populate form fields with defaults
            document.getElementById('course-name').value = siteSettings.courseName;
            document.getElementById('course-subtitle').value = siteSettings.courseSubtitle;
            document.getElementById('page-title').value = siteSettings.pageTitle;
            
            // Update the help text
            updateSiteSettingsHelpText();
            
            // Update preview
            updateSiteSettingsPreview();
        }
    } catch (error) {
        console.error("Error loading site settings:", error);
        showStatusMessage('Error loading site settings: ' + error.message, 'error');
    }
}

// Save site settings to Firestore
// Save site settings to Firestore
async function saveSiteSettings() {
    try {
        // Get values from form
        const courseName = document.getElementById('course-name').value;
        const courseSubtitle = document.getElementById('course-subtitle').value;
        const pageTitle = document.getElementById('page-title').value;
        
        // Validate
        if (!courseName || !courseSubtitle || !pageTitle) {
            showStatusMessage('Please fill in all site settings fields.', 'error');
            return;
        }
        
        // Create settings object
        const settings = {
            courseName,
            courseSubtitle,
            pageTitle,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.uid
        };
        
        // Save to Firestore
        const settingsRef = doc(db, 'siteConfig', 'settings');
        await setDoc(settingsRef, settings);
        
        // Update global variable
        siteSettings = settings;
        
        // Update site header elements immediately
        document.querySelector('.title-container h1').textContent = settings.courseName;
        document.getElementById('footer-course-name').textContent = settings.courseName;
        document.title = settings.pageTitle;
        
        // Update help text with new values
        updateSiteSettingsHelpText();
        
        // Show success message
        showStatusMessage('Site settings saved successfully!', 'success');
        
    } catch (error) {
        console.error("Error saving site settings:", error);
        showStatusMessage('Error saving site settings: ' + error.message, 'error');
    }
}

// Update site settings preview
function updateSiteSettingsPreview() {
    const courseName = document.getElementById('course-name').value;
    const courseSubtitle = document.getElementById('course-subtitle').value;
    const pageTitle = document.getElementById('page-title').value;
    
    // Update preview elements
    document.getElementById('preview-course-name').textContent = courseName;
    document.getElementById('preview-course-subtitle').textContent = courseSubtitle;
    document.getElementById('preview-page-title').textContent = pageTitle;
}

// Save assessment
async function saveAssessment() {
    try {
        // Collect data from the form
        const title = document.getElementById('assessment-title').value;
        const description = document.getElementById('assessment-description').value;
        const instructions = document.getElementById('assessment-instructions').value;
        
        // Validate required fields
        if (!title || !description || !instructions) {
            showStatusMessage('Please fill in all required fields.', 'error');
            return;
        }
        
        // Collect questions
        const questions = [];
        const questionElements = document.querySelectorAll('.question-container');
        questionElements.forEach(element => {
            const questionId = element.getAttribute('data-question-id');
            const questionText = element.querySelector('.question-text').value;
            
            questions.push({
                id: questionId,
                text: questionText
            });
        });
        
        // Collect scenarios
        const scenarios = [];
        const scenarioElements = document.querySelectorAll('.scenario-container');
        scenarioElements.forEach(element => {
            const scenarioId = element.getAttribute('data-scenario-id');
            const scenarioTitle = element.querySelector('.scenario-title').value;
            const scenarioDescription = element.querySelector('.scenario-description').value;
            
            scenarios.push({
                id: scenarioId,
                title: scenarioTitle,
                description: scenarioDescription
            });
        });
        
        // Update assessment data
        assessmentData = {
            ...assessmentData,
            title,
            description,
            instructions,
            questions,
            scenarios,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.uid
        };
        
        // Save to Firestore
        const assessmentRef = doc(db, 'assessmentTemplate', 'current');
        await setDoc(assessmentRef, assessmentData);
        
        showStatusMessage('Assessment saved successfully!', 'success');
    } catch (error) {
        console.error("Error saving assessment:", error);
        showStatusMessage('Error saving assessment: ' + error.message, 'error');
    }
}

// Publish assessment
async function publishAssessment() {
    try {
        // First save the assessment
        await saveAssessment();
        
        // Update the published status
        assessmentData.published = true;
        assessmentData.publishedAt = serverTimestamp();
        assessmentData.publishedBy = currentUser.uid;
        
        // Save to Firestore (template)
        const assessmentRef = doc(db, 'assessmentTemplate', 'current');
        await updateDoc(assessmentRef, {
            published: true,
            publishedAt: serverTimestamp(),
            publishedBy: currentUser.uid
        });
        
        // Copy the assessment to the assessmentContent collection for students
        const contentRef = doc(db, 'assessmentContent', 'current');
        await setDoc(contentRef, {
            ...assessmentData,
            lastPublished: serverTimestamp()
        });
        
        showStatusMessage('Assessment published successfully! Students can now access this assessment.', 'success');
    } catch (error) {
        console.error("Error publishing assessment:", error);
        showStatusMessage('Error publishing assessment: ' + error.message, 'error');
    }
}

// Preview assessment
function previewAssessment() {
    try {
        // First save the current state
        saveAssessmentToLocalStorage();
        
        // Open preview in a new tab/window
        const previewWindow = window.open('assessment-preview.html', '_blank');
        
        // If popup was blocked, inform the user
        if (!previewWindow) {
            showStatusMessage('Preview popup was blocked. Please allow popups for this site.', 'error');
        }
    } catch (error) {
        console.error("Error previewing assessment:", error);
        showStatusMessage('Error previewing assessment: ' + error.message, 'error');
    }
}

// Save assessment data to localStorage for preview
function saveAssessmentToLocalStorage() {
    // Collect data from the form
    const title = document.getElementById('assessment-title').value;
    const description = document.getElementById('assessment-description').value;
    const instructions = document.getElementById('assessment-instructions').value;
    
    // Collect questions
    const questions = [];
    const questionElements = document.querySelectorAll('.question-container');
    questionElements.forEach(element => {
        const questionId = element.getAttribute('data-question-id');
        const questionText = element.querySelector('.question-text').value;
        
        questions.push({
            id: questionId,
            text: questionText
        });
    });
    
    // Collect scenarios
    const scenarios = [];
    const scenarioElements = document.querySelectorAll('.scenario-container');
    scenarioElements.forEach(element => {
        const scenarioId = element.getAttribute('data-scenario-id');
        const scenarioTitle = element.querySelector('.scenario-title').value;
        const scenarioDescription = element.querySelector('.scenario-description').value;
        
        scenarios.push({
            id: scenarioId,
            title: scenarioTitle,
            description: scenarioDescription
        });
    });
    
    // Create preview data
    const previewData = {
        title,
        description,
        instructions,
        questions,
        scenarios,
        previewTimestamp: new Date().toISOString()
    };
    
    // Save to localStorage
    localStorage.setItem('assessmentPreview', JSON.stringify(previewData));
}

// Add a new question
function addQuestion() {
    const questionsContainer = document.getElementById('questions-container');
    if (questionsContainer) {
        // Create a temporary container to hold the new question HTML
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = createQuestionHTML(currentQuestionId, '');
        
        // Get the actual question element from the temporary container
        const newQuestion = tempContainer.firstElementChild;
        
        // Append the new question to the questions container
        questionsContainer.appendChild(newQuestion);
        
        // Add event listeners to the new question's buttons
        const removeButton = newQuestion.querySelector('.btn-remove');
        if (removeButton) {
            removeButton.addEventListener('click', function() {
                newQuestion.remove();
            });
        }
        
        // Increment the question ID counter
        currentQuestionId++;
    }
}

// Add a new scenario
function addScenario() {
    const scenariosContainer = document.getElementById('scenarios-container');
    if (scenariosContainer) {
        const scenarioId = scenariosContainer.children.length + 1;
        
        // Create a temporary container to hold the new scenario HTML
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = createScenarioHTML(scenarioId, '', '');
        
        // Get the actual scenario element from the temporary container
        const newScenario = tempContainer.firstElementChild;
        
        // Append the new scenario to the scenarios container
        scenariosContainer.appendChild(newScenario);
        
        // Add event listeners to the new scenario's buttons
        const removeButton = newScenario.querySelector('.btn-remove');
        if (removeButton) {
            removeButton.addEventListener('click', function() {
                newScenario.remove();
            });
        }
    }
}

// Create HTML for a question
function createQuestionHTML(id, text = '') {
    return `
        <div class="question-container" data-question-id="${id}">
            <div class="question-header">
                <h4>Question ${id}</h4>
                <div class="question-actions">
                    <button class="btn-small btn-remove">Remove</button>
                </div>
            </div>
            <div class="form-group">
                <label for="question-${id}-text">Question Text:</label>
                <textarea class="question-text" id="question-${id}-text" rows="3">${text}</textarea>
            </div>
        </div>
    `;
}

// Create HTML for a scenario
function createScenarioHTML(id, title = '', description = '') {
    return `
        <div class="scenario-container" data-scenario-id="${id}">
            <div class="scenario-header">
                <h4>Scenario ${id}</h4>
                <div class="scenario-actions">
                    <button class="btn-small btn-remove">Remove</button>
                </div>
            </div>
            <div class="form-group">
                <label for="scenario-${id}-title">Scenario Title:</label>
                <input type="text" class="scenario-title" id="scenario-${id}-title" value="${title}">
            </div>
            <div class="form-group">
                <label for="scenario-${id}-description">Scenario Description:</label>
                <textarea class="scenario-description" id="scenario-${id}-description" rows="5">${description}</textarea>
            </div>
        </div>
    `;
}

// Show a tab
function showTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show the selected tab
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.style.display = 'block';
    }
    
    // Add active class to the clicked button
    const activeButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

// Show status message
function showStatusMessage(message, type = 'success') {
    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';
        
        // Scroll to the message
        statusMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Hide the message after 5 seconds
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    }
}