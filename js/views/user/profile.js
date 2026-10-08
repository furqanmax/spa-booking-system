import { getUser, refreshUser } from '../../auth.js';
import { db } from '../../firebase.js';
import { doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { showToast } from '../../components.js';
import { validateName, validatePhone, validateForm, formatPhone } from '../../validators.js';
import { escapeHtml } from '../../utils.js';
import { updateEmail, updatePassword } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { auth } from '../../firebase.js';

export async function renderProfile(container) {
  const user = getUser();
  if (!user) {
    container.innerHTML = '<div class="empty-state"><h3>Please sign in</h3></div>';
    return;
  }

  container.innerHTML = `
    <h2>My Profile</h2>
    <form id="profile-form" style="max-width:500px;margin-top:var(--space-4)">
      <div class="form-group">
        <label class="form-label">Name</label>
        <input type="text" id="prof-name" class="form-input" value="${escapeHtml(user.name || '')}">
        <div class="form-error" id="prof-name-error"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" id="prof-email" class="form-input" value="${escapeHtml(user.email || '')}" disabled>
        <p style="font-size:0.8125rem;color:var(--c-stone-500);margin-top:var(--space-1)">Email cannot be changed</p>
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input type="tel" id="prof-phone" class="form-input" value="${escapeHtml(user.phone || '')}">
        <div class="form-error" id="prof-phone-error"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Role</label>
        <input type="text" class="form-input" value="${user.role || 'user'}" disabled>
      </div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </form>

    <hr style="margin:var(--space-8) 0;border-color:var(--c-stone-100)">

    <h3 style="margin-bottom:var(--space-4)">Change Password</h3>
    <form id="password-form" style="max-width:500px">
      <div class="form-group">
        <label class="form-label">New Password</label>
        <input type="password" id="prof-new-password" class="form-input" minlength="6" placeholder="At least 6 characters">
        <div class="form-error" id="prof-password-error"></div>
      </div>
      <button type="submit" class="btn btn-secondary">Update Password</button>
    </form>
  `;

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('prof-name').value.trim();
    const phone = document.getElementById('prof-phone').value.trim();

    const errors = {};
    const nameErr = validateName(name);
    if (nameErr) errors.name = nameErr;
    if (phone) {
      const phoneErr = validatePhone(phone);
      if (phoneErr) errors.phone = phoneErr;
    }

    document.getElementById('prof-name-error').textContent = errors.name || '';
    document.getElementById('prof-phone-error').textContent = errors.phone || '';
    if (Object.keys(errors).length > 0) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name,
        phone: formatPhone(phone),
        updatedAt: serverTimestamp()
      });
      await refreshUser();
      showToast({ message: 'Profile updated', type: 'success' });
    } catch (err) {
      showToast({ message: err.message, type: 'error' });
    }
  });

  document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('prof-new-password').value;
    if (password.length < 6) {
      document.getElementById('prof-password-error').textContent = 'Password must be at least 6 characters';
      return;
    }
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await updatePassword(currentUser, password);
        showToast({ message: 'Password updated successfully', type: 'success' });
        document.getElementById('prof-new-password').value = '';
      }
    } catch (err) {
      showToast({ message: err.message, type: 'error' });
    }
  });
}
