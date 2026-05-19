# Negotiator AI - Documentación del proyecto

## Descripción general

`negotiator-ai` es una aplicación web construida con Next.js 16 y React 19 que simula un marketplace de productos con negociación asistida por inteligencia artificial. La app permite a los vendedores publicar productos, a los compradores enviar ofertas y al sistema sugerir decisiones basadas en métricas, urgencia y comportamiento de negociación.

## Arquitectura general

- `app/`: contiene las páginas principales y rutas de servidor (`route.ts`) del proyecto.
- `components/`: componentes UI reutilizables como la barra de navegación, charts y modales.
- `lib/`: utilidades de conexión a Supabase y helpers comunes.
- `public/`: activos estáticos.
- `README.md`: plantilla básica de Next.js.

## Dependencias clave

- `next`, `react`, `react-dom`: stack principal de la aplicación.
- `@supabase/auth-helpers-nextjs`, `@supabase/ssr`, `@supabase/supabase-js`: integración con Supabase para autenticación, base de datos y realtime.
- `chart.js`, `react-chartjs-2`, `recharts`: visualización de datos en el dashboard.
- `tailwindcss`, `@tailwindcss/postcss`: estilos y utilidades CSS.

## Variables de entorno

La aplicación requiere al menos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_BUCKET` (opcional, usado para subir imágenes)

## Flujo de páginas

### `app/page.tsx`
Página de inicio con descripción del producto y enlaces hacia la tienda, el formulario de publicación y el dashboard.

### `app/create/page.tsx`
Formulario de creación de producto que:
- valida sesión de usuario
- sube imagen a Supabase Storage
- crea un registro en `deals`
- inserta los términos de negociación en `deal_terms`
- crea mensajes iniciales en `messages`
- opcionalmente genera un token para el vendedor en `deal_participants`

### `app/shop/page.tsx`
Página de catálogo donde se muestra el listado de `deals` activos y negociaciones. Permite buscar por título/descripción y filtrar por estado.

### `app/dashboard/page.tsx`
Dashboard de usuario con métricas de ventas y negociaciones:
- productos publicados
- ingresos
- ofertas recibidas
- gráficos de ventas y top productos
- actualiza datos en tiempo real con canales de Supabase Realtime.

### `app/deal/[id]/page.tsx`
Detalle de una negociación específica. Aquí se muestran:
- información del producto
- estado del trato
- ofertas disponibles
- mensajes y recomendaciones de IA
- cálculo de probabilidad de cierre y contraofertas sugeridas

## Componentes principales

### `components/AppNavbar.tsx`
Barra de navegación global con:
- enlaces a tienda, productos propios, ofertas, dashboard y login
- botón de logout
- indicador de notificaciones en tiempo real
- estado de sesión de Supabase

### `components/DashboardCharts.tsx`
Renderiza gráficos de ventas y ofertas (probablemente usando `chart.js` o `recharts`).

### `components/SalesAdvisor.tsx`
Componente que muestra recomendaciones de negociación basadas en heurísticas y datos de ofertas.

### `components/ImproveDescriptionModal.tsx` y `ImprovePriceModal.tsx`
Modales que probablemente permiten mejorar la descripción o el precio de un producto usando sugerencias automáticas.

## Utilidades y clientes Supabase

### `lib/supabaseClient.ts`
Cliente Supabase para uso en el navegador con la clave anónima.

### `lib/supabaseServer.ts`
Cliente seguro de Supabase que usa `SUPABASE_SERVICE_ROLE_KEY` para operaciones de servidor protegidas.

### `lib/requireAuth.ts`
Helper cliente para redirigir al usuario a `/login` si no está autenticado.

## Rutas API principales

La carpeta `app/api/` contiene rutas POST que ejecutan lógica de negocio en el servidor, especialmente operaciones de base de datos sensibles:

- `accept-counteroffer/route.ts`
- `accept-offer/route.ts`
- `archive-product/route.ts`
- `improve-description/route.ts`
- `improve-price/route.ts`
- `negotiate/route.ts`
- `offers/respond/route.ts`
- `propose/route.ts`
- `reactivate-product/route.ts`
- `reject-offer/route.ts`
- `sales-advisor/route.ts`
- `seller/update-min/route.ts`
- `seller-counteroffer/route.ts`
- `update-product/route.ts`
- `update-product-description/route.ts`
- `update-product-image/route.ts`
- `update-product-price/route.ts`

Estas rutas realizan acciones como:
- aceptar o rechazar ofertas
- actualizar estado de productos
- mejorar descripciones o precios usando IA heurística
- crear y responder ofertas
- reactivar publicaciones
- generar recomendaciones de venta

### Ejemplo: `app/api/accept-offer/route.ts`
Esta ruta:
- recibe `dealId` y `offerId`
- valida que el trato exista y no esté cerrado
- valida la oferta seleccionada
- actualiza el trato a `closed`
- marca la oferta aceptada y rechaza otras ofertas del mismo trato
- inserta mensajes de seguimiento para comprador y vendedor

## Modelo de datos inferido

El código usa al menos estas tablas de Supabase:

- `deals`
- `deal_terms`
- `offers`
- `messages`
- `deal_participants`
- `notifications`
- `users` (gestionado por Supabase Auth)

## Observaciones importantes

- El proyecto usa renderizado del lado del cliente en muchas páginas (`"use client"`).
- Se usa Supabase Realtime para actualizar contadores y dashboards en vivo.
- La aplicación usa estilos CSS personalizados y clases utilitarias, aunque también tiene Tailwind configurado.
- El `layout.tsx` envuelve todas las páginas con `AppNavbar`, lo que hace que la navegación y el estado de sesión sean globales.

## Cómo empezar

1. Instalar dependencias: `npm install`
2. Ejecutar localmente: `npm run dev`
3. Configurar las variables de entorno de Supabase.

---

Esta documentación cubre la estructura principal, las páginas clave y el comportamiento de negocio observado en el proyecto.
