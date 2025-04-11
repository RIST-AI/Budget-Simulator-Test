// js/student-dashboard.js
import { auth, db, collection, query, where, getDocs, orderBy, doc, getDoc, activeAssessmentRef } from './firebase-config.js';
import { requireStudent, updateNavigation } from './auth.js';

// Global variables
let currentUser = null;

// Initialize the dashboard page
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Initialize navigation
        await updateNavigation();
        
        // Get current user and ensure they're a student
        currentUser = await requireStudent();
        
        // If not a student, the function will redirect and return null
        if (!currentUser) {
            return;
        }
        
        // Load assessments
        await loadActiveAssessment();
        await loadPreviousAssessments();
        
        // Hide loading indicator
        document.getElementById('loading-indicator').style.display = 'none';
        
        // Show dashboard content
        document.getElementById('dashboard-container').style.display = 'block';
    } catch (error) {
        console.error("Error initializing dashboard:", error);
        document.getElementById('loading-indicator').innerHTML = 
            `<div class="error-message">Error loading dashboard: ${error.message}</div>`;
    }
});

// Load the currently active assessment
async function loadActiveAssessment() {
    const container = document.getElementById('current-assessment-container');
    if (!container) return;
    
    try {
        // Get active assessment ID
        const activeDoc = await getDoc(activeAssessmentRef);
        if (!activeDoc.exists()) {
            container.innerHTML = '<div class="info-message">No active assessment available at this time.</div>';
            return;
        }
        
        const activeAssessmentId = activeDoc.data().assessmentId;
        console.log("Active assessment ID:", activeAssessmentId);
        console.log("Current user ID:", currentUser.uid);
        // Get assessment details
        const assessmentDoc = await getDoc(doc(db, 'assessments', activeAssessmentId));
        if (!assessmentDoc.exists()) {
            container.innerHTML = '<div class="info-message">Error loading active assessment.</div>';
            return;
        }
        
        const assessment = assessmentDoc.data();
        
        // Check if the student has already submitted this assessment
        const compoundKey = `${currentUser?.uid || ''}_${activeAssessmentId || ''}`;
        const submissionRef = doc(db, 'submissions', compoundKey);
        // const submissionRef = doc(db, 'submissions', `${currentUser.uid}_${activeAssessmentId}`);
        const submissionDoc = await getDoc(submissionRef);
        
        let status = 'Not started';
        let statusClass = '';
        let actionText = 'Start Assessment';
        let hasGrade = false;
        let grade = '';
        
        if (submissionDoc.exists()) {
            const submission = submissionDoc.data();
            
                // Skip this submission if it's been deleted
            if (submission.status === 'deleted') {
                container.innerHTML = '<div class="info-message">No active assessment available at this time.</div>';
                return;
            }
            if (submission.status === 'submitted') {
                status = 'Submitted';
                statusClass = 'submitted';
                actionText = 'View Submission';
            } else if (submission.status === 'feedback_provided') {
                status = 'Feedback Provided';
                statusClass = 'feedback';
                actionText = 'Review & Update';
            } else if (submission.status === 'finalised') {
                status = 'Finalised';
                statusClass = 'finalised';
                actionText = 'View Results';
                hasGrade = true;
                grade = submission.grade || 'Not specified';
            }
        }
        
        // Build HTML
        let html = `
            <div class="assessment-card active-assessment">
                <div class="assessment-card-header">
                    <div class="assessment-type">${assessment.title || 'Farm Budget Assessment'}</div>
                    <div class="assessment-status ${statusClass}">${status}</div>
                </div>
                <p>${assessment.description || 'No description available'}</p>
                ${hasGrade ? 
                  `<div class="grade-badge ${grade === 'Satisfactory' ? 'grade-pass' : 'grade-fail'}">${grade}</div>` : 
                  ''}
                <div class="assessment-actions">
                    <a href="assessment.html" class="btn">${actionText}</a>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    } catch (error) {
        console.error("Error loading active assessment:", error);
        container.innerHTML = `<div class="error-message">Error loading active assessment: ${error.message}</div>`;
    }
}

// Load previous assessments
async function loadPreviousAssessments() {
    const container = document.getElementById('previous-assessments-container');
    if (!container) return;
    
    try {
        // Get active assessment ID to exclude from previous list
        let activeAssessmentId = null;
        try {
            const activeDoc = await getDoc(activeAssessmentRef);
            if (activeDoc.exists()) {
                activeAssessmentId = activeDoc.data().assessmentId;
            }
        } catch (error) {
            console.error("Error getting active assessment:", error);
        }
        
        // Query student's submissions
        const submissionsRef = collection(db, 'submissions');
        const q = query(
            submissionsRef,
            where("userId", "==", currentUser.uid),
            where("status", "in", ["submitted", "feedback_provided", "finalised", "saved"]), // Include all valid statuses
            orderBy("submittedAt", "desc")
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="info-message">No previous assessments found.</div>';
            return;
        }
        
        let html = '';
        let hasAssessments = false;
        
        // Process each submission
        for (const submissionDoc of snapshot.docs) {
            const submission = submissionDoc.data();
            const submissionId = submissionDoc.id;
            
            // Skip active assessment (it's shown in the current section)
            if (submission.assessmentId === activeAssessmentId) {
                continue;
            }
            
            // Get assessment details
            let assessmentTitle = 'Assessment';
            try {
                if (submission.assessmentId) {
                    const assessmentDoc = await getDoc(doc(db, 'assessments', submission.assessmentId));
                    if (assessmentDoc.exists()) {
                        assessmentTitle = assessmentDoc.data().title || 'Assessment';
                    }
                }
            } catch (error) {
                console.error("Error fetching assessment details:", error);
            }
            
            const submissionDate = submission.submittedAt ? 
                new Date(submission.submittedAt.seconds * 1000).toLocaleDateString() : 
                'Date unknown';
            
            let status = 'Submitted';
            let statusClass = 'submitted';
            let actionText = 'View Submission';
            let hasGrade = false;
            let grade = '';
            
            if (submission.status === 'feedback_provided') {
                status = 'Feedback Provided';
                statusClass = 'feedback';
                actionText = 'Review Feedback';
            } else if (submission.status === 'finalised') {
                status = 'Finalised';
                statusClass = 'finalised';
                actionText = 'View Results';
                hasGrade = true;
                grade = submission.grade || 'Not specified';
            }
            
            // Build HTML for this assessment
            html += `
                <div class="assessment-card">
                    <div class="assessment-card-header">
                        <div class="assessment-type">${assessmentTitle}</div>
                        <div class="assessment-status ${statusClass}">${status}</div>
                    </div>
                    <p>Submitted: ${submissionDate}</p>
                    ${hasGrade ? 
                      `<div class="grade-badge ${grade === 'Satisfactory' ? 'grade-pass' : 'grade-fail'}">${grade}</div>` : 
                      ''}
                    <div class="assessment-actions">
                    <a href="view-assessment.html?id=${submissionId}${submission.publicAccessToken ? `&token=${submission.publicAccessToken}` : ''}" class="btn">${actionText}</a>                    </div>
                </div>
            `;
            
            hasAssessments = true;
        }
        
        if (hasAssessments) {
            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="info-message">No previous assessments found.</div>';
        }
    } catch (error) {
        console.error("Error loading previous assessments:", error);
        container.innerHTML = `<div class="error-message">Error loading previous assessments: ${error.message}</div>`;
    }
}