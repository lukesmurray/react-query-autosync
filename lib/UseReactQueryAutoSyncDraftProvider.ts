export type UseReactQueryAutoSyncDraftProvider<TQueryFnData> = {
  /**
   * Function used to update the draft
   */
  setDraft: (data: TQueryFnData | undefined) => void;
  /**
   * The current value of the draft
   */
  draft: TQueryFnData | undefined;
};
