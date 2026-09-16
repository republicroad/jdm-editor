import type { Node, Viewport } from "@xyflow/react"

/** The gap a moved frame leaves between the toolbar and the nearest card. */
const TOOLBAR_AIR = 24

/** A card showing less than this at a canvas edge reads as a stray sliver. */
const SLIVER = 24

/** What a move that leaves a new sliver costs, in pixels of extra travel. */
const SLIVER_PENALTY = 1000

/** Absorbs float error, so a card resting exactly on an edge counts as clear. */
const EDGE = 0.5

/** The canvas size and the toolbar's box, all in canvas pixels. */
export type FrameBounds = {
  width: number
  height: number
  toolbar: { left: number; right: number; top: number; bottom: number }
}

/** A card that, when whole on screen left of `end`, has to stay that way. */
export type KeepInView = { id: string; end: number }

type Box = { id: string; x: number; y: number; width: number; height: number }

/**
 * Moves a frame only when a card overlaps the toolbar, taking the shortest
 * clear move that adds no new sliver and hides no kept card.
 */
export function clearToolbar(
  viewport: Viewport,
  nodes: Node[],
  bounds: FrameBounds,
  keep?: KeepInView
): Viewport {
  const { width, height, toolbar } = bounds
  const reach = toolbar.right + TOOLBAR_AIR
  const ceiling = toolbar.top - TOOLBAR_AIR
  const end = keep?.end ?? width
  const boxes: Box[] = nodes
    .filter((node) => !node.hidden && node.measured?.width)
    .map((node) => ({
      id: node.id,
      x: node.position.x * viewport.zoom,
      y: node.position.y * viewport.zoom,
      width: (node.measured?.width ?? 0) * viewport.zoom,
      height: (node.measured?.height ?? 0) * viewport.zoom,
    }))

  const overlapsToolbar = (box: Box, x: number, y: number) =>
    box.x + x + box.width > toolbar.left + EDGE &&
    box.x + x < toolbar.right - EDGE &&
    box.y + y + box.height > toolbar.top + EDGE &&
    box.y + y < toolbar.bottom - EDGE

  if (boxes.every((box) => !overlapsToolbar(box, viewport.x, viewport.y))) {
    return viewport
  }

  // A moved frame keeps the whole corner empty, air included, to the canvas edge.
  const inCorner = (box: Box, x: number, y: number) =>
    box.x + x + box.width > EDGE &&
    box.x + x < reach - EDGE &&
    box.y + y + box.height > ceiling + EDGE &&
    box.y + y < height - EDGE
  const isWhole = (box: Box, x: number, y: number) =>
    box.x + x > -EDGE &&
    box.x + x + box.width < end + EDGE &&
    box.y + y > -EDGE &&
    box.y + y + box.height < height + EDGE
  const isSliver = (box: Box, x: number, y: number) => {
    const shownWidth =
      Math.min(box.x + x + box.width, width) - Math.max(box.x + x, 0)
    const shownHeight =
      Math.min(box.y + y + box.height, height) - Math.max(box.y + y, 0)

    return (
      shownWidth > EDGE &&
      shownHeight > EDGE &&
      (shownWidth < SLIVER || shownHeight < SLIVER)
    )
  }
  const target = boxes.find((box) => box.id === keep?.id)
  const kept =
    target && isWhole(target, viewport.x, viewport.y) ? target : undefined

  // A card clears the corner past one of four edges, so every offset worth
  // trying lines a card up with one; pairing them covers diagonal moves too.
  const xs = new Set([viewport.x])
  const ys = new Set([viewport.y])

  for (const box of boxes) {
    xs.add(reach - box.x).add(-(box.x + box.width))
    ys.add(ceiling - (box.y + box.height)).add(height - box.y)
  }

  let best: { next: Viewport; score: number } | null = null

  for (const x of xs) {
    for (const y of ys) {
      if (kept && !isWhole(kept, x, y)) continue
      if (boxes.some((box) => inCorner(box, x, y))) continue

      const addsSliver = boxes.some(
        (box) => !isSliver(box, viewport.x, viewport.y) && isSliver(box, x, y)
      )
      const score =
        Math.abs(x - viewport.x) +
        Math.abs(y - viewport.y) +
        (addsSliver ? SLIVER_PENALTY : 0)

      if (!best || score < best.score) {
        best = { next: { ...viewport, x, y }, score }
      }
    }
  }

  return best?.next ?? viewport
}