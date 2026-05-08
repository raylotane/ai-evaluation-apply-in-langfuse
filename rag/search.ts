import Fuse from "fuse.js";

import { docs } from "./article";

const fuse = new Fuse(docs, {
  includeScore: true,
  // includeMatches: true,
  threshold: 1,
})

export const fuseSearch = (query: string) => {
  return fuse.search(query)
}