import { getActiveBranches, getBranch, getBranchConfig } from '../db/branches.js';
import { getBranchServices, getService } from '../db/services.js';
import { getStaffList } from '../db/staff.js';
import { createAppointmentWithTransaction } from '../db/appointments.js';
import { generateAvailableSlots, fetchSlotData } from '../slots.js';
import { renderTimeSlotPicker, renderDatePicker, showToast, showModal } from '../components.js';
import { validateBookingForm, formatPhone } from '../validators.js';
import { formatCurrency, formatDate, formatTime, escapeHtml, daysFromToday, todayString } from '../utils.js';
import { getUser, onAuthChange } from '../auth.js';

const STORAGE_KEY = 'booking_draft';

let state = {
  step: 1,
  branchId: null,
  branchName: null,
  branchConfig: null,
  service: null,
  serviceId: null,
  staffId: null,
  staffName: null,
  date: null,
  time: null,
  endTime: null,
  isOverbooking: false,
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  notes: '',
  slots: []
};

function saveDraft() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      branchId: state.branchId,
      branchName: state.branchName,
      serviceId: state.serviceId,
      service: state.service ? { id: state.service.id, name: state.service.name } : null,
      staffId: state.staffId,
      staffName: state.staffName,
      date: state.date,
      time: state.time,
      endTime: state.endTime,
      customerName: state.customerName,
      customerPhone: state.customerPhone,
      customerEmail: state.customerEmail,
      notes: state.notes
    }));
  } catch (e) {}
}

function restoreDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      Object.assign(state, data);
    }
  } catch (e) {}
}

function clearDraft() {
  sessionStorage.removeItem(STORAGE_KEY);
}

async function init() {
  restoreDraft();

  onAuthChange((user) => {
    const link = document.getElementById('booking-auth-link');
    if (user) {
      link.textContent = 'My Dashboard';
      link.href = 'dashboard.html';
      state.customerName = user.name || '';
      state.customerEmail = user.email || '';
      state.customerPhone = user.phone || '';
    } else {
      link.textContent = 'Sign In';
      link.href = 'login.html';
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  const preBranch = urlParams.get('branch');
  if (preBranch) {
    state.branchId = preBranch;
  }

  await renderStep(1);
}

async function renderStep(step) {
  state.step = step;
  updateStepIndicators();

  const content = document.getElementById('booking-content');
  content.innerHTML = '<div class="loading-spinner"></div>';

  try {
    switch (step) {
      case 1: await renderBranchStep(content); break;
      case 2: await renderServiceStep(content); break;
      case 3: await renderStaffStep(content); break;
      case 4: await renderDateTimeStep(content); break;
      case 5: await renderConfirmStep(content); break;
    }
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(err.message)}</p><button class="btn btn-primary" onclick="location.reload()">Try Again</button></div>`;
  }
}

function updateStepIndicators() {
  const indicators = document.querySelectorAll('.booking-step-indicator');
  indicators.forEach((el, i) => {
    const stepNum = i + 1;
    el.classList.remove('active', 'completed');
    if (stepNum === state.step) el.classList.add('active');
    else if (stepNum < state.step) el.classList.add('completed');

    const connector = el.querySelector('.booking-step-connector');
    if (connector) {
      connector.classList.toggle('completed', stepNum < state.step);
    }
  });
}

async function renderBranchStep(container) {
  container.innerHTML = '<h2>Select a Branch</h2><div class="branch-select-grid" id="branch-grid"></div>';

  const branches = await getActiveBranches();
  const grid = document.getElementById('branch-grid');

  if (branches.length === 0) {
    grid.innerHTML = '<div class="empty-state"><h3>No branches available</h3></div>';
    return;
  }

  for (const branch of branches) {
    const card = document.createElement('div');
    card.className = `branch-select-card${state.branchId === branch.id ? ' selected' : ''}`;
    card.innerHTML = `
      <h3>${escapeHtml(branch.name)}</h3>
      ${branch.address ? `<p>${escapeHtml(branch.address)}</p>` : ''}
      ${branch.phone ? `<p>${escapeHtml(branch.phone)}</p>` : ''}
    `;
    card.addEventListener('click', () => {
      state.branchId = branch.id;
      state.branchName = branch.name;
      state.serviceId = null;
      state.service = null;
      state.staffId = null;
      state.staffName = null;
      state.date = null;
      state.time = null;
      saveDraft();
      renderStep(2);
    });
    grid.appendChild(card);
  }
}

async function renderServiceStep(container) {
  if (!state.branchId) return renderStep(1);

  container.innerHTML = '<h2>Select a Service</h2><div id="service-list"></div>';

  const services = await getBranchServices(state.branchId);
  const serviceList = document.getElementById('service-list');

  if (services.length === 0) {
    serviceList.innerHTML = '<div class="empty-state"><h3>No services available at this branch</h3></div>';
    return;
  }

  const categories = {};
  for (const s of services) {
    const cat = s.category || 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(s);
  }

  for (const [category, items] of Object.entries(categories)) {
    const group = document.createElement('div');
    group.innerHTML = `<div class="category-label">${escapeHtml(category)}</div>`;

    for (const service of items) {
      const item = document.createElement('div');
      item.className = `service-select-item${state.serviceId === service.id ? ' selected' : ''}`;

      const price = service.pricing?.discountedPrice || service.pricing?.price || 0;
      const currency = service.pricing?.currency || 'INR';

      item.innerHTML = `
        ${service.imageUrl ? `<img class="service-select-item-image" src="${escapeHtml(service.imageUrl)}" alt="${escapeHtml(service.name)}" loading="lazy">` : ''}
        <div class="service-select-item-info">
          <h3>${escapeHtml(service.name)}</h3>
          ${service.description ? `<p>${escapeHtml(service.description)}</p>` : ''}
          <p style="font-size:0.8125rem;color:var(--c-stone-500);margin-top:var(--space-1)">${service.durationMinutes} min</p>
        </div>
        <div class="service-select-item-price">${formatCurrency(price, currency)}</div>
      `;

      item.addEventListener('click', () => {
        state.serviceId = service.id;
        state.service = service;
        state.staffId = null;
        state.staffName = null;
        state.date = null;
        state.time = null;
        saveDraft();
        renderStep(3);
      });

      group.appendChild(item);
    }

    serviceList.appendChild(group);
  }
}

async function renderStaffStep(container) {
  if (!state.branchId || !state.serviceId) return renderStep(2);

  container.innerHTML = '<h2>Select Staff (Optional)</h2><p style="color:var(--c-stone-600);margin-bottom:var(--space-4)">Choose a specific staff member or let us assign anyone available.</p><div class="staff-select-grid" id="staff-grid"></div>';

  const staff = await getStaffList(state.branchId);
  const filtered = state.service
    ? staff.filter(s => s.serviceIds?.includes(state.serviceId))
    : staff;

  const grid = document.getElementById('staff-grid');

  const anyCard = document.createElement('div');
  anyCard.className = `staff-select-card any${!state.staffId ? ' selected' : ''}`;
  anyCard.innerHTML = `
    <div class="staff-select-card-avatar">&#10003;</div>
    <h4>Any Available</h4>
    <p style="font-size:0.8125rem;color:var(--c-stone-500)">Auto-assign</p>
  `;
  anyCard.addEventListener('click', () => {
    state.staffId = null;
    state.staffName = null;
    saveDraft();
    renderStep(4);
  });
  grid.appendChild(anyCard);

  for (const staffMember of filtered) {
    const card = document.createElement('div');
    card.className = `staff-select-card${state.staffId === staffMember.id ? ' selected' : ''}`;
    card.innerHTML = `
      <div class="staff-select-card-avatar">${escapeHtml(staffMember.name.charAt(0).toUpperCase())}</div>
      <h4>${escapeHtml(staffMember.name)}</h4>
    `;
    card.addEventListener('click', () => {
      state.staffId = staffMember.id;
      state.staffName = staffMember.name;
      saveDraft();
      renderStep(4);
    });
    grid.appendChild(card);
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state"><h3>No staff available</h3></div>';
  }
}

async function renderDateTimeStep(container) {
  if (!state.branchId || !state.serviceId) return renderStep(2);

  container.innerHTML = '<h2>Select Date & Time</h2><div class="date-time-picker"><div id="date-picker-container"></div><div id="time-slots-container"><div class="empty-state"><h3>Select a date first</h3></div></div></div>';

  const branchConfig = await getBranchConfig(state.branchId);
  state.branchConfig = branchConfig;

  const bookingWindow = branchConfig?.bookingWindowDays || 30;
  const minDate = todayString();
  const maxDate = daysFromToday(bookingWindow);

  const datePickerContainer = document.getElementById('date-picker-container');

  let markedDates = new Set();

  renderDatePicker({
    container: datePickerContainer,
    selectedDate: state.date,
    minDate,
    maxDate,
    onSelect: async (date) => {
      state.date = date;
      state.time = null;
      saveDraft();
      await loadTimeSlots();
    }
  });

  if (state.date) {
    await loadTimeSlots();
  }
}

async function loadTimeSlots() {
  const timeSlotsContainer = document.getElementById('time-slots-container');
  if (!timeSlotsContainer) return;

  timeSlotsContainer.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const branchConfig = state.branchConfig || await getBranchConfig(state.branchId);
    const service = state.service || await getService(state.serviceId);
    const duration = service?.durationMinutes || 60;

    const slots = await fetchSlotData({
      date: state.date,
      branchId: state.branchId,
      serviceId: state.serviceId,
      staffId: state.staffId,
      branchConfig
    });

    state.slots = slots;

    renderTimeSlotPicker({
      container: timeSlotsContainer,
      slots,
      selectedTime: state.time,
      onSelect: (slot) => {
        state.time = slot.time;
        state.endTime = slot.endTime;
        state.staffId = slot.staffId;
        state.staffName = slot.staffName;
        state.isOverbooking = slot.isOverbooking;
        saveDraft();
      }
    });

    if (state.time) {
      timeSlotsContainer.querySelectorAll('.time-slot').forEach(el => {
        if (el.dataset.time === state.time) el.classList.add('selected');
      });
    }
  } catch (err) {
    timeSlotsContainer.innerHTML = `<div class="empty-state"><h3>Error loading slots</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

async function renderConfirmStep(container) {
  if (!state.branchId || !state.serviceId || !state.date || !state.time) {
    return renderStep(4);
  }

  const branch = await getBranch(state.branchId);
  const service = state.service || await getService(state.serviceId);
  const pricing = service?.pricing;
  const price = pricing?.discountedPrice || pricing?.price || 0;
  const currency = pricing?.currency || 'INR';

  container.innerHTML = `
    <h2>Confirm Your Booking</h2>

    <div class="booking-summary">
      <div class="booking-summary-row">
        <span class="label">Branch</span>
        <span><strong>${escapeHtml(branch?.name || state.branchName || '')}</strong></span>
      </div>
      <div class="booking-summary-row">
        <span class="label">Service</span>
        <span><strong>${escapeHtml(service?.name || '')}</strong> (${service?.durationMinutes || ''} min)</span>
      </div>
      ${state.staffName ? `
      <div class="booking-summary-row">
        <span class="label">Staff</span>
        <span><strong>${escapeHtml(state.staffName)}</strong></span>
      </div>` : ''}
      <div class="booking-summary-row">
        <span class="label">Date</span>
        <span><strong>${formatDate(state.date)}</strong></span>
      </div>
      <div class="booking-summary-row">
        <span class="label">Time</span>
        <span><strong>${formatTime(state.time)}</strong> — ${formatTime(state.endTime)}</span>
      </div>
      ${state.isOverbooking ? '<div class="booking-summary-row"><span class="label">Note</span><span class="badge badge-overbooking">Limited availability</span></div>' : ''}
      <div class="booking-summary-row booking-summary-total">
        <span>Total</span>
        <span>${formatCurrency(price, currency)}</span>
      </div>
    </div>

    <form id="customer-form">
      <h3 style="margin-bottom:var(--space-4);font-size:1.1rem">Your Details</h3>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="cust-name">Full Name *</label>
          <input type="text" id="cust-name" class="form-input" value="${escapeHtml(state.customerName)}" required placeholder="Your name">
          <div class="form-error" id="cust-name-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label" for="cust-phone">Phone *</label>
          <input type="tel" id="cust-phone" class="form-input" value="${escapeHtml(state.customerPhone)}" required placeholder="10-digit number">
          <div class="form-error" id="cust-phone-error"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="cust-email">Email</label>
        <input type="email" id="cust-email" class="form-input" value="${escapeHtml(state.customerEmail || '')}" placeholder="your@email.com">
      </div>
      <div class="form-group">
        <label class="form-label" for="cust-notes">Notes (optional)</label>
        <textarea id="cust-notes" class="form-textarea" placeholder="Any special requests...">${escapeHtml(state.notes || '')}</textarea>
      </div>
    </form>

    <div class="booking-nav">
      <button class="btn btn-ghost" id="back-btn">Back</button>
      <button class="btn btn-gold btn-lg" id="confirm-btn">Confirm Booking</button>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => renderStep(4));

  const nameInput = document.getElementById('cust-name');
  const phoneInput = document.getElementById('cust-phone');
  const emailInput = document.getElementById('cust-email');
  const notesInput = document.getElementById('cust-notes');

  nameInput.addEventListener('input', () => { state.customerName = nameInput.value; saveDraft(); });
  phoneInput.addEventListener('input', () => { state.customerPhone = phoneInput.value; saveDraft(); });
  emailInput.addEventListener('input', () => { state.customerEmail = emailInput.value; saveDraft(); });
  notesInput.addEventListener('input', () => { state.notes = notesInput.value; saveDraft(); });

  document.getElementById('confirm-btn').addEventListener('click', async () => {
    const errors = validateBookingForm({
      customerName: nameInput.value,
      customerPhone: phoneInput.value,
      customerEmail: emailInput.value
    });

    document.getElementById('cust-name-error').textContent = '';
    document.getElementById('cust-phone-error').textContent = '';

    if (errors) {
      if (errors.customerName) {
        document.getElementById('cust-name-error').textContent = errors.customerName;
        nameInput.classList.add('error');
      }
      if (errors.customerPhone) {
        document.getElementById('cust-phone-error').textContent = errors.customerPhone;
        phoneInput.classList.add('error');
      }
      return;
    }

    const btn = document.getElementById('confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Booking...';

    try {
      const user = getUser();
      const result = await createAppointmentWithTransaction({
        branchId: state.branchId,
        serviceId: state.serviceId,
        staffId: state.staffId || '',
        customerId: user?.uid || null,
        customerName: nameInput.value.trim(),
        customerPhone: formatPhone(phoneInput.value),
        customerEmail: emailInput.value.trim() || '',
        date: state.date,
        startTime: state.time,
        endTime: state.endTime,
        status: 'pending',
        isOverbooking: state.isOverbooking,
        notes: notesInput.value.trim() || '',
        price: price,
        currency: currency,
        createdBy: user?.uid || 'anonymous'
      });

      if (!result.success) {
        if (result.conflict) {
          showToast({ message: 'This slot was just booked by someone else. Please choose another time.', type: 'error', duration: 5000 });
        } else {
          showToast({ message: result.message || result.error || 'Booking failed. Please try again.', type: 'error' });
        }
        btn.disabled = false;
        btn.textContent = 'Confirm Booking';
        return;
      }

      clearDraft();
      showToast({ message: 'Appointment booked successfully!', type: 'success', duration: 5000 });
      container.innerHTML = `
        <div class="auth-success">
          <div class="auth-success-icon">&#10003;</div>
          <h2>Booking Confirmed!</h2>
          <p style="color:var(--c-stone-600);margin:var(--space-4) 0">Your appointment has been booked. We look forward to seeing you!</p>
          <div class="booking-summary" style="text-align:left">
            <div class="booking-summary-row"><span class="label">Reference</span><span><strong>#${result.id.slice(0, 8)}</strong></span></div>
            <div class="booking-summary-row"><span class="label">Date</span><span>${formatDate(state.date)}</span></div>
            <div class="booking-summary-row"><span class="label">Time</span><span>${formatTime(state.time)}</span></div>
          </div>
          <div style="margin-top:var(--space-6)">
            <a href="/" class="btn btn-ghost">Back to Home</a>
            <a href="book.html" class="btn btn-primary" style="margin-left:var(--space-3)">Book Another</a>
          </div>
        </div>
      `;
    } catch (err) {
      showToast({ message: err.message || 'Booking failed. Please try again.', type: 'error' });
      btn.disabled = false;
      btn.textContent = 'Confirm Booking';
    }
  });
}

init();
