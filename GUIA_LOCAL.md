# Guía de Ejecución Local y Emulador de Supabase

Esta guía resume cómo ejecutar y probar **Los Angeles Barber** en entorno local sin depender de la base de datos en producción.

---

## 1. Cómo iniciar el servidor local

Desde la raíz del proyecto (`shopbarber/`):

```bash
node serve-local.js
```

El servidor quedará disponible en:
- **App para clientes:** `http://localhost:4000`
- **Portal Staff / Admin:** `http://localhost:4000/admin/`

> **Nota:** El simulador local procesa automáticamente `_config.yml`, el frontmatter de cada página, `{% include ... %}`, `{% if site.* %}`, `{% seo %}` y `relative_url`.

---

## 2. Emulador Local de Supabase (Modo Mock)

Cuando abres el sitio desde `localhost` o `127.0.0.1`, el archivo `assets/js/supabase-client.js` activa automáticamente `MockSupabaseLib` (`assets/js/supabase-mock.js`):

- **Producción (GitHub Pages):** Al no estar en `localhost`, se conecta automáticamente al Supabase real sin usar el emulador.
- **Forzar Supabase real en local:** Agrega `?real=1` a la URL:
  - `http://localhost:4000/?real=1`
  - `http://localhost:4000/admin/?real=1`

### ¿Dónde se guardan los datos simulados?
- En el directorio temporal del sistema: `/tmp/losangelesbarber-mock/` (`db.json` y `storage/` para imágenes subidas).
- Con respaldo automático en `localStorage` del navegador (`shopbarber_mock_db_v2` y `shopbarber_mock_session_v2`).

---

## 3. Cuentas de Prueba Precargadas

Para iniciar sesión en `http://localhost:4000/admin/`:

### Super Administrador
- **Correo:** `juan@losangelesbarber.com` | **Contraseña:** `123456*`
- **Correo:** `admin@barberia.com` | **Contraseña:** `123456`

### Barberos Staff
- **Carlos Gómez:** `carlos@losangelesbarber.com` | **Contraseña:** `123456`
- **Sofía Martínez:** `sofia@losangelesbarber.com` | **Contraseña:** `123456`

### Datos iniciales incluidos
- **Servicios (3):** Corte de Cabello Tradicional (`$25.000`), Afeitado o Perfilado de Barba (`$18.000`), Combo Corte + Barba (`$38.000`).
- **Galería:** Imágenes locales `/assets/img/barber.png` y `/assets/img/barbera.png`.
- **Citas de ejemplo (4):** En estados `pending`, `scheduled` y `completed` para probar agenda, confirmación y reportes.

---

## 4. Cómo reiniciar los datos de prueba

Si deseas volver al estado inicial (datos semilla limpios):

1. Abre la consola del navegador (`F12` → **Console**) en `http://localhost:4000`.
2. Ejecuta:
   ```js
   await MockSupabaseLib.resetMockDb()
   ```
3. Recarga la página.

---

## 5. Recordatorios antes de publicar en producción

- Revisa que no queden credenciales o archivos temporales antes de hacer `git push` a un repositorio público (`git status`).
- Si vas a crear un proyecto nuevo en Supabase Cloud, ejecuta `supabase_schema.sql` (ya incluye `settings`, `barbers.login_email`, el bucket `logos`, el índice anti-doble-reserva y la función segura `get_busy_slots`).
