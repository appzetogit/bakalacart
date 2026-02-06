/**
 * Helper function for dynamic imports with path alias support
 * Ensures Vite properly resolves @ alias in dynamic imports
 */

export function dynamicImport(path) {
  // In development, Vite should handle the alias, but sometimes needs explicit resolution
  // In production build, the alias is already resolved
  if (path.startsWith('@/')) {
    // Convert @/ to relative path from src
    const relativePath = path.replace('@/', './')
    return import(/* @vite-ignore */ relativePath)
  }
  return import(path)
}
