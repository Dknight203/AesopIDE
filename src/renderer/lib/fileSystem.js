// src/renderer/lib/fileSystem.js
function ensureBridge() {
  if (!window.aesop || !window.aesop.fs) {
    throw new Error("AesopIDE bridge not available (fs).");
  }
}

export async function readDirectory(relPath = ".") {
  ensureBridge();
  return await window.aesop.fs.readDir(relPath);
}

export async function readFile(relPath) {
  ensureBridge();
  return await window.aesop.fs.readFile(relPath);
}

export async function writeFile(relPath, content) {
  ensureBridge();
  return await window.aesop.fs.writeFile(relPath, content);
}

export async function newFile(relPath) {
  ensureBridge();
  return await window.aesop.fs.newFile(relPath);
}

export async function newFolder(relPath) {
  ensureBridge();
  return await window.aesop.fs.newFolder(relPath);
}

export async function deleteFile(relPath) {
  ensureBridge();
  return await window.aesop.fs.deleteFile(relPath);
}