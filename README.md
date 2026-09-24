# Zapatería Red — HTML, CSS y JavaScript puro

Esta versión es independiente de React y de cualquier framework. Incluye una tienda pública, detalle de producto, filtros, ordenamiento, enlace de compra por WhatsApp y un panel administrativo en una sola estructura de navegación para escritorio.

## Estructura

```text
index.html       Tienda pública
producto.html    Detalle de producto
admin.html       Panel administrativo
style.css        Diseño responsive y componentes visuales
catalog.js       Datos demo y formato de precios
app.js            Filtros, búsqueda, ordenamiento y tarjetas
product.js       Galería, tallas y WhatsApp
admin.js         Métricas, inventario, estados y modal
assets/          Imágenes de producto
schema.sql       Modelo de datos para MySQL/PostgreSQL
```

## Ejecutar

Abre `index.html` directamente en el navegador o utiliza un servidor local para evitar restricciones de archivos locales:

```bash
python3 -m http.server 8080
```

Después visita `http://localhost:8080`.

## Personalizar

Edita `catalog.js` para cambiar productos, precios, tallas, marcas, stock e imágenes. El número de WhatsApp se encuentra en `index.html` y `product.js`; reemplaza `5215555555555` por el número real con código de país. La identidad visual principal se controla desde las variables y reglas de `style.css`, especialmente el rojo `#dc2626`.

La versión entregada utiliza datos demo y acciones de administración en memoria del navegador. Para producción, conecta `admin.js` y `app.js` a una API backend y persiste productos, variantes, imágenes, usuarios administradores e inventario en la base de datos definida en `schema.sql`.

## Corrección del panel

El panel utiliza un único `aside.admin-sidebar` visible en escritorio. No hay un segundo menú lateral ni un componente de navegación duplicado; en pantallas pequeñas esa misma navegación pasa a una barra horizontal superior.
