/**
 * DentalFlow — Vista de Login y Setup Inicial
 *
 * LoginView:  Pantalla de inicio de sesión con usuario y contraseña
 * SetupView:  Wizard de primer uso (solo cuando no hay usuarios)
 */

// ============================================================
// VISTA DE LOGIN
// ============================================================
const LoginView = {
  render(container) {
    container.innerHTML = `
      <div class="auth-wrapper fade-in" id="login-view">

        <div class="auth-brand">
          <div class="auth-brand-icon">🦷</div>
          <div class="auth-brand-name">DentalFlow</div>
          <div class="auth-brand-sub">Sistema de gestión odontológica</div>
        </div>

        <div class="auth-card">
          <h2 class="auth-title">Iniciar Sesión</h2>
          <p class="auth-desc">Ingresá tus credenciales para acceder</p>

          <form id="login-form" onsubmit="LoginView.submit(event)" autocomplete="on">
            <div class="form-group">
              <label class="form-label" for="login-user">Usuario</label>
              <input id="login-user" class="form-control" type="text"
                placeholder="tu_usuario" autocomplete="username"
                required autofocus />
            </div>
            <div class="form-group" style="margin-bottom:24px;">
              <label class="form-label" for="login-pass">Contraseña</label>
              <div class="auth-pass-wrap">
                <input id="login-pass" class="form-control" type="password"
                  placeholder="••••••••" autocomplete="current-password" required />
                <button type="button" class="auth-eye-btn" onclick="LoginView.togglePass()" id="login-eye" title="Mostrar/ocultar">
                  <svg id="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>

            <div id="login-error" class="auth-error" style="display:none;"></div>

            <button type="submit" id="login-btn" class="btn btn-primary btn-full">
              Ingresar
            </button>
          </form>

          <div class="auth-switch">
            ¿No tenés cuenta aún?
            <button type="button" class="auth-switch-link" onclick="Router.navigate('setup')">
              Crear cuenta
            </button>
          </div>
        </div>

        <div class="auth-footer">DentalFlow v1.0 · Tu consultorio en la palma de tu mano</div>
      </div>`;
  },

  togglePass() {
    const input = document.getElementById('login-pass');
    input.type = input.type === 'password' ? 'text' : 'password';
  },

  async submit(e) {
    e.preventDefault();
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;
    const btn      = document.getElementById('login-btn');
    const errBox   = document.getElementById('login-error');

    errBox.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = `<div class="loading-spinner" style="width:18px;height:18px;border-width:2px;"></div> Ingresando...`;

    try {
      const res = await api.auth.login({ username, password });
      Auth.setToken(res.token);
      Auth.setUser({ username: res.username, role: res.role });

      // Navegar al inicio
      window.Router.navigate('appointments');
    } catch (err) {
      errBox.textContent  = err.message;
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  }
};

// ============================================================
// VISTA DE SETUP INICIAL (Primer uso)
// ============================================================
const SetupView = {
  render(container) {
    container.innerHTML = `
      <div class="auth-wrapper fade-in" id="setup-view">

        <div class="auth-brand">
          <div class="auth-brand-icon">🦷</div>
          <div class="auth-brand-name">DentalFlow</div>
          <div class="auth-brand-sub">Configuración inicial</div>
        </div>

        <div class="auth-card">
          <div class="setup-step-badge">Paso 1 de 1</div>
          <h2 class="auth-title">¡Bienvenido/a!</h2>
          <p class="auth-desc">Creá tu cuenta de administrador para comenzar a usar DentalFlow.</p>

          <form id="setup-form" onsubmit="SetupView.submit(event)" autocomplete="off">

            <div class="form-group">
              <label class="form-label" for="setup-clinic">
                Nombre de tu clínica <span class="required">*</span>
              </label>
              <input id="setup-clinic" class="form-control" type="text"
                placeholder="Ej: Dr. García Odontología"
                required maxlength="80" />
            </div>

            <div class="form-group">
              <label class="form-label" for="setup-user">
                Nombre de usuario <span class="required">*</span>
              </label>
              <input id="setup-user" class="form-control" type="text"
                placeholder="admin" autocomplete="off"
                required pattern="[a-zA-Z0-9_]+" title="Solo letras, números y guión bajo" />
              <div class="form-hint">Solo letras, números y guión bajo (_). Sin espacios.</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="setup-pass">
                Contraseña <span class="required">*</span>
              </label>
              <div class="auth-pass-wrap">
                <input id="setup-pass" class="form-control" type="password"
                  placeholder="Mínimo 6 caracteres" autocomplete="new-password"
                  required minlength="6" />
                <button type="button" class="auth-eye-btn" onclick="SetupView.togglePass()" title="Mostrar/ocultar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="form-group" style="margin-bottom:24px;">
              <label class="form-label" for="setup-pass2">
                Confirmar contraseña <span class="required">*</span>
              </label>
              <input id="setup-pass2" class="form-control" type="password"
                placeholder="Repetí la contraseña" autocomplete="new-password" required />
            </div>

            <div id="setup-error" class="auth-error" style="display:none;"></div>

            <button type="submit" id="setup-btn" class="btn btn-primary btn-full">
              Crear cuenta y comenzar
            </button>
          </form>
        </div>

        <div class="auth-footer">Esta cuenta solo se crea una vez. Guardá tus credenciales en un lugar seguro.</div>
      </div>`;
  },

  togglePass() {
    ['setup-pass', 'setup-pass2'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
  },

  async submit(e) {
    e.preventDefault();
    const clinic    = document.getElementById('setup-clinic').value.trim();
    const username  = document.getElementById('setup-user').value.trim();
    const password  = document.getElementById('setup-pass').value;
    const password2 = document.getElementById('setup-pass2').value;
    const btn       = document.getElementById('setup-btn');
    const errBox    = document.getElementById('setup-error');

    errBox.style.display = 'none';

    if (password !== password2) {
      errBox.textContent   = 'Las contraseñas no coinciden.';
      errBox.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<div class="loading-spinner" style="width:18px;height:18px;border-width:2px;"></div> Creando cuenta...`;

    try {
      const res = await api.auth.setup({ username, password, clinic_name: clinic });
      Auth.setToken(res.token);
      Auth.setUser({ username: res.username, role: 'admin' });

      Toast.success(`¡Cuenta creada! Bienvenido/a, ${res.username} 🦷`);

      // Actualizar brand-name con el nombre de clínica
      const brandName = document.querySelector('.brand-name');
      if (brandName) brandName.textContent = clinic;

      window.Router.navigate('appointments');
    } catch (err) {
      errBox.textContent   = err.message;
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Crear cuenta y comenzar';
    }
  }
};

window.LoginView = LoginView;
window.SetupView  = SetupView;
