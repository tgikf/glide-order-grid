import {
  CustomCell,
  CustomRenderer,
  GridCellKind,
  Rectangle,
  roundedRect,
  getMiddleCenterBias,
  type Theme,
  interpolateColors,
} from "@glideapps/glide-data-grid";

export type PackedColor = string | readonly [normal: string, hover: string];

export const unpackColor = (
  color: PackedColor,
  theme: Record<string, any>,
  hoverAmount: number,
): string => {
  if (typeof color === "string") {
    if (theme[color] !== undefined) return theme[color];
    return color;
  }

  let [normal, hover] = color;
  if (theme[normal] !== undefined) normal = theme[normal];
  if (theme[hover] !== undefined) hover = theme[hover];
  return interpolateColors(normal, hover, hoverAmount);
};

interface TreeViewButtonsCellProps {
  readonly kind: "tree-view-buttons-cell";
  readonly text: string;
  readonly isOpen: boolean;
  readonly canOpen: boolean;
  readonly depth: number;
  readonly onClickOpener?: (
    cell: TreeViewButtonsCell,
  ) => TreeViewButtonsCell | undefined;
  readonly uniqueKey: string;
  readonly buttons: {
    title: string;
    onClick?: (event: { preventDefault: () => void }) => void;
    backgroundColor?: PackedColor;
    color?: PackedColor;
    borderColor?: PackedColor;
    borderRadius?: number;
  }[];
}

export type TreeViewButtonsCell = CustomCell<TreeViewButtonsCellProps> & {
  readonly: true;
};

interface ButtonHoverState {
  hovered: boolean;
  animationStartTime: number;
}

const depthShift = 16;

const cellHoverStates = new Map<
  string,
  {
    treeIconHovered: boolean;
    hoveredButtonIndex: number | null;
  }
>();

const setCellHoverState = (
  key: string,
  state: { treeIconHovered: boolean; hoveredButtonIndex: number | null },
) => {
  // only one element can be hovered at any one time, so clear map if new hover is set
  if (state.treeIconHovered || state.hoveredButtonIndex !== null) {
    cellHoverStates.clear();
    cellHoverStates.set(key, state);
  }
  // If no hover activity, just delete this cell's entry (if it exists)
  else {
    cellHoverStates.delete(key);
  }
};

const getCellHoverState = (key: string) => {
  return cellHoverStates.get(key) || null;
};

const calculateButtonLayouts = (
  buttons: TreeViewButtonsCellProps["buttons"],
  rect: Rectangle,
  ctx: CanvasRenderingContext2D,
  theme: any,
  textEndX: number,
): Rectangle[] => {
  const gap = 4;
  const buttonStartPadding = 8; // Space between text and first button
  const cellRightPadding = theme.cellHorizontalPadding || 8;
  const buttonInternalPadding = 8; // Reduced from 16 to 8 (4px on each side)

  const buttonRects: Rectangle[] = [];

  // Calculate button height and center it vertically
  const buttonHeight = Math.min(24, rect.height - 4); // Max 24px height with 2px margin
  const buttonY = rect.y + (rect.height - buttonHeight) / 2; // Center vertically

  // Calculate button widths
  const buttonWidths = buttons.map((btn) => {
    const textWidth = ctx.measureText(btn.title).width;
    return Math.ceil(textWidth + buttonInternalPadding); // Reduced padding
  });

  // Calculate total width needed for all buttons including gaps
  const totalButtonsWidth =
    buttonWidths.reduce((sum, width) => sum + width, 0) +
    (buttons.length - 1) * gap;

  // Calculate available space for buttons
  const minButtonStartX = textEndX + buttonStartPadding;
  const maxButtonEndX = rect.x + rect.width - cellRightPadding;
  const availableWidth = maxButtonEndX - minButtonStartX;

  let currentX: number;

  // If buttons can fit when right-aligned, align them to the right
  if (totalButtonsWidth <= availableWidth) {
    currentX = maxButtonEndX - totalButtonsWidth;
    // Ensure buttons don't overlap with text
    currentX = Math.max(currentX, minButtonStartX);
  } else {
    // Not enough space for right alignment, use left alignment after text
    currentX = minButtonStartX;
  }

  // Position buttons
  buttonWidths.forEach((btnWidth, _) => {
    buttonRects.push({
      x: currentX,
      y: buttonY, // Vertically centered
      width: btnWidth,
      height: buttonHeight,
    });

    currentX += btnWidth + gap;
  });

  return buttonRects;
};

interface HoverTarget {
  x: number;
  y: number;
  width: number;
  height: number;
}

const isHovered = (
  target: HoverTarget,
  hoverX: number | undefined,
  hoverY: number | undefined,
  cellRect: Rectangle,
): boolean => {
  if (hoverX === undefined || hoverY === undefined) return false;

  // Convert cell-relative hover coordinates to absolute coordinates
  const absoluteHoverX = cellRect.x + hoverX;
  const absoluteHoverY = cellRect.y + hoverY;

  return (
    absoluteHoverX >= target.x &&
    absoluteHoverX <= target.x + target.width &&
    absoluteHoverY >= target.y &&
    absoluteHoverY <= target.y + target.height
  );
};

// Helper to create tree icon hover target
const getTreeIconHoverTarget = (
  inset: number,
  theme: Theme,
  cellRect: Rectangle,
): HoverTarget => ({
  x: cellRect.x + inset + theme.cellHorizontalPadding - 4,
  y: cellRect.y + cellRect.height / 2 - 9,
  width: 22, // 18 + 4 padding
  height: 18,
});

export const TreeViewButtonsCellRenderer: CustomRenderer<TreeViewButtonsCell> =
  {
    kind: GridCellKind.Custom,
    isMatch: (c): c is TreeViewButtonsCell =>
      (c.data as any).kind === "tree-view-buttons-cell",
    needsHover: true,
    needsHoverPosition: true,
    onSelect: (args) => {
      const { cell } = args;
      const hoverState = getCellHoverState(cell.data.uniqueKey);

      // Prevent selection if over tree icon or any button
      if (hoverState?.treeIconHovered || hoverState?.hoveredButtonIndex) {
        args.preventDefault();
      }
    },
    onClick: (args) => {
      const { preventDefault, cell } = args;
      const { canOpen, onClickOpener, buttons } = cell.data;
      const hoverState = getCellHoverState(cell.data.uniqueKey);

      if (
        canOpen &&
        onClickOpener !== undefined &&
        hoverState?.treeIconHovered
      ) {
        return onClickOpener(cell);
      }

      if (
        hoverState?.hoveredButtonIndex !== null &&
        hoverState?.hoveredButtonIndex !== undefined
      ) {
        const buttonIndex = hoverState.hoveredButtonIndex;
        if (buttonIndex >= 0 && buttonIndex < buttons.length) {
          buttons[buttonIndex].onClick?.({ preventDefault });
          return;
        }
      }

      return undefined;
    },
    draw: (args, cell) => {
      const {
        ctx,
        theme,
        rect,
        hoverX = 0,
        hoverY = 0,
        frameTime,
        drawState,
        requestAnimationFrame,
      } = args;
      const { x, y, height: h } = rect;
      const { canOpen, depth, text, isOpen, buttons } = cell.data;

      const bias = getMiddleCenterBias(ctx, theme);
      const inset = depth * depthShift;
      const midLine = y + h / 2;

      // Track current hover state
      let treeIconHovered = false;
      let hoveredButtonIndex: number | null = null;

      // Draw tree icon
      if (canOpen) {
        const treeIconTarget = getTreeIconHoverTarget(inset, theme, rect);
        treeIconHovered = isHovered(treeIconTarget, hoverX, hoverY, rect);

        ctx.beginPath();
        if (isOpen) {
          ctx.moveTo(inset + x + theme.cellHorizontalPadding, midLine - 2.5);
          ctx.lineTo(
            inset + x + theme.cellHorizontalPadding + 5,
            midLine + 2.5,
          );
          ctx.lineTo(
            inset + x + theme.cellHorizontalPadding + 10,
            midLine - 2.5,
          );
        } else {
          ctx.moveTo(
            inset + x + theme.cellHorizontalPadding + 2.5,
            midLine - 5,
          );
          ctx.lineTo(
            inset + x + theme.cellHorizontalPadding + 2.5 + 5,
            midLine,
          );
          ctx.lineTo(
            inset + x + theme.cellHorizontalPadding + 2.5,
            midLine + 5,
          );
        }

        ctx.strokeStyle = treeIconHovered ? theme.textMedium : theme.textLight;
        ctx.lineWidth = 2;
        ctx.stroke();

        if (treeIconHovered) args.overrideCursor?.("pointer");
      }

      // Draw tree text
      const textX = 16 + x + inset + theme.cellHorizontalPadding + 0.5;
      ctx.fillStyle = theme.textDark;
      ctx.fillText(text, textX, y + h / 2 + bias);

      // Draw buttons
      if (buttons.length > 0) {
        let [state, setState] = drawState as [
          ButtonHoverState[] | undefined,
          (s: ButtonHoverState[]) => void,
        ];
        state ??= buttons.map(() => ({
          hovered: false,
          animationStartTime: 0,
        }));

        const textWidth = ctx.measureText(text).width;
        const textEndX = textX + textWidth;
        const buttonRects = calculateButtonLayouts(
          buttons,
          rect,
          ctx,
          theme,
          textEndX,
        );

        // Save the current clipping region
        ctx.save();

        // Set clipping rectangle to cell bounds to handle button overflow
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();

        buttons.forEach((btn, i) => {
          const buttonRect = buttonRects[i];

          // Check if button is visible within cell bounds
          if (buttonRect.x >= rect.x + rect.width) {
            return; // Button is completely outside cell bounds
          }

          const buttonHovered = isHovered(buttonRect, hoverX, hoverY, rect);

          // Track which button is hovered
          if (buttonHovered) {
            hoveredButtonIndex = i;
            args.overrideCursor?.("pointer");
          }

          if (buttonHovered !== state[i].hovered) {
            state[i] = {
              hovered: buttonHovered,
              animationStartTime: frameTime,
            };
          }

          const progress = Math.min(
            1,
            (frameTime - state[i].animationStartTime) / 200,
          );
          const hoverAmount = buttonHovered ? progress : 1 - progress;
          if (progress < 1) requestAnimationFrame?.();

          // Draw button background
          if (btn.backgroundColor) {
            ctx.beginPath();
            roundedRect(
              ctx,
              buttonRect.x,
              buttonRect.y,
              buttonRect.width,
              buttonRect.height,
              btn.borderRadius ?? theme.roundingRadius ?? 0,
            );
            ctx.fillStyle = unpackColor(
              btn.backgroundColor,
              theme,
              hoverAmount,
            );
            ctx.fill();
          }

          // Draw button border
          if (btn.borderColor) {
            ctx.beginPath();
            roundedRect(
              ctx,
              buttonRect.x + 0.5,
              buttonRect.y + 0.5,
              buttonRect.width - 1,
              buttonRect.height - 1,
              btn.borderRadius ?? theme.roundingRadius ?? 0,
            );
            ctx.strokeStyle = unpackColor(btn.borderColor, theme, hoverAmount);
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // Draw button text
          const prevTextAlign = ctx.textAlign;
          ctx.textAlign = "center";
          ctx.fillStyle = unpackColor(
            btn.color ?? theme.accentColor,
            theme,
            hoverAmount,
          );
          ctx.fillText(
            btn.title,
            buttonRect.x + buttonRect.width / 2,
            buttonRect.y +
              buttonRect.height / 2 +
              getMiddleCenterBias(ctx, theme.baseFontFull),
          );
          ctx.textAlign = prevTextAlign;
        });

        // Restore the clipping region
        ctx.restore();

        setState(state);
      }

      // hover state used in onClick/onSelect
      setCellHoverState(cell.data.uniqueKey, {
        treeIconHovered,
        hoveredButtonIndex,
      });

      return true;
    },
    measure: (ctx, cell, theme) => {
      const { text, depth, buttons } = cell.data;

      // Base tree view width
      const treeViewWidth =
        ctx.measureText(text).width +
        theme.cellHorizontalPadding * 2 +
        (depth + 2) * depthShift;

      // Calculate buttons width
      let buttonsWidth = 0;
      if (buttons.length > 0) {
        buttonsWidth += 8; // buttonStartPadding
        buttons.forEach((btn, i) => {
          const btnWidth = ctx.measureText(btn.title).width + 16; // internal padding
          buttonsWidth += btnWidth;
          if (i < buttons.length - 1) {
            buttonsWidth += 4; // gap between buttons
          }
        });
      }

      return treeViewWidth + buttonsWidth;
    },
    provideEditor: undefined,
  };
