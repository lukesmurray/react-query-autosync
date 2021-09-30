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
Both hooks return an object which contains `draft` and `setDraft` properties which can be treated similarly to the `state` and `setState` values returned by [`useState`](https://reactjs.org/docs/hooks-state.html).
The key thing this library does is provide mechanisms to automatically save and load changes to the `draft` value between the server and the client, all through a simple API.
Both hooks directly expose [react query](https://react-query.tanstack.com/) options so they are simple to configure and use.
This is easiest to see with an example.

<!-- prettier-ignore-start -->
```tsx
function Example() {
  const { draft, setDraft, queryResult } = useReactQueryAutoSync({
    queryOptions: { /* omitted but same as react-query */ },
    mutationOptions: { /* omitted but same as react-query */ },
    autoSaveOptions: { wait: 1000 },
  });

  const loading = queryResult.isLoading;

  if (loading) {
    return <div>Loading...</div>;
  } else {
    return (
      <div>
        <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)}></input>
      </div>
    );
  }
}
```
<!-- prettier-ignore-end -->

In this example we use query and mutation options to tell `useReactQueryAutoSync` how to fetch and save the value to the server. We use the `autoSaveOptions` parameter to tell `useReactQueryAutoSync` to debounce changes and automatically synchronize the value to the server after one second without any changes.

Similarly to `useState` you can only change the `draft` value using the `setDraft` function.

In addition to the sync hook the library exposes `useReactQueryAutoSave` (save). The difference between the two is the save hook is unidirectional and only saves a local value to the server when the local value changes. This can be useful for automatically saving things like logs, user analytivcs, or error reports. The sync hook is useful for things like documents where you don't want the user to have to press a save button to keep their changes.

### `useReactQueryAutoSync` Parameters

- `queryOptions` **required**: these are the query options passed to `useQuery`. Make sure to set `refetchInterval` if you want to enable automatic polling.
- `mutationOptions` **required**: these are the mutation options passed to `useMutation`. Internally the hook uses `onMutate`, `onError`, and `onSettled` to optimistically update the state but it will call your versions of these functions as well. The hook uses the key `previousData` to save the previous data in the `onMutate` context.
- `autoSaveOptions`: see autoSaveOptionsBelow. If undefined the hook will not automatically save data since it will assume a debounce time of `Infinity`.
- `merge`: function used to merge updates from the server with local changes to server data. If undefined the hook will ignore background updates from the server even if `refetchInterval` is supplied and local changes will take precedence. The merge function is also used when an error occurs while saving data.
- `alertIfUnsavedChanges`: ask the user to confirm before leaving the page if there are unsaved changes. If undefined the hook will not ask the user to confirm before leaving.
- `mutateEnabled`: similar to the `enabled` parameter of `useQuery`. If `mutateEnabled` is false and the hook tries to save to the server, a pending save will be created, and when `mutateEnabled` is toggled to true the pending save will immediately execute. Can be useful if you need to use dependent queries to get data to perform the mutation. If undefined, `mutateEnabled` defaults to true.
- `draftProvider`: see draftProviderBelow. If undefined the hook will use `useState` to create the `draft` value.

### `useReactQueryAutoSave` Parameters

Same as `useReactQueryAutoSync` but does not have `queryOptions`.

### `autoSaveOptions`

- `wait`: number of milliseconds to delay the debounce function
- `maxWait`: maximum number of milliseconds to delay the debounce function. If undefined there is no max delay.

### `draftProvider` **experimental**

- `draft`: The current value of the draft.
- `setDraft`: Function used to update the draft. `(value) => void`.

By default `useReactQueryAutoSync` uses `useState` to implement the draft.
However there are times when this is not desired.
For example, if you want to display the same synchronized value in multiple places in your application you have to either [list state up](https://reactjs.org/docs/lifting-state-up.html) or use a [react context](https://reactjs.org/docs/context.html).
If you try using `useReactQueryAutoSync` in multiple locations the values may eventually sync but it would be a sub optimal experience since synchronizing the values would require multiple round trips to the server.
Instead you can use the `draftProvider` and provide your own draft values backed by a library such as recoil or jotai or zustand.
Here is a simple example which creates a `draftProvider` using jotai.
Regardless of where you use this hook the `draft` values will be immediately synchronized.

<!-- prettier-ignore-start -->
```tsx
const exampleAtom = atom(undefined);

function Example() {
  const [draft_, setDraft_] = useAtom(exampleAtom);
  const { draft, setDraft, queryResult } = useReactQueryAutoSync({
    queryOptions: { /* omitted */ },
    mutationOptions: { /* omitted */ },
    autoSaveOptions: { wait: 1000 },
    draftProvider: { draft: draft_, setDraft: setDraft_ },
  });
```
<!-- prettier-ignore-end-->

⚠️ This is an experimental feature and has issues such as potentially issuing a mutation for each hook.

## Example

Here is a more complex example which shows off more of the features of `useReactQueryAutoSync`.

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
