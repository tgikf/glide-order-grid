import { GridCell } from "@glideapps/glide-data-grid";

export interface DataGridColumn<T> {
  title: string;
  id: string;
  visible: true;
  width?: number;
  renderer?: (value: any, row: T) => GridCell;
  sort?: "asc" | "desc";
  filter?: { val: string; disabled: boolean };
}

export type GridColumnState = Pick<
  DataGridColumn<any>,
  "title" | "id" | "width" | "sort" | "filter"
>;
