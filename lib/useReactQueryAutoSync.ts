/* eslint-disable @typescript-eslint/no-empty-function */
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

/**
 * Empty function used to avoid the overhead of `lodash.debounce` if autoSaveOptions are not used.
 */
const EmptyDebounceFunc = Object.assign(() => {}, {
  flush: () => {},
  cancel: () => {},
});

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

/**
 * Function used to merge server data with local modification of server data
 */
export type MergeFunc<TQueryData> = (remote: TQueryData, local: TQueryData) => TQueryData;

/**
 * Return type of UseReactQueryAutoSync
 */
export type UseReactQueryAutoSyncResult<TQueryData, TQueryError, TMutationData, TMutationError, TMutationContext> = {
  /**
   * Function used to manually save the data to the server
   */
  save: () => void;
  /**
   * Function used to update server data. Be careful avoid modifying the draft
   * directly and instead set the draft to a copy.
   */
  setDraft: React.Dispatch<React.SetStateAction<TQueryData | undefined>>;
  /**
   * The current value of the data either locally modified or taken from the server.
   * May be undefined if the data is not yet loaded.
   */
  draft: TQueryData | undefined;
  /**
   * The result of `useQuery`
   */
  queryResult: UseQueryResult<TQueryData, TQueryError>;
  /**
   * The result of `useMutation`
   */
  mutationResult: UseMutationResult<TMutationData, TMutationError, TQueryData, TMutationContext>;
};

/**
 * React hook which can be used to automatically save and update query data.
 */
export function useReactQueryAutoSync<
  TQueryFnData = unknown,
  TQueryError = unknown,
  TQueryData = TQueryFnData,
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
}: {
  /**
   * queryOptions passed to `useQuery`
   */
  queryOptions: UseQueryOptions<TQueryFnData, TQueryError, TQueryData, TQueryKey>;
  /**
   * mutationOptions passed to `useMutation`. Internally the hook uses
   * `onMutate`, `onError`, and `onSettled` to optimistically update the draft.
   */
  mutationOptions: UseMutationOptions<
    TMutationData,
    TMutationError,
    TQueryData, // input to mutate is the same as the output of the query
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
  merge?: MergeFunc<TQueryData>;
  /**
   * Ask the user to confirm before leaving the page if there are local
   * modification to server data.  If false or undefined the user is allowed to
   * leave the page.
   */
  alertIfUnsavedChanges?: boolean;
}): UseReactQueryAutoSyncResult<TQueryData, TQueryError, TMutationData, TMutationError, TMutationContext> {
  const [draft, setDraft] = useState<TQueryData | undefined>(undefined);

  // create a stable ref to the draft so we can memoize the save function
  const draftRef = useRef<TQueryData | undefined>(undefined);
  draftRef.current = draft;

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
    onError: (err, draft, context) => {
      // reset the server state to the last known state
      queryClient.setQueryData(queryKey, (context as any).previousData);
      // reset the draft to the last known draft unless the user made more changes
      if (draft !== undefined) {
        setDraft(draft as any);
      }
      return mutationOptions.onError?.(err, draft, context);
    },
    onSettled: (data, error, variables, context) => {
      // refetch after error or success:
      queryClient.invalidateQueries(queryKey);
      return mutationOptions?.onSettled?.(data, error, variables, context);
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
  useEffect(() => {
    const serverData = queryResult.data;
    if (serverData !== undefined && merge !== undefined) {
      setDraft((localData) => {
        if (localData !== undefined) {
          return merge(serverData, localData);
        }
      });
    }
  }, [merge, queryResult.data]);

  return {
    save: saveAndCancelDebounced,
    setDraft,
    draft: draft ?? queryResult.data,
    queryResult,
    mutationResult,
  };
}
