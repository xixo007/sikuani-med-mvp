/* Traductor Sikuani — lógica de la interfaz. La traducción la hace window.Motor (motor.js). */
(function () {
  const $ = (s) => document.querySelector(s);
  const NOMBRE = { es: "Español", sik: "Sikuani" };
  const CLAVE_FAV = "traductor-sikuani-favoritas";
  const CLAVE_HIST = "traductor-sikuani-recientes";

  const entrada = $("#entrada"), resultado = $("#resultado"), acciones = $("#acciones"), etiqueta = $("#etiqueta");
  const bDictar = $("#dictar"), bBorrar = $("#borrar"), bEscuchar = $("#escuchar"), bCopiar = $("#copiar"), bGuardar = $("#guardar");
  const notaDictado = $("#nota-dictado");

  let origen = "es";
  let ultimo = null; // { origenTexto, texto, fonetica, origen, destino, tipo }
  let temporizador = 0;
  let temaActivo = "Todas";
  let reconocimiento = null;

  const destino = () => (origen === "es" ? "sik" : "es");
  const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  function toast(texto) {
    const t = $("#toast");
    t.textContent = texto;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.hidden = true; }, 2200);
  }

  // ---------- dirección
  function pintarDireccion() {
    $("#idioma-origen").textContent = NOMBRE[origen];
    $("#idioma-destino").textContent = NOMBRE[destino()];
    entrada.placeholder = origen === "es" ? "Escribe en español" : "Escribe en sikuani";
    entrada.lang = origen === "es" ? "es" : "guh";
    const puedeDictar = origen === "es" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    bDictar.disabled = !puedeDictar;
    bDictar.setAttribute("aria-label", origen === "es" ? "Dictar en español" : "Dictar en sikuani (aún no disponible)");
    notaDictado.hidden = origen === "es";
    notaDictado.textContent = "El dictado en sikuani llegará con el modelo de voz del proyecto.";
    pintarFrases();
  }

  $("#intercambiar").addEventListener("click", (e) => {
    const texto = ultimo && ultimo.tipo === "frase" ? ultimo.texto : "";
    origen = destino();
    e.currentTarget.classList.toggle("girando");
    entrada.value = texto;
    pintarDireccion();
    traducirAhora();
  });

  // ---------- traducción
  entrada.addEventListener("input", () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(traducirAhora, 250);
    actualizarContador();
  });
  entrada.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); traducirAhora(true); }
  });
  bBorrar.addEventListener("click", () => { entrada.value = ""; actualizarContador(); traducirAhora(); entrada.focus(); });

  function actualizarContador() {
    $("#contador").textContent = `${entrada.value.length} / 500`;
    bBorrar.hidden = !entrada.value;
  }

  async function traducirAhora(guardarEnHistorial = false) {
    const texto = entrada.value.trim();
    const r = await window.Motor.traducir(texto, origen, destino());
    resultado.replaceChildren();
    ultimo = null;
    acciones.hidden = true;
    if (r.tipo === "vacio") {
      resultado.append(el("p", "resultado-vacio", "La traducción aparecerá aquí."));
      return;
    }
    if (r.tipo === "frase") {
      const t = el("p", "traduccion", r.texto);
      t.lang = destino() === "sik" ? "guh" : "es";
      resultado.append(t);
      if (r.fonetica) {
        const f = el("p", "fonetica");
        f.append(el("b", "", "Se pronuncia"), document.createTextNode(r.fonetica));
        resultado.append(f);
      }
      ultimo = { origenTexto: texto, texto: r.texto, fonetica: r.fonetica, origen, destino: destino(), tipo: "frase" };
      etiqueta.textContent = r.confianza === 1 ? "Frase de ejemplo · sin validar" : "Frase parecida · sin validar";
      mostrarAcciones(true);
      if (guardarEnHistorial) agregarHistorial(ultimo);
      return;
    }
    if (r.tipo === "palabras") {
      resultado.append(el("p", "resultado-nota", "No hay una frase completa; estas son las palabras que reconozco:"));
      const ul = el("ul", "glosario");
      r.palabras.forEach((p) => {
        const li = el("li");
        li.append(el("span", "g-origen", p.origen));
        const d = el("span", "g-destino", p.destino);
        d.lang = destino() === "sik" ? "guh" : "es";
        li.append(d);
        if (destino() === "sik" && p.fonetica) li.append(el("span", "g-fon", p.fonetica));
        ul.append(li);
      });
      resultado.append(ul);
      const textoPalabras = r.palabras.map((p) => p.destino).join(" · ");
      ultimo = { origenTexto: texto, texto: textoPalabras, fonetica: r.palabras.map((p) => p.fonetica).join(" · "), origen, destino: destino(), tipo: "palabras" };
      etiqueta.textContent = "Palabras sueltas · sin validar";
      mostrarAcciones(false);
      return;
    }
    resultado.append(el("p", "sin-resultado", origen === "es"
      ? "Todavía no tengo esta frase. El traductor real aprenderá con miles de frases escritas por hablantes sikuani; mientras tanto, prueba una de las frases de ejemplo."
      : "No reconozco este texto en sikuani. Prueba una de las frases de ejemplo."));
  }

  function mostrarAcciones(conFavorito) {
    acciones.hidden = false;
    bGuardar.hidden = !conFavorito;
    bGuardar.setAttribute("aria-pressed", String(esFavorita(ultimo)));
    bEscuchar.setAttribute("aria-label", ultimo.destino === "sik" ? "Escuchar (lectura aproximada)" : "Escuchar la traducción");
  }

  function el(tag, clase = "", texto = "") {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto) n.textContent = texto;
    return n;
  }

  // ---------- voz
  bEscuchar.addEventListener("click", () => {
    if (!ultimo || !("speechSynthesis" in window)) { toast("Este equipo no tiene voz instalada."); return; }
    speechSynthesis.cancel();
    const sikuani = ultimo.destino === "sik";
    const u = new SpeechSynthesisUtterance(sikuani ? (ultimo.fonetica || ultimo.texto).replace(/-/g, "") : ultimo.texto);
    const voces = speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang));
    u.voice = voces.find((v) => v.localService) || voces[0] || null;
    u.lang = u.voice ? u.voice.lang : "es-CO";
    u.rate = sikuani ? 0.85 : 1;
    speechSynthesis.speak(u);
    if (sikuani) toast("Lectura aproximada con voz en español: aún no hay voz sikuani.");
  });

  bDictar.addEventListener("click", () => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R || origen !== "es") return;
    if (reconocimiento) { reconocimiento.stop(); return; }
    reconocimiento = new R();
    reconocimiento.lang = "es-CO";
    reconocimiento.interimResults = true;
    reconocimiento.onresult = (e) => {
      entrada.value = Array.from(e.results).map((x) => x[0].transcript).join(" ");
      actualizarContador();
      traducirAhora(e.results[e.results.length - 1].isFinal);
    };
    reconocimiento.onerror = () => toast("No se pudo usar el micrófono.");
    reconocimiento.onend = () => { bDictar.classList.remove("escuchando"); reconocimiento = null; };
    bDictar.classList.add("escuchando");
    reconocimiento.start();
  });

  // ---------- copiar y favoritas
  bCopiar.addEventListener("click", async () => {
    if (!ultimo) return;
    try { await navigator.clipboard.writeText(ultimo.texto); toast("Copiado"); } catch { toast("No se pudo copiar"); }
  });

  const idDe = (x) => `${x.origen}|${window.Motor.normalizar(x.origenTexto)}`;
  const esFavorita = (x) => Boolean(x) && leer(CLAVE_FAV).some((f) => idDe(f) === idDe(x));

  bGuardar.addEventListener("click", () => {
    if (!ultimo) return;
    let favs = leer(CLAVE_FAV);
    if (esFavorita(ultimo)) { favs = favs.filter((f) => idDe(f) !== idDe(ultimo)); toast("Quitada de favoritas"); }
    else { favs.unshift(ultimo); toast("Guardada en favoritas"); }
    escribir(CLAVE_FAV, favs.slice(0, 50));
    bGuardar.setAttribute("aria-pressed", String(esFavorita(ultimo)));
    pintarListas();
  });

  function agregarHistorial(x) {
    const h = leer(CLAVE_HIST).filter((i) => idDe(i) !== idDe(x));
    h.unshift(x);
    escribir(CLAVE_HIST, h.slice(0, 15));
    pintarListas();
  }
  $("#borrar-historial").addEventListener("click", () => { escribir(CLAVE_HIST, []); pintarListas(); });

  function pintarLista(ul, items, vacio) {
    ul.replaceChildren();
    if (!items.length) { const li = el("li", "lista-vacia", vacio); ul.append(li); return; }
    items.forEach((x) => {
      const li = el("li", "lista-item");
      const b = el("button", "abrir");
      b.type = "button";
      b.append(el("span", "l-origen", x.origenTexto), el("span", "l-destino", x.texto));
      b.addEventListener("click", () => abrir(x));
      li.append(b);
      ul.append(li);
    });
  }
  function pintarListas() {
    const hist = leer(CLAVE_HIST);
    pintarLista($("#favoritas"), leer(CLAVE_FAV), "Toca la estrella de una traducción para guardarla aquí.");
    pintarLista($("#historial"), hist, "Tus últimas traducciones aparecerán aquí.");
    $("#borrar-historial").hidden = !hist.length;
  }
  function abrir(x) {
    origen = x.origen;
    pintarDireccion();
    entrada.value = x.origenTexto;
    actualizarContador();
    traducirAhora();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- frases de ejemplo
  function pintarFrases() {
    const todas = window.Motor.sugerencias(origen);
    const temas = ["Todas", ...new Set(todas.map((f) => f.categoria))];
    const filtros = $("#filtros");
    filtros.replaceChildren();
    filtros.hidden = temas.length <= 2; // con un solo tema los filtros no aportan
    temas.forEach((t) => {
      const b = el("button", "filtro", t);
      b.type = "button";
      b.setAttribute("aria-pressed", String(t === temaActivo));
      b.addEventListener("click", () => { temaActivo = t; pintarFrases(); });
      filtros.append(b);
    });
    const ul = $("#frases");
    ul.replaceChildren();
    todas.filter((f) => temaActivo === "Todas" || f.categoria === temaActivo).forEach((f) => {
      const li = el("li");
      const b = el("button", "frase");
      b.type = "button";
      const t = el("span", "frase-texto", f.texto);
      if (origen === "sik") t.lang = "guh";
      b.append(t);
      if (temas.length > 2) b.append(el("span", "frase-tema", f.categoria));
      b.addEventListener("click", () => {
        entrada.value = f.texto;
        actualizarContador();
        traducirAhora(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      li.append(b);
      ul.append(li);
    });
  }

  // ---------- estado sin conexión
  function pintarEstado(listo) {
    const e = $("#estado");
    e.classList.toggle("listo", listo);
    $("#estado-texto").textContent = listo ? "Disponible sin conexión" : (navigator.onLine ? "En línea" : "Sin conexión");
    $("#estado-corto").textContent = listo ? "Sin red: listo" : (navigator.onLine ? "En línea" : "Sin red");
  }
  if ("serviceWorker" in navigator && window.isSecureContext && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).then(() => pintarEstado(true)).catch(() => pintarEstado(false));
  } else {
    pintarEstado(false);
  }
  window.addEventListener("online", () => pintarEstado(Boolean(navigator.serviceWorker && navigator.serviceWorker.controller)));
  window.addEventListener("offline", () => pintarEstado(Boolean(navigator.serviceWorker && navigator.serviceWorker.controller)));

  pintarDireccion();
  pintarListas();
  actualizarContador();
})();
