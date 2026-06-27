import { Component, type ReactNode } from "react";

// A minimal error boundary around the lazy-loaded 3D scene. Two real failures would otherwise unmount the
// ENTIRE app to a blank page: (1) the hashed 3D chunk 404s after a redeploy while a browser holds a stale
// index.html, and (2) a machine that cannot create a WebGL context (GPU blocklist, locked-down lab box,
// headless). With this boundary, either one degrades to a static notice in just the 3D pane while every
// number, plot, and control on the rest of the instrument keeps working.
export class SceneBoundary extends Component<{ children: ReactNode; note?: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.warn("[3D scene] disabled after a render error:", err); }
  render() {
    if (this.state.failed) {
      return (
        <div className="scene-fallback">
          <div className="scene-fallback-t">3D view unavailable</div>
          <div className="scene-fallback-s">{this.props.note ?? "This device or browser could not start the WebGL scene. Every number, plot, and control on the rest of the page works without it."}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
