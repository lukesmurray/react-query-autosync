/**
 * Options used to control auto save function debounced with `lodash.debounce`
 */

export interface AutoSaveOptions {
  /**
   * Number of milliseconds to delay the debounce function
   */
  wait: number;
  /**
   * Maximum number of milliseconds to delay the debounce function. If undefined
   * there is no maximum delay.
   */
  maxWait?: number;
}
