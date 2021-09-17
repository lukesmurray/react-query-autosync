import debounce from "lodash.debounce";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, UseMutationOptions, UseMutationResult } from "react-query";
import { AutoSaveOptions } from "./utils/AutoSaveOptions";
import { EmptyDebounceFunc } from "./utils/EmptyDebounceFunc";

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
  setDraft: React.Dispatch<React.SetStateAction<TData | undefined>>;
  /**
   * The current value of the data either locally modified or taken from the server.
   * May be undefined if the data is not yet loaded.
   */
  draft: TData | undefined;
  /**
   * The result of `useMutation`
   */
  mutationResult: UseMutationResult<TMutationData, TMutationError, TData, TMutationContext>;
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
}): UseReactQueryAutoSaveResult<TData, TMutationData, TMutationError, TMutationContext> {
  const [draft, setDraft] = useState<TData | undefined>(undefined);
  const [serverValue, setServerValue] = useState<TData | undefined>(undefined);

  // create a stable ref to the draft so we can memoize the save function
  const draftRef = useRef<TData | undefined>(undefined);
  draftRef.current = draft;

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
    onError: (err, draft, context) => {
      // reset the server state to the last known state
      setServerValue((context as any).previousData);
      // reset the draft to the last known draft unless the user made more changes
      if (draft !== undefined) {
        setDraft(draft as any);
      }
      return mutationOptions.onError?.(err, draft, context);
    },
  });

  const { mutate } = mutationResult;

  // return a stable save function
  const save = useCallback(() => {
    if (draftRef.current !== undefined) {
      mutate(draftRef.current);
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

  return {
    save: saveAndCancelDebounced,
    setDraft,
    draft,
    mutationResult,
  };
}
