// src/renderer/lib/git.js

function getGitBridge() {
  if (!window.aesop || !window.aesop.git) {
    console.error("[AesopIDE git] window.aesop.git is not available");
    throw new Error("Git bridge not available in renderer");
  }
  return window.aesop.git;
}

export async function gitStatus() {
  const git = getGitBridge();
  const res = await git.status();
  return res;
}

export async function gitCommit(message) {
  const git = getGitBridge();
  const res = await git.commit(message);
  return res;
}

export async function gitPush() {
  const git = getGitBridge();
  const res = await git.push();
  return res;
}

export async function gitPull() {
  const git = getGitBridge();
  const res = await git.pull();
  return res;
}
