/**
 * DentalFlow — Toast Notifications
 */
const Toast = {
  show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-msg">${message}</span>
    `;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('hiding');
      setTimeout(() => el.remove(), 300);
    }, duration);
  },
  success: (msg, d) => Toast.show(msg, 'success', d),
  error:   (msg, d) => Toast.show(msg, 'error', d || 5000),
  warning: (msg, d) => Toast.show(msg, 'warning', d),
  info:    (msg, d) => Toast.show(msg, 'info', d),
};
window.Toast = Toast;
