import React, { useRef } from "react";
import { useReactQueryAutoSync } from "../lib/useReactQueryAutoSync";

export function HookDemo(props: { wait: number; maxWait: number }) {
  const fakeServerValueRef = useRef("foo");
  const { draft, setDraft, save } = useReactQueryAutoSync({
    queryOptions: {
      queryKey: "foo",
      queryFn: async () => fakeServerValueRef.current,
      suspense: true,
      refetchInterval: 5000,
    },
    mutationOptions: {
      mutationFn: async (value) => {
        console.log("saving", value);
        fakeServerValueRef.current = value;
      },
    },
    autoSaveOptions: {
      wait: props.wait,
      maxWait: props.maxWait,
    },
  });
  return (
    <>
      <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button onClick={() => save()}>Save</button>
    </>
  );
}
