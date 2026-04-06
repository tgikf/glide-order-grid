import {
  CustomCell,
  CustomRenderer,
  DrawArgs,
  GridCellKind,
  Theme,
  drawTextCell,
} from "@glideapps/glide-data-grid";

interface MultilineTextCellProps {
  kind: "multiline-text-cell";
  displayData: string;
  allowOverlay: boolean;
  readonly: boolean;
  themeOverride?: Partial<Theme>;
}

export type MultilineTextCell = CustomCell<MultilineTextCellProps>;

export const MultilineTextCellRenderer: CustomRenderer<MultilineTextCell> = {
  kind: GridCellKind.Custom,
  isMatch: (c): c is MultilineTextCell =>
    (c.data as any).kind === "multiline-text-cell",
  draw: (args: DrawArgs<MultilineTextCell>) => {
    const { ctx, rect, cell, theme, highlighted } = args;
    const { displayData } = cell.data;

    if (!displayData.includes("\n")) {
      drawTextCell(args, displayData);
      return;
    }

    ctx.save();
    if (highlighted) {
      ctx.fillStyle = theme.accentColor;
    } else {
      ctx.fillStyle = theme.bgCell;
    }
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = theme.textDark;

    const lines = displayData.split("\n");
    const lineHeight = args.theme.lineHeight;

    const horizontalPadding = args.theme.cellHorizontalPadding;
    const totalTextHeight = lineHeight * lines.length;
    let startY = rect.y + (rect.height - totalTextHeight) / 2;

    for (let i = 0; i < lines.length; i++) {
      const y = startY + i * lineHeight + lineHeight / 2;
      ctx.fillText(lines[i], rect.x + horizontalPadding, y);
    }

    ctx.restore();
    return true;
  },
};
