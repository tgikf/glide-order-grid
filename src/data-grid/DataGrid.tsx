import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@glideapps/glide-data-grid/dist/index.css";
import { useMoveableColumns } from "@glideapps/glide-data-grid-source";
import {
  CustomCell,
  DataEditor,
  GetRowThemeCallback,
  GridCell,
  GridCellKind,
  GridColumn,
  GridMouseEventArgs,
  GridSelection,
  HeaderClickedEventArgs,
  Item,
} from "@glideapps/glide-data-grid";
import { TreeGridConfig, useTreeStructure } from "../hooks/useTreeStructure.ts";
import { DataGridColumn, GridColumnState } from "./DataGridColumn.ts";
import { useColumnFilterInputs } from "../hooks/useColumnFilterInputs.tsx";
import { useFilteredAndSortedData } from "../hooks/useFilteredAndSortedData.ts";
import { TreeViewButtonsCellRenderer } from "../custom-cells/TreeViewButtonsCell.ts";
import { MultilineTextCellRenderer } from "../custom-cells/MultiLineTextCell.ts";
import { getDrawCell, getDrawHeader } from "./drawing-utils.ts";
import { gridTheme, ID_SEPARATOR } from "./static.ts";

export interface DataGridProps<T> {
  data: T[];
  columns: DataGridColumn<T>[];
  idKey: string;
  treeConfig?: TreeGridConfig;
  sortColumn?: GridColumn;
  sortDirection?: "asc" | "desc";
  onColumnsChange?: (columns: GridColumnState[]) => void;
  onSortChange?: (
    column: GridColumn | undefined,
    direction: "asc" | "desc",
  ) => void;
  showFilters?: boolean;
}

export function DataGrid<T extends Record<string, any>>({
  data: rawData,
  columns: columnDefs,
  idKey,
  treeConfig,
  sortColumn,
  sortDirection = "desc",
  onColumnsChange,
  onSortChange,
  showFilters = true,
}: DataGridProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [hoverRow, setHoverRow] = useState<number | undefined>(undefined);
  const [gridSelection, setGridSelection] = useState<GridSelection | undefined>(
    undefined,
  );

  const COL_TITLE_TEXT_AREA_HEIGHT = 30;
  const COL_TITLE_HEIGHT = showFilters ? 65 : COL_TITLE_TEXT_AREA_HEIGHT;
  const gridRef = useRef<HTMLDivElement>(null);
  const cellUpdatesRef = useRef<Map<string, number>>(new Map());
  const previousDataRef = useRef<Map<string, T>>(new Map());
  const frameTimeRef = useRef<number>(0);
  const treeStructure = useTreeStructure(rawData, idKey, treeConfig);

  const createSortComparator = useCallback(
    (column: GridColumn, direction: "asc" | "desc") => {
      return (a: T, b: T) => {
        const aValue = a[column.id as keyof typeof a];
        const bValue = b[column.id as keyof typeof b];

        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        const modifier = direction === "asc" ? 1 : -1;
        return aValue < bValue
          ? -1 * modifier
          : aValue > bValue
            ? 1 * modifier
            : 0;
      };
    },
    [],
  );

  const getDisplayValue = useCallback(
    (item: T, fieldId: string): string => {
      const columnDef = columnDefs.find((def) => def.id === fieldId);
      if (!columnDef) return String(item[fieldId as keyof T] || "");

      // If there's a renderer, use it to get the display value
      if (columnDef.renderer) {
        const renderedCell = columnDef.renderer(item[fieldId as keyof T], item);

        // Handle different cell kinds to extract display value
        if (renderedCell.kind === GridCellKind.Text) {
          return renderedCell.displayData || String(renderedCell.data || "");
        } else if (renderedCell.kind === GridCellKind.Number) {
          return String(renderedCell.displayData || renderedCell.data || "");
        } else if (
          renderedCell.kind === GridCellKind.Custom &&
          "copyData" in renderedCell
        ) {
          return String(renderedCell.copyData || "");
        } else if ("displayData" in renderedCell) {
          return String(renderedCell.displayData || "");
        } else if ("data" in renderedCell) {
          // For custom cells that might have nested data
          const data = renderedCell.data;
          if (typeof data === "object" && data !== null && "text" in data) {
            return String(data.text || "");
          }
          return String(data || "");
        }
      }

      // Fallback to the raw value as string
      return String(item[fieldId as keyof T] || "");
    },
    [columnDefs],
  );

  const handleFilterChange = useCallback(
    (colId: string, value: string) => {
      if (!onColumnsChange) return;

      const updatedColumns = columnDefs.map((col) =>
        col.id === colId
          ? {
              id: col.id,
              title: col.title,
              visible: col.visible,
              width: col.width,
              sort: sortColumn?.id === col.id ? sortDirection : col.sort,
              filter: { val: value, disabled: false },
            }
          : {
              id: col.id,
              title: col.title,
              visible: col.visible,
              width: col.width,
              sort: sortColumn?.id === col.id ? sortDirection : col.sort,
              filter: col.filter,
            },
      );

      onColumnsChange(updatedColumns);
    },
    [columnDefs, onColumnsChange, sortColumn, sortDirection],
  );

  const columnFilters = useMemo(() => {
    return columnDefs.reduce(
      (acc, col) => {
        if (col.filter) {
          acc[col.id] = col.filter;
        }
        return acc;
      },
      {} as Record<string, { val: string; disabled: boolean }>,
    );
  }, [columnDefs]);

  const { updateInputPositions, headerInputsJSX } = useColumnFilterInputs({
    columns: columnDefs,
    gridRef,
    headerTextAreaHeight: COL_TITLE_TEXT_AREA_HEIGHT,
    onFilterChange: handleFilterChange,
  });

  const { data: filteredAndSortedData, ids: filteredAndSortedIds } =
    useFilteredAndSortedData(
      rawData,
      columnFilters,
      sortColumn,
      sortDirection,
      createSortComparator,
      treeStructure,
      idKey,
      treeConfig,
      getDisplayValue,
    );

  const processedData = useMemo(() => {
    const now = Date.now();
    const newCellUpdates = new Map(cellUpdatesRef.current);
    const prevRawDataMap = previousDataRef.current;

    const detectChangesForItem = (item: T) => {
      const idStr = String(item[idKey]);
      const prevItem = prevRawDataMap.get(idStr);

      if (!prevItem) {
        for (let j = 0; j < columnDefs.length; j++) {
          const col = columnDefs[j];
          if (col.visible && col.id) {
            newCellUpdates.set(`${idStr}${ID_SEPARATOR}${col.id}`, now);
          }
        }
      } else {
        for (let j = 0; j < columnDefs.length; j++) {
          const col = columnDefs[j];
          if (!col.visible || !col.id) continue;

          const currentValue = item[col.id];
          const previousValue = prevItem[col.id];

          // short circuit primitive values and null: much faster and much more common
          if (currentValue === previousValue) {
            continue;
          }
          const isPrimitive =
            currentValue == null ||
            typeof currentValue === "string" ||
            typeof currentValue === "number" ||
            typeof currentValue === "boolean" ||
            typeof currentValue === "bigint" ||
            typeof currentValue === "symbol";

          if (isPrimitive) {
            newCellUpdates.set(`${idStr}${ID_SEPARATOR}${col.id}`, now);
          } else if (
            JSON.stringify(currentValue) !== JSON.stringify(previousValue)
          ) {
            newCellUpdates.set(`${idStr}${ID_SEPARATOR}${col.id}`, now);
          }
        }
      }
    };

    if (prevRawDataMap.size === 0) {
      for (let i = 0; i < rawData.length; i++) {
        const item = rawData[i];
        const id = item[idKey];
        if (id !== undefined && id !== null) {
          prevRawDataMap.set(String(id), item);
        }
      }
    }

    // Tree processing with integrated change detection
    let finalData: T[];
    if (!treeConfig || !treeStructure) {
      // No tree - just do change detection on filtered data and return it
      for (let i = 0; i < filteredAndSortedData.length; i++) {
        detectChangesForItem(filteredAndSortedData[i]);
      }
      finalData = filteredAndSortedData;
    } else {
      const result: T[] = [];

      function processItem(item: T, isVisible: boolean) {
        if (!isVisible || !treeStructure) return;

        detectChangesForItem(item);
        result.push(item);

        const id = item[idKey];
        if (id === undefined || id === null) return;

        const idStr = String(id);
        const childIds = treeStructure.getDescendants(idStr);

        if (childIds && childIds.length > 0) {
          const isExpanded = expandedRows.has(idStr);
          if (!isExpanded) return;

          for (let i = 0; i < childIds.length; i++) {
            const childId = childIds[i];
            if (filteredAndSortedIds.has(childId)) {
              const childItem = treeStructure.itemsById.get(childId);
              if (childItem) {
                processItem(childItem, true);
              }
            }
          }
        }
      }

      for (let i = 0; i < filteredAndSortedData.length; i++) {
        const item = filteredAndSortedData[i];
        const currentId = String(item[idKey]);
        const isRoot =
          treeStructure.rootIdByItemId.get(currentId) === currentId;
        if (isRoot) {
          processItem(item, true);
        }
      }

      finalData = result;
    }

    const newRawDataMap = new Map<string, T>();
    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      const id = item[idKey];
      if (id !== undefined && id !== null) {
        newRawDataMap.set(String(id), item);
      }
    }
    previousDataRef.current = newRawDataMap;

    // Clean up cell updates for items no longer visible
    const visibleIds = new Set(filteredAndSortedIds);
    for (const [cellKey] of newCellUpdates) {
      const separatorIndex = cellKey.indexOf(ID_SEPARATOR);
      const itemId = cellKey.substring(0, separatorIndex);
      if (!visibleIds.has(itemId)) {
        newCellUpdates.delete(cellKey);
      }
    }

    cellUpdatesRef.current = newCellUpdates;
    frameTimeRef.current = now;

    return finalData;
  }, [
    rawData,
    filteredAndSortedData,
    filteredAndSortedIds,
    columnDefs,
    idKey,
    treeConfig,
    treeStructure,
    expandedRows,
  ]);

  useEffect(() => {
    setGridSelection(undefined);
  }, [sortColumn, sortDirection, rawData]);

  useEffect(() => {
    if (
      !treeConfig ||
      !treeStructure ||
      Object.keys(columnFilters).filter((key) => columnFilters[key]).length ===
        0
    ) {
      return;
    }

    const nodesToExpand = new Set<string>();

    for (let i = 0; i < filteredAndSortedData.length; i++) {
      const item = filteredAndSortedData[i];
      const id = item[idKey];

      if (id !== undefined && id !== null) {
        const ancestors = treeStructure.getAncestors(String(id));
        for (let j = 0; j < ancestors.length; j++) {
          nodesToExpand.add(ancestors[j]);
        }
      }
    }

    if (nodesToExpand.size > 0) {
      setExpandedRows((prev) => {
        const next = new Set(prev);
        const initialSize = next.size;
        for (const nodeId of nodesToExpand) {
          next.add(nodeId);
        }
        return next.size === initialSize ? prev : next;
      });
    }
  }, [columnFilters, treeStructure, treeConfig, filteredAndSortedData, idKey]);

  const onItemHovered = useCallback((args: GridMouseEventArgs) => {
    const [_, row] = args.location;
    setHoverRow(args.kind !== "cell" ? undefined : row);
  }, []);

  const onGridSelectionChange = useCallback((newSelection: GridSelection) => {
    setGridSelection(newSelection);
  }, []);

  const getData = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const colId = columnDefs[col]?.id;
      const item = processedData[row];

      if (!item || !colId) {
        return {
          kind: GridCellKind.Loading,
          allowOverlay: false,
        };
      }

      const columnDef = columnDefs.find((def) => def.id === colId);
      const value = item[colId];

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
        const config = treeConfig!;

        const hasChildren =
          treeStructure?.hasChildren(String(item[idKey])) ?? false;
        const isExpanded = expandedRows.has(item[idKey]);

        const createToggleHandler = () => {
          return () => {
            setExpandedRows((prev) => {
              const next = new Set(prev);
              if (isExpanded) {
                const idToDelete = item[idKey];
                if (idToDelete !== undefined && idToDelete !== null) {
                  next.delete(String(idToDelete));
                }
              } else {
                const idToAdd = item[idKey];
                if (idToAdd !== undefined && idToAdd !== null) {
                  next.add(String(idToAdd));
                }
              }
              return next;
            });
            return undefined;
          };
        };

        if (
          baseCell.kind === GridCellKind.Custom &&
          "kind" in baseCell.data &&
          baseCell.data.kind === "tree-view-buttons-cell"
        ) {
          const customCell = baseCell as CustomCell<any>;
          return {
            ...customCell,
            data: {
              ...customCell.data,
              canOpen: hasChildren,
              isOpen: isExpanded,
              onClickOpener: createToggleHandler(),
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
            depth: item[config.depthAccessor],
            canOpen: hasChildren,
            isOpen: isExpanded,
            onClickOpener: createToggleHandler(),
          },
        } as CustomCell<any>;
      }

      return baseCell;
    },
    [expandedRows, processedData, columnDefs, treeConfig, treeStructure, idKey],
  );

  const moveArgs = useMoveableColumns({
    columns: columnDefs,
    getCellContent: getData,
  });

  const getRowThemeOverride = useCallback<GetRowThemeCallback>(
    (row) => {
      if (row !== hoverRow) return undefined;
      return {
        bgCell: gridTheme.bgHeaderHovered,
        bgCellMedium: gridTheme.bgHeaderHovered,
      };
    },
    [hoverRow],
  );

  const drawHeader = useCallback(
    (args: any) =>
      getDrawHeader(
        sortDirection,
        columnDefs,
        COL_TITLE_TEXT_AREA_HEIGHT,
        sortColumn,
      )(args),
    [columnDefs, sortColumn, sortDirection],
  );

  const drawCellRef = useRef<(args: any, draw: Function) => void>();

  drawCellRef.current = (args: any, draw: Function) => {
    frameTimeRef.current = Date.now();
    return getDrawCell(
      processedData,
      columnDefs,
      cellUpdatesRef.current, // back to .current, read at call time
      idKey,
      frameTimeRef.current,
    )(args, draw);
  };

  const drawCell = useCallback((args: any, draw: Function) => {
    return drawCellRef.current!(args, draw);
  }, []);

  // const drawCell = useCallback(
  //   (args: any, draw: Function) => {
  //     frameTimeRef.current = Date.now(); // Update frame time on each draw
  //     console.log('drawCell, cellUpdatesRef', cellUpdatesRef.current)
  //     return getDrawCell(
  //       processedData,
  //       columnDefs,
  //       cellUpdatesRef,
  //       idKey,
  //       frameTimeRef.current,
  //     )(args, draw);
  //   },
  //   [processedData, columnDefs, idKey],
  // );

  const onHeaderClicked = useCallback(
    (colIndex: number, args: HeaderClickedEventArgs) => {
      if (args.localEventY < COL_TITLE_TEXT_AREA_HEIGHT) {
        const column = moveArgs.columns[colIndex];
        const newDirection =
          sortColumn?.id === column.id && sortDirection === "asc"
            ? "desc"
            : "asc";

        onSortChange?.(column, newDirection);
      }
    },
    [moveArgs.columns, sortColumn, sortDirection, onSortChange],
  );

  const onColumnProposeMove = useCallback(
    (startIndex: number, endIndex: number) => {
      if (startIndex === endIndex) return true;

      // Create a temporary column order based on the proposed move
      const tempColumns = [...moveArgs.columns] as DataGridColumn<T>[];
      const [movedColumn] = tempColumns.splice(startIndex, 1);
      tempColumns.splice(endIndex, 0, movedColumn);

      updateInputPositions(tempColumns);
      return true;
    },
    [moveArgs.columns, updateInputPositions],
  );

  return (
    <div ref={gridRef} className="relative size-full text-foreground">
      <DataEditor
        onColumnProposeMove={onColumnProposeMove}
        drawCell={drawCell}
        drawHeader={drawHeader}
        headerHeight={COL_TITLE_HEIGHT}
        columns={moveArgs.columns}
        columnSelect={"none"}
        getCellContent={moveArgs.getCellContent}
        gridSelection={gridSelection}
        onGridSelectionChange={onGridSelectionChange}
        onHeaderClicked={onHeaderClicked}
        onSelectionCleared={() => undefined}
        onColumnMoved={(col, newPos) => {
          if (!onColumnsChange) return;

          const newColumns = [...columnDefs];
          const [removed] = newColumns.splice(col, 1);
          newColumns.splice(newPos, 0, removed);

          const updatedColumns = newColumns.map((column) => ({
            id: column.id,
            title: column.title,
            visible: column.visible,
            width: column.width,
            sort: sortColumn?.id === column.id ? sortDirection : column.sort,
            filter: column.filter,
          }));

          onColumnsChange(updatedColumns);
          updateInputPositions(newColumns);
          moveArgs.onColumnMoved?.(col, newPos);
        }}
        onColumnResize={(_, newSize, colIndex) => {
          if (!onColumnsChange) return;

          const updatedColumns = columnDefs.map((col, idx) => ({
            id: col.id,
            title: col.title,
            visible: col.visible,
            width: idx === colIndex ? newSize : col.width,
            sort: sortColumn?.id === col.id ? sortDirection : col.sort,
            filter: col.filter,
          }));

          onColumnsChange(updatedColumns);
          updateInputPositions(updatedColumns as DataGridColumn<T>[]);
        }}
        getCellsForSelection={true}
        rows={processedData.length}
        verticalBorder={false}
        customRenderers={
          treeConfig?.isTreeGrid
            ? [TreeViewButtonsCellRenderer, MultilineTextCellRenderer]
            : [MultilineTextCellRenderer]
        }
        onItemHovered={onItemHovered}
        getRowThemeOverride={getRowThemeOverride}
        rowHeight={38}
        theme={gridTheme}
        smoothScrollX={true}
        smoothScrollY={true}
        height={"100%"}
        width={"100%"}
        maxColumnWidth={9999}
        rightElement={
          <div
            style={{
              height: "100%",
              padding: "8px 12px",
              display: "flex",
              justifyContent: "start",
              flexDirection: "column",
              backgroundColor: "#0F233E",
              color: "#DDDDDD",
              fontFamily: "Overpass, sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <span>Displayed rows: {processedData.length}</span>
            <span>Total rows: {rawData.length}</span>
          </div>
        }
        rightElementProps={{
          sticky: true,
        }}
      />
      {showFilters && headerInputsJSX}
    </div>
  );
}
