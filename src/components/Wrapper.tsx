import React, { ReactNode } from "react";
import tw, { css } from "twin.macro";

export function Wrapper({ children }: { children?: ReactNode }) {
  return (
    <div
      css={[
        tw`p-2`,
        css`
          height: 100vh;
          width: 100vw;
        `,
      ]}
    >
      {children}
    </div>
  );
}
