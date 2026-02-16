/**
 * SynergyCarbon Console Kit — Entry Point
 *
 * Bootstraps the Console Kit deployment with:
 * - EStreamThemeProvider (branding.yaml → CSS custom properties)
 * - WidgetGrid layout
 * - Spark wire protocol authentication
 * - ESLite WASM local storage
 * - Widget registration
 */

export { App } from './App';
export { WIDGET_CATALOG } from './widgets';
export { ESLITE_SCHEMAS } from './eslite/schemas';
export { LEX_TOPICS } from './types';
export type * from './types';
