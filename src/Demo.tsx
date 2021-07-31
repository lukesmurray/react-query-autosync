import React from "react";
import { useReactQueryAutoSync } from "../lib/useReactQueryAutoSync";

// fake api object. You would supply your own!
const fakeAPI: any = {};

// fake function used to merge server and local state
const mergeFoo: any = (remote: any, local: any) => ({ ...remote, ...local });

export function Demo() {
  const { draft, setDraft } = useReactQueryAutoSync({
    queryOptions: {
      queryKey: "foo",
      queryFn: async () => fakeAPI.fetchFoo(),
      // if you want to poll the server pass a refetchInterval to react query
      refetchInterval: 5000,
    },
    mutationOptions: {
      mutationFn: async (foo) => fakeAPI.saveFoo(foo),
    },
    // pass autoSaveOptions to automatically save to the server with debouncing
    autoSaveOptions: {
      wait: 500,
    },
    // pass alertIfUnsavedChanges to notify user if they leave with unsaved changes
    alertIfUnsavedChanges: true,
    // pass merge to merge server and local state when the server state updates
    merge: (remoteFoo, localFoo) => mergeFoo(remoteFoo, localFoo),
  });

  return (
    <>
      <input
        type="text"
        value={draft.foo}
        onChange={(e) => {
          // modify draft with `setDraft` but make sure to modify a copy so you
          // don't break the ReactQuery caching!
          setDraft({ ...draft, foo: e.target.value });
        }}
      />
    </>
  );
}
