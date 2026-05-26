# Tengo-Hambre 🍔🥗 (SaaS para Restaurantes, POS & Menú Digital)

Bienvenido a **Tengo-Hambre**, una plataforma SaaS multitenant premium y de última generación diseñada específicamente para la modernización de restaurantes, cafeterías, bares y negocios de comida. 

Esta aplicación integra en un solo lugar un sistema de **Punto de Venta (POS)**, **Control de Caja y Finanzas**, **Control de Inventario**, **Menú Digital PWA para Pedidos por WhatsApp**, **Generación de Facturas y Cotizaciones**, **Programa de Lealtad (CRM)**, **Blog integrado** y **Métricas de Analítica en Tiempo Real**.

La aplicación en producción se puede visualizar y probar en: [https://tengo-hambre.com/](https://tengo-hambre.com/)

---

## 🚀 Características Principales

### 🏢 1. Arquitectura SaaS / Multitenant
* **Registro de Negocios Independientes:** Cualquier restaurante puede registrarse directamente desde la plataforma (`/register`), lo que le crea un perfil único (`Business`) y una cuenta de usuario administrador.
* **Espacios Personalizados:** Cada restaurante obtiene un subdominio/slug amigable de acceso directo para sus clientes (por ejemplo: `tengo-hambre.com/buffalucas`).

### 📱 2. Menú Digital PWA e Integración con WhatsApp
* **PWA (Progressive Web App):** Interfaz ultra-rápida, fluida y totalmente responsiva diseñada para dispositivos móviles. Los clientes pueden escanear un código QR en la mesa y acceder al menú al instante sin descargar aplicaciones de tiendas.
* **Pedidos por WhatsApp:** Los clientes añaden productos al carrito, seleccionan método de entrega (mesa, recoger, a domicilio con validación de colonias/municipios) y envían el pedido. La PWA procesa el pedido en base de datos y genera automáticamente un mensaje estructurado y listo para enviar por WhatsApp al número del comercio.

### 💻 3. Punto de Venta (POS) & Control de Caja (Finanzas)
* **Apertura y Cierre de Caja:** Gestión de turnos de caja (`CashShift`) para cajeros y personal de servicio.
* **Control de Flujo:** Registro de ingresos, retiros de efectivo, arqueos de caja y ventas en tiempo real, garantizando transparencia financiera.
* **Panel de Pedidos en Vivo:** Dashboard interactivo para que la cocina o el administrador reciba, prepare y despache los pedidos.

### 📦 4. Gestión de Catálogo e Inventario
* **Productos y Precios:** Control detallado de productos con stock, precios de venta, imágenes y estado de disponibilidad.
* **Categorías Dinámicas:** Categorización del menú por secciones (ej. Entradas, Bebidas, Platos Fuertes).
* **Complementos y Modificadores (Add-ons):** Permite añadir opciones extras a los platos (ej. "Término de la carne", "Ingredientes extra", "Tamaño").

### 📋 5. Cotizaciones y Facturación
* **Módulo de Cotizaciones:** Herramienta ágil para generar y enviar presupuestos formales a clientes corporativos o eventos especiales.
* **Generación de Documentos:** Creación de registros de facturación e historial de ventas detallado.

### 🏆 6. Programa de Fidelización (Loyalty Program)
* **CRM de Clientes:** Registro automático de clientes frecuentes.
* **Sistema de Puntos:** Los clientes acumulan puntos por sus compras que pueden canjear en futuras visitas, incrementando la retención del restaurante.

### 📈 7. Analíticas & Reportes
* **Dashboard Estadístico:** Gráficos intuitivos del rendimiento financiero diario, semanal y mensual.
* **Métricas de Visitas:** Registro inteligente de visitas únicas al menú digital (`Visit`) versus conversiones en pedidos finales, ayudando al restaurante a optimizar su embudo de ventas.

---

## 🛠️ Tecnologías Utilizadas

La arquitectura del proyecto está construida bajo el enfoque **MVC (Modelo-Vista-Controlador)** utilizando tecnologías modernas y de alto rendimiento:

* **Backend:** Node.js con Express.js para la creación de la API REST.
* **Base de Datos:** MongoDB utilizando Mongoose como ODM.
* **Autenticación:** JSON Web Tokens (JWT) para sesiones seguras y `bcryptjs` para la encriptación de contraseñas.
* **Carga de Archivos:** `multer` para la subida fluida de imágenes de productos, banners y logos.
* **Notificaciones:** Integración opcional con la API de `twilio` para mensajería automatizada.
* **Frontend:** HTML5, CSS3 (diseño moderno y estilizado) y JavaScript (Vanilla y frameworks ligeros para inyección de datos dinámicos). Panel Administrativo desarrollado como SPA (Single Page Application).

---

## 📁 Estructura del Proyecto

A continuación se detalla la organización del código fuente:

```bash
menu-digital/
├── server.js               # Archivo de inicio del servidor y configuración de Express
├── package.json            # Dependencias del proyecto y scripts de inicio
├── .env                    # Configuración de variables de entorno (sensible)
├── .gitignore              # Archivos y directorios excluidos en Git
│
├── controllers/            # Controladores con la lógica de negocio de la API
│   ├── authController.js       # Autenticación de usuarios (Registro, Login)
│   ├── saasController.js       # Gestión multitenant y administración de negocios
│   ├── productController.js    # CRUD de productos e inventario
│   ├── categoryController.js   # Categorías del menú de cada restaurante
│   ├── addonController.js      # Complementos / Modificadores de platos
│   ├── orderController.js      # Recepción, estados y gestión de pedidos
│   ├── financeController.js    # Gestión de cajas chicas, aperturas/cierres (turnos)
│   ├── QuoteController.js      # Creación y gestión de cotizaciones
│   ├── loyaltyController.js    # Programa de lealtad y puntos
│   ├── analyticsController.js  # Procesamiento de visitas y métricas
│   └── ...
│
├── models/                 # Modelos de datos definidos con esquemas Mongoose
│   ├── Business.js             # Datos de cada comercio/restaurante registrado
│   ├── User.js                 # Credenciales, roles y permisos de personal
│   ├── Product.js              # Atributos, stock y precio del platillo
│   ├── Category.js             # Categoría de menú
│   ├── Addon.js                # Opciones extras de los productos
│   ├── Order.js                # Registro de transacciones y pedidos de clientes
│   ├── CashShift.js            # Turnos y control de flujo de caja (POS)
│   ├── Customer.js             # Perfil del cliente final (CRM)
│   ├── LoyaltyProgram.js       # Reglas y balance de puntos
│   ├── Visit.js                # Log de visitas para analítica
│   └── ...
│
├── routes/                 # Enrutadores que mapean endpoints de la API REST
│   ├── auth.js                 # Rutas de autenticación
│   ├── saas.js                 # Rutas de administración global
│   ├── public.js               # Rutas públicas (menú digital sin auth)
│   └── ...
│
├── middleware/             # Funciones intermediarias
│   └── auth.js                 # Middleware para verificar tokens JWT y proteger rutas
│
├── helper/                 # Utilidades generales y helpers
│
├── public/                 # Archivos estáticos accesibles directamente
│   ├── css/                    # Estilos globales y layouts
│   ├── js/                     # Scripts generales
│   └── uploads/                # Imágenes subidas de productos y logos de comercios
│
└── views/                  # Vistas HTML de la aplicación
    ├── admin/                  # Dashboard SPA para administradores de restaurantes
    │   └── index.html              # Panel de administración integral
    └── frontend/               # Vistas para el cliente final y visitantes
        ├── index.html              # Landing page comercial de Tengo-Hambre
        ├── register.html           # Formulario de registro de nuevos restaurantes
        ├── menu.html               # Aplicación del menú digital (PWA de mesa/pedidos)
        └── blog.html               # Vista del blog de la plataforma
```

---

## ⚙️ Configuración del Entorno (`.env`)

Para hacer funcionar la aplicación, debes crear un archivo llamado `.env` en la raíz del proyecto. Este archivo contendrá las credenciales y accesos necesarios. A continuación, tienes una plantilla con las variables obligatorias y opcionales:

```env
# Puerto del servidor local (Por defecto 3000)
PORT=3000

# URI de Conexión de MongoDB (Local o Atlas en la Nube)
MONGO_URI="mongodb://localhost:27017/menu_digital"

# Llave secreta para la firma y verificación de tokens JWT (Usa un texto seguro)
JWT_SECRET="mi_clave_secreta_super_segura"

# Configuración de Twilio para notificaciones por WhatsApp / SMS (Opcional)
TWILIO_ACCOUNT_SID="TU_TWILIO_ACCOUNT_SID"
TWILIO_AUTH_TOKEN="TU_TWILIO_AUTH_TOKEN"
TWILIO_PHONE_NUMBER="TU_NUMERO_TELEFONICO_TWILIO"
```

---

## 🛠️ Instalación y Puesta en Marcha

Sigue estos pasos detallados para ejecutar la aplicación en tu entorno local de desarrollo:

### 1. Requisitos Previos
Asegúrate de tener instalado en tu sistema:
* **Node.js** (Versión 16.x, 18.x o superior recomendada). [Descargar Node.js](https://nodejs.org/)
* **MongoDB** (Instalación local corriendo en el puerto por defecto `27017` o una cuenta en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)).

### 2. Clonar e Instalar Dependencias
Abre tu terminal en el directorio del proyecto y ejecuta:

```bash
# 1. Instala todas las dependencias requeridas del backend
npm install
```

### 3. Configurar Entorno
Copia o renombra el archivo `.env.example` (o crea uno nuevo llamado `.env`) en la raíz del proyecto y completa las variables de entorno de acuerdo con tu configuración local o de base de datos como se detalla en la sección de [Configuración de Entorno](#-configuración-del-entorno-env).

### 4. Iniciar la Aplicación

Ofrecemos dos comandos principales para correr el servidor Express:

* **Modo Producción / Estándar:**
  ```bash
  npm start
  ```
  *Inicia el servidor en el puerto configurado utilizando `node server.js`.*

* **Modo Desarrollo (Recarga Automática):**
  Si estás utilizando una versión de Node.js v18.11 o superior, puedes aprovechar la recarga automática integrada en Node sin instalar dependencias adicionales:
  ```bash
  npm run dev
  ```
  *(Equivale a `node --watch server.js`. Si utilizas una versión anterior de Node, puedes instalar `nodemon` de forma global con `npm install -g nodemon` y ejecutar `nodemon server.js`).*

---

## 🖥️ Flujo de Operación (¿Cómo usar el sistema?)

Una vez que el servidor esté corriendo en `http://localhost:3000`, puedes experimentar el ecosistema completo siguiendo este flujo:

### Paso 1: Registro del Comercio
1. Dirígete a `http://localhost:3000/register`.
2. Completa los datos del restaurante (Nombre, Teléfono, Tipo de comida, Correo y Contraseña).
3. Esto registrará el negocio (`Business`) y creará el usuario administrador asignado a dicho negocio.

### Paso 2: Configuración en el Panel de Administración (POS / Inventario)
1. Inicia sesión en `http://localhost:3000/admin`.
2. **Crear Categorías:** Ve al apartado de Categorías y crea opciones como *Hamburguesas, Bebidas, Postres*.
3. **Cargar Complementos:** Agrega opciones opcionales para tus productos (ej: *Papas extras, Queso cheddar*).
4. **Agregar Productos:** Registra tus platillos, asigna precio, stock, asócialos a una categoría y sube una fotografía.
5. **Configuración del Negocio:** En los ajustes de la tienda, define los horarios de atención, el número de teléfono para recibir los pedidos de WhatsApp, y las zonas o municipios de entrega a domicilio.
6. **Manejo de POS (Caja):** Inicia un turno de caja (`CashShift`) ingresando el saldo inicial para comenzar a facturar o recibir pedidos en mesa.

### Paso 3: Menú Digital para Clientes
1. Accede al menú de tu restaurante a través del slug creado. Por ejemplo: `http://localhost:3000/buffalucas` (donde *buffalucas* es el identificador de tu negocio).
2. Agrega los platillos al carrito, selecciona tus complementos.
3. Haz clic en **Realizar Pedido**.
4. Elige si tu orden es para **Mesa**, **Recoger en Tienda** o **Entrega a Domicilio** (con cobertura según tu configuración).
5. Al confirmar, el pedido se guardará en la base de datos para la analítica del restaurante, y se abrirá una ventana de WhatsApp con un mensaje formateado con el desglose total de tu compra y tu dirección, permitiendo enviar la orden directamente al teléfono del comercio con un solo toque.

---

## 📈 Despliegue en la Nube

Para llevar este SaaS a un entorno de producción como en [https://tengo-hambre.com/](https://tengo-hambre.com/):

1. **Base de Datos:** Configura un clúster en **MongoDB Atlas** y reemplaza la cadena en `MONGO_URI`.
2. **Alojamiento:** Puedes desplegar en servicios PaaS como **Render**, **Railway**, o **Heroku** simplemente conectando el repositorio de GitHub.
3. **Servidor Virtual (VPS):** Si usas un VPS (como DigitalOcean, AWS EC2, Linode):
   * Instala **Node.js** y **MongoDB**.
   * Usa un gestor de procesos como **PM2** para mantener el servicio activo 24/7:
     ```bash
     npm install -g pm2
     pm2 start server.js --name "tengo-hambre-api"
     pm2 startup
     pm2 save
     ```
   * Configura **Nginx** como proxy inverso para redirigir el tráfico del puerto 80/443 al puerto de Express (ej. 3000) y añade certificados SSL gratuitos con **Certbot (Let's Encrypt)**.

---

## 📄 Licencia

Este proyecto está bajo la Licencia **ISC**. Siéntete libre de modificar, colaborar y adaptarlo para las necesidades de tu negocio.

---

*¡Desarrollado con mucho ☕ y 🍕 para transformar la digitalización gastronómica! Si tienes alguna duda o sugerencia, no dudes en contactar al equipo de soporte de Tengo-Hambre.*
