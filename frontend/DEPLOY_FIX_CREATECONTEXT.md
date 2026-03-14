# Fix: createContext of undefined (ui-vendor error)

## Problem
Production shows: `Uncaught TypeError: can't access property "createContext" of undefined` in `ui-vendor-BveOUHkk.js`

## Cause
The old build split framer-motion and @radix-ui into a separate `ui-vendor` chunk that sometimes loaded before React, causing `React.createContext` to be undefined.

## Solution (already in vite.config.js)
React, framer-motion, and @radix-ui are now bundled into a single `react-vendor` chunk so UI libs always have React in scope.

## Deployment Steps

**CRITICAL: You must run a fresh build and deploy the new dist. The old `ui-vendor` chunk must be replaced.**

### 1. On your local machine (or CI)
```bash
cd frontend
npm run build
```

### 2. Deploy the new `frontend/dist` folder to production
- Copy the entire `frontend/dist` folder to your web server (e.g. nginx/html or similar)
- **Replace** the old dist completely - do not merge

### 3. Verify
- After deploy, the new build should have `react-vendor-*.js` (e.g. react-vendor-BrMrNnr2.js)
- There should be **no** `ui-vendor-*.js` file
- Clear browser cache or hard refresh (Ctrl+Shift+R) when testing

### If using git-based deploy
Ensure your deploy script runs:
```bash
cd frontend && npm install && npm run build
```
Then copies `frontend/dist/*` to the web root.
