export function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function timesOverlap(s1, e1, s2, e2) {
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(s2) < timeToMinutes(e1);
}

export function getDayOfWeek(dateStr) {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
}

export function intersectTimeSlots(a, b) {
  const result = [];
  for (const sa of a) {
    for (const sb of b) {
      const start = minutesToTime(Math.max(timeToMinutes(sa.start), timeToMinutes(sb.start)));
      const end = minutesToTime(Math.min(timeToMinutes(sa.end), timeToMinutes(sb.end)));
      if (timeToMinutes(start) < timeToMinutes(end)) {
        result.push({ start, end });
      }
    }
  }
  return result;
}

export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function formatCurrency(amount, currency = 'INR') {
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function todayString(timezone) {
  const opts = { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(new Date());
  return parts.map(p => p.value).join('');
}

export function daysFromToday(n, timezone) {
  const t = new Date();
  if (timezone) {
    const opts = { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' };
    const parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(t);
    t.setFullYear(parseInt(parts[0].value), parseInt(parts[2].value) - 1, parseInt(parts[4].value));
  }
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

export function timeAgo(date) {
  const now = new Date();
  const diff = now - (date.toDate ? date.toDate() : new Date(date));
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
