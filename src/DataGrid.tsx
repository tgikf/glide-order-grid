import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  useColumnSort,
  useMoveableColumns,
} from "@glideapps/glide-data-grid-source";
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
  const [gridSelection, setGridSelection] = useState<GridSelection | undefined>(undefined);
  const [previousData, setPreviousData] = useState<T[]>([]);
  
  interface ChangeInfo {
    isNew?: boolean;
    updatedFields?: Map<string, {
      prevValue: any;
      newValue: any;
    }>;
    timestamp: number;
  }
  
  const [changedOrders, setChangedOrders] = useState<Map<string, ChangeInfo>>(new Map());

  const rawData = useMemo(() => {
    return typeof data === 'function' ? data({}) : data;
  }, [data]);

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
  
  useEffect(() => {
    setGridSelection(undefined);
  }, [sortColumn, sortDirection, rawData]);

  useEffect(() => {
    if (previousData.length === 0) {
      setPreviousData(JSON.parse(JSON.stringify(rawData)));
      return;
    }
    
    const prevDataMap = new Map<string, T>();
    
    for (let i = 0; i < previousData.length; i++) {
      const item = previousData[i];
      const id = (item as any).id;
      if (id !== undefined && id !== null) {
        prevDataMap.set(String(id), item);
      }
    }
    
    const newChanges = new Map<string, ChangeInfo>();
    const now = Date.now();
    
    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      const id = (item as any).id;
      if (id === undefined || id === null) continue;
      
      const idStr = String(id);
      
      if (!prevDataMap.has(idStr)) {
        newChanges.set(idStr, {
          isNew: true,
          timestamp: now
        });
        continue;
      }
      
      const prevItem = prevDataMap.get(idStr);
      const updatedFields = new Map<string, { prevValue: any; newValue: any }>();
      
      for (let j = 0; j < columns.length; j++) {
        const col = columns[j];
        if (!col.id){
          console.error('Failed column comparison, id missing', col)
          continue
        }
        const fieldId = col.id;
        const currentValue = item[fieldId as keyof T];
        const previousValue = prevItem?.[fieldId as keyof T];
        
        if (JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
          const colIndex = columns.findIndex(col => col.id === fieldId);
          
          updatedFields.set(fieldId, {
            prevValue: previousValue,
            newValue: currentValue
          });
        }
      }
      
      if (updatedFields.size > 0) {
        newChanges.set(idStr, {
          updatedFields,
          timestamp: now
        });
      }
    }
    
    setChangedOrders(prev => {
      const merged = new Map(prev);
      
      const entries = Array.from(newChanges.entries());
      for (let i = 0; i < entries.length; i++) {
        const [id, changeInfo] = entries[i];
        
        if (merged.has(id)) {
          const existing = merged.get(id)!;
          
          merged.set(id, {
            isNew: changeInfo.isNew || existing.isNew,
            updatedFields: changeInfo.updatedFields 
              ? new Map([...(existing.updatedFields || new Map()), ...(changeInfo.updatedFields)])
              : existing.updatedFields,
            timestamp: changeInfo.timestamp
          });
        } else {
          merged.set(id, changeInfo);
        }
      }
      
      return merged;
    });
    
    setPreviousData(JSON.parse(JSON.stringify(rawData)));
  }, [rawData, columns]);
  
  const onItemHovered = useCallback((args: GridMouseEventArgs) => {
    const [_, row] = args.location;
    setHoverRow(args.kind !== "cell" ? undefined : row);
  }, []);
  
  const onGridSelectionChange = useCallback((newSelection: GridSelection) => {
    setGridSelection(newSelection);
  }, []);

  const createSortComparator = useCallback((column: GridColumn, direction: "asc" | "desc") => {
    return (a: T, b: T) => {
      const aValue = a[column.id as keyof typeof a];
      const bValue = b[column.id as keyof typeof b];
      
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      const modifier = direction === "asc" ? 1 : -1;
      return aValue < bValue ? -1 * modifier : aValue > bValue ? 1 * modifier : 0;
    };
  }, []);

  const processedData = useMemo(() => {
    if (!treeConfig) {
      if (!sortColumn) return rawData;
      
      return [...rawData].sort(createSortComparator(sortColumn, sortDirection));
    }
    
    if (treeConfig) {
      const config = treeConfig!;
      
      const itemsById = new Map<string, T>();
      const childrenByParentId = new Map<string, T[]>();
      
      for (let i = 0; i < rawData.length; i++) {
        const item = rawData[i];
        const id = item[config.idAccessor];
        if (id !== undefined && id !== null) {
          itemsById.set(String(id), item);
          
          const parentId = item.parentId;
          if (parentId !== undefined && parentId !== null) {
            const parentIdStr = String(parentId);
            if (!childrenByParentId.has(parentIdStr)) {
              childrenByParentId.set(parentIdStr, []);
            }
            childrenByParentId.get(parentIdStr)!.push(item);
          }
        }
      }
      
      const rootItems: T[] = [];
      for (let i = 0; i < rawData.length; i++) {
        const item = rawData[i];
        if (item[config.depthAccessor] === 0) {
          rootItems.push(item);
        }
      }
    
      if (sortColumn) {
        rootItems.sort(createSortComparator(sortColumn, sortDirection));
      }
      
      const result: T[] = [];
      
      function processItem(item: T, isVisible: boolean) {
        if (isVisible) {
          result.push(item);
        }
        
        const id = item[config.idAccessor];
        if (id === undefined || id === null) return;
        
        const childIds = item[config.childIdsAccessor] as string[];
        
        const children: T[] = [];
        for (let i = 0; i < childIds.length; i++) {
          const childId = childIds[i];
          const child = itemsById.get(childId);
          if (child) {
            children.push(child);
          }
        }
        
        if (sortColumn && children.length > 0) {
          children.sort(createSortComparator(sortColumn, sortDirection));
        }
        
        const idStr = String(id);
        const isExpanded = expandedRows.has(idStr);
        for (let i = 0; i < children.length; i++) {
          processItem(children[i], isVisible && isExpanded);
        }
      }
      
      for (let i = 0; i < rootItems.length; i++) {
        processItem(rootItems[i], true);
      }
      
      return result;
    }
    
    return rawData;
  }, [rawData, sortColumn, sortDirection, treeConfig, expandedRows, createSortComparator]);


  const handleDrawCell = useCallback((args: any, drawCell: Function) => {
    const { ctx, rect, col, row } = args;
    
    const item = processedData[row];
    if (!item) {
      drawCell();
      return;
    }
    
    const colId = columns[col]?.id;
    if (!colId) {
      drawCell();
      return;
    }
    
    const orderId = item.id;
    const changeInfo = changedOrders.get(String(orderId));
    
    if (changeInfo) {
      const isNewOrder = changeInfo.isNew;
      const isUpdatedField = changeInfo.updatedFields?.has(colId);
      
      if (isNewOrder || isUpdatedField) {
        const now = Date.now();
        const elapsed = now - changeInfo.timestamp;
        const flashDuration = 5000;
        
        if (elapsed < flashDuration) {
          const fadeOutStart = flashDuration * 0.7;
          let opacity = 0.7;
          
          if (elapsed > fadeOutStart) {
            const fadeProgress = (elapsed - fadeOutStart) / (flashDuration - fadeOutStart);
            opacity = 0.7 * (1 - fadeProgress);
          }
          
          const flashPeriod = 1500;
          const flashProgress = (elapsed % flashPeriod) / flashPeriod;
          
          const pulseOpacity = Math.sin(flashProgress * Math.PI) * opacity;
          
          ctx.save();
          
          const inset = 1;
          ctx.globalAlpha = pulseOpacity;
          ctx.fillStyle = '#00796b';
          ctx.fillRect(
            rect.x + inset, 
            rect.y + inset, 
            rect.width - (inset * 2), 
            rect.height - (inset * 2)
          );
          
          ctx.globalAlpha = 1.0;
          ctx.restore();
          
          args.requestAnimationFrame();
        }
      }
    }
    
    drawCell();
  }, [processedData, columns, changedOrders]);

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const expirationTime = 2000;
      
      setChangedOrders(prev => {
        const updated = new Map(prev);
        let hasChanges = false;
        
        const entries = Array.from(updated.entries());
        for (let i = 0; i < entries.length; i++) {
          const [id, info] = entries[i];
          
          if (now - info.timestamp > expirationTime) {
            updated.delete(id);
            hasChanges = true;
          }
        }
        
        return hasChanges ? updated : prev;
      });
    }, 500);
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  const getData = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const colId = columns[col]?.id;
      const item = processedData[row];

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
          (item[config.childIdsAccessor] as string[]).length > 0;
        const isExpanded = expandedRows.has(item[config.idAccessor]);
        
        const createToggleHandler = () => {
          return () => {
            setExpandedRows((prev) => {
              const next = new Set(prev);
              if (isExpanded) {
                const idToDelete = item[config.idAccessor];
                if (idToDelete !== undefined && idToDelete !== null) {
                  next.delete(String(idToDelete));
                }
              } else {
                const idToAdd = item[config.idAccessor];
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
          baseCell.data.kind === "tree-view-cell"
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
    [expandedRows, processedData, columns, columnDefs, treeConfig]
  );

  const moveArgs = useMoveableColumns({
    columns,
    getCellContent: getData,
  });

  const sortArgs = useColumnSort({
    columns: moveArgs.columns,
    getCellContent: moveArgs.getCellContent,
    sort:
      sortColumn && processedData.length > 0
        ? {
            column: sortColumn,
            direction: sortDirection,
            mode: "default",
          }
        : undefined,
    rows: processedData.length,
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
      drawCell={handleDrawCell}
      columns={moveArgs.columns}
      columnSelect={"none"}
      getCellContent={moveArgs.getCellContent}
      gridSelection={gridSelection}
      onGridSelectionChange={onGridSelectionChange}
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
      rows={processedData.length}
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
      rightElement={
        <div style={{
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
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)"
        }}>
          <span>Displayed rows: {processedData.length}</span>
          <span>Total rows: {rawData.length}</span>
        </div>
      }
      rightElementProps={{
        sticky: true
      }}
    />
  );
}
