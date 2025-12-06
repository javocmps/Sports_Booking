# Usar la imagen oficial de Playwright (incluye Node.js y navegadores)
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de definición de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar el resto del código
COPY . .

# Comando por defecto (esto permite correr el contenedor manualmente o via cron)
# Nota: En entornos de nube reales, usualmente se define el comando en el dashboard del servicio
CMD ["node", "booking_agent.js"]
