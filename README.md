# Traductor Sikuani — prototipo de demostración

Traductor español ↔ sikuani que funciona en el celular, la tableta o el computador **sin conexión a internet**.

Autor del prototipo: Edisson Vega Izquierdo (ADSO).

## Estado real

- **Es una demostración.** Traduce solo 10 frases y 16 palabras de ejemplo. Ese vocabulario **no está validado** por hablantes sikuani ni por un lingüista, y la app lo indica en cada resultado.
- Si el texto no coincide con una frase de ejemplo, muestra las palabras sueltas que reconoce. Si tampoco hay palabras, lo dice. Nunca inventa una traducción.
- **Dictado:** en español usa el reconocimiento de voz del navegador cuando está disponible. En sikuani aún no hay dictado.
- **Escuchar:** en español usa una voz instalada en el equipo. En sikuani hace una lectura aproximada con esa misma voz, porque todavía no hay voz sikuani integrada.

El traductor real (modelos entrenados con un corpus validado por la comunidad) se describe en la propuesta del proyecto.

## Cómo se ejecuta

Es HTML, CSS y JavaScript sin dependencias. Debe servirse por `http://localhost` o `https://` para poder instalarse y funcionar sin conexión:

```bash
python -m http.server 8000
```

Después se abre `http://localhost:8000`. Tras la primera visita, la app abre aunque no haya red. Los navegadores la ofrecen para «Instalar».

## Arquitectura

| Archivo | Función |
|---|---|
| `index.html` | Estructura de la interfaz |
| `styles.css` | Diseño (modo claro y oscuro automáticos) |
| `app.js` | Interfaz: dirección de traducción, dictado, voz, copiar, favoritas y recientes |
| `motor.js` | Motor de traducción. Contrato `Motor.traducir(texto, origen, destino)` → `{ tipo, texto, fonetica, palabras, confianza }` |
| `datos.js` | Frases y palabras de ejemplo (sin validar) |
| `sw.js`, `manifest.webmanifest`, `iconos/` | Instalación y uso sin conexión. El service worker busca primero en la red y, si no hay, usa la caché. Cambiar `VERSION` en cada publicación |

Para conectar el modelo real basta con reemplazar el motor de ejemplo por otro que cumpla el mismo contrato. La interfaz no cambia.

## Privacidad

Lo que se escribe no sale del equipo. Favoritas y recientes se guardan solo en el navegador y se pueden borrar desde la app.

Pendiente de decidir por el autor: la licencia del código.
