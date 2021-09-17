/* eslint-disable @typescript-eslint/no-empty-function */

/**
 * Empty function used to avoid the overhead of `lodash.debounce` if autoSaveOptions are not used.
 */
export const EmptyDebounceFunc = Object.assign(() => {}, {
  flush: () => {},
  cancel: () => {},
});
