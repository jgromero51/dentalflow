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

          <div class="social-login" style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button class="btn btn-outline" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="Auth.socialLogin('google')" type="button">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>
            <button class="btn btn-outline" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="Auth.socialLogin('apple')" type="button">
              <svg width="18" height="18" viewBox="0 0 384 512"><path fill="#000000" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
              Apple
            </button>
          </div>
          
          <div style="text-align: center; margin-bottom: 20px; position: relative;">
            <hr style="border:none; border-top: 1px solid var(--border); margin: 0;">
            <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--surface); padding: 0 10px; color: var(--text-muted); font-size: 0.9em;">o con tu email</span>
          </div>

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

          <div class="auth-switch" style="margin-top: 10px;">
            <button type="button" class="auth-switch-link" onclick="Router.navigate('forgot-password')" style="font-size: 0.9em;">
              ¿Olvidaste tu contraseña?
            </button>
          </div>

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
  async render(container) {
    let hasUsers = false;
    try {
      const status = await api.auth.status();
      hasUsers = status.hasUsers;
    } catch (e) {
      console.error(e);
    }

    container.innerHTML = `
      <div class="auth-wrapper fade-in" id="setup-view">

        <div class="auth-brand">
          <div class="auth-brand-icon">🦷</div>
          <div class="auth-brand-name">DentalFlow</div>
          <div class="auth-brand-sub">${hasUsers ? 'Registrar nuevo usuario' : 'Configuración inicial'}</div>
        </div>

        <div class="auth-card">
          ${!hasUsers ? '<div class="setup-step-badge">Paso 1 de 1</div>' : ''}
          <h2 class="auth-title">¡Bienvenido/a!</h2>
          <p class="auth-desc">${hasUsers ? 'Creá una cuenta para un nuevo usuario.' : 'Creá tu cuenta de administrador para comenzar a usar DentalFlow.'}</p>

          <div class="social-login" style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button class="btn btn-outline" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="Auth.socialLogin('google')" type="button">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>
            <button class="btn btn-outline" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="Auth.socialLogin('apple')" type="button">
              <svg width="18" height="18" viewBox="0 0 384 512"><path fill="#000000" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
              Apple
            </button>
          </div>
          
          <div style="text-align: center; margin-bottom: 20px; position: relative;">
            <hr style="border:none; border-top: 1px solid var(--border); margin: 0;">
            <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--surface); padding: 0 10px; color: var(--text-muted); font-size: 0.9em;">o con tu email</span>
          </div>

          <form id="setup-form" onsubmit="SetupView.submit(event)" autocomplete="off">

            <div class="form-group" id="clinic-group" style="${hasUsers ? 'display:none;' : ''}">
              <label class="form-label" for="setup-clinic">
                Nombre de tu clínica <span class="required">*</span>
              </label>
              <input id="setup-clinic" class="form-control" type="text"
                placeholder="Ej: Dr. García Odontología"
                maxlength="80" />
            </div>

            <div class="form-group">
              <label class="form-label" for="setup-email">
                Correo Electrónico <span class="required">*</span>
              </label>
              <input id="setup-email" class="form-control" type="email"
                placeholder="tu@email.com" required />
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

          <div class="auth-switch">
            ¿Ya tenés una cuenta?
            <button type="button" class="auth-switch-link" onclick="Router.navigate('login')">
              Iniciar sesión
            </button>
          </div>
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
    const clinicGroup = document.getElementById('clinic-group');
    const isFirstUser = clinicGroup && clinicGroup.style.display !== 'none';
    const clinic    = isFirstUser ? document.getElementById('setup-clinic').value.trim() : '';
    const email     = document.getElementById('setup-email').value.trim();
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
      const res = await api.auth.setup({ username, password, clinic_name: clinic, email });
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

// ============================================================
// VISTA DE RECUPERAR CONTRASEÑA
// ============================================================
const ForgotPasswordView = {
  render(container) {
    container.innerHTML = `
      <div class="auth-wrapper fade-in" id="forgot-view">
        <div class="auth-brand">
          <div class="auth-brand-icon">🦷</div>
          <div class="auth-brand-name">DentalFlow</div>
        </div>

        <div class="auth-card">
          <h2 class="auth-title">Recuperar Contraseña</h2>
          <p class="auth-desc">Ingresá tu correo electrónico y te enviaremos las instrucciones para restablecer tu contraseña.</p>

          <form id="forgot-form" onsubmit="ForgotPasswordView.submit(event)">
            <div class="form-group" style="margin-bottom:24px;">
              <label class="form-label" for="forgot-email">Correo Electrónico</label>
              <input id="forgot-email" class="form-control" type="email"
                placeholder="tu@email.com" required autofocus />
            </div>

            <div id="forgot-msg" class="auth-error" style="display:none; color: var(--success); background: #e6f6ee; border-color: #c3e6cb;"></div>
            <div id="forgot-error" class="auth-error" style="display:none;"></div>

            <button type="submit" id="forgot-btn" class="btn btn-primary btn-full">
              Enviar instrucciones
            </button>
          </form>

          <div class="auth-switch">
            <button type="button" class="auth-switch-link" onclick="Router.navigate('login')">
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>`;
  },

  async submit(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const btn   = document.getElementById('forgot-btn');
    const msg   = document.getElementById('forgot-msg');
    const err   = document.getElementById('forgot-error');

    msg.style.display = 'none';
    err.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = `<div class="loading-spinner" style="width:18px;height:18px;border-width:2px;"></div> Enviando...`;

    try {
      const res = await api.auth.forgotPassword({ email });
      msg.textContent = res.message || 'Instrucciones enviadas. Revisá tu correo electrónico.';
      msg.style.display = 'block';
      btn.innerHTML = 'Enviado';
    } catch (error) {
      err.textContent = error.message;
      err.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = 'Enviar instrucciones';
    }
  }
};

window.LoginView = LoginView;
window.SetupView = SetupView;
window.ForgotPasswordView = ForgotPasswordView;
