/* Motor de traducción.
   Contrato: Motor.traducir(texto, origen, destino) -> Promise<Resultado>
     Resultado = { tipo: "frase" | "palabras" | "ninguna", texto, fonetica, palabras: [{origen, destino, fonetica}], confianza }
   Hoy usa el vocabulario de ejemplo (sin validar). El modelo real del proyecto debe exponer
   este mismo contrato para reemplazar a MotorEjemplo sin tocar la interfaz. */
(function () {
  const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:"«»()]/g, " ").replace(/\s+/g, " ").trim();
  const tokens = (t) => normalizar(t).split(" ").filter((p) => p.length > 2);

  function similitud(a, b) {
    const A = new Set(tokens(a)), B = new Set(tokens(b));
    if (!A.size || !B.size) return 0;
    let comunes = 0;
    A.forEach((p) => { if (B.has(p)) comunes += 1; });
    return comunes / Math.max(A.size, B.size);
  }

  function MotorEjemplo(datos) {
    const frases = datos.frases;
    const palabras = datos.palabras;

    function buscarFrase(texto, origen) {
      const n = normalizar(texto);
      let mejor = null, puntaje = 0;
      for (const f of frases) {
        const candidato = origen === "es" ? f.es : f.sik;
        if (normalizar(candidato) === n) return { frase: f, puntaje: 1 };
        const s = similitud(texto, candidato);
        if (s > puntaje) { mejor = f; puntaje = s; }
      }
      return puntaje >= 0.6 ? { frase: mejor, puntaje } : null;
    }

    function buscarPalabras(texto, origen) {
      const n = " " + normalizar(texto) + " ";
      const candidatos = [];
      for (const p of palabras) {
        const claves = origen === "es" ? p.es : [p.sik];
        for (const clave of claves) {
          const pos = n.indexOf(" " + normalizar(clave) + " ");
          if (pos >= 0) candidatos.push({ origen: clave, destino: origen === "es" ? p.sik : p.es[0], fonetica: p.fon, pos, fin: pos + normalizar(clave).length + 1 });
        }
      }
      // las coincidencias largas ganan: «buenos días» no se repite como «días»
      candidatos.sort((a, b) => (b.fin - b.pos) - (a.fin - a.pos));
      const halladas = [];
      for (const c of candidatos) {
        if (!halladas.some((h) => c.pos < h.fin && h.pos < c.fin || h.destino === c.destino)) halladas.push(c);
      }
      return halladas.sort((a, b) => a.pos - b.pos);
    }

    return {
      nombre: "Vocabulario de ejemplo (sin validar)",
      async traducir(texto, origen) {
        if (!normalizar(texto)) return { tipo: "vacio" };
        const f = buscarFrase(texto, origen);
        if (f) {
          return origen === "es"
            ? { tipo: "frase", texto: f.frase.sik, fonetica: f.frase.fon, confianza: f.puntaje }
            : { tipo: "frase", texto: f.frase.es, fonetica: "", confianza: f.puntaje };
        }
        const p = buscarPalabras(texto, origen);
        if (p.length) return { tipo: "palabras", palabras: p, confianza: 0 };
        return { tipo: "ninguna", confianza: 0 };
      },
      sugerencias(origen) {
        return frases.map((f) => ({ texto: origen === "es" ? f.es : f.sik, categoria: f.cat }));
      },
    };
  }

  window.Motor = MotorEjemplo(window.DATOS_EJEMPLO);
  window.Motor.normalizar = normalizar;
})();
