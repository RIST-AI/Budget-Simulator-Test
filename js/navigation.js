// js/navigation.js
import { getCurrentUser } from './auth.js';
import { db, doc, getDoc, collection, query, where, getDocs } from './firebase-config.js'; 


// Navigation items configuration
const navItems = {
  left: [
  ],
  student: [
    { id: 'budget-nav-item', text: 'Budget Simulator', href: 'budget.html' },
    { id: 'dashboard-nav-item', text: 'Dashboard', href: 'student-dashboard.html' },
    { id: 'assessment-nav-item', text: 'Assessment', href: 'assessment.html' }
  ],
  trainer: [
    { id: 'review-nav-item', text: 'Review Assessments', href: 'trainer-review.html' },
    { id: 'edit-nav-item', text: 'Edit Assessment', href: 'assessment-editor.html' }
  ],
  right: [
    { id: 'logout-nav-item', text: 'Logout', href: '#', class: 'logout-link' }
  ]
};

// Check for assessment notifications
async function checkAssessmentNotifications() {
  const user = await getCurrentUser();
  if (!user || user.roles?.includes('trainer')) return;
  
  try {
    // Query for submissions with feedback instead of checking assessments
    const submissionsRef = collection(db, 'submissions');
    const q = query(
      submissionsRef,
      where("userId", "==", user.uid),
      where("status", "in", ["feedback_provided", "finalised"])
    );
    const snapshot = await getDocs(q);
    
    // If there are submissions with feedback or finalised status, show notification
    if (!snapshot.empty) {
      const assessmentNavItem = document.getElementById('assessment-nav-item');
      if (assessmentNavItem) {
        const navLink = assessmentNavItem.querySelector('a');
        if (navLink && !navLink.querySelector('.notification-dot')) {
          // Create notification dot
          const notificationDot = document.createElement('span');
          notificationDot.className = 'notification-dot';
          notificationDot.style.display = 'inline-block';
          notificationDot.style.width = '10px';
          notificationDot.style.height = '10px';
          notificationDot.style.backgroundColor = '#e74c3c';
          notificationDot.style.borderRadius = '50%';
          notificationDot.style.marginLeft = '5px';
          
          navLink.appendChild(notificationDot);
        }
      }
    }
  } catch (error) {
    console.error("Error checking for assessment notifications:", error);
  }
}

// Function to generate navigation HTML
export async function generateNavigation() {
  const user = await getCurrentUser();
  const navElement = document.querySelector('nav ul');
  
  if (!navElement) {
    console.error('Navigation element not found');
    return;
  }
  
  // Clear existing navigation
  navElement.innerHTML = '';
  
  // Create left container for main navigation items
  const leftNav = document.createElement('div');
  leftNav.className = 'nav-left';
  
  // Create right container for logout
  const rightNav = document.createElement('div');
  rightNav.className = 'nav-right';
  
  // Add common items to left nav
  navItems.left.forEach(item => {
    addNavItem(leftNav, item);
  });
  
  if (user) {
    // Get user roles
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role];
    const isTrainer = userRoles.includes('trainer');
    
    // Add role-specific items
    if (isTrainer) {
      navItems.trainer.forEach(item => addNavItem(leftNav, item));
    } else {
      navItems.student.forEach(item => addNavItem(leftNav, item));
    }
    
    // Add right-aligned items (logout)
    navItems.right.forEach(item => addNavItem(rightNav, item));
  }
  
  // Append both containers to the nav
  navElement.appendChild(leftNav);
  navElement.appendChild(rightNav);
  
  // Set active nav item based on current page
  setActiveNavItem();
  
  // Add event listener for logout
  const logoutLinks = document.querySelectorAll('.logout-link');
  logoutLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      // Import here to avoid circular dependency
      import('./auth.js').then(auth => {
        auth.logoutUser();
      });
    });
  });
  
  // Check for assessment notifications for students
  if (user && !user.roles.includes('trainer')) {
    await checkAssessmentNotifications();
  }
}

// Helper function to add a nav item
function addNavItem(container, item) {
  const li = document.createElement('li');
  li.id = item.id;
  
  const a = document.createElement('a');
  a.href = item.href;
  a.textContent = item.text;
  
  if (item.class) {
    a.classList.add(item.class);
  }
  
  li.appendChild(a);
  container.appendChild(li);
}

// Set the active nav item based on current page
function setActiveNavItem() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('nav a');
  
  navLinks.forEach(link => {
    const linkPage = link.getAttribute('href');
    if (linkPage === currentPage || 
        (currentPage === 'index.html' && linkPage === 'budget.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', generateNavigation);