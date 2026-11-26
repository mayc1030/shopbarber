// Configuración del Cliente de Supabase
// Reemplaza los siguientes valores con los de tu proyecto de Supabase.
// Puedes encontrarlos en: Settings > API en tu panel de Supabase.

window.SUPABASE_URL = "https://jcepgrxcokhipzzuepod.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZXBncnhjb2toaXB6enVlcG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODE0MTgsImV4cCI6MjA5NTY1NzQxOH0.phS5QxY5ueEpwYzrLEjDeHw5BoVs53C-eAwcaDh9xL4";

const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const forceRealSupabase = window.location.search.includes("real=1");

if (isLocalHost && !forceRealSupabase && window.MockSupabaseLib) {
  window.SupabaseLib = window.MockSupabaseLib;
  window.supabase = window.SupabaseLib.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  window.IS_MOCK_SUPABASE = true;
  console.info("🧪 Supabase MOCK local activado. (Agrega ?real=1 a la URL para usar Supabase real).");
} else {
  // Guardar referencia a la librería original
  window.SupabaseLib = window.supabase;

  // Inicializar el cliente principal
  window.supabase = window.SupabaseLib.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  window.IS_MOCK_SUPABASE = false;
  console.log("Supabase Client inicializado correctamente.");
}
