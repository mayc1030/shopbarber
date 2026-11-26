# ShopBarber — Sistema de Reservas y Gestión para Barbería

Aplicación web *mobile-first* para la gestión de citas, servicios, barberos y contenido de una barbería (**Los Angeles Barber**), diseñada para publicarse como sitio estático en **GitHub Pages** con backend en **Supabase**.

---

## Características Principales

### Portal para Clientes (`/`)
- **Inicio dinámico:** Logotipo, textos promocionales (*hero*), dirección y horarios cargados desde Supabase (`settings`).
- **Asistente de reservas en 5 pasos:**
  1. Selección de servicio activo (duración y precio).
  2. Selección de barbero activo.
  3. Selección de fecha (calendario semanal + selector completo) y franja horaria disponible, respetando la duración del servicio, horarios configurados, días cerrados y evitando solapamientos o reservas duplicadas mediante RPC segura (`get_busy_slots`).
  4. Formulario de contacto del cliente con resumen de la cita.
  5. Confirmación de solicitud en estado pendiente y botón opcional de envío por **WhatsApp**.
- **Historial "Mis Citas" sin perfil:** Guarda las citas del cliente en `localStorage` con un `client_token` único, muestra cuánto ha gastado (en citas completadas) y sincroniza su estado en vivo mediante la RPC segura `get_my_appointments`.
- **Galería con Lightbox:** Portafolio de cortes publicado desde el panel administrativo.
- **Información del local:** Mapa embebido de Google Maps, botón *Cómo Llegar*, perfiles públicos del equipo (biografía y especialidades), políticas de cancelación y redes sociales.

### Portal Staff y Administración (`/admin/`)
Autenticación por roles mediante Supabase Auth:
- **Barbero Staff:**
  - Edición de su perfil público (foto, biografía y especialidades).
  - Gestión de sus citas asignadas: aceptar o cancelar solicitudes pendientes, completar citas agendadas y consultar ingresos del día.
- **Super Administrador:**
  - **Citas del Día:** Gestión global de solicitudes pendientes y agenda por fecha o vista general.
  - **Servicios:** Crear, editar, activar/desactivar y eliminar servicios.
  - **Barberos:** Alta de nuevos barberos con cuenta de acceso, edición, activación y eliminación.
  - **Galería:** Subida y eliminación de fotos en Supabase Storage (`logos`).
  - **Inicio y Horarios:** Personalización de logotipo, textos del *hero*, dirección, horarios de atención (apertura, cierre, intervalo y cierre de domingos), redes sociales y ubicación GPS.
  - **Reportes de Producción:** Métricas por barbero y período (hoy, últimos 7 días, mes o rango personalizado) con conteo de citas, tasa de asistencia, total producido e historial detallado.

---

## Tecnologías Utilizadas

- **Frontend:** Jekyll (GitHub Pages), HTML5, CSS3, JavaScript Vanilla.
- **Iconos y Tipografía:** Lucide Icons y Google Fonts (*Outfit*).
- **Backend as a Service:** Supabase (PostgreSQL, Row Level Security, RPC `SECURITY DEFINER`, Auth y Storage).

---

## Estructura Principal

```text
shopbarber/
├── _config.yml                 # Configuración de Jekyll y GitHub Pages
├── _includes/
│   └── bottom_nav.html         # Barra de navegación inferior
├── _layouts/
│   └── default.html            # Layout base, loader y modales
├── admin/
│   └── index.html              # Panel de login y administración/staff
├── assets/
│   ├── css/styles.css          # Estilos principales (tema oscuro / dorado)
│   ├── img/                    # Imágenes estáticas del sitio
│   └── js/
│       ├── app-utils.js        # Sanitización XSS/URLs, fechas locales y utilidades
│       ├── booking.js          # Lógica del portal cliente y asistente de reservas
│       ├── admin.js            # Lógica del panel de administración y reportes
│       ├── supabase-client.js  # Inicialización del cliente Supabase
│       └── supabase-mock.js    # Emulador local automático en localhost
├── index.html                  # Vista principal de clientes
├── 404.html                    # Página de error personalizada
└── serve-local.js              # Servidor local Node.js (simulador Jekyll + mock API)
```

---

## Ejecución en Local

El proyecto incluye un servidor local ligero en Node.js que no requiere instalar Ruby/Jekyll:

```bash
node serve-local.js
```

Luego abre en el navegador:
- **Clientes:** `http://localhost:4000`
- **Staff / Admin:** `http://localhost:4000/admin/`

> En `localhost` o `127.0.0.1`, la app activa automáticamente el emulador local (`supabase-mock.js`) con datos de prueba sin afectar la base en producción. Para conectarte al Supabase real desde local, agrega `?real=1` a la URL.

---

## Despliegue en Producción (Supabase + GitHub Pages)

1. **Base de datos (Supabase):**
   - Ejecuta el script `supabase_schema.sql` en el **SQL Editor** de tu proyecto de Supabase (crea tablas `profiles`, `barbers`, `services`, `appointments`, `settings`, la función `get_busy_slots`, el bucket `logos` y las políticas RLS).
   - Configura `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `assets/js/supabase-client.js`.
2. **GitHub Pages:**
   - Verifica `url` y `baseurl` en `_config.yml`.
   - En tu repositorio de GitHub ve a **Settings → Pages → Build and deployment**, selecciona **Deploy from a branch** (`main` / `/ (root)`) y guarda los cambios.
