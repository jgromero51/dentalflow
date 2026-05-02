# 🦷 DentalFlow — MVP Gestión de Citas Odontológicas

Sistema completo de gestión de citas para odontólogos con automatización inteligente via WhatsApp e IA.

---

## 🚀 Instalación Rápida (Windows)

### Paso 1 — Instalar Node.js
1. Descargá Node.js desde: **https://nodejs.org** (versión LTS)
2. Instalalo con las opciones por defecto
3. Reiniciá la terminal/PowerShell

### Paso 2 — Arrancar la aplicación
```bash
# Doble-click en start.bat  ← forma más fácil
# O desde PowerShell:
cd dentalflow
.\start.bat
```

### Paso 3 — Abrir en el navegador
```
http://localhost:3000
```

---

## ⚙️ Configuración

Editá `backend/.env` para personalizar:

```env
# Nombre de tu consultorio
CLINIC_NAME=Dr. García Odontología

# Modo demo (true = mensajes en consola, sin WhatsApp real)
DEMO_MODE=true

# OpenAI para IA (opcional en modo demo)
OPENAI_API_KEY=sk-tu-key-aqui

# WhatsApp Cloud API (opcional en modo demo)
WHATSAPP_TOKEN=EAAtu-token
WHATSAPP_PHONE_NUMBER_ID=tu-phone-id
```

---

## 📱 Instalar como PWA en el celular

1. Abrí `http://TU_IP:3000` en el Chrome del celular
2. Tocá el menú (⋮) → **"Agregar a pantalla de inicio"**
3. ¡Listo! Aparece como app nativa

Para acceder desde el celular, reemplazá `TU_IP` con la IP local de tu PC:
```powershell
# En PowerShell ejecutá:
ipconfig
# Buscá "Dirección IPv4" (ejemplo: 192.168.1.100)
```

---

## 🌟 Funcionalidades

| Funcionalidad | Estado |
|---|---|
| ✅ Crear cita rápida (< 1 min) | Implementado |
| ✅ Anti-cruces de horarios | Implementado |
| ✅ Lista de citas (hoy / próximas / todas) | Implementado |
| ✅ Gestión de estados (pendiente/confirmada/cancelada) | Implementado |
| ✅ Recordatorio automático 24h antes | Implementado |
| ✅ Recordatorio automático 4h antes | Implementado |
| ✅ IA para mensajes dinámicos (OpenAI) | Implementado |
| ✅ Respuesta automática vía webhook | Implementado |
| ✅ Gestión de pacientes | Implementado |
| ✅ Mini-calendario con días ocupados | Implementado |
| ✅ PWA instalable en celular | Implementado |
| ✅ Modo demo (sin credenciales) | Implementado |

---

## 🗂️ Estructura del Proyecto

```
dentalflow/
├── start.bat                  ← Arranque en Windows
├── backend/
│   ├── server.js              ← Servidor Express
│   ├── .env                   ← Configuración (editá esto)
│   ├── db/
│   │   ├── database.js        ← SQLite + inicialización
│   │   └── schema.sql         ← Tablas: patients, appointments, message_log
│   ├── routes/
│   │   ├── appointments.js    ← API citas + anti-cruces
│   │   ├── patients.js        ← API pacientes
│   │   └── webhook.js         ← WhatsApp webhook entrante
│   └── services/
│       ├── ai.js              ← OpenAI: mensajes + clasificación
│       ├── whatsapp.js        ← Cloud API + modo demo
│       └── scheduler.js       ← Cron: recordatorios automáticos
└── frontend/
    ├── index.html             ← Shell PWA
    ├── manifest.json          ← Configuración PWA
    ├── sw.js                  ← Service Worker (offline)
    ├── css/style.css          ← Design system dark mode
    └── js/
        ├── api.js             ← Cliente HTTP
        ├── app.js             ← Router SPA + bootstrap
        ├── components/
        │   ├── toast.js       ← Notificaciones
        │   └── calendar.js    ← Mini-calendario
        └── views/
            ├── appointments.js    ← Vista lista de citas
            └── newAppointment.js  ← Formulario nueva cita
```

---

## 🔌 API REST

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/appointments` | Listar citas (filtros: fecha, estado) |
| `GET` | `/api/appointments/today` | Citas de hoy |
| `GET` | `/api/appointments/upcoming` | Próximas 30 días |
| `GET` | `/api/appointments/slots/:fecha` | Horarios ocupados |
| `POST` | `/api/appointments` | Crear cita (con anti-cruces) |
| `PUT` | `/api/appointments/:id` | Actualizar cita/estado |
| `DELETE` | `/api/appointments/:id` | Eliminar cita |
| `GET` | `/api/patients` | Listar/buscar pacientes |
| `POST` | `/api/patients` | Crear paciente |
| `GET` | `/api/webhook` | Verificación Meta |
| `POST` | `/api/webhook` | Mensajes WhatsApp entrantes |

---

## 💬 Activar WhatsApp Real

1. Creá una app en **https://developers.facebook.com**
2. Agregá el producto **WhatsApp**
3. Obtené tu `Phone Number ID` y el `Token de acceso`
4. Configurá el webhook en Meta apuntando a: `https://tudominio.com/api/webhook`
5. En `.env`, configurá:
   ```env
   DEMO_MODE=false
   WHATSAPP_TOKEN=tu-token-real
   WHATSAPP_PHONE_NUMBER_ID=tu-phone-id
   WHATSAPP_VERIFY_TOKEN=dentalflow_webhook_secret_2024
   ```

> **Nota**: Para recibir mensajes entrantes (confirmaciones de pacientes), el servidor debe ser accesible desde internet. Usá [ngrok](https://ngrok.com) para desarrollo:
> ```bash
> ngrok http 3000
> # Copiá la URL HTTPS y configurala en Meta como webhook URL
> ```

---

## 🤖 Activar IA (OpenAI)

1. Creá una cuenta en **https://platform.openai.com**
2. Generá una API Key
3. En `.env`:
   ```env
   OPENAI_API_KEY=sk-tu-key-real
   ```
4. Sin API Key, el sistema usa **plantillas predefinidas** (funciona igual)

---

## 🚀 Mejoras Futuras

- [ ] Autenticación con JWT (multi-usuario)
- [ ] Panel de analytics (tasa confirmación, ausentismo)
- [ ] Integración Google Calendar
- [ ] Historial clínico simplificado
- [ ] Módulo de pagos / facturación
- [ ] Notificaciones push nativas
- [ ] Exportar agenda a PDF
- [ ] Soporte multi-odontólogo
