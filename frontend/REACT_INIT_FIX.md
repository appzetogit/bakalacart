# React Initialization Error Fix - Complete Guide

## Problem
**Error:** `Uncaught ReferenceError: can't access lexical declaration 'React' before initialization`

This error occurs when React is accessed before it's fully initialized, typically due to:
1. Incorrect chunk loading order in production builds
2. Temporal Dead Zone (TDZ) issues with const/let declarations
3. Circular dependencies involving React
4. Vite build configuration issues with code splitting

## Root Cause Analysis

### 1. **Chunk Loading Order Issue**
- The entry chunk (`index-*.js`) was loading before the `react-vendor` chunk
- React-dependent code executed before React was initialized
- Module preload hints don't guarantee execution order

### 2. **Temporal Dead Zone (TDZ) Error**
- React was declared with `const`/`let` in the bundle
- Code tried to access React before its declaration was hoisted
- Build configuration wasn't preventing TDZ issues

### 3. **Missing Explicit React Import**
- Modern React (17+) doesn't require explicit React import for JSX
- However, explicit import ensures proper initialization order
- Helps bundlers understand dependency relationships

## Solutions Implemented

### ✅ Fix 1: Explicit React Import in main.jsx
```javascript
// CRITICAL FIX: Import React explicitly first
import React from 'react'
import { StrictMode } from 'react'
// ... rest of imports
```
**Why:** Ensures React is imported first, establishing proper dependency order.

### ✅ Fix 2: React Vendor Chunk Configuration
```javascript
manualChunks: (id) => {
  const isReactCore = (
    id.includes('node_modules/react/') || 
    id.includes('node_modules/react-dom/') || 
    id.includes('node_modules/react-router/') ||
    // ... all React-related packages
  )
  if (isReactCore) {
    return 'react-vendor' // Single chunk for all React dependencies
  }
  // Also bundle React-dependent packages
  if (id.includes('sonner')) {
    return 'react-vendor' // Sonner uses React
  }
}
```
**Why:** Bundles all React-related code together, ensuring initialization order.

### ✅ Fix 3: Build Configuration Fixes
```javascript
generatedCode: {
  constBindings: false, // Use let/var instead of const to avoid TDZ issues
  objectShorthand: true,
},
hoistTransitiveImports: true, // Hoist React imports
keepNames: true, // Keep function names to prevent TDZ issues
```
**Why:** Prevents TDZ errors and ensures proper hoisting.

### ✅ Fix 4: React Plugin Configuration
```javascript
react({
  jsxRuntime: 'automatic',
  jsxImportSource: 'react',
  fastRefresh: true,
})
```
**Why:** Ensures proper JSX transformation and React initialization.

## Build & Deployment Commands

### Clean Build (Recommended)
```powershell
# Windows PowerShell
.\clean-build.ps1

# Or manually:
npm run build
```

### Clean Everything and Rebuild
```powershell
# Remove all caches
Remove-Item -Recurse -Force node_modules\.vite, dist

# Reinstall dependencies (if needed)
npm ci

# Build
npm run build
```

### Verify Build
```powershell
# Check if react-vendor chunk exists
Get-ChildItem dist\assets\js\react-vendor-*.js

# Check HTML for proper chunk order
Get-Content dist\index.html | Select-String "react-vendor"
```

## Server Configuration (Nginx)

### Cache Headers for Production
```nginx
# In your Nginx config
location /assets/ {
    # Cache static assets aggressively
    add_header Cache-Control "public, max-age=31536000, immutable";
    
    # But ensure HTML is not cached
    if ($request_uri ~* \.(html)$) {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}

# Ensure proper MIME types
location ~* \.(js|mjs)$ {
    add_header Content-Type "application/javascript; charset=utf-8";
}
```

### Clear Nginx Cache (if using proxy_cache)
```bash
sudo rm -rf /var/cache/nginx/*
sudo systemctl reload nginx
```

## Best Practices to Prevent This Issue

### 1. **Always Import React Explicitly in Entry Files**
```javascript
// ✅ Good
import React from 'react'
import { useState } from 'react'

// ❌ Avoid relying on automatic imports in entry files
// (though fine in components)
```

### 2. **Keep React in a Single Vendor Chunk**
- Never split React across multiple chunks
- Bundle all React-related packages together
- Ensure React loads before application code

### 3. **Use Proper Build Configuration**
- Set `constBindings: false` to avoid TDZ issues
- Enable `hoistTransitiveImports: true`
- Keep function names (`keepNames: true`) for better debugging

### 4. **Test Production Builds Locally**
```powershell
npm run build
npm run preview
# Test in browser, check console for errors
```

### 5. **Monitor Chunk Sizes**
- React vendor chunk should be ~200-300KB
- If larger, check for unnecessary dependencies
- If smaller, React might be split incorrectly

### 6. **Use Module Preload Hints**
- Vite automatically adds `<link rel="modulepreload">` tags
- These help browsers prioritize chunk loading
- But don't rely solely on them for execution order

## Debugging Production Builds

### Check Chunk Dependencies
```javascript
// In browser console after loading page
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('.js'))
  .forEach(r => console.log(r.name, r.duration))
```

### Verify React Initialization
```javascript
// In browser console
console.log('React version:', React.version)
console.log('React DOM:', typeof ReactDOM)
```

### Check for Circular Dependencies
```powershell
# Install madge if needed
npm install -g madge

# Check for circular dependencies
madge --circular --extensions js,jsx src/
```

## Troubleshooting

### Error Still Occurs After Fix
1. **Clear all caches:**
   ```powershell
   Remove-Item -Recurse -Force node_modules\.vite, dist
   npm ci
   npm run build
   ```

2. **Check for duplicate React installations:**
   ```powershell
   npm list react react-dom
   # Should show single version, all deduped
   ```

3. **Verify chunk order in HTML:**
   - `react-vendor-*.js` should be preloaded before `index-*.js`
   - Check browser Network tab for actual load order

4. **Check browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Clear browser cache completely
   - Test in incognito/private mode

### Build Fails
1. Check Node.js version (should be 18+)
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and `package-lock.json`, then `npm install`

### Chunk Loading Issues
1. Verify Nginx/server is serving files correctly
2. Check CORS headers if using CDN
3. Verify file paths match `dist/index.html` references

## Additional Resources

- [Vite Build Configuration](https://vite.dev/config/build-options.html)
- [Rollup Manual Chunks](https://rollupjs.org/configuration-options/#output-manualchunks)
- [React Production Build Issues](https://react.dev/learn/start-a-new-react-project#production-builds)
- [Temporal Dead Zone Explained](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let#temporal_dead_zone_tdz)

## Summary

The fix ensures:
1. ✅ React is explicitly imported first
2. ✅ All React code is in a single vendor chunk
3. ✅ Build configuration prevents TDZ errors
4. ✅ Proper hoisting and initialization order
5. ✅ Clean build process for reliable deployments

**After applying these fixes, always:**
1. Clean build cache
2. Rebuild production bundle
3. Test locally with `npm run preview`
4. Clear browser cache before testing production
5. Monitor browser console for any remaining errors
