import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { ReactQueryDevtools } from "react-query/devtools";
import { Demo } from "./Demo";

if (process.env.NODE_ENV === "development") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  import("./mocks/browser").then((res) => res.worker.start());
}

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={"Loading..."}>
        <Demo />
      </Suspense>
      <ReactQueryDevtools initialIsOpen={true} />
    </QueryClientProvider>
  );
}

export default App;
