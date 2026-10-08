import { auth } from '../firebase.js';
import { loginUser, registerUser, initAuth, getUser } from '../auth.js';
import { showToast } from '../components.js';

let isLogin = true;

async function init() {
  await initAuth();

  const user = getUser();
  if (user) {
    const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || 'dashboard.html';
    window.location.href = returnUrl;
    return;
  }

  const form = document.getElementById('auth-form');
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit');
  const toggleLink = document.getElementById('auth-toggle-link');
  const toggleText = document.getElementById('auth-toggle-text');
  const subtitle = document.getElementById('auth-subtitle');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');

  function toggleMode() {
    isLogin = !isLogin;
    submitBtn.textContent = isLogin ? 'Sign In' : 'Create Account';
    subtitle.textContent = isLogin ? 'Sign in to manage your appointments' : 'Create an account to get started';
    toggleText.textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
    toggleLink.textContent = isLogin ? 'Create one' : 'Sign in';
    errorEl.style.display = 'none';
  }

  toggleLink.addEventListener('click', toggleMode);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait...';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      errorEl.textContent = 'Please fill in all fields';
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? 'Sign In' : 'Create Account';
      return;
    }

    try {
      if (isLogin) {
        await loginUser(email, password);
        showToast({ message: 'Welcome back!', type: 'success' });
      } else {
        await registerUser(email, password, { name: email.split('@')[0] });
        showToast({ message: 'Account created!', type: 'success' });
      }

      const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || 'dashboard.html';
      window.location.href = returnUrl;
    } catch (err) {
      errorEl.textContent = err.message || 'Authentication failed';
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? 'Sign In' : 'Create Account';
    }
  });
}

init();
