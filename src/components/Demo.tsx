import { useRect } from "@reach/rect";
import { button, useControls } from "leva";
import { nanoid } from "nanoid";
import getStroke from "perfect-freehand";
import React, { useEffect, useRef, useState } from "react";
import tw, { css } from "twin.macro";
import { useReactQueryAutoSync } from "../../lib/useReactQueryAutoSync";
import { getSvgPathFromStroke } from "../utils/getSvgPathFromStroke";
import { SaveIndicator } from "./SaveIndicator";
import { Wrapper } from "./Wrapper";

export function Demo() {
  const eventElementRef = useRef<SVGSVGElement | null>(null);
  const rect = useRect(eventElementRef, { observe: true });

  // creating a synced value is nearly as simple as useState
  const {
    draft: strokes,
    setDraft: setStrokes,
    queryResult: { data: serverStrokes },
  } = useStrokes();

  useEvents(eventElementRef, strokes, setStrokes);

  useControls({
    clear: button(() => fetch("/clear")),
  });

  return (
    <Wrapper>
      <svg
        ref={eventElementRef}
        height="100%"
        width="100%"
        css={[
          tw`bg-gray-100 rounded-md`,
          css`
            touch-action: none;
          `,
        ]}
        viewBox={`0 0 ${rect?.width ?? 100} ${rect?.height ?? 100}`}
      >
        <g>
          {strokes !== undefined &&
            Object.keys(strokes).map((strokeId) => {
              return (
                <path
                  d={getSvgPathFromStroke(
                    getStroke(strokes[strokeId], {
                      size: 16,
                      thinning: 0.75,
                      smoothing: 0.5,
                      streamline: 0.5,
                    }),
                  )}
                  key={strokeId}
                />
              );
            })}
        </g>
      </svg>
      <SaveIndicator isUnsyncedChanges={serverStrokes !== strokes} />
    </Wrapper>
  );
}

function useEvents(
  eventElementRef: React.MutableRefObject<SVGSVGElement | null>,
  strokes: Record<string, number[][]> | undefined,
  setStrokes: (newStrokes: Record<string, number[][]> | undefined) => void,
) {
  const [currentStrokeId, setCurrentStrokeId] = useState<string | null>(null);
  useEffect(() => {
    const ref = eventElementRef.current;
    if (ref) {
      ref.addEventListener("pointerdown", handlePointerDown);
      ref.addEventListener("pointermove", handlePointerMove);
      ref.addEventListener("pointerup", handlePointerUp);
    }
    return () => {
      if (ref) {
        ref.removeEventListener("pointerdown", handlePointerDown);
        ref.removeEventListener("pointermove", handlePointerMove);
        ref.removeEventListener("pointerup", handlePointerUp);
      }
    };

    function pointsFromEvent(e: PointerEvent) {
      return [e.offsetX, e.offsetY, e.pressure];
    }

    function handlePointerDown(e: PointerEvent): void {
      // on pointer down, if strokes are loaded, add a new stroke
      if (strokes !== undefined) {
        const newStrokeId = nanoid();
        setStrokes({
          ...strokes,
          [`${newStrokeId}`]: [pointsFromEvent(e)],
        });
        setCurrentStrokeId(newStrokeId);
      }
    }
    function handlePointerMove(e: PointerEvent): void {
      // on pointer move if strokes are loaded add new points to the current stroke
      if (currentStrokeId !== null && strokes !== undefined) {
        setStrokes({
          ...strokes,
          [`${currentStrokeId}`]: [...strokes[currentStrokeId], pointsFromEvent(e)],
        });
      }
    }
    function handlePointerUp(e: PointerEvent): void {
      // on pointer up finish the current stroke
      if (currentStrokeId !== null && strokes !== undefined) {
        setStrokes({
          ...strokes,
          [`${currentStrokeId}`]: [...strokes[currentStrokeId], pointsFromEvent(e)],
        });
        setCurrentStrokeId(null);
      }
    }
  }, [currentStrokeId, eventElementRef, setStrokes, strokes]);
}

function useStrokes() {
  const { refetchInterval, wait, maxWait } = useControls({ refetchInterval: 1000, wait: 50, maxWait: 250 });
  // all the logic for saving is embedded in this hook
  return useReactQueryAutoSync({
    queryOptions: {
      queryKey: "getStrokes",
      queryFn: async () =>
        await fetch(`/load`)
          .then((res) => res.json())
          .then((json) => json as Record<string, number[][]>),
      // refetch interval for querying from the server
      refetchInterval,
    },
    mutationOptions: {
      mutationFn: (strokes) =>
        fetch("/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(strokes),
        }),
    },
    // auto save option for saving to the server
    autoSaveOptions: {
      wait,
      maxWait,
    },
    // we can merge the local/server state
    merge: (remote, local) => ({
      ...remote,
      ...local,
    }),
  });
}
