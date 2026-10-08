const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{10}$/;
const NAME_RE = /^[A-Za-z\s\-']{2,60}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateEmail(email) {
  if (!email || !email.trim()) return 'Email is required';
  if (!EMAIL_RE.test(email.trim())) return 'Invalid email format';
  return null;
}

export function validatePhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return 'Phone number is required';
  if (!PHONE_RE.test(cleaned)) return 'Phone must be 10 digits';
  return null;
}

export function validateName(name) {
  if (!name || !name.trim()) return 'Name is required';
  if (!NAME_RE.test(name.trim())) return 'Name must be 2-60 characters, letters and spaces only';
  return null;
}

export function validateTime(time) {
  if (!time) return 'Time is required';
  if (!TIME_RE.test(time)) return 'Invalid time format (HH:MM)';
  return null;
}

export function validateDate(date) {
  if (!date) return 'Date is required';
  if (!DATE_RE.test(date)) return 'Invalid date format (YYYY-MM-DD)';
  return null;
}

export function validatePassword(password) {
  if (!password || password.length < 6) return 'Password must be at least 6 characters';
  return null;
}

export function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && !value.trim())) return `${fieldName} is required`;
  return null;
}

export function validateNumber(value, fieldName, min = 0) {
  const n = Number(value);
  if (isNaN(n)) return `${fieldName} must be a number`;
  if (n < min) return `${fieldName} must be at least ${min}`;
  return null;
}

export function validateForm(formData, rules) {
  const errors = {};
  for (const [field, validators] of Object.entries(rules)) {
    for (const validator of validators) {
      const error = validator(formData[field]);
      if (error) {
        errors[field] = error;
        break;
      }
    }
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

export function formatPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned;
}

export function validateBookingForm(data) {
  const errors = {};
  const nameErr = validateName(data.customerName);
  if (nameErr) errors.customerName = nameErr;
  const phoneErr = validatePhone(data.customerPhone);
  if (phoneErr) errors.customerPhone = phoneErr;
  if (data.customerEmail) {
    const emailErr = validateEmail(data.customerEmail);
    if (emailErr) errors.customerEmail = emailErr;
  }
  return Object.keys(errors).length > 0 ? errors : null;
}
