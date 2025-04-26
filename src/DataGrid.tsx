import { useCallback, useEffect, useMemo, useState } from "react";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  useColumnSort,
  useMoveableColumns,
} from "@glideapps/glide-data-grid-source";
import {
  CustomCell,
  DataEditor,
  DataEditorProps,
  GetRowThemeCallback,
  GridCell,
  GridCellKind,
  GridColumn,
  GridMouseEventArgs,
  HeaderClickedEventArgs,
  Item,
  Highlight,
} from "@glideapps/glide-data-grid";
import { TreeViewCell } from "@glideapps/glide-data-grid-cells";

export interface DataGridColumn<T> {
  header: string;
  accessorKey: keyof T;
  width?: number;
  renderer?: (value: any, row: T) => GridCell;
}

export interface TreeGridConfig {
  isTreeGrid: true;
  treeColumnKey: string;
  depthAccessor: string;
  childIdsAccessor: string;
  idAccessor: string;
}

export interface DataGridProps<T> {
  data: T[] | ((state: any) => T[]);
  columns: DataGridColumn<T>[];
  treeConfig?: TreeGridConfig;
  defaultSortColumn?: string;
  defaultSortDirection?: "asc" | "desc";
}

export function DataGrid<T extends Record<string, any>>({
  data,
  columns: columnDefs,
  treeConfig,
  defaultSortColumn,
  defaultSortDirection = "desc",
}: DataGridProps<T>) {
  const [sortColumn, setSortColumn] = useState<GridColumn | undefined>(() => {
    if (!defaultSortColumn) return undefined;
    const defaultCol = columnDefs.find(
      (col) => col.accessorKey.toString() === defaultSortColumn
    );
    if (!defaultCol) return undefined;
    return {
      title: defaultCol.header,
      id: defaultCol.accessorKey.toString(),
      width: defaultCol.width ?? 150,
    };
  });
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    defaultSortDirection
  );
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [hoverRow, setHoverRow] = useState<number | undefined>(undefined);

  const [columns, setColumns] = useState<GridColumn[]>(() =>
    columnDefs.map((colDef) => ({
      title: colDef.header,
      id: colDef.accessorKey.toString(),
      width: colDef.width ?? 150,
    }))
  );
  const [highlightRegions, setHighlightRegions] = useState<Highlight[]>([]);

  // Update column titles when sort changes
  useEffect(() => {
    setColumns((prev) =>
      prev.map((col) => {
        const isSortColumn = sortColumn?.id === col.id;
        const sortIndicator = isSortColumn
          ? sortDirection === "asc"
            ? " ▲"
            : " ▼"
          : "";
        return {
          ...col,
          title:
            columnDefs.find((def) => def.accessorKey.toString() === col.id)
              ?.header + sortIndicator,
        };
      })
    );
  }, [columnDefs, sortColumn, sortDirection]);

  const rawData = data;
  const onItemHovered = useCallback((args: GridMouseEventArgs) => {
    const [_, row] = args.location;
    setHoverRow(args.kind !== "cell" ? undefined : row);
  }, []);

  const sortedData = useMemo(() => {
    if (!sortColumn) return rawData;

    const rootItems = treeConfig
      ? rawData.filter((item) => item[treeConfig.depthAccessor] === 0)
      : rawData;

    const sortedRoots = [...rootItems].sort((a, b) => {
      const aValue = a[sortColumn.id as keyof typeof a];
      const bValue = b[sortColumn.id as keyof typeof b];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      const modifier = sortDirection === "asc" ? 1 : -1;
      return aValue < bValue
        ? -1 * modifier
        : aValue > bValue
        ? 1 * modifier
        : 0;
    });

    if (!treeConfig) return sortedRoots;

    const result: T[] = [];
    const addItemWithChildren = (item: T) => {
      result.push(item);
      const childIds = item[treeConfig.childIdsAccessor] as string[];
      const children = childIds
        .map((childId) =>
          rawData.find((o) => o[treeConfig.idAccessor] === childId)
        )
        .filter((child): child is T => child !== undefined);

      children.forEach((child) => addItemWithChildren(child));
    };

    sortedRoots.forEach(addItemWithChildren);
    return result;
  }, [rawData, sortColumn, sortDirection, treeConfig]);

  const visibleData = useMemo(() => {
    if (!treeConfig) return sortedData;

    const visibleItems: T[] = [];
    const processItem = (item: T) => {
      visibleItems.push(item);
      const childIds = item[treeConfig.childIdsAccessor] as string[];

      if (
        childIds.length > 0 &&
        expandedRows.has(item[treeConfig.idAccessor])
      ) {
        for (const possibleChild of rawData) {
          if (childIds.includes(possibleChild[treeConfig.idAccessor])) {
            processItem(possibleChild);
          }
        }
      }
    };

    sortedData
      .filter((item) => item[treeConfig.depthAccessor] === 0)
      .forEach(processItem);

    return visibleItems;
  }, [sortedData, expandedRows, rawData, treeConfig]);

  const flashCell = (row: number, col: number) => {
    const region: Highlight = {
      color: "#FFFBCC", // flash color
      range: { x: col, y: row, width: 1, height: 1 },
    };
    setHighlightRegions((prev) => [...prev, region]);
    setTimeout(() => {
      setHighlightRegions((prev) => prev.filter((r) => r !== region));
    }, 1000);
  };

  // useEffect(() => {
  //   flashCell(1, 1);
  // }, [visibleData]);

  const getData = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const colId = columns[col]?.id;
      const item = visibleData[row];

      if (!item || !colId) {
        return {
          kind: GridCellKind.Loading,
          allowOverlay: false,
        };
      }

      const columnDef = columnDefs.find(
        (def) => def.accessorKey.toString() === colId
      );
      const value = item[colId];

      // Get base cell from custom renderer if provided
      let baseCell: GridCell = columnDef?.renderer
        ? columnDef.renderer(value, item)
        : {
            allowOverlay: false,
            readonly: true,
            kind: GridCellKind.Text,
            displayData: String(value),
            data: String(value),
          };

      if (treeConfig && colId === treeConfig.treeColumnKey) {
        const hasChildren =
          (item[treeConfig.childIdsAccessor] as string[]).length > 0;
        const isExpanded = expandedRows.has(item[treeConfig.idAccessor]);

        if (
          baseCell.kind === GridCellKind.Custom &&
          "kind" in baseCell.data &&
          baseCell.data.kind === "tree-view-cell"
        ) {
          const customCell = baseCell as CustomCell<any>;
          return {
            ...customCell,
            data: {
              ...customCell.data,
              canOpen: hasChildren,
              isOpen: isExpanded,
              onClickOpener: () => {
                setExpandedRows((prev) => {
                  const next = new Set(prev);
                  if (isExpanded) {
                    next.delete(item[treeConfig.idAccessor]);
                  } else {
                    next.add(item[treeConfig.idAccessor]);
                  }
                  return next;
                });
                return undefined;
              },
            },
          };
        }

        return {
          kind: GridCellKind.Custom,
          allowOverlay: false,
          readonly: true,
          copyData: String(value),
          data: {
            kind: "tree-view-cell",
            text: String(value),
            depth: item[treeConfig.depthAccessor],
            canOpen: hasChildren,
            isOpen: isExpanded,
            onClickOpener: () => {
              setExpandedRows((prev) => {
                const next = new Set(prev);
                if (isExpanded) {
                  next.delete(item[treeConfig.idAccessor]);
                } else {
                  next.add(item[treeConfig.idAccessor]);
                }
                return next;
              });
              return undefined;
            },
          },
        } as CustomCell<any>;
      }

      return baseCell;
    },
    [expandedRows, visibleData, columns, columnDefs, treeConfig]
  );

  const moveArgs = useMoveableColumns({
    columns,
    getCellContent: getData,
  });

  const sortArgs = useColumnSort({
    columns: moveArgs.columns,
    getCellContent: moveArgs.getCellContent,
    sort:
      sortColumn && visibleData.length > 0
        ? {
            column: sortColumn,
            direction: sortDirection,
            mode: "default", // Changed from "smart" to "default" to avoid parsing issues
          }
        : undefined,
    rows: visibleData.length,
  });

  const getRowThemeOverride = useCallback<GetRowThemeCallback>(
    (row) => {
      if (row !== hoverRow) return undefined;
      return {
        bgCell: "#17355D",
        bgCellMedium: "#17355D",
      };
    },
    [hoverRow]
  );

  return (
    <DataEditor
      {...sortArgs}
      columns={moveArgs.columns}
      columnSelect={"none"}
      getCellContent={moveArgs.getCellContent}
      onHeaderClicked={(col, event: HeaderClickedEventArgs) => {
        event.preventDefault();
        const column = moveArgs.columns[col];
        const newDirection =
          sortColumn?.id === column.id && sortDirection === "asc"
            ? "desc"
            : "asc";
        setSortColumn(column);
        setSortDirection(newDirection);
      }}
      onSelectionCleared={() => undefined}
      onColumnMoved={(col, newPos) => {
        const newColumns = [...columns];
        const [removed] = newColumns.splice(col, 1);
        newColumns.splice(newPos, 0, removed);
        setColumns(newColumns);
        moveArgs.onColumnMoved?.(col, newPos);
      }}
      onColumnResize={(column, newSize, colIndex) => {
        setColumns((prev) => {
          const newColumns = [...prev];
          newColumns[colIndex] = { ...newColumns[colIndex], width: newSize };
          return newColumns;
        });
      }}
      getCellsForSelection={true}
      rows={visibleData.length}
      verticalBorder={false}
      customRenderers={treeConfig?.isTreeGrid ? [TreeViewCell] : undefined}
      onItemHovered={onItemHovered}
      getRowThemeOverride={getRowThemeOverride}
      theme={{
        fontFamily: "Overpass, sans-serif",
        accentColor: "#0DBDFF",
        accentFg: "#FFFFFF",
        accentLight: "#0DBDFF",
        textDark: "#FFFFFF",
        textMedium: "#0DBDFF",
        textLight: "#FFFFFF",
        textBubble: "#81ff00",
        bgIconHeader: "#DDDDDD",
        fgIconHeader: "#81ff00",
        textHeader: "#DDDDDD",
        textGroupHeader: "#DDDDDD",
        textHeaderSelected: "#DDDDDD",
        bgCell: "#0F233E",
        bgCellMedium: "#0F233E",
        bgHeader: "#0F233E",
        bgHeaderHasFocus: "var(--color-primary)",
        bgHeaderHovered: "#17355D",
        bgBubble: "#81ff00",
        bgBubbleSelected: "#81ff00",
        bgSearchResult: "#81ff00",
        linkColor: "#81ff00",
        cellHorizontalPadding: 12,
        cellVerticalPadding: 0,
        headerFontStyle: "600 13px",
        baseFontStyle: "12px",
        lineHeight: 0.8,
      }}
      smoothScrollX={true}
      smoothScrollY={true}
      height={"100%"}
      width={"100%"}
    />
  );
}
