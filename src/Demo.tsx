import React from "react";
import { css } from "twin.macro";

export function Demo() {
  return (
    <div
      css={css`
        background: red;
        height: 50px;
      `}
    ></div>
  );
}
