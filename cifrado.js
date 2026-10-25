/* Bóveda local cifrada: los registros clínicos se guardan cifrados con AES-GCM
   usando una clave derivada del PIN (PBKDF2-SHA-256). El PIN y la clave nunca
   se guardan; si se olvida el PIN, los datos no se pueden recuperar. */
(function () {
  const CLAVE_BOVEDA = "sikuani-med-boveda-v1";
  const ITERACIONES = 250000;
  const TESTIGO = "sikuani-med-ok";
  const cod = new TextEncoder();
  const dec = new TextDecoder();
  let clave = null;

  const aB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const deB64 = (txt) => Uint8Array.from(atob(txt), (c) => c.charCodeAt(0));

  function disponible() {
    return Boolean(window.crypto && window.crypto.subtle && window.isSecureContext);
  }

  async function derivar(pin, sal) {
    const base = await crypto.subtle.importKey("raw", cod.encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: sal, iterations: ITERACIONES, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async function cifrar(k, texto) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const datos = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, cod.encode(texto));
    return { iv: aB64(iv), datos: aB64(datos) };
  }

  async function descifrar(k, sobre) {
    const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(sobre.iv) }, k, deB64(sobre.datos));
    return dec.decode(plano);
  }

  function leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE_BOVEDA) || "null"); } catch { return null; }
  }

  window.BovedaLocal = {
    disponible,
    existe: () => Boolean(leer()),
    abierta: () => Boolean(clave),
    async crear(pin) {
      const sal = crypto.getRandomValues(new Uint8Array(16));
      clave = await derivar(pin, sal);
      const registro = { version: 1, sal: aB64(sal), iteraciones: ITERACIONES, testigo: await cifrar(clave, TESTIGO), registros: null };
      localStorage.setItem(CLAVE_BOVEDA, JSON.stringify(registro));
    },
    async abrir(pin) {
      const registro = leer();
      if (!registro) throw new Error("No hay bóveda creada.");
      const k = await derivar(pin, deB64(registro.sal));
      try {
        if ((await descifrar(k, registro.testigo)) !== TESTIGO) throw new Error();
      } catch {
        throw new Error("PIN incorrecto.");
      }
      clave = k;
    },
    async cargar() {
      const registro = leer();
      if (!clave || !registro || !registro.registros) return null;
      return JSON.parse(await descifrar(clave, registro.registros));
    },
    async guardar(valor) {
      const registro = leer();
      if (!clave || !registro) throw new Error("La bóveda está cerrada.");
      registro.registros = await cifrar(clave, JSON.stringify(valor));
      localStorage.setItem(CLAVE_BOVEDA, JSON.stringify(registro));
    },
    cerrar() { clave = null; },
    borrarTodo() { clave = null; localStorage.removeItem(CLAVE_BOVEDA); },
  };
})();
