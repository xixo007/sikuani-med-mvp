# Sikuani Med Pro — prototipo de demostración

Maqueta navegable de una suite clínica para brigadas y puestos de salud de la Orinoquía: consulta bilingüe español–sikuani, triage Manchester con mapa corporal, sala de espera y exportación de registros.

Autor: Edisson Vega Izquierdo (ADSO).

## Estado real

- **Es una demostración.** La conversación en sikuani es simulada con cinco respuestas de ejemplo; no hay reconocimiento de voz, traducción ni síntesis de voz para sikuani.
- **El vocabulario sikuani no está validado** por hablantes ni por un lingüista. La app lo marca como «no validado» y no debe usarse para decisiones clínicas.
- El micrófono del profesional usa el reconocimiento de voz en español del navegador cuando está disponible; si no, también se simula y se rotula «SIMULADO».

## Cómo se ejecuta

Es HTML, CSS y JavaScript, sin instalación: la única librería, three.js, viene incluida en `vendor/`. Debe servirse por `http://localhost` o `https://` (el cifrado y el modo sin conexión no funcionan abriendo el archivo directamente):

```bash
python -m http.server 8000
```

Abrir `http://localhost:8000`. La primera vez pide crear un PIN.

## Datos y privacidad

- Los registros de pacientes se guardan **cifrados** en el navegador (AES-GCM de 256 bits; clave derivada del PIN con PBKDF2-SHA-256, 250.000 iteraciones). El PIN no se guarda: si se olvida, los datos no se pueden recuperar (botón «Olvidé el PIN» borra todo).
- Si había datos de una versión anterior en texto plano, se cifran al crear el PIN y se borra la copia sin cifrar.
- «Usar sin guardar» abre la app solo en memoria, para demostraciones.
- Los archivos exportados (CSV/JSON) **no van cifrados**.

## Sin conexión (PWA)

`manifest.webmanifest` y `sw.js` permiten instalar la app y abrirla sin red después de la primera visita. El service worker usa red primero y caché como respaldo; al publicar una versión nueva, cambiar `VERSION` en `sw.js`.

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura, datos de ejemplo embebidos y diálogo de PIN |
| `styles.css` | Estilos; las correcciones de interfaz están en el bloque final «CORRECCIONES DE INTERFAZ» |
| `app.js` | Lógica de la app |
| `cifrado.js` | Bóveda local cifrada (`window.BovedaLocal`) |
| `tema-vega.css` | Tema visual «Vega al atardecer» (paleta arena, tinta, terracota y musgo; contraste ≥ 4,5:1), definido con las skills de diseño de `D:/diseñador_web` por la colmena de diseño |
| `fuentes/` | Epilogue (licencia OFL 1.1), incluida para funcionar sin internet |
| `cuerpo3d.js` | Mapa corporal 3D: cuerpo realista que se gira con el dedo; tocar una zona la selecciona en la ficha de triage. Vista de esqueleto y cuerpo de hombre o mujer |
| `modelos/` | `cuerpo_hombre.glb`, `cuerpo_mujer.glb` (seis zonas anatómicas tocables) y `esqueleto.glb`, de Human Base Meshes v1.4.1 de Blender Studio (licencia CC0) |
| `vendor/three/` | three.js r180 (licencia MIT) copiado dentro de la app para que funcione sin internet |
| `sw.js`, `manifest.webmanifest`, `iconos/` | Instalación y uso sin conexión |

Pendiente de decidir por el autor: la licencia del código.
