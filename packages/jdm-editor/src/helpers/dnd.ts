type BoxLike = {
  top: number;
  height: number;
};

export const getDropDirection = (
  activeBox: BoxLike | null | undefined,
  targetBox: DOMRect | null | undefined,
): 'up' | 'down' => {
  if (!activeBox || !targetBox) {
    return 'up';
  }

  return activeBox.top + activeBox.height / 2 > targetBox.top + targetBox.height / 2 ? 'down' : 'up';
};
