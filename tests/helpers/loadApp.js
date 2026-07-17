'use strict';
// Loads the inline <script> from index.html into a vm sandbox so we can call
// its functions directly, without a browser. The app has no build step, so
// this is the only way to unit-test logic that lives inside index.html.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function extractMainScript(html) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (scripts.length === 0) throw new Error('No inline <script> blocks found in index.html');
  // The main app script is the largest inline block (the version-badge IIFE is tiny).
  const main = scripts.sort((a, b) => b.length - a.length)[0];
  // Strip the trailing init() bootstrap call so loading the sandbox doesn't
  // try to touch a real DOM / hit the network.
  return main.replace(/\ninit\(\);\s*$/, '\n');
}

function makeFakeStorage() {
  const store = new Map();
  return {
    setItem: (k, v) => store.set(k, String(v)),
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    removeItem: (k) => store.delete(k),
  };
}

function makeFakeElement() {
  return {
    value: '', textContent: '', style: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(){}, appendChild(){}, querySelector(){ return null; }, querySelectorAll(){ return []; },
    setAttribute(){}, getAttribute(){ return null; }, disabled: false,
  };
}

function loadApp({ fetchImpl, confirmImpl } = {}) {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const src = extractMainScript(html);

  const fakeStorage = makeFakeStorage();
  const sandbox = {
    console,
    localStorage: fakeStorage,
    fetch: fetchImpl || (async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' })),
    confirm: confirmImpl || (() => true),
    alert: () => {},
    prompt: () => null,
    navigator: { share: undefined, vibrate: () => {} },
    window: {
      storage: {
        set: async () => {}, get: async () => null, delete: async () => {},
      },
      location: { href: '' },
      addEventListener(){},
    },
    document: {
      getElementById: () => makeFakeElement(),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener(){},
      createElement: () => makeFakeElement(),
      body: makeFakeElement(),
    },
    setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, parseFloat, parseInt, Number, String, Array, Object, isNaN,
  };
  sandbox.window.storage.set = sandbox.window.storage.set;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(src, context, { filename: 'index.html-inline-script.js' });
  return context;
}

module.exports = { loadApp, extractMainScript };
