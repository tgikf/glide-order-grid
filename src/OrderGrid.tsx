import { GridCell, GridCellKind } from "@glideapps/glide-data-grid";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid } from "./data-grid/DataGrid.tsx";
import { usesUpdatingOrders } from "./mock/useUpdatingOrders.ts";
import { FXOrder, generateTestData } from "./mock/utils.ts";
import { DataGridColumn } from "./data-grid/DataGridColumn.ts";
import { TreeGridConfig } from "./hooks/useTreeStructure.ts";
import { gridTheme } from "./data-grid/static.ts";

export const OrderGrid = () => {
  const [orders, setOrders] = useState<FXOrder[]>([]);

  useEffect(() => {
    setOrders(generateTestData(12000, 2000));
  }, []);

  usesUpdatingOrders(setOrders, 1500, 5000);

  const [columns, setColumns] = useState<DataGridColumn<FXOrder>[]>([]);
  const [sortColumnId, setSortColumnId] = useState<string>("createdTimestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const cancelOrderAndChildren = useCallback((rootOrder: FXOrder) => {
    setOrders((prevOrders) => {
      const orderMap = new Map<string, FXOrder>(
        prevOrders.map((o) => [o.id, o]),
      );
      const idsToCancel = new Set<string>();

      const collectIds = (id: string) => {
        idsToCancel.add(id);
        const order = orderMap.get(id);
        order?.childIds.forEach(collectIds);
      };

      collectIds(rootOrder.id);

      return prevOrders.map((order) => {
        if (idsToCancel.has(order.id)) {
          return {
            ...order,
            status: "CANCELLED",
            updatedTimestamp: new Date(),
          };
        }
        return order;
      });
    });
  }, []);

  useEffect(() => {
    setColumns([
      {
        title: "Order ID",
        id: "id",
        width: 200,
        visible: true,
        renderer: (value: any, row: FXOrder): GridCell => {
          const buttons = [];
          const canCancel =
            ["NEW", "PARTIALLY_FILLED"].includes(row.status) && row.depth === 0;

          if (canCancel) {
            buttons.push({
              backgroundColor: [
                gridTheme.bgHeaderHovered,
                gridTheme.accentLight,
              ],
              color: [gridTheme.textBubble, gridTheme.textLight],
              borderColor: gridTheme.accentLight,
              borderRadius: 1.2,
              title: `CANCEL`,
              onClick: () => cancelOrderAndChildren(row),
            });
          }

          return {
            kind: GridCellKind.Custom,
            allowOverlay: false,
            readonly: true,
            copyData: String(value),
            data: {
              kind: "tree-view-buttons-cell",
              text: String(value),
              uniqueKey: `${row.id}-status`,
              depth: row.depth,
              canOpen: false,
              buttons,
            },
          };
        },
      },
      { title: "Status", id: "status", width: 150, visible: true },
      {
        title: "Created",
        id: "createdTimestamp",
        width: 180,
        visible: true,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: value instanceof Date ? value.toLocaleString() : "",
          data: value instanceof Date ? value.toISOString() : "",
          allowOverlay: false,
          readonly: true,
        }),
      },
      {
        title: "Updated",
        id: "updatedTimestamp",
        width: 180,
        visible: true,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: value instanceof Date ? value.toLocaleString() : "",
          data: value instanceof Date ? value.toISOString() : "",
          allowOverlay: false,
          readonly: true,
        }),
      },
      {
        title: "Quantity",
        id: "orderQuantity",
        width: 120,
        visible: true,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: value ? value.toLocaleString() : "0",
          data: value ? value.toString() : "0",
          allowOverlay: false,
          readonly: true,
        }),
      },
      {
        title: "Side",
        id: "side",
        width: 80,
        visible: true,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: String(value),
          data: String(value),
          allowOverlay: false,
          readonly: true,
        }),
      },
      {
        title: "Filled",
        id: "filledQuantity",
        width: 120,
        visible: true,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: value ? value.toLocaleString() : "0",
          data: value ? value.toString() : "0",
          allowOverlay: false,
          readonly: true,
        }),
      },
      {
        title: "Limit Price",
        id: "limitPrice",
        width: 120,
        visible: true,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: value ? value.toFixed(4) : "0.0000",
          data: value ? value.toString() : "0",
          allowOverlay: false,
          readonly: true,
        }),
      },
      {
        title: "Filled Price",
        id: "filledPrice",
        width: 120,
        visible: true,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: value ? value.toFixed(4) : "-",
          data: value ? value.toString() : "",
          allowOverlay: false,
          readonly: true,
        }),
      },
      {
        title: "Trader",
        id: "trader",
        width: 150,
        visible: true,
        renderer: (value) => ({
          kind: GridCellKind.Custom,
          allowOverlay: false,
          readonly: true,
          copyData: value,
          data: {
            displayData: value,
            kind: "multiline-text-cell",
          },
        }),
      },
      { title: "Venue", id: "venue", width: 80, visible: true },
      { title: "Account", id: "account", width: 120, visible: true },
      { title: "Strategy", id: "strategy", width: 150, visible: true },
    ]);
  }, [cancelOrderAndChildren]);

  const onColumnsChange = useCallback((newColumnState: any[]) => {
    setColumns((prevColumns) => {
      return newColumnState.map((state) => {
        const existingColumn = prevColumns.find((col) => col.id === state.id);
        return {
          ...existingColumn,
          ...state,
          visible: true, // DataGrid currently assumes visible: true for all columns in this state
        } as DataGridColumn<FXOrder>;
      });
    });
  }, []);

  const onSortChange = useCallback(
    (column: any | undefined, direction: "asc" | "desc") => {
      setSortColumnId(column?.id);
      setSortDirection(direction);
    },
    [],
  );

  const treeConfig: TreeGridConfig = useMemo(
    () => ({
      isTreeGrid: true,
      treeColumnKey: "id",
      depthAccessor: "depth",
      childIdsAccessor: "childIds",
      idAccessor: "id",
    }),
    [],
  );

  return (
    <div style={{ height: "100vh" }}>
      <DataGrid
        data={orders}
        idKey="id"
        columns={columns}
        treeConfig={treeConfig}
        sortColumn={columns.find((c) => c.id === sortColumnId)}
        sortDirection={sortDirection}
        onColumnsChange={onColumnsChange}
        onSortChange={onSortChange}
      />
    </div>
  );
};

export default OrderGrid;
