// js/auth.js

import { auth, onAuthStateChanged, signOut, db, doc, getDoc } from './firebase-config.js';

// Check if user is logged in and get their role
async function getCurrentUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // Stop listening immediately
      
      if (user) {
        try {
          // Get user role from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            resolve({
              uid: user.uid,
              email: user.email,
              role: userData.role,
              roles: userData.roles || [userData.role], // Support both role and roles fields
              fullName: userData.fullName || '',
              studentId: userData.studentId || '',
              // Add any other user properties you need
            });
          } else {
            resolve({ uid: user.uid, email: user.email, role: 'unknown', roles: ['unknown'] });
          }
        } catch (error) {
          console.error("Error getting user data:", error);
          resolve({ uid: user.uid, email: user.email, role: 'unknown', roles: ['unknown'] });
        }
      } else {
        resolve(null); // Not logged in
      }
    });
  });
}

// Helper function to get user roles
function getUserRoles(user) {
  if (!user) return [];
  return Array.isArray(user.roles) ? user.roles : [user.role];
}

// Redirect to login if not authenticated
async function requireAuth() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    // Save the current URL to redirect back after login
    sessionStorage.setItem('redirectUrl', window.location.href);
    window.location.href = 'login.html';
    return null;
  }
  return currentUser;
}

// Check if user has specific role and redirect if not
async function requireRole(requiredRoles) {
  const currentUser = await requireAuth();
  if (!currentUser) return null; // Already redirected to login
  
  if (!Array.isArray(requiredRoles)) {
    requiredRoles = [requiredRoles]; // Convert to array if single role
  }
  
  // Check if user has any of the required roles
  const userRoles = getUserRoles(currentUser);
  const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
  
  if (!hasRequiredRole) {
    // User doesn't have required role, redirect to appropriate dashboard
    if (userRoles.includes('student')) {
      alert(`You need ${requiredRoles.join(' or ')} permissions to access this page.`);
      window.location.href = 'student-dashboard.html';
    } else if (userRoles.includes('trainer')) {
      alert(`You need ${requiredRoles.join(' or ')} permissions to access this page.`);
      window.location.href = 'trainer-dashboard.html';
    } else {
      alert(`You need ${requiredRoles.join(' or ')} permissions to access this page.`);
      window.location.href = 'index.html';
    }
    return null;
  }
  
  return currentUser;
}

// Check if user is a student (for assessment page)
async function requireStudent() {
  const currentUser = await requireAuth();
  if (!currentUser) return null; // Already redirected to login
  
  // Check if user is a trainer
  const userRoles = getUserRoles(currentUser);
  const isTrainer = userRoles.includes('trainer');
  
  if (isTrainer) {
    alert('Trainers cannot submit assessments. Please use a student account.');
    window.location.href = 'trainer-review.html';
    return null;
  }
  
  return currentUser;
}

// Handle logout
function logoutUser() {
  return signOut(auth).then(() => {
    window.location.href = 'login.html';
  });
}

// Update UI based on authentication state
async function updateNavigation() {
  const currentUser = await getCurrentUser();
  
  // Update user status display
  const userStatusElement = document.getElementById('user-status');
  if (userStatusElement) {
    if (currentUser) {
      userStatusElement.innerHTML = `
        <p>Logged in as: <strong>${currentUser.email}</strong></p>
        <p class="user-role">${currentUser.role || 'Student'}</p>
      `;
    } else {
      userStatusElement.innerHTML = `
        <p>Not logged in</p>
        <a href="login.html" class="btn-small">Login</a>
      `;
    }
  }
  
  // Show/hide trainer-only navigation items
  const trainerOnlyItems = document.querySelectorAll('.trainer-only');
  
  if (currentUser) {
    // Get user roles as array
    const userRoles = getUserRoles(currentUser);
    const isTrainer = userRoles.includes('trainer');
    
    // Show/hide trainer-only items
    trainerOnlyItems.forEach(item => {
      item.style.display = isTrainer ? 'block' : 'none';
    });
  } else {
    // User is not logged in, hide role-specific items
    trainerOnlyItems.forEach(item => {
      item.style.display = 'none';
    });
  }
  
  // Show/hide logout link
  const logoutNavItem = document.getElementById('logout-nav-item');
  if (logoutNavItem) {
    if (currentUser) {
      logoutNavItem.style.display = 'block';
    } else {
      logoutNavItem.style.display = 'none';
    }
  }
}

// Initialize authentication on page load
function initAuth() {
  document.addEventListener('DOMContentLoaded', async () => {
    await updateNavigation();
    
    // Set up logout functionality
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        logoutUser();
      });
    }
    
    // Check if we're on the assessment page and prevent trainers from accessing it
    if (window.location.pathname.includes('assessment.html')) {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        const userRoles = getUserRoles(currentUser);
        if (userRoles.includes('trainer')) {
          alert('Trainers cannot submit assessments. Please use a student account.');
          window.location.href = 'trainer-review.html';
        }
      }
    }
  });
}

// Auto-redirect to dashboard if already logged in (for login page)
async function redirectIfLoggedIn() {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    // Get user roles as array
    const userRoles = getUserRoles(currentUser);
    
    if (userRoles.includes('student')) {
      window.location.href = 'student-dashboard.html';
    } else if (userRoles.includes('trainer')) {
      window.location.href = 'trainer-dashboard.html';
    } else {
      window.location.href = 'budget.html';
    }
    return true;
  }
  return false;
}

// Export all functions at the end
export { 
  getCurrentUser, 
  requireAuth, 
  requireRole,
  requireStudent,
  logoutUser, 
  updateNavigation,
  initAuth,
  redirectIfLoggedIn
};