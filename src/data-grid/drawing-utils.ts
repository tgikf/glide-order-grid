import { GridColumn, Theme } from "@glideapps/glide-data-grid";
import { DataGridColumn } from "./DataGridColumn.ts";
import { ID_SEPARATOR } from "./static.ts";

export function getDrawHeader<T>(
  sortDirection: "asc" | "desc",
  columnDefs: DataGridColumn<T>[],
  headerHeight: number,
  sortColumn?: GridColumn,
) {
  return (args: {
    ctx: CanvasRenderingContext2D;
    rect: { x: number; y: number; width: number; height: number };
    column: GridColumn;
    theme: Theme;
    isHovered: boolean;
    isSelected: boolean;
  }) => {
    const { ctx, rect, column, theme, isHovered } = args;
    ctx.fillStyle = isHovered ? theme.bgHeaderHovered : theme.bgHeader;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    const titleAreaHeight = headerHeight;
    const padding = 8;

    ctx.fillStyle = theme.textHeader;
    ctx.font = theme.headerFontStyle;
    const baseTitle =
      columnDefs.find((def) => def.id === column.id)?.title || "";

    const isSortColumn = sortColumn?.id === column.id;
    const title = isSortColumn
      ? baseTitle.replace(/\s[▲▼]$/, "") +
        (sortDirection === "asc" ? " ▲" : " ▼")
      : baseTitle.replace(/\s[▲▼]$/, "");

    ctx.textBaseline = "middle";
    ctx.fillText(title, rect.x + padding, rect.y + titleAreaHeight / 2);

    return true;
  };
}

export function drawCellUpdateUnderlay(
  args: {
    ctx: CanvasRenderingContext2D;
    rect: { x: number; y: number; width: number; height: number };
    theme: Theme;
    requestAnimationFrame: () => void;
  },
  lastUpdate: number | undefined,
  frameTime: number,
  isLastCol: boolean,
  isLastRow: boolean,
): boolean {
  const { ctx, rect, theme, requestAnimationFrame } = args;

  const animTime = 1750;
  if (lastUpdate === undefined) return false;

  const progress = frameTime - lastUpdate;
  if (progress >= animTime) return false;
  ctx.save();

  const fade = 1 - progress / animTime;
  ctx.globalAlpha = fade * 0.6;
  ctx.fillStyle = theme.accentFg;
  ctx.fillRect(
    rect.x + 1,
    rect.y + 1,
    rect.width - (isLastCol ? 2 : 1),
    rect.height - (isLastRow ? 2 : 1),
  );
  ctx.restore();

  requestAnimationFrame();
  return true;
}

export function getDrawCell<T, K extends keyof T>(
  processedData: T[],
  columns: DataGridColumn<T>[],
  cellUpdates: Map<string, number>,
  idKey: K,
  frameTime: number,
) {
  return (args: any, drawCell: Function) => {
    const { col, row } = args;
    const item = processedData[row];
    const colId = columns[col]?.id;

    if (!item || !colId) {
      return drawCell();
    }

    // use default cell rendering for the content
    const result = drawCell();

    // if needed use underlay rendering for flashing
    const cellKey = `${item[idKey]}${ID_SEPARATOR}${colId}`;
    const lastUpdate = cellUpdates.get(cellKey);
    if (lastUpdate !== undefined) {
      const isLastCol = col === columns.length - 1;
      const isLastRow = row === processedData.length - 1;
      drawCellUpdateUnderlay(args, lastUpdate, frameTime, isLastCol, isLastRow);
    }
    return result;
  };
}
