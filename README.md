# useReactQueryAutoSync

![](https://img.shields.io/npm/v/use-react-query-auto-sync?label=npm)
![](https://img.shields.io/bundlephobia/minzip/use-react-query-auto-sync)

A helpful react hook for building interfaces which require autosave.
Read more about the motivation and design in the [original blog post](https://lsmurray.com/blog/react-query-auto-sync-hook).
Check out the quick example below or feel free to view the [drawing demo](https://react-query-auto-sync.lsmurray.com/) online.
The code for the demo is in the [src](./src) folder and can be run locally with `yarn dev`.

## Installation

```sh
# npm
npm install use-react-query-auto-sync

# yarn
yarn add use-react-query-auto-sync
```

## Documentation

The library exposes two hooks `useReactQueryAutoSync` and `useReactQueryAutoSave`.
The `Sync` hook is used to query the server for data and synchronize local changes to that data back to the server.
The `Save` hook is used to automatically save local changes to data to the server and does not make any queries.

### `useReactQueryAutoSync` Parameters

- `queryOptions` **required**: these are the query options passed to `useQuery`. Make sure to set `refetchInterval` if you want to enable automatic polling.
- `mutationOptions` **required**: these are the mutation options passed to `useMutation`. Internally the hook uses `onMutate`, `onError`, and `onSettled` to optimistically update the state but it will call your versions of these functions as well. The hook uses the key `previousData` to save the previous data in the `onMutate` context.
- `autoSaveOptions`: see autoSaveOptionsBelow. If undefined the hook will not automatically save data.
- `merge`: function used to merge updates from the server with local changes to server data. If undefined the hook will ignore background updates from the server and local changes will overwrite data from the server. If the merge function is undefined and the hook fails to save data to the server, it will overwrite intermittent changes with the data that failed to save. If the merge function is defined the hook will merge the changes which failed to save with new changes.
- `alertIfUnsavedChanges`: ask the user to confirm before leaving the page if there are unsaved changes. If undefined the hook will not ask the user to confirm before leaving.

### `useReactQueryAutoSave` Parameters

Same as `useReactQueryAutoSync` but does not have `queryOptions`.

### `autoSaveOptions`

- `wait`: number of milliseconds to delay the debounce function
- `maxWait`: maximum number of milliseconds to delay the debounce function. If undefined there is no max delay.

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
