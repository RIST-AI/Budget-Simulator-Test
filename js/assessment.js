// Import Firebase modules
import { auth, onAuthStateChanged, signOut, db, doc, getDoc, setDoc, collection, addDoc, activeAssessmentRef, getStudentBudgetRef } from './firebase-config.js';
import { requireStudent, updateNavigation } from './auth.js';

// Global variables
let currentUser = null;
let assessmentData = null;
let userScenario = null;

// Initialize the assessment page
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Initialize navigation
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.textContent = 'Loading...';
            loadingIndicator.className = ''; // Remove any spinner classes
        }
        await updateNavigation();
        
        // Get current user and ensure they're a student
        currentUser = await requireStudent();
        
        // If not a student, the function will redirect and return null
        if (!currentUser) {
            return;
        }
        
        // Set up logout functionality
        const logoutLink = document.querySelector('.logout-link');
        if (logoutLink) {  // Check if the element exists before adding event listener
            logoutLink.addEventListener('click', function(e) {
                e.preventDefault();
                signOut(auth).then(() => {
                    window.location.href = 'index.html';
                }).catch((error) => {
                    console.error("Error signing out:", error);
                });
            });
        }
        
        // Load assessment content
        await loadAssessmentContent();
        await loadPreviousBudgetData();
        
        // Check if user already has an assessment in progress
        await checkExistingSubmission();
        
        // Set up event listeners
        setupEventListeners();
        
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Show assessment content
        const assessmentContent = document.getElementById('assessment-content');
        if (assessmentContent) {
            assessmentContent.style.display = 'block';
        }
        fixRemoveButtons();
    } catch (error) {
        console.error("Error initializing assessment:", error);
        showErrorMessage("Error loading assessment: " + error.message);
    }
});

function fixRemoveButtons() {
    // Target the actual button classes in your HTML
    document.querySelectorAll('#income-table .btn-remove, #expense-table .btn-remove').forEach(button => {
        // Set the onclick property directly (avoids event listener issues)
        button.onclick = function() {
            const row = this.closest('tr');
            if (row) {
                const tbody = row.closest('tbody');
                if (tbody && tbody.querySelectorAll('tr').length > 1) {
                    row.remove();
                    updateBudgetTotals();
                }
            }
        };
    });
}

// Show error message
function showErrorMessage(message) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-message';
    errorContainer.innerHTML = `
        <p>${message}</p>
        <button class="btn" onclick="location.reload()">Try Again</button>
    `;
    
    const mainContent = document.querySelector('main');
    if (mainContent) {
        // Clear main content
        mainContent.innerHTML = '';
        mainContent.appendChild(errorContainer);
    } else {
        document.body.appendChild(errorContainer);
    }
}

// Load assessment content
async function loadAssessmentContent() {
    try {
        // Function to show error messages
        function displayError(message) {
            // Hide loading indicator
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            
            // Create error element
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-danger';
            errorDiv.innerHTML = `
                <h4>Error Loading Assessment</h4>
                <p>${message}</p>
                <button class="btn" onclick="location.reload()">Try Again</button>
            `;
            
            // Insert after loading indicator
            loadingIndicator.parentNode.insertBefore(errorDiv, loadingIndicator.nextSibling);
        }
        
        // Try to get the active assessment ID
        let activeAssessmentId = null;
        try {
            const activeDoc = await getDoc(activeAssessmentRef);
            if (activeDoc.exists()) {
                activeAssessmentId = activeDoc.data().assessmentId;
            } else {
                displayError("No active assessment is currently available. Please contact your instructor.");
                return;
            }
        } catch (error) {
            console.error("Error getting active assessment:", error);
            
            // Specific handling for permission error
            if (error.code === 'permission-denied') {
                displayError("You don't have permission to access the assessment. Please make sure you're logged in with the correct account.");
            } else {
                displayError(`Could not load the active assessment: ${error.message}`);
            }
            return;
        }

        // Try to get the assessment content
        try {
            const assessmentRef = doc(db, 'assessments', activeAssessmentId);
            const assessmentDoc = await getDoc(assessmentRef);
            
            if (!assessmentDoc.exists()) {
                displayError(`The active assessment (ID: ${activeAssessmentId}) could not be found. Please contact your instructor.`);
                return;
            }
            
            // We have the assessment data, proceed with display
            const assessmentData = assessmentDoc.data();
            displayAssessment(assessmentData);
            
        } catch (error) {
            console.error("Error loading assessment content:", error);
            
            // Specific handling for permission error
            if (error.code === 'permission-denied') {
                displayError("You don't have permission to access this assessment. This might be because the security rules are still updating or you're using the wrong account.");
            } else {
                displayError(`Failed to load the assessment content: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error("Error in assessment loading process:", error);
        displayError(`An unexpected error occurred while loading the assessment: ${error.message}`);
    }
}

// Display assessment content
function displayAssessment(data) {
    assessmentData = data;
    // Hide loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    
    // Show assessment content
    const assessmentContent = document.getElementById('assessment-content');
    if (assessmentContent) {
        assessmentContent.style.display = 'block';
    }
    
    // Fill in the assessment details
    document.getElementById('assessment-title').textContent = assessmentData.title || 'Farm Budget Assessment';
    document.getElementById('assessment-description').textContent = assessmentData.description || '';
    document.getElementById('instructions-text').textContent = assessmentData.instructions || '';
    
    // Handle scenarios - select one if available
    if (assessmentData.scenarios && assessmentData.scenarios.length > 0) {
        // For simplicity, use the first scenario (or you could implement a dropdown)
        const scenarioHTML = `
            <div class="scenario">
                <h4>${assessmentData.scenarios[0].title}</h4>
                <p>${assessmentData.scenarios[0].description}</p>
            </div>
        `;
        document.getElementById('scenario-text').innerHTML = scenarioHTML;
    } else {
        document.getElementById('scenario-text').innerHTML = '<p>No scenario available for this assessment.</p>';
    }
    
    // Handle questions
    if (assessmentData.questions && assessmentData.questions.length > 0) {
        let questionsHTML = '';
        
        assessmentData.questions.forEach((question, index) => {
            questionsHTML += `
                <div class="question">
                    <div class="question-text">
                        <p><strong>Question ${index + 1}:</strong> ${question.text}</p>
                    </div>
                    <div class="answer-area">
                        <textarea id="answer-${question.id}" placeholder="Enter your answer here..." rows="4"></textarea>
                    </div>
                </div>
            `;
        });
        
        document.querySelector('.question-container').innerHTML = questionsHTML;
    } else {
        document.querySelector('.question-container').innerHTML = '<p>No questions available for this assessment.</p>';
    }
}

// Add function to load previous budget data
async function loadPreviousBudgetData() {
    try {
        // Get the user's saved budget data
        const budgetRef = getStudentBudgetRef(currentUser.uid);
        const budgetDoc = await getDoc(budgetRef);
        
        if (budgetDoc.exists()) {
            const budgetData = budgetDoc.data();
            
            // Update farm type if it exists
            const farmTypeSelect = document.getElementById('farm-type');
            if (farmTypeSelect && budgetData.farmType) {
                farmTypeSelect.value = budgetData.farmType;
            }
            
            // Update budget period if it exists
            const budgetPeriodSelect = document.getElementById('budget-period');
            if (budgetPeriodSelect && budgetData.budgetPeriod) {
                budgetPeriodSelect.value = budgetData.budgetPeriod;
            }
            
            // Populate income items
            if (budgetData.incomeItems && budgetData.incomeItems.length > 0) {
                const incomeTable = document.getElementById('income-table');
                if (incomeTable) {
                    const incomeTableBody = incomeTable.querySelector('tbody');
                    if (incomeTableBody) {
                        incomeTableBody.innerHTML = '';
                        
                        budgetData.incomeItems.forEach(item => {
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td><input type="text" value="${item.name}" placeholder="Income item"></td>
                                <td><input type="number" class="quantity-input" value="${item.quantity || 1}" placeholder="0" min="0"></td>
                                <td><input type="number" class="price-input" value="${item.price || 0}" placeholder="0.00" min="0" step="0.01"></td>
                                <td class="row-total">$${((item.quantity || 1) * (item.price || 0)).toFixed(2)}</td>
                                <td><button class="btn-small btn-remove">Remove</button></td>
                            `;
                            incomeTableBody.appendChild(row);
                            
                            // Add event listeners to the new row
                            addEventListenersToRow(row);
                        });
                    }
                }
            }
            
            // Populate expense items
            if (budgetData.expenseItems && budgetData.expenseItems.length > 0) {
                const expenseTable = document.getElementById('expense-table');
                if (expenseTable) {
                    const expenseTableBody = expenseTable.querySelector('tbody');
                    if (expenseTableBody) {
                        expenseTableBody.innerHTML = '';
                        
                        budgetData.expenseItems.forEach(item => {
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td><input type="text" value="${item.name}" placeholder="Expense item"></td>
                                <td><input type="number" class="quantity-input" value="${item.quantity || 1}" placeholder="0" min="0"></td>
                                <td><input type="number" class="price-input" value="${item.price || 0}" placeholder="0.00" min="0" step="0.01"></td>
                                <td class="row-total">$${((item.quantity || 1) * (item.price || 0)).toFixed(2)}</td>
                                <td><button class="btn-small btn-remove">Remove</button></td>
                            `;
                            expenseTableBody.appendChild(row);
                            
                            // Add event listeners to the new row
                            addEventListenersToRow(row);
                        });
                    }
                }
            }
            
            // Update budget totals
            updateBudgetTotals();

        }
    } catch (error) {
        console.error("Error loading previous budget data:", error);
    }
}

// Add helper function for row event listeners
function addEventListenersToRow(row) {
    // Add event listener to remove button
    const removeButton = row.querySelector('.btn-remove');
    if (removeButton) {
        removeButton.onclick = function() {
            const tbody = row.closest('tbody');
            if (tbody && tbody.querySelectorAll('tr').length > 1) {
                row.remove();
                updateBudgetTotals();
            }
        };
    }
    
    // Add event listeners for quantity and price inputs
    const quantityInput = row.querySelector('.quantity-input');
    const priceInput = row.querySelector('.price-input');
    
    if (quantityInput && priceInput) {
        const updateTotals = function() {
            calculateRowTotal(row);
            updateBudgetTotals();
        };
        
        quantityInput.addEventListener('input', updateTotals);
        priceInput.addEventListener('input', updateTotals);
    }
}

// Assign a random scenario to the user
function assignScenario() {
    if (!assessmentData || !assessmentData.scenarios || assessmentData.scenarios.length === 0) {
        // Use default scenario if none are available
        userScenario = {
            id: 'default',
            title: 'Default Scenario',
            description: 'You are the manager of a farm. Create a budget and answer the questions.'
        };
    } else {
        // Select a random scenario
        const randomIndex = Math.floor(Math.random() * assessmentData.scenarios.length);
        userScenario = assessmentData.scenarios[randomIndex];
    }
    
    // Display the scenario
    const scenarioElement = document.getElementById('scenario-text');
    if (scenarioElement) {
        scenarioElement.innerHTML = userScenario.description;
    }
}

// Populate questions
function populateQuestions() {
    if (!assessmentData || !assessmentData.questions || assessmentData.questions.length === 0) {
        return;
    }
    
    const questionContainer = document.querySelector('.question-container');
    if (!questionContainer) {
        console.error("Question container not found");
        return;
    }
    
    questionContainer.innerHTML = '';
    
    assessmentData.questions.forEach((question, index) => {
        const questionElement = document.createElement('div');
        questionElement.className = 'question';
        
        questionElement.innerHTML = `
            <h3>Question ${index + 1}</h3>
            <div class="question-text">${question.text}</div>
            <textarea id="question${index + 1}" rows="5" placeholder="Your answer here..."></textarea>
        `;
        
        questionContainer.appendChild(questionElement);
    });
}

// Check if user already has an assessment in progress
// Modify checkExistingSubmission in assessment.js

async function checkExistingSubmission() {
    try {
        // Get active assessment ID first
        const activeDoc = await getDoc(activeAssessmentRef);
        if (!activeDoc.exists()) return;
        
        const activeAssessmentId = activeDoc.data().assessmentId;
        
        // Check for existing submission with compound key
        const submissionRef = doc(db, 'submissions', `${currentUser.uid}_${activeAssessmentId}`);
        const submissionDoc = await getDoc(submissionRef);
        
        if (submissionDoc.exists()) {
            const existingSubmission = submissionDoc.data();
            
            // Check assessment status
            const status = existingSubmission.status || 
                           (existingSubmission.submitted ? 'submitted' : 'saved');
            
            // Handle different statuses
            switch(status) {
                case 'saved':
                    // Populate the form with saved data
                    populateExistingBudget(existingSubmission.budget);
                    populateExistingAnswers(existingSubmission.answers);
                    
                    // Set scenario
                    if (existingSubmission.scenario) {
                        userScenario = existingSubmission.scenario;
                        const scenarioElement = document.getElementById('scenario-text');
                        if (scenarioElement) {
                            scenarioElement.innerHTML = userScenario.description;
                        }
                    }
                    break;
                    
                case 'feedback_provided':
                    // Populate the form with previous submission
                    populateExistingBudget(existingSubmission.budget);
                    populateExistingAnswers(existingSubmission.answers);
                    
                    // Set scenario
                    if (existingSubmission.scenario) {
                        userScenario = existingSubmission.scenario;
                        const scenarioElement = document.getElementById('scenario-text');
                        if (scenarioElement) {
                            scenarioElement.innerHTML = userScenario.description;
                        }
                    }
                    
                    // Show feedback message
                    showFeedbackMessage(existingSubmission);
                    break;
                    
                case 'submitted':
                case 'finalised':
                    // Show message that assessment is already submitted
                    showSubmittedMessage(status, existingSubmission);
                    return; // Exit function to prevent form population
            }
        }
    } catch (error) {
        console.error("Error checking existing assessment:", error);
    }
}

// Show feedback message
function showFeedbackMessage(assessment) {
    // Create feedback message container
    const feedbackContainer = document.createElement('div');
    feedbackContainer.className = 'feedback-container';
    feedbackContainer.style.backgroundColor = '#d4edda';
    feedbackContainer.style.color = '#155724';
    feedbackContainer.style.padding = '15px';
    feedbackContainer.style.marginBottom = '20px';
    feedbackContainer.style.borderRadius = '4px';
    
    // Get the most recent feedback
    const latestFeedback = assessment.feedbackHistory && assessment.feedbackHistory.length > 0 
        ? assessment.feedbackHistory[assessment.feedbackHistory.length - 1] 
        : { comments: 'Your trainer has provided feedback and requested resubmission.' };
    
    feedbackContainer.innerHTML = `
        <h3>Trainer Feedback</h3>
        <p>${latestFeedback.comments || 'No specific comments provided.'}</p>
        <p>Please review your assessment, make any necessary changes, and resubmit.</p>
    `;
    
    // Insert at the top of the assessment content
    const assessmentContent = document.getElementById('assessment-content');
    if (assessmentContent && assessmentContent.firstChild) {
        assessmentContent.insertBefore(feedbackContainer, assessmentContent.firstChild);
    }
}

// Show message for already submitted assessments
function showSubmittedMessage(status, assessment) {
    const mainContent = document.querySelector('main');
    if (!mainContent) return;
    
    // Clear main content
    mainContent.innerHTML = '';
    
    // Create message container
    const messageContainer = document.createElement('div');
    messageContainer.className = 'container';
    
    if (status === 'submitted') {
        messageContainer.innerHTML = `
            <div class="info-message">
                <h2>Assessment Already Submitted</h2>
                <p>Your assessment has been submitted and is awaiting review by your trainer.</p>
                <p>You will be notified when feedback is available.</p>
                <p><strong>Submitted on:</strong> ${new Date(assessment.submittedAt.seconds * 1000).toLocaleDateString()}</p>
                <a href="index.html" class="btn">Return to Home</a>
            </div>
        `;
    } else if (status === 'finalised') {
        // Get the latest feedback that contains the grade
        let grade = assessment.grade || 'Not specified';
        let feedbackText = 'No feedback provided.';
        
        if (assessment.feedbackHistory && assessment.feedbackHistory.length > 0) {
            const finalFeedback = assessment.feedbackHistory.find(f => f.grade) || 
                                 assessment.feedbackHistory[assessment.feedbackHistory.length - 1];
            
            if (finalFeedback.comments) {
                feedbackText = finalFeedback.comments;
            }
        }
        
        messageContainer.innerHTML = `
            <div class="info-message">
                <h2>Assessment finalised</h2>
                <p>Your assessment has been graded and finalised by your trainer.</p>
                <div class="grade-display">
                    <h3>Grade: ${grade}</h3>
                </div>
                <div class="feedback-container">
                    <h3>Trainer Feedback:</h3>
                    <p>${feedbackText}</p>
                </div>
                <p><strong>finalised on:</strong> ${assessment.finalisedAt ? new Date(assessment.finalisedAt.seconds * 1000).toLocaleDateString() : 'Date not available'}</p>
                <a href="index.html" class="btn">Return to Home</a>
            </div>
        `;
    }
    
    mainContent.appendChild(messageContainer);
}

// Populate existing budget
function populateExistingBudget(budget) {
    // Populate farm type and budget period
    const farmTypeElement = document.getElementById('farm-type');
    if (farmTypeElement) {
        farmTypeElement.value = budget.farmType || 'mixed';
    }
    
    const budgetPeriodElement = document.getElementById('budget-period');
    if (budgetPeriodElement) {
        budgetPeriodElement.value = budget.budgetPeriod || 'annual';
    }
    
    // Populate income items
    const incomeTable = document.getElementById('income-table');
    if (!incomeTable) {
        console.error("Income table not found");
        return;
    }
    
    const incomeTableBody = incomeTable.querySelector('tbody');
    if (!incomeTableBody) {
        console.error("Income table body not found");
        return;
    }
    
    incomeTableBody.innerHTML = '';
    
    if (budget.incomeItems && budget.incomeItems.length > 0) {
        budget.incomeItems.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="text" value="${item.name}" placeholder="Income item"></td>
                <td><input type="number" class="quantity-input" value="${item.quantity || 1}" placeholder="0" min="0"></td>
                <td><input type="number" class="price-input" value="${item.price || item.amount || 0}" placeholder="0.00" min="0" step="0.01"></td>
                <td class="row-total">$${((item.quantity || 1) * (item.price || item.amount || 0)).toFixed(2)}</td>
                <td><button class="btn-small btn-remove">Remove</button></td>
            `;
            incomeTableBody.appendChild(row);
            
            // Add event listener to remove button
            const removeButton = row.querySelector('.btn-remove');
            if (removeButton) {
                removeButton.addEventListener('click', function() {
                    row.remove();
                    updateBudgetTotals();
                });
            }
            
            // Add event listeners to update row total when quantity or price changes
            const quantityInput = row.querySelector('.quantity-input');
            const priceInput = row.querySelector('.price-input');
            
            if (quantityInput && priceInput) {
                const updateRowTotal = function() {
                    calculateRowTotal(row);
                    updateBudgetTotals();
                };
                
                quantityInput.addEventListener('input', updateRowTotal);
                priceInput.addEventListener('input', updateRowTotal);
            }
        });
    } else {
        // Add a default empty row
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" placeholder="Income item"></td>
            <td><input type="number" class="quantity-input" placeholder="0" min="0"></td>
            <td><input type="number" class="price-input" placeholder="0.00" min="0" step="0.01"></td>
            <td class="row-total">$0.00</td>
            <td><button class="btn-small btn-remove">Remove</button></td>
        `;
        incomeTableBody.appendChild(row);
        
        // Add event listener to remove button
        const removeButton = row.querySelector('.btn-remove');
        if (removeButton) {
            removeButton.addEventListener('click', function() {
                if (incomeTableBody.querySelectorAll('tr').length > 1) {
                    row.remove();
                    updateBudgetTotals();
                }
            });
        }
        
        // Add event listeners to update row total when quantity or price changes
        const quantityInput = row.querySelector('.quantity-input');
        const priceInput = row.querySelector('.price-input');
        
        if (quantityInput && priceInput) {
            const updateRowTotal = function() {
                calculateRowTotal(row);
                updateBudgetTotals();
            };
            
            quantityInput.addEventListener('input', updateRowTotal);
            priceInput.addEventListener('input', updateRowTotal);
        }
    }
    
    // Populate expense items
    const expenseTable = document.getElementById('expense-table');
    if (!expenseTable) {
        console.error("Expense table not found");
        return;
    }
    
    const expenseTableBody = expenseTable.querySelector('tbody');
    if (!expenseTableBody) {
        console.error("Expense table body not found");
        return;
    }
    
    expenseTableBody.innerHTML = '';
    
    if (budget.expenseItems && budget.expenseItems.length > 0) {
        budget.expenseItems.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="text" value="${item.name}" placeholder="Expense item"></td>
                <td><input type="number" class="quantity-input" value="${item.quantity || 1}" placeholder="0" min="0"></td>
                <td><input type="number" class="price-input" value="${item.price || item.amount || 0}" placeholder="0.00" min="0" step="0.01"></td>
                <td class="row-total">$${((item.quantity || 1) * (item.price || item.amount || 0)).toFixed(2)}</td>
                <td><button class="btn-small btn-remove">Remove</button></td>
            `;
            expenseTableBody.appendChild(row);
            
            // Add event listener to remove button
            const removeButton = row.querySelector('.btn-remove');
            if (removeButton) {
                removeButton.addEventListener('click', function() {
                    row.remove();
                    updateBudgetTotals();
                });
            }
            
            // Add event listeners to update row total when quantity or price changes
            const quantityInput = row.querySelector('.quantity-input');
            const priceInput = row.querySelector('.price-input');
            
            if (quantityInput && priceInput) {
                const updateRowTotal = function() {
                    calculateRowTotal(row);
                    updateBudgetTotals();
                };
                
                quantityInput.addEventListener('input', updateRowTotal);
                priceInput.addEventListener('input', updateRowTotal);
            }
        });
    } else {
        // Add a default empty row
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" placeholder="Expense item"></td>
            <td><input type="number" class="quantity-input" placeholder="0" min="0"></td>
            <td><input type="number" class="price-input" placeholder="0.00" min="0" step="0.01"></td>
            <td class="row-total">$0.00</td>
            <td><button class="btn-small btn-remove">Remove</button></td>
        `;
        expenseTableBody.appendChild(row);
        
        // Add event listener to remove button
        const removeButton = row.querySelector('.btn-remove');
        if (removeButton) {
            removeButton.addEventListener('click', function() {
                if (expenseTableBody.querySelectorAll('tr').length > 1) {
                    row.remove();
                    updateBudgetTotals();
                }
            });
        }
        
        // Add event listeners to update row total when quantity or price changes
        const quantityInput = row.querySelector('.quantity-input');
        const priceInput = row.querySelector('.price-input');
        
        if (quantityInput && priceInput) {
            const updateRowTotal = function() {
                calculateRowTotal(row);
                updateBudgetTotals();
            };
            
            quantityInput.addEventListener('input', updateRowTotal);
            priceInput.addEventListener('input', updateRowTotal);
        }
    }
    
    // Update budget totals
    updateBudgetTotals();
}

// Calculate row total
function calculateRowTotal(row) {
    const quantityInput = row.querySelector('.quantity-input');
    const priceInput = row.querySelector('.price-input');
    
    if (!quantityInput || !priceInput) return 0;
    
    const quantity = parseFloat(quantityInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    const total = quantity * price;
    
    const rowTotalElement = row.querySelector('.row-total');
    if (rowTotalElement) {
        rowTotalElement.textContent = '$' + total.toFixed(2);
    }
    
    return total;
}

// Populate existing answers
function populateExistingAnswers(answers) {
    Object.keys(answers).forEach(questionId => {
        const answerElement = document.getElementById(questionId);
        if (answerElement) {
            answerElement.value = answers[questionId];
        }
    });
}

// Set up event listeners
function setupEventListeners() {
    // Add income item
    const addIncomeButton = document.getElementById('add-income');

    if (addIncomeButton) {
        addIncomeButton.addEventListener('click', function() {
            const incomeTable = document.getElementById('income-table');
            if (!incomeTable) return;
            
            const incomeTableBody = incomeTable.querySelector('tbody');
            if (!incomeTableBody) return;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="text" placeholder="Income item"></td>
                <td><input type="number" class="quantity-input" placeholder="0" min="0"></td>
                <td><input type="number" class="price-input" placeholder="0.00" min="0" step="0.01"></td>
                <td class="row-total">$0.00</td>
                <td><button class="btn-small btn-remove">Remove</button></td>
            `;
            incomeTableBody.appendChild(row);
            
            // Add event listener to remove button
            const removeButton = row.querySelector('.btn-remove');
            if (removeButton) {
                removeButton.addEventListener('click', function() {
                    row.remove();
                    updateBudgetTotals();
                });
            }
            
            // Add event listeners to update row total when quantity or price changes
            const quantityInput = row.querySelector('.quantity-input');
            const priceInput = row.querySelector('.price-input');
            
            if (quantityInput && priceInput) {
                const updateRowTotal = function() {
                    calculateRowTotal(row);
                    updateBudgetTotals();
                };
                
                quantityInput.addEventListener('input', updateRowTotal);
                priceInput.addEventListener('input', updateRowTotal);
            }
            
            // Focus on the new input
            const firstInput = row.querySelector('input');
            if (firstInput) {
                firstInput.focus();
            }
        });
    }
    
    // Add expense item
    const addExpenseButton = document.getElementById('add-expense');
    if (addExpenseButton) {
        addExpenseButton.addEventListener('click', function() {
            const expenseTable = document.getElementById('expense-table');
            if (!expenseTable) return;
            
            const expenseTableBody = expenseTable.querySelector('tbody');
            if (!expenseTableBody) return;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="text" placeholder="Expense item"></td>
                <td><input type="number" class="quantity-input" placeholder="0" min="0"></td>
                <td><input type="number" class="price-input" placeholder="0.00" min="0" step="0.01"></td>
                <td class="row-total">$0.00</td>
                <td><button class="btn-small btn-remove">Remove</button></td>
            `;
            expenseTableBody.appendChild(row);
            
            // Add event listener to remove button
            const removeButton = row.querySelector('.btn-remove');
            if (removeButton) {
                removeButton.addEventListener('click', function() {
                    row.remove();
                    updateBudgetTotals();
                });
            }
            
            // Add event listeners to update row total when quantity or price changes
            const quantityInput = row.querySelector('.quantity-input');
            const priceInput = row.querySelector('.price-input');
            
            if (quantityInput && priceInput) {
                const updateRowTotal = function() {
                    calculateRowTotal(row);
                    updateBudgetTotals();
                };
                
                quantityInput.addEventListener('input', updateRowTotal);
                priceInput.addEventListener('input', updateRowTotal);
            }
            
            // Focus on the new input
            const firstInput = row.querySelector('input');
            if (firstInput) {
                firstInput.focus();
            }
        });
    }
    
    // Add event listeners to existing inputs
    document.querySelectorAll('tr').forEach(row => {
        const quantityInput = row.querySelector('.quantity-input');
        const priceInput = row.querySelector('.price-input');
        
        if (quantityInput && priceInput) {
            const updateRowTotal = function() {
                calculateRowTotal(row);
                updateBudgetTotals();
            };
            
            quantityInput.addEventListener('input', updateRowTotal);
            priceInput.addEventListener('input', updateRowTotal);
        }
    });
    
    // Add event listeners to existing remove buttons
    document.querySelectorAll('.btn-remove').forEach(button => {
        if (button) {
            button.addEventListener('click', function() {
                const row = this.closest('tr');
                if (!row) return;
                
                const table = row.closest('table');
                if (!table) return;
                
                const tbody = table.querySelector('tbody');
                if (!tbody) return;
                
                // Only remove if there's more than one row
                if (tbody.querySelectorAll('tr').length > 1) {
                    row.remove();
                    updateBudgetTotals();
                }
            });
        }
    });
    
    // Save assessment
    const saveButton = document.getElementById('save-assessment');
    if (saveButton) {
        saveButton.addEventListener('click', saveAssessment);
    }
    
    // Submit assessment
    const submitButton = document.getElementById('submit-assessment');
    if (submitButton) {
        submitButton.addEventListener('click', submitAssessment);
    }
    
    const resetBudgetButton = document.getElementById('reset-budget');

    if (resetBudgetButton) {
        resetBudgetButton.addEventListener('click', function() {
            if (confirm('Are you sure you want to reset your budget? All current entries will be cleared.')) {
                resetBudget();
            }
        });
}
    // Update budget totals initially
    updateBudgetTotals();
}

function resetBudget() {
    // Reset farm type and budget period to defaults
    const farmTypeSelect = document.getElementById('farm-type');
    if (farmTypeSelect) {
        farmTypeSelect.value = 'mixed';
    }
    
    const budgetPeriodSelect = document.getElementById('budget-period');
    if (budgetPeriodSelect) {
        budgetPeriodSelect.value = 'annual';
    }
    
    // Reset income table
    const incomeTable = document.getElementById('income-table');
    if (incomeTable) {
        const incomeTableBody = incomeTable.querySelector('tbody');
        if (incomeTableBody) {
            incomeTableBody.innerHTML = `
                <tr>
                    <td><input type="text" placeholder="Income item"></td>
                    <td><input type="number" class="quantity-input" placeholder="0" min="0"></td>
                    <td><input type="number" class="price-input" placeholder="0.00" min="0" step="0.01"></td>
                    <td class="row-total">$0.00</td>
                    <td><button class="btn-small btn-remove">Remove</button></td>
                </tr>
            `;
            
            // Add event listeners to the row
            const row = incomeTableBody.querySelector('tr');
            if (row) {
                addEventListenersToRow(row);
            }
        }
    }
    
    // Reset expense table
    const expenseTable = document.getElementById('expense-table');
    if (expenseTable) {
        const expenseTableBody = expenseTable.querySelector('tbody');
        if (expenseTableBody) {
            expenseTableBody.innerHTML = `
                <tr>
                    <td><input type="text" placeholder="Expense item"></td>
                    <td><input type="number" class="quantity-input" placeholder="0" min="0"></td>
                    <td><input type="number" class="price-input" placeholder="0.00" min="0" step="0.01"></td>
                    <td class="row-total">$0.00</td>
                    <td><button class="btn-small btn-remove">Remove</button></td>
                </tr>
            `;
            
            // Add event listeners to the row
            const row = expenseTableBody.querySelector('tr');
            if (row) {
                addEventListenersToRow(row);
            }
        }
    }
    
    // Update totals
    updateBudgetTotals();
}

// Update budget totals
function updateBudgetTotals() {
    // Calculate total income by summing row totals
    let totalIncome = 0;
    document.querySelectorAll('#income-table tbody tr').forEach(row => {
        const rowTotalElement = row.querySelector('.row-total');
        if (rowTotalElement) {
            // Remove $ sign and convert to number
            const rowTotal = parseFloat(rowTotalElement.textContent.replace('$', '')) || 0;
            totalIncome += rowTotal;
        }
    });
    
    // Calculate total expenses by summing row totals
    let totalExpenses = 0;
    document.querySelectorAll('#expense-table tbody tr').forEach(row => {
        const rowTotalElement = row.querySelector('.row-total');
        if (rowTotalElement) {
            // Remove $ sign and convert to number
            const rowTotal = parseFloat(rowTotalElement.textContent.replace('$', '')) || 0;
            totalExpenses += rowTotal;
        }
    });
    
    // Calculate net result
    const netResult = totalIncome - totalExpenses;
    
    // Update display
    const totalIncomeElement = document.getElementById('total-income');
    if (totalIncomeElement) {
        totalIncomeElement.textContent = `$${totalIncome.toFixed(2)}`;
    }
    
    const totalExpensesElement = document.getElementById('total-expenses');
    if (totalExpensesElement) {
        totalExpensesElement.textContent = `$${totalExpenses.toFixed(2)}`;
    }
    
    const summaryIncomeElement = document.getElementById('summary-income');
    if (summaryIncomeElement) {
        summaryIncomeElement.textContent = `$${totalIncome.toFixed(2)}`;
    }
    
    const summaryExpensesElement = document.getElementById('summary-expenses');
    if (summaryExpensesElement) {
        summaryExpensesElement.textContent = `$${totalExpenses.toFixed(2)}`;
    }
    
    const netResultElement = document.getElementById('net-result');
    if (netResultElement) {
        netResultElement.textContent = `$${netResult.toFixed(2)}`;
        
        // Add color to net result based on value
        if (netResult > 0) {
            netResultElement.className = 'positive';
        } else if (netResult < 0) {
            netResultElement.className = 'negative';
        } else {
            netResultElement.className = '';
        }
    }
}

// Save assessment
async function saveAssessment() {
    try {
        // Show saving indicator
        const saveButton = document.getElementById('save-assessment');
        if (!saveButton) return;
        
        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
        
        // Get the active assessment ID first
        const activeAssessmentDoc = await getDoc(activeAssessmentRef);
        if (!activeAssessmentDoc.exists()) {
            throw new Error('No active assessment available');
        }
        const activeAssessmentId = activeAssessmentDoc.data().assessmentId;
        
        // Collect budget data
        const budget = collectBudgetData();
        
        // Collect answers
        const answers = collectAnswers();
        
        // Create assessment data
        const assessmentData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            scenario: userScenario,
            budget: budget,
            answers: answers,
            lastSaved: new Date(),
            status: 'saved',
            submitted: false,
            assessmentId: activeAssessmentId
        };
        
        // Save to submissions collection with compound key
        await setDoc(doc(db, 'submissions', `${currentUser.uid}_${activeAssessmentId}`), assessmentData);
        
        // Show success message
        alert('Assessment saved successfully!');
    } catch (error) {
        console.error("Error saving assessment:", error);
        alert('Error saving assessment: ' + error.message);
    } finally {
        // Reset button
        const saveButton = document.getElementById('save-assessment');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Progress';
        }
    }
}

// Submit assessment
async function submitAssessment() {
    try {
        // Validate assessment
        const validationResult = validateAssessment();
        if (!validationResult.valid) {
            alert(validationResult.message);
            return;
        }
        
        // Confirm submission
        if (!confirm('Are you sure you want to submit your assessment? You will not be able to make changes after submission unless your trainer provides feedback and requests resubmission.')) {
            return;
        }
        
        // Show submitting indicator
        const submitButton = document.getElementById('submit-assessment');
        if (!submitButton) return;
        
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
        
        // Collect budget data
        const budget = collectBudgetData();
        
        // Collect answers
        const answers = collectAnswers();
        
        // Get assessment title before submission
    let assessmentTitle = "Assessment";
    try {
        const activeAssessmentDoc = await getDoc(activeAssessmentRef);
        if (activeAssessmentDoc.exists()) {
            const activeAssessmentId = activeAssessmentDoc.data().assessmentId;
            const assessmentDoc = await getDoc(doc(db, 'assessments', activeAssessmentId));
            if (assessmentDoc.exists()) {
                assessmentTitle = assessmentDoc.data().title || "Assessment";
            }
        }
    } catch (error) {
        console.error("Error getting assessment title:", error);
    }
        // Create assessment data
        const assessmentData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            scenario: userScenario,
            budget: budget,
            answers: answers,
            submittedAt: new Date(),
            status: 'submitted', // Set status to 'submitted'
            submitted: true,
            feedback: null,
            grade: null,
            feedbackHistory: [], // Initialize feedback history array
            assessmentTitle: assessmentTitle
        };
        
        // Get the active assessment ID
        const activeAssessmentDoc = await getDoc(activeAssessmentRef);
        if (!activeAssessmentDoc.exists()) {
            throw new Error('No active assessment available');
        }
        const activeAssessmentId = activeAssessmentDoc.data().assessmentId;

        // Update the assessmentData with the assessment ID
        assessmentData.assessmentId = activeAssessmentId;

        // Save budget data separately for reuse in future assessments
        await setDoc(getStudentBudgetRef(currentUser.uid), {
            userId: currentUser.uid,
            farmType: budget.farmType,
            budgetPeriod: budget.budgetPeriod,
            incomeItems: budget.incomeItems,
            expenseItems: budget.expenseItems,
            lastUpdated: new Date()
        });

        // Save to Firestore - use composite key
        await setDoc(doc(db, 'submissions', `${currentUser.uid}_${activeAssessmentId}`), assessmentData);
        
        // Show success message
        const assessmentContent = document.getElementById('assessment-content');
        if (assessmentContent) {
            assessmentContent.style.display = 'none';
        }
        
        const submissionSuccess = document.getElementById('submission-success');
        if (submissionSuccess) {
            submissionSuccess.style.display = 'block';
        }
    } catch (error) {
        console.error("Error submitting assessment:", error);
        alert('Error submitting assessment: ' + error.message);
        
        // Reset button
        const submitButton = document.getElementById('submit-assessment');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Assessment';
        }
    }
}

// Collect budget data
function collectBudgetData() {
    // Get farm type and budget period
    const farmTypeElement = document.getElementById('farm-type');
    const farmType = farmTypeElement ? farmTypeElement.value : 'mixed';
    
    const budgetPeriodElement = document.getElementById('budget-period');
    const budgetPeriod = budgetPeriodElement ? budgetPeriodElement.value : 'annual';
    
    // Collect income items
    const incomeItems = [];
    document.querySelectorAll('#income-table tbody tr').forEach(row => {
        const nameInput = row.querySelector('input[type="text"]');
        const quantityInput = row.querySelector('.quantity-input');
        const priceInput = row.querySelector('.price-input');
        const rowTotalElement = row.querySelector('.row-total');
        
        if (!nameInput || !quantityInput || !priceInput || !rowTotalElement) return;
        
        const name = nameInput.value.trim();
        const quantity = parseFloat(quantityInput.value) || 0;
        const price = parseFloat(priceInput.value) || 0;
        const total = quantity * price;
        
        if (name || quantity > 0 || price > 0) {
            incomeItems.push({
                name: name,
                quantity: quantity,
                price: price,
                amount: total // Keep amount for backward compatibility
            });
        }
    });
    
    // Collect expense items
    const expenseItems = [];
    document.querySelectorAll('#expense-table tbody tr').forEach(row => {
        const nameInput = row.querySelector('input[type="text"]');
        const quantityInput = row.querySelector('.quantity-input');
        const priceInput = row.querySelector('.price-input');
        const rowTotalElement = row.querySelector('.row-total');
        
        if (!nameInput || !quantityInput || !priceInput || !rowTotalElement) return;
        
        const name = nameInput.value.trim();
        const quantity = parseFloat(quantityInput.value) || 0;
        const price = parseFloat(priceInput.value) || 0;
        const total = quantity * price;
        
        if (name || quantity > 0 || price > 0) {
            expenseItems.push({
                name: name,
                quantity: quantity,
                price: price,
                amount: total // Keep amount for backward compatibility
            });
        }
    });
    
    // Calculate totals
    let totalIncome = 0;
    incomeItems.forEach(item => totalIncome += item.amount);
    
    let totalExpenses = 0;
    expenseItems.forEach(item => totalExpenses += item.amount);
    
    const netResult = totalIncome - totalExpenses;
    
    // Return budget data
    return {
        farmType: farmType,
        budgetPeriod: budgetPeriod,
        incomeItems: incomeItems,
        expenseItems: expenseItems,
        totalIncome: totalIncome,
        totalExpenses: totalExpenses,
        netResult: netResult
    };
}

// Collect answers
function collectAnswers() {
    const answers = {};
    
    // Get all question textareas
    document.querySelectorAll('.question textarea').forEach(textarea => {
        if (textarea && textarea.id) {
            answers[textarea.id] = textarea.value.trim();
        }
    });
    
    return answers;
}

// Validate assessment
function validateAssessment() {
    // Validate budget
    const incomeItems = document.querySelectorAll('#income-table tbody tr');
    const expenseItems = document.querySelectorAll('#expense-table tbody tr');
    
    let hasValidIncome = false;
    incomeItems.forEach(row => {
        const nameInput = row.querySelector('input[type="text"]');
        const quantityInput = row.querySelector('.quantity-input');
        const priceInput = row.querySelector('.price-input');
        
        if (nameInput && quantityInput && priceInput && 
            nameInput.value.trim() && 
            parseFloat(quantityInput.value) > 0 && 
            parseFloat(priceInput.value) > 0) {
            hasValidIncome = true;
        }
    });
    
    if (!hasValidIncome) {
        return {
            valid: false,
            message: 'Please add at least one income item with a name, quantity, and price greater than zero.'
        };
    }
    
    let hasValidExpense = false;
    expenseItems.forEach(row => {
        const nameInput = row.querySelector('input[type="text"]');
        const quantityInput = row.querySelector('.quantity-input');
        const priceInput = row.querySelector('.price-input');
        
        if (nameInput && quantityInput && priceInput && 
            nameInput.value.trim() && 
            parseFloat(quantityInput.value) > 0 && 
            parseFloat(priceInput.value) > 0) {
            hasValidExpense = true;
        }
    });
    
    if (!hasValidExpense) {
        return {
            valid: false,
            message: 'Please add at least one expense item with a name, quantity, and price greater than zero.'
        };
    }
    
    // Validate answers
    const questions = document.querySelectorAll('.question textarea');
    for (let i = 0; i < questions.length; i++) {
        const textarea = questions[i];
        if (textarea && !textarea.value.trim()) {
            return {
                valid: false,
                message: `Please answer all questions. Question ${i + 1} is empty.`
            };
        }
    }
    
    return {
        valid: true
    };
}