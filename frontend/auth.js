// API Configuration - Dynamic based on environment
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : 'https://ai-visibility-tool.onrender.com/api';

// Industry categories for signup dropdown
const INDUSTRY_CATEGORIES = [
  { category: 'Marketing & Advertising', industries: ['Marketing Agency', 'MarTech / Marketing Technology', 'Media & Advertising', 'Public Relations', 'Content Marketing'] },
  { category: 'Sales & Customer', industries: ['Sales Technology / CRM', 'Customer Support', 'Customer Success Platform'] },
  { category: 'Finance & Banking', industries: ['Finance', 'FinTech / Financial Technology', 'Banking', 'Insurance', 'InsurTech / Insurance Technology', 'Accounting', 'Accounting Software', 'Wealth Management'] },
  { category: 'Technology & Software', industries: ['SaaS / Cloud Software', 'AI / Machine Learning', 'Cybersecurity', 'Developer Tools / DevOps', 'Data & Analytics', 'IT Services', 'Computer Hardware & Software'] },
  { category: 'Infrastructure & Cloud', industries: ['Data Infrastructure', 'Digital Infrastructure', 'Cloud Infrastructure', 'Network Infrastructure'] },
  { category: 'Telecommunications', industries: ['Telecommunications', 'Telecom Software', 'Unified Communications', 'VoIP / Cloud Communications'] },
  { category: 'Hardware & Equipment', industries: ['ICT Hardware', 'Computer Hardware', 'Networking Equipment', 'Enterprise Hardware'] },
  { category: 'Healthcare', industries: ['Healthcare / Medical Services', 'HealthTech / Healthcare Technology', 'Telemedicine', 'Medical Devices'] },
  { category: 'Ecommerce & Retail', industries: ['Ecommerce', 'Retail', 'Marketplace Platform'] },
  { category: 'Real Estate & Construction', industries: ['Real Estate', 'PropTech / Property Technology', 'Construction', 'Construction Technology'] },
  { category: 'Education', industries: ['Education / Training', 'EdTech / Education Technology', 'Corporate Training'] },
  { category: 'Professional Services', industries: ['Legal / Law Firm', 'LegalTech / Legal Technology', 'Consulting', 'Accounting Services', 'HR / Recruiting', 'HR Technology / HCM'] },
  { category: 'Operations & Logistics', industries: ['Manufacturing', 'Logistics / Supply Chain', 'Transportation', 'Warehouse Management'] },
  { category: 'Utilities & Energy', industries: ['Utilities', 'Energy', 'Water & Wastewater', 'Power & Electric'] },
  { category: 'Nonprofit & Government', industries: ['Nonprofit Organization', 'Government / Public Sector'] }
];

// UI Elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');

// Switch between login and signup tabs
function switchTab(tab) {
  const loginTab = document.querySelectorAll('.auth-tab')[0];
  const signupTab = document.querySelectorAll('.auth-tab')[1];
  
  if (tab === 'login') {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    loginForm.classList.add('active');
    signupForm.classList.remove('active');
  } else {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    signupForm.classList.add('active');
    loginForm.classList.remove('active');
  }
  
  // Clear messages when switching tabs
  hideMessages();
}

// Show error message
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  successMessage.style.display = 'none';
  
  // Scroll to top to show message
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show success message
function showSuccess(message) {
  successMessage.textContent = message;
  successMessage.style.display = 'block';
  errorMessage.style.display = 'none';
  
  // Scroll to top to show message
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Hide all messages
function hideMessages() {
  errorMessage.style.display = 'none';
  successMessage.style.display = 'none';
}

// Handle Login Form Submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessages();
  
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  // Client-side validation
  if (!email || !password) {
    showError('Please enter both email and password');
    return;
  }
  
  // Disable submit button
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';
  
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }
    
    if (data.success && data.accessToken) {
      // Store token in localStorage
      localStorage.setItem('authToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Show success message
      showSuccess('Login successful! Redirecting...');
      
      // Redirect to dashboard after 1 second
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
    } else {
      throw new Error('Invalid response from server');
    }
    
  } catch (error) {
    showError(error.message || 'Login failed. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  }
});

// Handle Signup Form Submission
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessages();
  
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('signupPasswordConfirm').value;
  const industry = document.getElementById('signupIndustry').value;
  const industryCustom = document.getElementById('signupIndustryCustom').value.trim();

  // Client-side validation
  if (!email || !password || !confirmPassword) {
    showError('Please fill in all fields');
    return;
  }

  if (password.length < 8) {
    showError('Password must be at least 8 characters');
    return;
  }

  if (password !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError('Please enter a valid email address');
    return;
  }

  // Validate custom industry if "Other" is selected
  if (industry === 'Other' && !industryCustom) {
    showError('Please specify your industry');
    return;
  }

  // Disable submit button
  const submitBtn = signupForm.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';

  // Prepare signup data
  const signupData = {
    email,
    password,
    name: email.split('@')[0] // Use email prefix as name
  };

  // Add industry if provided
  if (industry) {
    signupData.industry = industry === 'Other' ? industryCustom : industry;
    if (industry === 'Other') {
      signupData.industryCustom = industryCustom;
    }
  }

  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(signupData)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
    }
    
    if (data.success && data.accessToken) {
      // Store token in localStorage
      localStorage.setItem('authToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Show success message
      showSuccess('Account created! Please check your email to verify your account. Redirecting...');
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 2000);
    } else {
      throw new Error('Invalid response from server');
    }
    
  } catch (error) {
    showError(error.message || 'Signup failed. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  }
});

// Populate industry dropdown
function populateIndustryDropdown() {
  const select = document.getElementById('signupIndustry');
  if (!select) return;

  // Add optgroups for each category
  INDUSTRY_CATEGORIES.forEach(category => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category.category;

    category.industries.forEach(industry => {
      const option = document.createElement('option');
      option.value = industry;
      option.textContent = industry;
      optgroup.appendChild(option);
    });

    select.appendChild(optgroup);
  });

  // Add "Other" option at the end
  const otherOption = document.createElement('option');
  otherOption.value = 'Other';
  otherOption.textContent = 'Other (please specify)';
  select.appendChild(otherOption);
}

// Handle industry dropdown change (show/hide custom field)
function handleIndustryChange() {
  const select = document.getElementById('signupIndustry');
  const customGroup = document.getElementById('customIndustryGroup');

  if (!select || !customGroup) return;

  select.addEventListener('change', () => {
    if (select.value === 'Other') {
      customGroup.style.display = 'block';
      document.getElementById('signupIndustryCustom').setAttribute('required', 'required');
    } else {
      customGroup.style.display = 'none';
      document.getElementById('signupIndustryCustom').removeAttribute('required');
      document.getElementById('signupIndustryCustom').value = '';
    }
  });
}

// Check if user is already logged in
window.addEventListener('DOMContentLoaded', () => {
  // Populate industry dropdown
  populateIndustryDropdown();
  handleIndustryChange();

  const token = localStorage.getItem('authToken');
  if (token) {
    // Verify token is still valid
    fetch(`${API_URL}/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.authenticated) {
        // User is already logged in, redirect to dashboard
        window.location.href = 'dashboard.html';
      }
    })
    .catch(() => {
      // Token is invalid, clear it
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    });
  }
});