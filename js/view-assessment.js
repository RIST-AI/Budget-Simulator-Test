// js/view-assessment.js
import { db, doc, getDoc, collection, query, orderBy, getDocs } from './firebase-config.js';

// Get assessment ID from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const assessmentId = urlParams.get('id');
const accessToken = urlParams.get('token');

// DOM elements
const loadingIndicator = document.getElementById('loading-indicator');
const assessmentView = document.getElementById('assessment-view');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

// Load assessment data when page loads
document.addEventListener('DOMContentLoaded', async () => {
    if (!assessmentId) {
        showError('No assessment ID provided. Please check the URL.');
        return;
    }
    
    try {
        await loadAssessment(assessmentId, accessToken);
    } catch (error) {
        console.error('Error loading assessment:', error);
        showError('Error loading assessment: ' + error.message);
    }
});

// Load assessment data from Firestore
async function loadAssessment(assessmentId, accessToken) {
    try {
        // Get assessment document
        const assessmentRef = doc(db, 'assessments', assessmentId);
        const assessmentDoc = await getDoc(assessmentRef);
        
        if (!assessmentDoc.exists()) {
            throw new Error('Assessment not found');
        }
        
        const assessment = assessmentDoc.data();
        
        // Check if assessment is finalised and has a matching public access token
        if (assessment.status !== 'finalised') {
            throw new Error('This assessment is not available for public viewing');
        }
        
        if (!assessment.publicAccessToken || assessment.publicAccessToken !== accessToken) {
            throw new Error('Invalid access token');
        }
        
        // Populate assessment data
        populateAssessmentData(assessment);
        
        // Load comments
        await loadComments(assessmentId);
        
        // Hide loading indicator and show assessment
        loadingIndicator.style.display = 'none';
        assessmentView.style.display = 'block';
    } catch (error) {
        console.error('Error in loadAssessment:', error);
        throw error;
    }
}

// Populate assessment data in the UI
function populateAssessmentData(assessment) {
    // Student info
    const studentNameElement = document.getElementById('student-name');
    const studentEmailElement = document.getElementById('student-email');
    const submissionDateElement = document.getElementById('submission-date');
    const submissionStatusElement = document.getElementById('submission-status');
    
    if (studentNameElement) studentNameElement.textContent = assessment.studentName || 'Not provided';
    if (studentEmailElement) studentEmailElement.textContent = assessment.userEmail || 'Not provided';
    if (submissionDateElement && assessment.submittedAt) {
        submissionDateElement.textContent = new Date(assessment.submittedAt.seconds * 1000).toLocaleString();
    }
    if (submissionStatusElement) {
        submissionStatusElement.textContent = 'finalised';
    }
    
    // Budget info
    const farmTypeElement = document.getElementById('farm-type');
    const budgetPeriodElement = document.getElementById('budget-period');
    
    if (farmTypeElement) {
        farmTypeElement.textContent = assessment.budget?.farmType || 'Not specified';
    }
    
    if (budgetPeriodElement) {
        budgetPeriodElement.textContent = assessment.budget?.budgetPeriod || 'Not specified';
    }
    
    // Income items
    const incomeItemsBody = document.getElementById('income-items-body');
    if (incomeItemsBody) {
        incomeItemsBody.innerHTML = '';
        
        if (assessment.budget?.incomeItems && assessment.budget.incomeItems.length > 0) {
            assessment.budget.incomeItems.forEach(item => {
                const row = document.createElement('tr');
                
                const nameCell = document.createElement('td');
                nameCell.textContent = item.name || 'Unnamed item';
                row.appendChild(nameCell);
                
                const quantityCell = document.createElement('td');
                quantityCell.textContent = item.quantity || '1';
                row.appendChild(quantityCell);
                
                const priceCell = document.createElement('td');
                const price = parseFloat(item.price || 0);
                priceCell.textContent = `$${price.toFixed(2)}`;
                row.appendChild(priceCell);
                
                const amountCell = document.createElement('td');
                const amount = parseFloat(item.amount || 0);
                amountCell.textContent = `$${amount.toFixed(2)}`;
                row.appendChild(amountCell);
                
                incomeItemsBody.appendChild(row);
            });
        } else {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.textContent = 'No income items found';
            cell.style.textAlign = 'center';
            row.appendChild(cell);
            incomeItemsBody.appendChild(row);
        }
    }
    
    // Expense items
    const expenseItemsBody = document.getElementById('expense-items-body');
    if (expenseItemsBody) {
        expenseItemsBody.innerHTML = '';
        
        if (assessment.budget?.expenseItems && assessment.budget.expenseItems.length > 0) {
            assessment.budget.expenseItems.forEach(item => {
                const row = document.createElement('tr');
                
                const nameCell = document.createElement('td');
                nameCell.textContent = item.name || 'Unnamed item';
                row.appendChild(nameCell);
                
                const quantityCell = document.createElement('td');
                quantityCell.textContent = item.quantity || '1';
                row.appendChild(quantityCell);
                
                const priceCell = document.createElement('td');
                const price = parseFloat(item.price || 0);
                priceCell.textContent = `$${price.toFixed(2)}`;
                row.appendChild(priceCell);
                
                const amountCell = document.createElement('td');
                const amount = parseFloat(item.amount || 0);
                amountCell.textContent = `$${amount.toFixed(2)}`;
                row.appendChild(amountCell);
                
                expenseItemsBody.appendChild(row);
            });
        } else {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.textContent = 'No expense items found';
            cell.style.textAlign = 'center';
            row.appendChild(cell);
            expenseItemsBody.appendChild(row);
        }
    }
    
    // Update totals
    const totalIncome = assessment.budget?.totalIncome || 0;
    const totalExpenses = assessment.budget?.totalExpenses || 0;
    const netResult = assessment.budget?.netResult || 0;
    
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
        netResultElement.className = netResult >= 0 ? 'positive' : 'negative';
    }
    
    // Fill in student answers
    const answersContainer = document.getElementById('answers-container');
    if (answersContainer) {
        answersContainer.innerHTML = '';
        
        if (assessment.answers) {
            const answerKeys = Object.keys(assessment.answers).sort();
            
            if (answerKeys.length > 0) {
                answerKeys.forEach((key, index) => {
                    const answerDiv = document.createElement('div');
                    answerDiv.className = 'student-answer';
                    
                    const questionNumber = key.replace('question', '');
                    
                    answerDiv.innerHTML = `
                        <h4>Question ${questionNumber}</h4>
                        <div class="answer-text">${assessment.answers[key]}</div>
                    `;
                    
                    answersContainer.appendChild(answerDiv);
                });
            } else {
                answersContainer.innerHTML = '<p>No answers provided</p>';
            }
        } else {
            answersContainer.innerHTML = '<p>No answers provided</p>';
        }
    }
    
    // Show grade
    const gradeContainer = document.getElementById('grade-container');
    if (gradeContainer) {
        gradeContainer.innerHTML = `
            <h3>Grade</h3>
            <p><strong>Final Grade:</strong> ${assessment.grade || 'Not graded'}</p>
        `;
    }
}

// Load comments for the assessment
async function loadComments(assessmentId) {
    const commentsContainer = document.getElementById('comments-container');
    if (!commentsContainer) return;
    
    try {
        const commentsRef = collection(db, 'assessments', assessmentId, 'comments');
        const q = query(commentsRef, orderBy('timestamp', 'desc'));
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            commentsContainer.innerHTML = '<p>No comments available.</p>';
            return;
        }
        
        let commentsHTML = '<h3>Trainer Comments</h3>';
        snapshot.forEach(doc => {
            const comment = doc.data();
            
            // Only show finalization comments
            if (comment.isFinalization) {
                const date = comment.timestamp ? 
                    new Date(comment.timestamp.seconds * 1000).toLocaleString() : 
                    'Date unknown';
                
                commentsHTML += `
                    <div class="comment">
                        <div class="comment-header">
                            <strong>${comment.trainerName || 'Trainer'}</strong>
                            <span>${date}</span>
                        </div>
                        <div class="comment-body">
                            ${comment.text}
                        </div>
                    </div>
                `;
            }
        });
        
        commentsContainer.innerHTML = commentsHTML;
    } catch (error) {
        console.error("Error loading comments:", error);
        commentsContainer.innerHTML = '<p>Error loading comments.</p>';
    }
}

// Show error message
function showError(message) {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (assessmentView) assessmentView.style.display = 'none';
    if (errorMessage) errorMessage.style.display = 'block';
    if (errorText) errorText.textContent = message;
}