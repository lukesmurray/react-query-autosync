# useReactQueryAutoSync

A helpful react hook for building interfaces which require autosave.
Read more about the motivation and design in the [original blog post](https://lsmurray.com/blog/react-query-auto-sync-hook).
Check out the quick example below or feel free to run the [drawing demo](./src/components/Demo.tsx) on your own machine.
To run the drawing demo simply clone the repository and run `yarn` followed by `yarn dev`.
If you open two browser windows to `localhost:3000` you can click to draw and the drawings will sync between pages.

## Example

```ts
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
```

## TODO

- ~~create a demo with [perfect-freehand](https://github.com/steveruizok/perfect-freehand)~~
- compare with alternatives such as websockets, long polling, replicache
- When is this a good idea, when are alternatives better?
- See if it is possible to have `setDraft` use the server value if the local value is not defined
  - otherwise you cannot memoize a `setDraft` function
