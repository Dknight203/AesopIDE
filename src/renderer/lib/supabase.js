// src/renderer/lib/supabase.js
function ensureBridge() {
  if (!window.aesop || !window.aesop.supabase) {
    throw new Error("AesopIDE bridge not available (supabase).");
  }
}

export async function testSupabase() {
  ensureBridge();
  return await window.aesop.supabase.test();
}
