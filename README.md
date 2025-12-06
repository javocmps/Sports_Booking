# 🏅 Sports Booking Agent

Este es un agente autónomo diseñado para automatizar la reserva de horas en centros deportivos (específicamente adaptado para Centros Deportivos Las Condes).

El agente está optimizado para ejecutarse diariamente de forma automática utilizando **GitHub Actions**, pero también puede ejecutarse localmente.

## 🚀 Características

- **Automatización Completa**: Inicia sesión, navega y reserva.
- **Configurable**: Define horarios, días de preferencia y servicios mediante variables de entorno.
- **Notificaciones**: Envía correos con capturas de pantalla del resultado (Éxito/Fallo).
- **Resilient**: Maneja errores de red, reintentos básicos y validaciones de disponibilidad.
- **Seguro**: Las credenciales nunca se guardan en el código.

## 🛠️ Configuración

### 1. Variables de Entorno (.env)
Este proyecto requiere ciertas variables para funcionar. Crea un archivo `.env` localmente (basado en `.env.example`) o configúralos en **GitHub Secrets** para la nube.

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `USER_EMAIL` | Tu RUT de usuario | `12345678-9` |
| `USER_PASSWORD` | Tu contraseña | `mypassword` |
| `TARGET_TIME` | Hora preferida a buscar | `19:00` |
| `FACILITY_NAME` | Nombre del recinto | `SPA CERRO APOQUINDO` |
| `SERVICE_NAME` | Nombre del servicio | `NATACIÓN BÁSICA` |
| `DAYS_OFFSET` | Días de anticipación para reservar | `7` (para reservar la próxima semana) |
| `ALLOWED_DAYS` | Días de la semana permitidos para reservar (0-6) | `2,3,5` (Mar, Mié, Vie) |
| `ENABLE_EMAIL` | Activar notificaciones | `true` |
| `EMAIL_USER` | Tu correo Gmail (remitente) | `tu@gmail.com` |
| `EMAIL_PASS` | [App Password](https://myaccount.google.com/apppasswords) de Gmail | `abcd 1234 ...` |
| `EMAIL_TO` | Correo destinatario | `me@gmail.com` |

### 2. Instalación Local

Si deseas probarlo en tu máquina:

```bash
# Instalar dependencias
npm install

# Instalar navegadores de Playwright
npx playwright install chromium

# Ejecutar el agente
node booking_agent.js
```

## ☁️ Ejecución en GitHub Actions

El proyecto ya incluye un flujo de trabajo configurado en `.github/workflows/schedule.yml`.

1. Sube este código a un repositorio de GitHub.
2. Ve a **Settings > Secrets and variables > Actions**.
3. Agrega todas las variables mencionadas arriba como "Repository secrets".
4. El agente correrá automáticamente todos los días a la hora configurada (por defecto 00:05 UTC).
5. Puedes ejecutarlo manualmente desde la pestaña **Actions > Run workflow**.

### Ver Resultados
Después de cada ejecución, ve a la sección **Artifacts** de la ejecución en GitHub para descargar las capturas de pantalla (`screenshots`) y verificar si la reserva fue exitosa.

## ⚠️ Notas Importantes
- **Zona Horaria**: GitHub Actions usa UTC. El cron `5 3 * * *` significa las 03:05 UTC, que corresponde a la noche en Chile (varía invierno/verano). Ajusta el cron en `schedule.yml` si necesitas otra hora.
- **Selectores**: Si la página cambia su diseño, es posible que los selectores CSS en `booking_agent.js` deban actualizarse.

---
Código optimizado y listo para producción.
