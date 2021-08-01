import React from "react";
import tw, { css } from "twin.macro";

export function SaveIndicator({ isUnsyncedChanges }: { isUnsyncedChanges: boolean }) {
  return (
    (isUnsyncedChanges && (
      <div css={[tw`fixed top-2 left-2`]}>
        <div
          css={[
            tw`w-6 h-6 rounded-full border-4 border-gray-400 animate-spin`,
            css`
              /* tw blue 3 */
              border-top-color: rgba(147, 197, 253, var(--tw-border-opacity));
            `,
          ]}
        ></div>
        <div css={tw`text-xs text-center`}>Unsynced Changes</div>
      </div>
    )) ||
    null
  );
}
