/**
 * The current save status of the query
 * - `loading` means the query is loading initial data
 * - `saving` means the query is saving local data to the server
 * - `saved` means the query and server are in sync
 * - `unsaved` means the local data has unsaved changed
 * - `error` means there was an error either saving or loading data
 */
export type ReactQueryAutoSyncSaveStatus = "loading" | "saving" | "saved" | "unsaved" | "error";

/**
 * Same as AutoSync but does not have a loading state.
 */
export type ReactQueryAutoSaveSaveStatus = "saving" | "saved" | "unsaved" | "error";
