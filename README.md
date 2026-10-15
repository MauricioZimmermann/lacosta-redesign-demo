# La Costa Vinoteca: demo de rediseño

Sitio demo estático y navegable para presentar al cliente (vinotecalacosta.com). No tiene build: abrí `index.html` en el navegador (Chrome o Edge).
**Ningún link sale al WordPress actual**: todas las secciones existen dentro de la demo.

## Páginas
| Archivo | Contenido |
|---|---|
| `index.html` | Home: hero con cota, cómo funciona, vitrina, cajas armadas, travesía, vinícolas, Wine Day, dónde retirar |
| `catalogo.html` | Catálogo con filtros (tipo, uva, vinícola, precio, colección), orden, búsqueda y URL compartible (`?tipo=tinto&uva=Malbec`) |
| `produto.html?id=…` | Ficha de producto: precio, preço cota, ficha técnica, relacionados |
| `vinicolas.html` | 66 vinícolas con buscador y A–Z |
| `travessia.html` | Horarios y estado en vivo de la balsa, tarifas, Lampalagua, calculadora y reglas de la Receita |
| `como-comprar.html` | 6 pasos + preguntas frecuentes |
| `precos.html` | Política de precios con ejemplo de cálculo |
| `guia-de-cata.html` | Guía de degustación (contenido del sitio actual) |

## Código
- `assets/js/core.js`: header, footer, carrito, búsqueda, aviso de edad, estado en vivo y WhatsApp simulado, compartidos por todas las páginas.
- `assets/js/catalog.js`: 224 productos reales y 66 vinícolas extraídos del sitio (oct/2026).
- `assets/js/home.js`, `catalogo.js`, `produto.js`: lógica de cada página.
- `assets/css/app.css`: tokens de diseño y todos los componentes.

## Comportamiento en la demo
- **WhatsApp:** enviar el pedido (o cualquier botón de WhatsApp) abre un chat simulado dentro del sitio, con una respuesta automática de la tienda. No se sale de la demo ni se le escribe a la tienda real; hay un botón opcional "Abrir no WhatsApp".
- Links externos que sí abren pestaña nueva: Instagram, Google Maps y Waze.
- El carrito y el aviso de edad se guardan en el navegador. Para repetir la demo desde cero: abrir en ventana privada.

## Reglas de negocio (verificadas contra el sitio actual)
- Precio mostrado = lista × 0,84 (−16%). **Preço cota** = lista × 0,80 (−20%), que se aplica desde 16 botellas.
- BRL = ARS / 310 (constante `RATE` en `core.js`).
- 16 botellas = 12 L = cota isenta por CPF de la Receita Federal.

## Placeholders para validar con el cliente
- Testimonios (marcados como ilustrativos), composición de las cajas armadas, tarifas de la balsa (guía 2025).
- Las fotos tienen la marca de agua "la costa": para producción hacen falta fotos limpias.
- Las descripciones de producto vienen tal cual de las bodegas (la mayoría en español).
