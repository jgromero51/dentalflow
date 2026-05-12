/**
 * DentalFlow — Vista: Panel de Administración
 * Permite al dueño supervisar usuarios y estado del sistema.
 */
import api from '../api.js';

export default {
  render: async () => {
    return `
      <div class="view-container">
        <header class="view-header">
          <h1>Panel de Control Maestro</h1>
          <p>Supervisión global de DentalFlow</p>
        </header>

        <div class="admin-stats-grid" id="admin-stats">
          <div class="stat-card loading">Cargando...</div>
        </div>

        <section class="admin-section">
          <h2>Usuarios Registrados</h2>
          <div class="table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Creado</th>
                  <th>Último Acceso</th>
                  <th>Pacientes</th>
                  <th>Citas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="users-list">
                <tr><td colspan="7" class="loading">Cargando usuarios...</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  },

  afterRender: async () => {
    try {
      const statsRes = await api.get('/admin/system-stats');
      const usersRes = await api.get('/admin/users');

      const stats = statsRes.data;
      const users = usersRes.data;

      // Renderizar Estadísticas
      const statsContainer = document.getElementById('admin-stats');
      statsContainer.innerHTML = `
        <div class="stat-card">
          <span class="stat-label">Usuarios</span>
          <span class="stat-value">${stats.total_users}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Pacientes</span>
          <span class="stat-value">${stats.total_patients}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Citas Totales</span>
          <span class="stat-value">${stats.total_appointments}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Mensajes WA</span>
          <span class="stat-value">${stats.total_messages}</span>
        </div>
      `;

      // Renderizar Lista de Usuarios
      const usersList = document.getElementById('users-list');
      if (users.length === 0) {
        usersList.innerHTML = '<tr><td colspan="7">No hay usuarios registrados.</td></tr>';
      } else {
        usersList.innerHTML = users.map(user => `
          <tr>
            <td><strong>${user.username}</strong></td>
            <td><span class="badge ${user.role}">${user.role}</span></td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
            <td>${user.last_login ? new Date(user.last_login).toLocaleString() : 'Nunca'}</td>
            <td>${user.stats?.patients_count || 0}</td>
            <td>${user.stats?.appointments_count || 0}</td>
            <td>
              <button class="btn-icon mini" onclick="window.alert('Función de soporte próximamente')">
                <span class="material-icons">support_agent</span>
              </button>
            </td>
          </tr>
        `).join('');
      }

    } catch (err) {
      console.error('[Admin] Error:', err);
      document.getElementById('admin-stats').innerHTML = `<p class="error">Error al cargar datos: ${err.message}</p>`;
    }
  }
};
