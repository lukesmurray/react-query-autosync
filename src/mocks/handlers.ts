import { rest } from "msw";

const saveHandler = rest.post("/save", (req, res, ctx) => {
  saveObjectToStorage(req.body as any);
  return res(ctx.status(200));
});

const loadHandler = rest.get("/load", (req, res, ctx) => {
  return res(ctx.status(200), ctx.json(loadObjectFromStorage() ?? {}));
});
const clearHandler = rest.get("/clear", (req, res, ctx) => {
  deleteObjectFromLocalStorage();
  return res(ctx.status(200));
});

export const handlers = [saveHandler, loadHandler, clearHandler];

function deleteObjectFromLocalStorage() {
  localStorage.removeItem(getStorageKey());
}

function loadObjectFromStorage(): any | undefined {
  const localItem = localStorage.getItem(getStorageKey());
  if (localItem !== null) {
    return JSON.parse(localItem);
  } else {
    return undefined;
  }
}

function saveObjectToStorage(obj: any) {
  localStorage.setItem(getStorageKey(), JSON.stringify(obj));
}

function getStorageKey(): string {
  return "useReactQueryAutoSyncDrawing";
}
