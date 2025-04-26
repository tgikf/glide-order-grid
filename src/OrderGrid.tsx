import { GridCellKind } from "@glideapps/glide-data-grid";
import { useEffect, useMemo, useState } from "react";
import { DataGrid, DataGridColumn, TreeGridConfig } from "./DataGrid";
import { useseUpdatingOrders } from "./useUpdatingOrders";
import { FXOrder, generateTestData } from "./utils";

// OrderGrid component
export const OrderGrid = () => {
  const [orders, setOrders] = useState<FXOrder[]>([]);

  // Generate data on component mount - create 5000 orders
  useEffect(() => {
    setOrders(generateTestData(10000, 2000));
  }, []);

  // generate order every 5 sec, fill after 2.5 sec
  // useseUpdatingOrders(setOrders, 2000, 1000);

  const columns: DataGridColumn<FXOrder>[] = useMemo(
    () => [
      { header: "Order ID", accessorKey: "id", width: 200 },
      { header: "Status", accessorKey: "status", width: 150 },
      {
        header: "Created",
        accessorKey: "createdTimestamp",
        width: 180,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: value instanceof Date ? value.toLocaleString() : "",
          data: value instanceof Date ? value.toISOString() : "",
          allowOverlay: false,
          readonly: true,
        }),
      },
      {
        header: "Updated",
        accessorKey: "updatedTimestamp",
        width: 180,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: value instanceof Date ? value.toLocaleString() : "",
          data: value instanceof Date ? value.toISOString() : "",
          allowOverlay: false,
          readonly: true,
        }),
      },
      {
        header: "Quantity",
        accessorKey: "orderQuantity",
        width: 120,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: value ? value.toLocaleString() : "0",
          data: value ? value.toString() : "0",
          allowOverlay: false,
          readonly: true,
        }),
      },
      {
        header: "Side",
        accessorKey: "side",
        width: 80,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: String(value),
          data: String(value),
          allowOverlay: false,
          readonly: true,
        }),
      },
      {
        header: "Filled",
        accessorKey: "filledQuantity",
        width: 120,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: value ? value.toLocaleString() : "0",
          data: value ? value.toString() : "0",
          allowOverlay: false,
          readonly: true,
        }),
      },
      {
        header: "Limit Price",
        accessorKey: "limitPrice",
        width: 120,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: value ? value.toFixed(4) : "0.0000",
          data: value ? value.toString() : "0",
          allowOverlay: false,
          readonly: true,
        }),
      },
      {
        header: "Filled Price",
        accessorKey: "filledPrice",
        width: 120,
        renderer: (value) => ({
          kind: GridCellKind.Text,
          displayData: value ? value.toFixed(4) : "-",
          data: value ? value.toString() : "",
          allowOverlay: false,
          readonly: true,
        }),
      },
      { header: "Trader", accessorKey: "trader", width: 150 },
      { header: "Venue", accessorKey: "venue", width: 80 },
      { header: "Account", accessorKey: "account", width: 120 },
      { header: "Strategy", accessorKey: "strategy", width: 150 },
    ],
    []
  );

  const treeConfig: TreeGridConfig = useMemo(
    () => ({
      isTreeGrid: true,
      treeColumnKey: "id",
      depthAccessor: "depth",
      childIdsAccessor: "childIds",
      idAccessor: "id",
    }),
    []
  );

  return (
    <div style={{ height: "100vh" }}>
      <DataGrid
        data={orders}
        columns={columns}
        treeConfig={treeConfig}
        defaultSortColumn="createdTimestamp"
        defaultSortDirection="desc"
      />
    </div>
  );
};

export default OrderGrid;
