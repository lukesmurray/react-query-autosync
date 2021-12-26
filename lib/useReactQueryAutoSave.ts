import debounce from "lodash.debounce";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, UseMutationOptions, UseMutationResult } from "react-query";
import { ReactQueryAutoSaveSaveStatus } from "./ReactQueryAutoSyncSaveStatus";
import { UseReactQueryAutoSyncDraftProvider } from "./UseReactQueryAutoSyncDraftProvider";
import { AutoSaveOptions, EmptyDebounceFunc, MergeFunc } from "./utils";

/**
 * Return type of UseReactQueryAutoSync
 */
export type UseReactQueryAutoSaveResult<TData, TMutationData, TMutationError, TMutationContext> = {
  /**
   * Function used to manually save the data to the server
   */
  save: () => void;
  /**
   * Function used to update server data. Be careful avoid modifying the draft
   * directly and instead set the draft to a copy.
   */
  setDraft: (data: TData | undefined) => void;
  /**
   * The current value of the data either locally modified or taken from the server.
   * May be undefined if the data is not yet loaded.
   */
  draft: TData | undefined;
  /**
   * The result of `useMutation`
   */
  mutationResult: UseMutationResult<TMutationData, TMutationError, TData, TMutationContext>;
  /**
   * The current save status of the query
   */
  saveStatus: ReactQueryAutoSaveSaveStatus;
};

/**
 * React hook which can be used to automatically save and update query data.
 */
export function useReactQueryAutoSave<
  TData = unknown,
  TMutationData = unknown,
  TMutationError = unknown,
  TMutationContext = unknown,
>({
  mutationOptions,
  autoSaveOptions,
  alertIfUnsavedChanges,
  merge,
  mutateEnabled = true,
  draftProvider = undefined,
}: {
  /**
   * mutationOptions passed to `useMutation`. Internally the hook uses
   * `onMutate`, `onError`, and `onSettled` to optimistically update the draft.
   */
  mutationOptions: UseMutationOptions<TMutationData, TMutationError, TData, TMutationContext>;
  /**
   * options passed to `lodash.debounce` to automatically save the query data to
   * the server with a debounced save function.  if undefined the hook will not
   * automatically save data to the server.
   */
  autoSaveOptions?: AutoSaveOptions;
  /**
   * Ask the user to confirm before leaving the page if there are local
   * modification to server data.  If false or undefined the user is allowed to
   * leave the page.
   */
  alertIfUnsavedChanges?: boolean;
  /**
   * function used to merge optimistic updates when saving to the server fails
   * and the user has made intermittent updates to the draft
   */
  merge?: MergeFunc<TData>;
  /**
   * boolean used to determine if the mutate function should be called, defaults to true
   */
  mutateEnabled?: boolean;
  /**
   * If you want to pass your own draft you can
   */
  draftProvider?: UseReactQueryAutoSyncDraftProvider<TData>;
}): UseReactQueryAutoSaveResult<TData, TMutationData, TMutationError, TMutationContext> {
  const [stateDraft, setStateDraft] = useState<TData | undefined>(undefined);
  const draft = draftProvider !== undefined ? draftProvider.draft : stateDraft;
  const setDraft = draftProvider !== undefined ? draftProvider.setDraft : setStateDraft;

  const [serverValue, setServerValue] = useState<TData | undefined>(undefined);

  // create a stable ref to the draft so we can memoize the save function
  const draftRef = useRef<TData | undefined>(undefined);
  draftRef.current = draft;

  // create a stable ref to the merge so we can memoize the merge effect
  const mergeRef = useRef<MergeFunc<TData> | undefined>(undefined);
  mergeRef.current = merge;

  // we provide options to useMutation that optimistically update our state
  const mutationResult = useMutation({
    ...mutationOptions,
    onMutate: async (draft) => {
      // Snapshot the last known server data
      const previousData = serverValue;
      // optimistically set our known server state to the new data
      setServerValue(draft);
      // optimistically clear our draft state
      setDraft(undefined);
      // Return a context object with the snapshotted value
      return {
        previousData,
        ...mutationOptions.onMutate?.(draft),
      } as any;
    },
    onError: (err, prevDraft, context) => {
      // if the user has not made any more local changes reset the draft
      // to last known state
      if (draft === undefined) {
        setDraft(prevDraft);
      } else {
        const mergeFunc = mergeRef.current;
        // if the user has defined a merge func merge the previous and current changes
        if (mergeFunc) {
          setDraft(mergeFunc(prevDraft, draft));
        } else {
          // rollback the draft to the last known state
          setDraft(prevDraft);
        }
      }
      return mutationOptions.onError?.(err, prevDraft, context);
    },
  });

  const { mutate } = mutationResult;

  const pendingSave = useRef(false);
  const mutateEnabledRef = useRef(mutateEnabled);
  mutateEnabledRef.current = mutateEnabled;

  // return a stable save function
  const save = useCallback(() => {
    if (draftRef.current !== undefined) {
      if (mutateEnabledRef.current === false) {
        pendingSave.current = true;
      } else {
        mutate(draftRef.current);
      }
    }
  }, [mutate]);

  // memoize a debounced save function
  const saveDebounced = useMemo(
    () =>
      autoSaveOptions?.wait === undefined
        ? EmptyDebounceFunc
        : debounce(save, autoSaveOptions?.wait, {
            // only pass maxWait to the options if maxWait is defined
            // if maxWait is undefined it is set to 0
            ...(autoSaveOptions?.maxWait !== undefined ? { maxWait: autoSaveOptions?.maxWait } : {}),
          }),
    [autoSaveOptions?.maxWait, autoSaveOptions?.wait, save],
  );

  // clean up saveDebounced on unmount to avoid leaks
  useEffect(() => {
    const prevSaveDebounced = saveDebounced;
    return () => {
      prevSaveDebounced.cancel();
    };
  }, [saveDebounced]);

  // call saveDebounced when the draft changes
  useEffect(() => {
    // check that autoSave is enabled and there are local changes to save
    if (autoSaveOptions?.wait !== undefined && draft !== undefined) {
      saveDebounced();
    }
  }, [saveDebounced, draft, autoSaveOptions?.wait]);

  // create a function which saves and cancels the debounced save
  const saveAndCancelDebounced = useMemo(
    () => () => {
      saveDebounced.cancel();
      save();
    },
    [save, saveDebounced],
  );

  // automatically save if we enable mutation and are pending a save
  if (mutateEnabledRef.current === true && pendingSave.current === true) {
    pendingSave.current = false;
    saveAndCancelDebounced();
  }

  // confirm before the user leaves if the draft value isn't saved
  useEffect(() => {
    const shouldPreventUserFromLeaving = draft !== undefined && alertIfUnsavedChanges;

    const alertUserIfDraftIsUnsaved = (e: BeforeUnloadEvent) => {
      if (shouldPreventUserFromLeaving) {
        // Cancel the event
        e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
        // Chrome requires returnValue to be set
        e.returnValue = "";
      } else {
        // the absence of a returnValue property on the event will guarantee the browser unload happens
        delete e["returnValue"];
      }
    };

    // only add beforeUnload if there is unsaved work to avoid performance penalty
    if (shouldPreventUserFromLeaving) {
      window.addEventListener("beforeunload", alertUserIfDraftIsUnsaved);
    }
    // document.addEventListener("visibilitychange", saveDraftOnVisibilityChange);
    return () => {
      if (shouldPreventUserFromLeaving) {
        window.removeEventListener("beforeunload", alertUserIfDraftIsUnsaved);
      }
      // document.removeEventListener("visibilitychange", saveDraftOnVisibilityChange);
    };
  }, [alertIfUnsavedChanges, draft, saveAndCancelDebounced]);

  const saveStatus: ReactQueryAutoSaveSaveStatus = mutationResult.isLoading
    ? "saving"
    : mutationResult.isError
    ? "error"
    : serverValue === draft
    ? "saved"
    : "unsaved";

  return {
    save: saveAndCancelDebounced,
    setDraft,
    draft,
    mutationResult,
    saveStatus,
  };
}
