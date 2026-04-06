import { renderHook } from "@testing-library/react";
import { useFilteredAndSortedData } from "../useFilteredAndSortedData";
import { GridColumn } from "@glideapps/glide-data-grid";
import { describe, it, expect, beforeEach } from "vitest";
import { TreeGridConfig, TreeStructure } from "../useTreeStructure.ts";

/**
 * @vitest-environment happy-dom
 */

// Test data structure
interface TestItem {
  id: string;
  name: string;
  category: string;
  value: number;
  depth: number;
  childIds: string[];
}

// Mock tree structure for testing
const createMockTreeStructure = (
  items: TestItem[],
): TreeStructure<TestItem> => {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const parentMap = new Map<string, string>();
  const childrenByParentId = new Map<string, string[]>();
  const rootIdByItemId = new Map<string, string>();

  // First pass: populate childrenByParentId and parentMap
  items.forEach((item) => {
    // ensure an array entry even if no children
    childrenByParentId.set(item.id, item.childIds ? [...item.childIds] : []);
    (item.childIds || []).forEach((childId) => {
      parentMap.set(childId, item.id);
    });
  });

  // Determine roots (items with no parent). Also include items whose depth === 0 if present.
  const rootSet = new Set<string>();
  items.forEach((item) => {
    if (!parentMap.has(item.id) || item.depth === 0) {
      rootSet.add(item.id);
    }
  });
  const rootItemIds = Array.from(rootSet);

  // Compute root id for every item by walking up parentMap
  items.forEach((item) => {
    let current = item.id;
    let root = current;
    while (parentMap.has(current)) {
      current = parentMap.get(current)!;
      root = current;
    }
    rootIdByItemId.set(item.id, root);
  });

  // helper - ancestors
  const getAncestors = (id: string) => {
    const ancestors: string[] = [];
    let current = parentMap.get(id);
    while (current) {
      ancestors.push(current);
      current = parentMap.get(current);
    }
    return ancestors;
  };

  // helper - descendants (recursive, closed over childrenByParentId)
  const getDescendants = (id: string) => {
    const results: string[] = [];
    const collect = (cur: string) => {
      const children = childrenByParentId.get(cur) || [];
      for (const c of children) {
        results.push(c);
        collect(c);
      }
    };
    collect(id);
    return results;
  };

  return {
    itemsById,
    parentMap,
    childrenByParentId,
    rootItemIds,
    rootIdByItemId,
    hasChildren: (id: string) => (childrenByParentId.get(id) || []).length > 0,
    getAncestors,
    getDescendants,
  };
};

const mockTreeConfig: TreeGridConfig = {
  isTreeGrid: true,
  depthAccessor: "depth",
  childIdsAccessor: "childIds",
  treeColumnKey: "name",
};

const createTestData = (): TestItem[] => [
  // Root items
  {
    id: "root1",
    name: "Root Alpha",
    category: "A",
    value: 100,
    depth: 0,
    childIds: ["child1", "child2"],
  },
  {
    id: "root2",
    name: "Root Beta",
    category: "B",
    value: 200,
    depth: 0,
    childIds: ["child3"],
  },
  {
    id: "root3",
    name: "Root Gamma",
    category: "A",
    value: 150,
    depth: 0,
    childIds: [],
  },

  // Child items
  {
    id: "child1",
    name: "Child Alpha1",
    category: "A",
    value: 50,
    depth: 1,
    childIds: [],
  },
  {
    id: "child2",
    name: "Child Beta1",
    category: "B",
    value: 75,
    depth: 1,
    childIds: [],
  },
  {
    id: "child3",
    name: "Child Alpha2",
    category: "A",
    value: 25,
    depth: 1,
    childIds: [],
  },
];

const mockGetDisplayValue = (item: TestItem, fieldId: string): string => {
  switch (fieldId) {
    case "name":
      return item.name;
    case "category":
      return item.category;
    case "value":
      return item.value.toString();
    default:
      return "";
  }
};

const createMockSortComparator = (
  column: GridColumn,
  direction: "asc" | "desc",
) => {
  return (a: TestItem, b: TestItem) => {
    let aVal: any;
    let bVal: any;

    switch (column.id) {
      case "name":
        aVal = a.name;
        bVal = b.name;
        break;
      case "category":
        aVal = a.category;
        bVal = b.category;
        break;
      case "value":
        aVal = a.value;
        bVal = b.value;
        break;
      default:
        return 0;
    }

    let result = 0;
    if (typeof aVal === "string" && typeof bVal === "string") {
      result = aVal.localeCompare(bVal);
    } else if (typeof aVal === "number" && typeof bVal === "number") {
      result = aVal - bVal;
    }

    return direction === "desc" ? -result : result;
  };
};

describe("useFilteredAndSortedData", () => {
  describe("Basic functionality", () => {
    it("should return original data when no filters or sorting", () => {
      const testData = createTestData();
      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          {},
          undefined,
          "asc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          mockGetDisplayValue,
        ),
      );

      expect(result.current.data).toEqual(testData);
      expect(result.current.data).toHaveLength(6);
      expect(result.current.ids).toBeInstanceOf(Set);
      expect(result.current.ids.size).toBe(6);
      expect(Array.from(result.current.ids)).toEqual(
        expect.arrayContaining([
          "root1",
          "root2",
          "root3",
          "child1",
          "child2",
          "child3",
        ]),
      );
    });

    it("should handle empty data array", () => {
      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          [],
          {},
          undefined,
          "asc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          mockGetDisplayValue,
        ),
      );

      expect(result.current.data).toEqual([]);
      expect(result.current.ids).toBeInstanceOf(Set);
      expect(result.current.ids.size).toBe(0);
    });

    it("should filter data based on column filters", () => {
      const testData = createTestData();
      const columnFilters = { category: { val: "A", disabled: false } };

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          undefined,
          "asc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      expect(data).toHaveLength(4); // root1, root3, child1, child3
      expect(data.every((item) => item.category === "A")).toBe(true);
      expect(ids.size).toBe(4);
      expect(Array.from(ids)).toEqual(
        expect.arrayContaining(["root1", "root3", "child1", "child3"]),
      );
    });

    it("should sort data when sort column is provided", () => {
      const testData = createTestData();
      const sortColumn: GridColumn = {
        id: "name",
        title: "Name",
      } as GridColumn;

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          {},
          sortColumn,
          "asc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      expect(data).toHaveLength(6);
      expect(ids.size).toBe(6);

      // Check if sorted alphabetically by name
      for (let i = 0; i < data.length - 1; i++) {
        expect(
          data[i].name.localeCompare(data[i + 1].name),
        ).toBeLessThanOrEqual(0);
      }
    });

    it("should sort data in descending order", () => {
      const testData = createTestData();
      const sortColumn: GridColumn = {
        id: "value",
        title: "Value",
      } as GridColumn;

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          {},
          sortColumn,
          "desc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      expect(data).toHaveLength(6);
      expect(ids.size).toBe(6);

      // Check if sorted by value in descending order
      for (let i = 0; i < data.length - 1; i++) {
        expect(data[i].value).toBeGreaterThanOrEqual(data[i + 1].value);
      }
    });

    it("should filter and sort combined", () => {
      const testData = createTestData();
      const columnFilters = { category: { val: "A", disabled: false } };
      const sortColumn: GridColumn = {
        id: "value",
        title: "Value",
      } as GridColumn;

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          sortColumn,
          "desc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      expect(data).toHaveLength(4);
      expect(data.every((item) => item.category === "A")).toBe(true);
      expect(ids.size).toBe(4);

      // Check if sorted by value in descending order
      for (let i = 0; i < data.length - 1; i++) {
        expect(data[i].value).toBeGreaterThanOrEqual(data[i + 1].value);
      }
    });
  });

  describe("Filtering behavior", () => {
    it("should perform case-insensitive filtering", () => {
      const testData = createTestData();
      const columnFilters = { name: { val: "ALPHA", disabled: false } }; // Uppercase filter

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          undefined,
          "asc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      expect(data).toHaveLength(3); // Should match "Alpha" items
      expect(
        data.every((item) => item.name.toLowerCase().includes("alpha")),
      ).toBe(true);
      expect(ids.size).toBe(3);
    });

    it("should filter with multiple criteria", () => {
      const testData = createTestData();
      const columnFilters = {
        category: { val: "A", disabled: false },
        name: { val: "Root", disabled: false },
      };

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          undefined,
          "asc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      expect(data).toHaveLength(2); // root1 and root3
      expect(
        data.every(
          (item) => item.category === "A" && item.name.includes("Root"),
        ),
      ).toBe(true);
      expect(ids.size).toBe(2);
      expect(Array.from(ids)).toEqual(
        expect.arrayContaining(["root1", "root3"]),
      );
    });

    it("should ignore empty or whitespace-only filters", () => {
      const testData = createTestData();
      const columnFilters = {
        name: { val: "     ", disabled: false },
        category: { val: "A", disabled: false },
      };

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          undefined,
          "asc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      // Only the 'category' filter should be active, white space is ignored
      expect(data).toHaveLength(4);
      expect(ids.size).toBe(4);
    });
  });

  describe("Tree filtering", () => {
    let treeStructure: TreeStructure<TestItem>;

    beforeEach(() => {
      const testData = createTestData();
      treeStructure = createMockTreeStructure(testData);
    });

    it("should include entire root tree when any descendant matches filter", () => {
      const testData = createTestData();
      const columnFilters = { name: { val: "Child Alpha1", disabled: false } }; // Matches only one child

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          undefined,
          "asc",
          createMockSortComparator,
          treeStructure,
          "id",
          mockTreeConfig,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      // Should include root1, child1, child2 (entire root1 tree)
      const rootIds = data
        .map((item) => treeStructure.rootIdByItemId.get(item.id))
        .filter(Boolean);
      expect(new Set(rootIds)).toEqual(new Set(["root1"]));

      // Should include items from root1 tree
      const root1Items = data.filter(
        (item) => treeStructure.rootIdByItemId.get(item.id) === "root1",
      );
      expect(root1Items).toHaveLength(3); // root1, child1, child2
      expect(ids.size).toBe(3);
    });

    it("should include multiple root trees when items in different trees match", () => {
      const testData = createTestData();
      const columnFilters = { category: { val: "A", disabled: false } }; // Matches items in multiple trees

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          undefined,
          "asc",
          createMockSortComparator,
          treeStructure,
          "id",
          mockTreeConfig,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      const rootIds = [
        ...new Set(
          data
            .map((item) => treeStructure.rootIdByItemId.get(item.id))
            .filter(Boolean),
        ),
      ];

      // Should include root1 (has child1 with category A) and root2 (has child3 with category A) and root3 (category A)
      expect(rootIds).toContain("root1");
      expect(rootIds).toContain("root2");
      expect(rootIds).toContain("root3");
      expect(ids.size).toBeGreaterThan(0);
    });

    it("should maintain sorting within tree filtering", () => {
      const testData = createTestData();
      const columnFilters = { category: { val: "A", disabled: false } };
      const sortColumn: GridColumn = {
        id: "value",
        title: "Value",
      } as GridColumn;

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          sortColumn,
          "desc",
          createMockSortComparator,
          treeStructure,
          "id",
          mockTreeConfig,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      expect(data.length).toBeGreaterThan(0);
      expect(ids.size).toBeGreaterThan(0);

      // Should be sorted by value in descending order
      for (let i = 0; i < data.length - 1; i++) {
        expect(data[i].value).toBeGreaterThanOrEqual(data[i + 1].value);
      }
    });

    it("should return empty array when no tree items match filters", () => {
      const testData = createTestData();
      const columnFilters = { name: { val: "NonExistent", disabled: false } };

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          undefined,
          "asc",
          createMockSortComparator,
          treeStructure,
          "id",
          mockTreeConfig,
          mockGetDisplayValue,
        ),
      );

      expect(result.current.data).toEqual([]);
      expect(result.current.ids.size).toBe(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle null tree structure gracefully", () => {
      const testData = createTestData();
      const columnFilters = { category: { val: "A", disabled: false } };

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          undefined,
          "asc",
          createMockSortComparator,
          null,
          "id",
          mockTreeConfig,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      expect(data).toHaveLength(4); // Normal filtering without tree logic
      expect(ids.size).toBe(4);
    });

    it("should handle undefined tree config gracefully", () => {
      const testData = createTestData();
      const treeStructure = createMockTreeStructure(testData);
      const columnFilters = { category: { val: "A", disabled: false } };

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          undefined,
          "asc",
          createMockSortComparator,
          treeStructure,
          "id",
          undefined,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      expect(data).toHaveLength(4); // Normal filtering without tree logic
      expect(ids.size).toBe(4);
    });

    it("should handle items with null/undefined ids in tree mode", () => {
      const testDataWithNulls = [
        ...createTestData(),
        {
          id: null as any,
          name: "Null ID",
          category: "A",
          value: 999,
          depth: 0,
          childIds: [],
        },
      ];
      const treeStructure = createMockTreeStructure(createTestData()); // Structure without null item
      const columnFilters = { category: { val: "A", disabled: false } };

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testDataWithNulls,
          columnFilters,
          undefined,
          "asc",
          createMockSortComparator,
          treeStructure,
          "id",
          mockTreeConfig,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      // Should handle the null ID item gracefully (likely excluded from tree logic)
      expect(data.length).toBeGreaterThan(0);
      expect(ids).toBeInstanceOf(Set);
    });

    it("should handle getDisplayValue returning empty string", () => {
      const testData = createTestData();
      const mockGetDisplayValueEmpty = () => "";
      const columnFilters = { name: { val: "anything", disabled: false } };

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          undefined,
          "asc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          mockGetDisplayValueEmpty,
        ),
      );

      expect(result.current.data).toEqual([]); // No matches since all display values are empty
      expect(result.current.ids.size).toBe(0);
    });
  });

  describe("ID collection functionality", () => {
    it("should collect IDs using treeIdKey when available", () => {
      const testData = createTestData();

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          {},
          undefined,
          "asc",
          createMockSortComparator,
          null,
          "id",
          mockTreeConfig,
          mockGetDisplayValue,
        ),
      );

      const { ids } = result.current;
      expect(ids.size).toBe(6);
      expect(Array.from(ids)).toEqual(
        expect.arrayContaining([
          "root1",
          "root2",
          "root3",
          "child1",
          "child2",
          "child3",
        ]),
      );
    });

    it('should fallback to "id" field when treeConfig is not available', () => {
      const testData = createTestData();

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          {},
          undefined,
          "asc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          mockGetDisplayValue,
        ),
      );

      const { ids } = result.current;
      expect(ids.size).toBe(6);
      expect(Array.from(ids)).toEqual(
        expect.arrayContaining([
          "root1",
          "root2",
          "root3",
          "child1",
          "child2",
          "child3",
        ]),
      );
    });

    it("should handle items without IDs gracefully", () => {
      const testDataWithoutIds = [
        { name: "Item 1", category: "A", value: 100 },
        { id: "valid-id", name: "Item 2", category: "B", value: 200 },
        { id: null, name: "Item 3", category: "A", value: 300 },
        { id: undefined, name: "Item 4", category: "B", value: 400 },
      ] as unknown as TestItem[];

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testDataWithoutIds,
          {},
          undefined,
          "asc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          //@ts-expect-error
          (item, field) => String(item[field] || ""),
        ),
      );

      const { data, ids } = result.current;
      expect(data).toHaveLength(4);
      expect(ids.size).toBe(1); // Only 'valid-id' should be collected
      expect(Array.from(ids)).toEqual(["valid-id"]);
    });
  });

  describe("Memoization behavior", () => {
    it("should return same reference when inputs are unchanged", () => {
      const testData = createTestData();
      const columnFilters = {};
      const treeStructure = createMockTreeStructure(testData);

      const { result, rerender } = renderHook(
        ({
          data,
          filters,
          sortCol,
          sortDir,
          comparator,
          treeStruct,
          treeConf,
          getDisplay,
        }) =>
          useFilteredAndSortedData(
            data,
            filters,
            sortCol,
            sortDir,
            comparator,
            treeStruct,
            "id",
            treeConf,
            getDisplay,
          ),
        {
          initialProps: {
            data: testData,
            filters: columnFilters,
            sortCol: undefined as GridColumn | undefined,
            sortDir: "asc" as const,
            comparator: createMockSortComparator,
            treeStruct: treeStructure,
            treeConf: mockTreeConfig,
            getDisplay: mockGetDisplayValue,
          },
        },
      );

      const firstResult = result.current;

      // Rerender with same props
      rerender({
        data: testData,
        filters: columnFilters,
        sortCol: undefined,
        sortDir: "asc" as const,
        comparator: createMockSortComparator,
        treeStruct: treeStructure,
        treeConf: mockTreeConfig,
        getDisplay: mockGetDisplayValue,
      });

      expect(result.current).toBe(firstResult); // Same reference due to memoization
    });

    it("should recalculate when data changes", () => {
      const testData1 = createTestData();
      const testData2 = [
        ...testData1,
        {
          id: "new",
          name: "New Item",
          category: "C",
          value: 300,
          depth: 0,
          childIds: [],
        },
      ];
      const columnFilters = {};

      const { result, rerender } = renderHook(
        ({ data }) =>
          useFilteredAndSortedData(
            data,
            columnFilters,
            undefined,
            "asc",
            createMockSortComparator,
            null,
            "id",
            undefined,
            mockGetDisplayValue,
          ),
        { initialProps: { data: testData1 } },
      );

      const firstResult = result.current;

      rerender({ data: testData2 });

      expect(result.current).not.toBe(firstResult);
      expect(result.current.data).toHaveLength(7); // One more item
      expect(result.current.ids.size).toBe(7);
    });

    it("should recalculate when filters change", () => {
      const testData = createTestData();
      const filters1 = {};
      const filters2 = { category: { val: "A", disabled: false } };

      const { result, rerender } = renderHook(
        ({ filters }) =>
          useFilteredAndSortedData(
            testData,
            filters,
            undefined,
            "asc",
            createMockSortComparator,
            null,
            "id",
            undefined,
            mockGetDisplayValue,
          ),
        { initialProps: { filters: filters1 } },
      );

      const firstResult = result.current;

      rerender({ filters: filters2 });

      expect(result.current).not.toBe(firstResult);
      expect(result.current.data.length).toBeLessThan(testData.length); // Filtered result
      expect(result.current.ids.size).toBeLessThan(testData.length);
    });

    it("should recalculate when sort configuration changes", () => {
      const testData = createTestData();
      const sortCol1: GridColumn | undefined = undefined;
      const sortCol2: GridColumn = { id: "name", title: "Name" } as GridColumn;

      const { result, rerender } = renderHook(
        ({ sortCol }) =>
          useFilteredAndSortedData(
            testData,
            {},
            sortCol,
            "asc",
            createMockSortComparator,
            null,
            "id",
            undefined,
            mockGetDisplayValue,
          ),
        { initialProps: { sortCol: sortCol1 } },
      );

      const firstResult = result.current;

      //@ts-expect-error
      rerender({ sortCol: sortCol2 });

      expect(result.current).not.toBe(firstResult);
      expect(result.current.ids.size).toBe(firstResult.ids.size); // Same items, different order
      // Results should be in different order
    });
  });

  describe("Performance optimization", () => {
    it("should maintain sorted order during filtering (insertSorted)", () => {
      const testData = createTestData();
      const columnFilters = { category: { val: "A", disabled: false } };
      const sortColumn: GridColumn = {
        id: "value",
        title: "Value",
      } as GridColumn;

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          sortColumn,
          "asc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;
      expect(data.length).toBeGreaterThan(1);
      expect(ids.size).toBe(data.length);

      // Verify sorted order is maintained
      for (let i = 0; i < data.length - 1; i++) {
        expect(data[i].value).toBeLessThanOrEqual(data[i + 1].value);
      }
    });

    it("should not sort when no sort column is provided", () => {
      const testData = createTestData();
      const columnFilters = { category: { val: "A", disabled: false } };

      const { result } = renderHook(() =>
        useFilteredAndSortedData(
          testData,
          columnFilters,
          undefined,
          "asc",
          createMockSortComparator,
          null,
          "id",
          undefined,
          mockGetDisplayValue,
        ),
      );

      const { data, ids } = result.current;

      // Should maintain original order of items that match the filter
      const originalFiltered = testData.filter((item) => item.category === "A");
      expect(data.map((item) => item.id)).toEqual(
        originalFiltered.map((item) => item.id),
      );
      expect(ids.size).toBe(originalFiltered.length);
    });
  });
});
