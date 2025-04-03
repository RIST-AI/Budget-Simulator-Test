// js/budget.js
import { auth, onAuthStateChanged, signOut, db, doc, getDoc, collection, addDoc, updateDoc, query, where, getDocs } from './firebase-config.js';
import { requireAuth, updateNavigation } from './auth.js';

// Global variables
let currentUser = null;

// Initialize budget functionality
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.textContent = 'Loading...';
            loadingIndicator.className = ''; // Remove any spinner classes
        }
        // Initialize navigation first
        await updateNavigation();
        
        // Ensure user is authenticated
        currentUser = await requireAuth();
        
        // If user is null, the function will redirect and we should stop execution
        if (!currentUser) {
            return;
        }
        
        // Update user status
        const userStatusElement = document.getElementById('user-status');
        if (userStatusElement) {
            userStatusElement.innerHTML = 'Logged in as: ' + currentUser.email;
        }
        
        // Set up event listeners after we know the user is authenticated and navigation is loaded
        setupEventListeners();
        
        // Initial calculation
        updateTotals();
        
        // Hide loading indicator
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Show budget content
        const budgetContent = document.getElementById('budget-content');
        if (budgetContent) {
            budgetContent.style.display = 'block';
        }
    } catch (error) {
        console.error("Error initializing budget:", error);
    }
});

// Set up event listeners
function setupEventListeners() {
    // Logout functionality - UPDATED SELECTOR to match navigation.js
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('logout-link')) {
            e.preventDefault();
            signOut(auth).then(() => {
                window.location.href = 'index.html';
            }).catch((error) => {
                console.error("Error signing out:", error);
            });
        }
    });
    
    // Add income row
    const addIncomeButton = document.getElementById('add-income');
    if (addIncomeButton) {
        addIncomeButton.addEventListener('click', function() {
            const tbody = document.querySelector('#income-table tbody');
            if (!tbody) return;
            
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td><input type="text" placeholder="Income item"></td>
                <td><input type="number" class="quantity-input" placeholder="0" min="0"></td>
                <td><input type="number" class="price-input" placeholder="0.00" min="0" step="0.01"></td>
                <td class="row-total">$0.00</td>
                <td><button class="btn-small btn-remove">Remove</button></td>
            `;
            
            tbody.appendChild(newRow);
            
            // Add event listener to the new remove button
            const removeButton = newRow.querySelector('.btn-remove');
            if (removeButton) {
                removeButton.addEventListener('click', function() {
                    tbody.removeChild(newRow);
                    updateTotals();
                });
            }
            
            // Add event listeners to update row total when quantity or price changes
            const quantityInput = newRow.querySelector('.quantity-input');
            const priceInput = newRow.querySelector('.price-input');
            
            if (quantityInput && priceInput) {
                const updateRowTotal = function() {
                    const quantity = parseFloat(quantityInput.value) || 0;
                    const price = parseFloat(priceInput.value) || 0;
                    const total = quantity * price;
                    
                    const rowTotalElement = newRow.querySelector('.row-total');
                    if (rowTotalElement) {
                        rowTotalElement.textContent = '$' + total.toFixed(2);
                    }
                    
                    updateTotals();
                };
                
                quantityInput.addEventListener('input', updateRowTotal);
                priceInput.addEventListener('input', updateRowTotal);
            }
            
            // Focus on the new input
            const textInput = newRow.querySelector('input[type="text"]');
            if (textInput) {
                textInput.focus();
            }
        });
    }
    
    // Add expense row
    const addExpenseButton = document.getElementById('add-expense');
    if (addExpenseButton) {
        addExpenseButton.addEventListener('click', function() {
            const tbody = document.querySelector('#expense-table tbody');
            if (!tbody) return;
            
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td><input type="text" placeholder="Expense item"></td>
                <td><input type="number" class="quantity-input" placeholder="0" min="0"></td>
                <td><input type="number" class="price-input" placeholder="0.00" min="0" step="0.01"></td>
                <td class="row-total">$0.00</td>
                <td><button class="btn-small btn-remove">Remove</button></td>
            `;
            
            tbody.appendChild(newRow);
            
            // Add event listener to the new remove button
            const removeButton = newRow.querySelector('.btn-remove');
            if (removeButton) {
                removeButton.addEventListener('click', function() {
                    tbody.removeChild(newRow);
                    updateTotals();
                });
            }
            
            // Add event listeners to update row total when quantity or price changes
            const quantityInput = newRow.querySelector('.quantity-input');
            const priceInput = newRow.querySelector('.price-input');
            
            if (quantityInput && priceInput) {
                const updateRowTotal = function() {
                    const quantity = parseFloat(quantityInput.value) || 0;
                    const price = parseFloat(priceInput.value) || 0;
                    const total = quantity * price;
                    
                    const rowTotalElement = newRow.querySelector('.row-total');
                    if (rowTotalElement) {
                        rowTotalElement.textContent = '$' + total.toFixed(2);
                    }
                    
                    updateTotals();
                };
                
                quantityInput.addEventListener('input', updateRowTotal);
                priceInput.addEventListener('input', updateRowTotal);
            }
            
            // Focus on the new input
            const textInput = newRow.querySelector('input[type="text"]');
            if (textInput) {
                textInput.focus();
            }
        });
    }
    
    // Add event listeners to existing remove buttons
    document.querySelectorAll('.btn-remove').forEach(button => {
        if (button) {
            button.addEventListener('click', function() {
                const row = button.closest('tr');
                if (row && row.parentNode) {
                    row.parentNode.removeChild(row);
                    updateTotals();
                }
            });
        }
    });
    
    // Add event listeners to existing quantity and price inputs
    document.querySelectorAll('tr').forEach(row => {
        const quantityInput = row.querySelector('.quantity-input');
        const priceInput = row.querySelector('.price-input');
        
        if (quantityInput && priceInput) {
            const updateRowTotal = function() {
                const quantity = parseFloat(quantityInput.value) || 0;
                const price = parseFloat(priceInput.value) || 0;
                const total = quantity * price;
                
                const rowTotalElement = row.querySelector('.row-total');
                if (rowTotalElement) {
                    rowTotalElement.textContent = '$' + total.toFixed(2);
                }
                
                updateTotals();
            };
            
            quantityInput.addEventListener('input', updateRowTotal);
            priceInput.addEventListener('input', updateRowTotal);
            
            // Calculate initial row totals
            updateRowTotal();
        }
    });
    
    // Reset button
    const resetButton = document.getElementById('reset-budget');
    if (resetButton) {
        resetButton.addEventListener('click', function() {
            if (confirm('Are you sure you want to reset the budget? All data will be lost.')) {
                resetBudget();
            }
        });
    }
}

// Function to update totals
function updateTotals() {
    // Calculate income total by summing row totals
    let incomeTotal = 0;
    document.querySelectorAll('#income-table tbody tr').forEach(row => {
        const rowTotalElement = row.querySelector('.row-total');
        if (rowTotalElement) {
            // Remove $ sign and convert to number
            const rowTotal = parseFloat(rowTotalElement.textContent.replace('$', '')) || 0;
            incomeTotal += rowTotal;
        }
    });
    
    // Calculate expense total by summing row totals
    let expenseTotal = 0;
    document.querySelectorAll('#expense-table tbody tr').forEach(row => {
        const rowTotalElement = row.querySelector('.row-total');
        if (rowTotalElement) {
            // Remove $ sign and convert to number
            const rowTotal = parseFloat(rowTotalElement.textContent.replace('$', '')) || 0;
            expenseTotal += rowTotal;
        }
    });
    
    // Calculate net result
    const netResult = incomeTotal - expenseTotal;
    
    // Update display
    const totalIncomeElement = document.getElementById('total-income');
    if (totalIncomeElement) {
        totalIncomeElement.textContent = '$' + incomeTotal.toFixed(2);
    }
    
    const totalExpensesElement = document.getElementById('total-expenses');
    if (totalExpensesElement) {
        totalExpensesElement.textContent = '$' + expenseTotal.toFixed(2);
    }
    
    const summaryIncomeElement = document.getElementById('summary-income');
    if (summaryIncomeElement) {
        summaryIncomeElement.textContent = '$' + incomeTotal.toFixed(2);
    }
    
    const summaryExpensesElement = document.getElementById('summary-expenses');
    if (summaryExpensesElement) {
        summaryExpensesElement.textContent = '$' + expenseTotal.toFixed(2);
    }
    
    const netResultElement = document.getElementById('net-result');
    if (netResultElement) {
        netResultElement.textContent = '$' + netResult.toFixed(2);
        
        // Add class based on net result
        if (netResult > 0) {
            netResultElement.className = 'positive';
        } else if (netResult < 0) {
            netResultElement.className = 'negative';
        } else {
            netResultElement.className = '';
        }
    }
}

// Function to calculate row total
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

// Function to reset budget
function resetBudget() {
    const budgetNameElement = document.getElementById('budget-name');
    if (budgetNameElement) {
        budgetNameElement.value = '';
    }
    
    const budgetPeriodElement = document.getElementById('budget-period');
    if (budgetPeriodElement) {
        budgetPeriodElement.value = 'annual';
    }
    
    const farmTypeElement = document.getElementById('farm-type');
    if (farmTypeElement) {
        farmTypeElement.value = 'dairy';
    }
    
    // Reset income table
    const incomeBody = document.querySelector('#income-table tbody');
    if (incomeBody) {
        incomeBody.innerHTML = `
            <tr>
                <td><input type="text" placeholder="Income item"></td>
                <td><input type="number" class="quantity-input" placeholder="0" min="0"></td>
                <td><input type="number" class="price-input" placeholder="0.00" min="0" step="0.01"></td>
                <td class="row-total">$0.00</td>
                <td><button class="btn-small btn-remove">Remove</button></td>
            </tr>
        `;
    }
    
    // Reset expense table
    const expenseBody = document.querySelector('#expense-table tbody');
    if (expenseBody) {
        expenseBody.innerHTML = `
            <tr>
                <td><input type="text" placeholder="Expense item"></td>
                <td><input type="number" class="quantity-input" placeholder="0" min="0"></td>
                <td><input type="number" class="price-input" placeholder="0.00" min="0" step="0.01"></td>
                <td class="row-total">$0.00</td>
                <td><button class="btn-small btn-remove">Remove</button></td>
            </tr>
        `;
    }
    
    // Re-add event listeners
    document.querySelectorAll('.btn-remove').forEach(button => {
        if (button) {
            button.addEventListener('click', function() {
                const row = button.closest('tr');
                if (row && row.parentNode) {
                    row.parentNode.removeChild(row);
                    updateTotals();
                }
            });
        }
    });
    
    // Add event listeners to quantity and price inputs
    document.querySelectorAll('tr').forEach(row => {
        const quantityInput = row.querySelector('.quantity-input');
        const priceInput = row.querySelector('.price-input');
        
        if (quantityInput && priceInput) {
            const updateRowTotal = function() {
                calculateRowTotal(row);
                updateTotals();
            };
            
            quantityInput.addEventListener('input', updateRowTotal);
            priceInput.addEventListener('input', updateRowTotal);
        }
    });
    
    updateTotals();
    
    // Show status message
    showStatusMessage('Budget has been reset.', 'info');
}

// Function to show status message
function showStatusMessage(message, type = 'success') {
    // Check if status message element exists, if not create it
    let statusMessage = document.getElementById('status-message');
    if (!statusMessage) {
        statusMessage = document.createElement('div');
        statusMessage.id = 'status-message';
        
        // Insert at the top of the main content
        const mainContent = document.querySelector('main');
        if (mainContent && mainContent.firstChild) {
            mainContent.insertBefore(statusMessage, mainContent.firstChild);
        }
    }
    
    // Set message and type
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