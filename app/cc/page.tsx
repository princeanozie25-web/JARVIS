export { default, metadata } from "../../src/app/cc/page";

// Route-segment config must be statically declared in the ROUTE file: the
// Core reads the CURRENT pending-approval count at render, never a
// build-time snapshot (E-030).
export const dynamic = "force-dynamic";
