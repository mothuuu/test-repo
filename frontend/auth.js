const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : 'https://ai-visibility-tool.onrender.com/api';

// Tab switching
function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelector('.auth-tab:first-child').classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.querySelector('.auth-tab:last-child').classList.add('active');
        document.getElementById('signupForm').classList.add('active');
    }
    
    hideMessages();
}

// Message display
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    document.getElementById('successMessage').style.display = 'none';
}

function showSuccess(message) {
    const successEl = document.getElementById('successMessage');
    successEl.textContent = message;
    successEl.style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';
}

function hideMessages() {
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
}

// Check for success message from password reset
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === 'success') {
        showSuccess('✅ Password reset successfully! You can now sign in with your new password.');
    }
});

// Login handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Important for cookies
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }
        
        // Store access token (short-lived, in memory is better but localStorage works for demo)
        localStorage.setItem('authToken', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        showSuccess('Login successful! Redirecting...');
        
        // Check if user needs to verify email
        if (!data.user.email_verified) {
            setTimeout(() => {
                window.location.href = 'verify.html';
            }, 1000);
            return;
        }
        
        // Check for redirect URL or scan URL
        const urlParams = new URLSearchParams(window.location.search);
        const scanUrl = urlParams.get('scanUrl');
        
        setTimeout(() => {
            if (scanUrl) {
                window.location.href = `dashboard.html?scanUrl=${encodeURIComponent(scanUrl)}`;
            } else {
                window.location.href = 'dashboard.html';
            }
        }, 1000);
        
    } catch (error) {
        showError(error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
    }
});

// Signup handler
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();
    
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    if (password !== passwordConfirm) {
        showError('Passwords do not match');
        return;
    }
    
    if (password.length < 8) {
        showError('Password must be at least 8 characters');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Important for cookies
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Signup failed');
        }
        
        // Store access token and user data
        localStorage.setItem('authToken', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        showSuccess('Account created! Please check your email to verify your account.');
        
        // Redirect to verification page after 2 seconds
        setTimeout(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const scanUrl = urlParams.get('scanUrl');
            
            if (scanUrl) {
                window.location.href = `verify.html?scanUrl=${encodeURIComponent(scanUrl)}`;
            } else {
                window.location.href = 'verify.html';
            }
        }, 2000);
        
    } catch (error) {
        showError(error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Free Account';
    }
});

// Check if already logged in on page load
window.addEventListener('DOMContentLoaded', async () => {
    const authToken = localStorage.getItem('authToken');
    
    if (authToken) {
        // Verify token is still valid
        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Check if verified
                if (!data.user.email_verified) {
                    window.location.href = 'verify.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }
        } catch (error) {
            // Token invalid, stay on auth page
            console.log('Token invalid, user needs to login');
        }
    }
});
