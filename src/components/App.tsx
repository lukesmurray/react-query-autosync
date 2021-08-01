import React from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { ReactQueryDevtools } from "react-query/devtools";
import { GlobalStyles } from "twin.macro";
import { Demo } from "./Demo";

// eslint-disable-next-line @typescript-eslint/no-var-requires
import("../mocks/browser").then((res) =>
  res.worker.start({
    quiet: true,
  }),
);

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalStyles />
      <Demo />
      <ReactQueryDevtools initialIsOpen={true} />
    </QueryClientProvider>
  );
}

export default App;
