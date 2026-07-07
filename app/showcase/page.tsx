export { default, metadata } from "../../src/app/showcase/page";

// Route-segment config must be statically declared in the ROUTE file (Next
// cannot parse a re-export): the projections read live state at render, so
// the map reflects the CURRENT governed state, never a build-time snapshot.
export const dynamic = "force-dynamic";
