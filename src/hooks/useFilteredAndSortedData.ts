import { useMemo } from "react";
import { GridColumn } from "@glideapps/glide-data-grid";
import { TreeGridConfig, TreeStructure } from "./useTreeStructure.ts";

function itemMatchesFilters<T>(
  item: T,
  activeFilters: Array<[string, { val: string; disabled: boolean }]>,
  getDisplayValue: (item: T, fieldId: string) => string,
): boolean {
  return activeFilters.every(([fieldId, filterValue]) => {
    const displayValue = getDisplayValue(item, fieldId);
    return displayValue.toLowerCase().includes(filterValue.val.toLowerCase());
  });
}

export function useFilteredAndSortedData<T extends Record<string, any>>(
  rawData: T[],
  columnFilters: Record<string, { val: string; disabled: boolean }>,
  sortColumn: GridColumn | undefined,
  sortDirection: "asc" | "desc",
  createSortComparator: (
    column: GridColumn,
    direction: "asc" | "desc",
  ) => (a: T, b: T) => number,
  treeStructure: TreeStructure<T> | null,
  dataIdKey: string,
  treeConfig: TreeGridConfig | undefined,
  getDisplayValue: (item: T, fieldId: string) => string,
): { data: T[]; ids: Set<string> } {
  return useMemo(() => {
    const activeFilters = Object.entries(columnFilters).filter(
      ([_, filterValue]) => filterValue?.val && filterValue.val.trim(),
    );

    const compareFn = sortColumn
      ? createSortComparator(sortColumn, sortDirection)
      : null;
    const idKey = dataIdKey || "id";

    if (activeFilters.length === 0) {
      // Single traversal for copy + ID collection
      const data: T[] = [];
      const ids = new Set<string>();

      for (let i = 0; i < rawData.length; i++) {
        const item = rawData[i];
        data.push(item);
        const id = item[idKey];
        if (id != null) ids.add(String(id));
      }

      // Conditionally sort if needed
      if (compareFn) {
        data.sort(compareFn);
      }

      return { data, ids };
    }

    if (!treeConfig || !treeStructure) {
      // Non-tree: filter and sort in one pass
      const result: T[] = [];
      const ids = new Set<string>();

      for (let i = 0; i < rawData.length; i++) {
        const item = rawData[i];
        if (itemMatchesFilters(item, activeFilters, getDisplayValue)) {
          const id = item[idKey];
          if (id != null) ids.add(String(id));

          if (!compareFn) {
            result.push(item);
          } else {
            // Insert in sorted position - no separate sort pass!
            insertSorted(result, item, compareFn);
          }
        }
      }
      return { data: result, ids };
    }

    // Tree filtering
    const matchingRoots = new Set<string>();

    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      if (itemMatchesFilters(item, activeFilters, getDisplayValue)) {
        const id = item[idKey];
        if (id !== undefined && id !== null) {
          const rootId = treeStructure.rootIdByItemId.get(String(id));
          if (rootId) {
            matchingRoots.add(rootId);
          }
        }
      }
    }

    // Pass 2: Build result in sorted order and collect IDs
    const result: T[] = [];
    const ids = new Set<string>();
    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      const id = item[idKey];
      if (id !== undefined && id !== null) {
        const rootId = treeStructure.rootIdByItemId.get(String(id));
        if (rootId && matchingRoots.has(rootId)) {
          ids.add(String(id));

          if (!compareFn) {
            result.push(item);
          } else {
            // Insert in sorted position during filtering
            insertSorted(result, item, compareFn);
          }
        }
      }
    }

    return { data: result, ids };
  }, [
    rawData,
    columnFilters,
    sortColumn,
    sortDirection,
    createSortComparator,
    treeStructure,
    treeConfig,
    getDisplayValue,
  ]);
}

// Binary search insertion to maintain sorted order
function insertSorted<T>(arr: T[], item: T, compareFn: (a: T, b: T) => number) {
  let low = 0;
  let high = arr.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (compareFn(arr[mid], item) <= 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  arr.splice(low, 0, item);
}
