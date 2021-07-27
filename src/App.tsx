import React, { Suspense, useState } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { ReactQueryDevtools } from "react-query/devtools";
import { HookDemo } from "./HookDemo";

const queryClient = new QueryClient();

function App() {
  const [showDemo, setShowDemo] = useState(true);
  const [wait, setWait] = useState(5000);
  const [maxWait, setMaxWait] = useState(5000);
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={"Loading..."}>
        <div>
          <div>
            <label>Wait</label>
            <input type="number" value={wait} onChange={(e) => setWait(Number(e.target.value))}></input>
          </div>
          <div>
            <label>Max Wait</label>
            <input type="number" value={maxWait} onChange={(e) => setMaxWait(Number(e.target.value))}></input>
          </div>
          <button onClick={() => setShowDemo(!showDemo)}>Toggle Demo</button>
        </div>
        {showDemo && <HookDemo wait={wait} maxWait={maxWait} />}
      </Suspense>
      <ReactQueryDevtools initialIsOpen={true} />
    </QueryClientProvider>
  );
}

export default App;
