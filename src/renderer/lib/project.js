// src/renderer/lib/project.js
function ensureBridge() {
  if (!window.aesop || !window.aesop.project) {
    throw new Error("AesopIDE bridge not available (project).");
  }
}

export async function getRoot() {
  ensureBridge();
  return await window.aesop.project.getRoot();
}

export async function openFolderDialog() {
  ensureBridge();
  return await window.aesop.project.openFolder();
}
