import debounce from "lodash.debounce";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  QueryKey,
  useMutation,
  UseMutationOptions,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  UseQueryResult,
} from "react-query";
import { ReactQueryAutoSyncSaveStatus } from "./ReactQueryAutoSyncSaveStatus";
import { UseReactQueryAutoSyncDraftProvider } from "./UseReactQueryAutoSyncDraftProvider";
import { AutoSaveOptions } from "./utils/AutoSaveOptions";
import { EmptyDebounceFunc } from "./utils/EmptyDebounceFunc";
import { MergeFunc } from "./utils/MergeFunc";

/**
 * Return type of UseReactQueryAutoSync
 */
export type UseReactQueryAutoSyncResult<TQueryFnData, TQueryError, TMutationData, TMutationError, TMutationContext> = {
  /**
   * Function used to manually save the data to the server
   */
  save: () => void;
  /**
   * Function used to update server data. Be careful avoid modifying the draft
   * directly and instead set the draft to a copy.
   */
  setDraft: (data: TQueryFnData | undefined) => void;
  /**
   * The current value of the data either locally modified or taken from the server.
   * May be undefined if the data is not yet loaded.
   */
  draft: TQueryFnData | undefined;
  /**
   * The result of `useQuery`
   */
  queryResult: UseQueryResult<TQueryFnData, TQueryError>;
  /**
   * The result of `useMutation`
   */
  mutationResult: UseMutationResult<TMutationData, TMutationError, TQueryFnData, TMutationContext>;
  /**
   * The current save status of the query
   */
  saveStatus: ReactQueryAutoSyncSaveStatus;
};

/**
 * React hook which can be used to automatically save and update query data.
 */
export function useReactQueryAutoSync<
  TQueryFnData = unknown,
  TQueryError = unknown,
  TQueryKey extends QueryKey = QueryKey,
  TMutationData = unknown,
  TMutationError = unknown,
  TMutationContext = unknown,
>({
  queryOptions,
  mutationOptions,
  autoSaveOptions,
  merge,
  alertIfUnsavedChanges,
  mutateEnabled = true,
  draftProvider = undefined,
}: {
  /**
   * queryOptions passed to `useQuery`
   */
  queryOptions: UseQueryOptions<TQueryFnData, TQueryError, TQueryFnData, TQueryKey>;
  /**
   * mutationOptions passed to `useMutation`. Internally the hook uses
   * `onMutate`, `onError`, and `onSettled` to optimistically update the draft.
   */
  mutationOptions: UseMutationOptions<
    TMutationData,
    TMutationError,
    TQueryFnData, // input to mutate is the same as the output of the query
    TMutationContext
  >;
  /**
   * options passed to `lodash.debounce` to automatically save the query data to
   * the server with a debounced save function.  if undefined the hook will not
   * automatically save data to the server.
   */
  autoSaveOptions?: AutoSaveOptions;
  /**
   * function used to merge updates from the server with the local changes to
   * the server data.  if undefined the hook will ignore background updates from
   * the server and local changes will overwrite data from the server.
   */
  merge?: MergeFunc<TQueryFnData>;
  /**
   * Ask the user to confirm before leaving the page if there are local
   * modification to server data.  If false or undefined the user is allowed to
   * leave the page.
   */
  alertIfUnsavedChanges?: boolean;
  /**
   * boolean used to determine if the mutate function should be called, defaults to true
   */
  mutateEnabled?: boolean;
  /**
   * If you want to pass your own draft you can
   */
  draftProvider?: UseReactQueryAutoSyncDraftProvider<TQueryFnData>;
}): UseReactQueryAutoSyncResult<TQueryFnData, TQueryError, TMutationData, TMutationError, TMutationContext> {
  const [stateDraft, setStateDraft] = useState<TQueryFnData | undefined>(undefined);

  const draft = draftProvider !== undefined ? draftProvider.draft : stateDraft;
  const setDraft = draftProvider !== undefined ? draftProvider.setDraft : setStateDraft;

  // create a stable ref to the draft so we can memoize the save function
  const draftRef = useRef<TQueryFnData | undefined>(undefined);
  draftRef.current = draft;

  // create a stable ref to the merge so we can memoize the merge effect
  const mergeRef = useRef<MergeFunc<TQueryFnData> | undefined>(undefined);
  mergeRef.current = merge;

  const queryResult = useQuery(queryOptions);

  const queryClient = useQueryClient();
  const queryKey = queryOptions.queryKey!;

  // we provide options to useMutation that optimistically update our state
  const mutationResult = useMutation({
    ...mutationOptions,
    onMutate: async (draft) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries(queryKey);
      // Snapshot the last known server data
      const previousData = queryClient.getQueryData(queryKey);
      // optimistically set our known server state to the new data
      queryClient.setQueryData(queryKey, draft);
      // optimistically clear our draft state
      setDraft(undefined);
      // Return a context object with the snapshotted value
      return {
        previousData,
        ...mutationOptions.onMutate?.(draft),
      } as any;
    },
    onError: (err, prevDraft, context) => {
      // reset the server state to the last known state
      queryClient.setQueryData(queryKey, (context as any).previousData);
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
    onSettled: (data, error, variables, context) => {
      // refetch after error or success:
      queryClient.invalidateQueries(queryKey);
      return mutationOptions?.onSettled?.(data, error, variables, context);
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

    // const saveDraftOnVisibilityChange = () => {
    //   // fires when user switches tabs, apps, goes to home screen, etc.
    //   if (document.visibilityState == "hidden") {
    //     // TODO(lukemurray): This doesn't quite work
    //     // see https://calendar.perfplanet.com/2020/beaconing-in-practice/#beaconing-incrementally-gathering-telemtry
    //     // and https://github.com/wealthsimple/beforeunload-request
    //     // if we do expose this it would have the following options
    //     // interface SaveOptions {
    //     //   url: string;
    //     //   options: Pick<RequestInit, "method" | "headers" | "body" | "credentials">;
    //     // }
    //     // first try navigator.sendBeacon
    //     // then try xhmlhttprequest
    //     // then try fetch with keepalive
    //     // it should return true if it succeeds (this is based on the beforeunload-request)
    //     saveAndCancelDebounced();
    //   }
    // };

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

  // merge the local data with the server data when the server data changes
  const currentDraftValue = useRef(draft);
  currentDraftValue.current = draft;
  useEffect(() => {
    const serverData = queryResult.data;
    const currentMergeFunc = mergeRef.current;
    if (serverData !== undefined && currentMergeFunc !== undefined && currentDraftValue.current !== undefined) {
      setDraft(currentMergeFunc(serverData, currentDraftValue.current));
    }
  }, [queryResult.data, setDraft]);

  const saveStatus: ReactQueryAutoSyncSaveStatus = queryResult.isLoading
    ? "loading"
    : mutationResult.isLoading
    ? "saving"
    : mutationResult.isError || queryResult.isError
    ? "error"
    : queryResult.data === draft
    ? "saved"
    : "unsaved";

  return {
    save: saveAndCancelDebounced,
    setDraft,
    draft: draft ?? queryResult.data,
    queryResult,
    mutationResult,
    saveStatus,
  };
}
